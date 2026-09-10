import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AiChatMessage, AiProposedAction, ChatLoadingStep } from "../types";
import { apiAi, apiAiChat } from "../lib/api";
import { completeOpenRouterChatStream, type ChatMessage } from "../lib/openRouterClient";
import { useOpenRouterStore } from "./openRouterStore";
import { extractPdfToHtml } from "../lib/pdfExtractor";
import mammoth from "mammoth";

interface ChatState {
  isOpen: boolean;
  messages: AiChatMessage[];
  input: string;
  loadingStep: ChatLoadingStep;
  loadingStepMessage: string;
  activeProvider: "openrouter" | "local";
  selectedLocalModelId: "qwen-1.5b" | "qwen-3b";
  selectedOpenRouterModel: string;
  abortController: AbortController | null;

  setIsOpen: (open: boolean) => void;
  openChat: (initialPrompt?: string, candidateId?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
  setInput: (input: string) => void;
  clearChat: () => void;
  setActiveProvider: (provider: "openrouter" | "local") => void;
  setSelectedLocalModelId: (modelId: "qwen-1.5b" | "qwen-3b") => void;
  setSelectedOpenRouterModel: (model: string) => void;
  stopGeneration: () => void;
  sendMessage: (customText?: string) => Promise<void>;
  askAboutCandidate: (candidateId: string, candidateName: string) => Promise<void>;
  updateMessageAction: (messageId: string, patch: Partial<AiProposedAction>) => void;
  uploadAndParseResume: (file: File) => Promise<void>;
}

const DEFAULT_WELCOME_MESSAGE: AiChatMessage = {
  id: "welcome-msg",
  role: "assistant",
  content:
    "Hello! I am your **RecDesk AI Assistant**. I have complete real-time access to your database and can also perform actions for you.\n\nTry asking me to:\n- ⚡ *\"Move Bilal Niazi to Interview stage\"*\n- 📅 *\"Create a reminder to call Rob tomorrow at 10 AM\"*\n- 📎 **Drag & drop a resume** right here to add candidate to database in 1-click\n- 🔍 *\"Who are all candidates in interview stage?\"*\n- 🏢 *\"Show all open job requisitions\"*",
  timestamp: Date.now(),
  suggestedFollowups: [
    "Who are all candidates in interview stage?",
    "Show all open job requisitions",
    "List 5 candidates from TX",
  ],
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      messages: [DEFAULT_WELCOME_MESSAGE],
      input: "",
      loadingStep: "idle",
      loadingStepMessage: "",
      activeProvider: "openrouter",
      selectedLocalModelId: "qwen-1.5b",
      selectedOpenRouterModel: "meta-llama/llama-3.3-70b-instruct:free",
      abortController: null,

      setIsOpen: (isOpen) => set({ isOpen }),
      openChat: (initialPrompt, candidateId) => {
        set({ isOpen: true });
        if (candidateId && initialPrompt) {
          get().sendMessage(initialPrompt);
        } else if (initialPrompt) {
          set({ input: initialPrompt });
        }
      },
      closeChat: () => set({ isOpen: false }),
      toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
      setInput: (input) => set({ input }),
      clearChat: () => {
        const controller = get().abortController;
        if (controller) {
          controller.abort();
        }
        set({
          messages: [
            {
              ...DEFAULT_WELCOME_MESSAGE,
              timestamp: Date.now(),
            },
          ],
          input: "",
          loadingStep: "idle",
          loadingStepMessage: "",
          abortController: null,
        });
      },

      setActiveProvider: (activeProvider) => set({ activeProvider }),
      setSelectedLocalModelId: (selectedLocalModelId) => set({ selectedLocalModelId }),
      setSelectedOpenRouterModel: (selectedOpenRouterModel) => {
        set({ selectedOpenRouterModel });
        useOpenRouterStore.getState().setSelectedModel(selectedOpenRouterModel);
      },

      stopGeneration: () => {
        const controller = get().abortController;
        if (controller) {
          controller.abort();
        }
        set({
          loadingStep: "idle",
          loadingStepMessage: "",
          abortController: null,
        });
      },

      updateMessageAction: (messageId, patch) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId && m.proposedAction
              ? {
                ...m,
                proposedAction: {
                  ...m.proposedAction,
                  ...patch,
                },
              }
              : m
          ),
        }));
      },

      uploadAndParseResume: async (file: File) => {
        const userMsgId = `user-resume-${Date.now()}`;
        const assistantMsgId = `assistant-resume-${Date.now() + 1}`;

        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: userMsgId,
              role: "user",
              content: `📄 Dropped resume file: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)`,
              timestamp: Date.now(),
            },
          ],
          loadingStep: "analyzing",
          loadingStepMessage: `Extracting text and profile from ${file.name}...`,
        }));

        try {
          let rawText = "";
          const fileNameLower = file.name.toLowerCase();

          if (fileNameLower.endsWith(".pdf")) {
            const arrayBuf = await file.arrayBuffer();
            const pdfResult = await extractPdfToHtml(new Uint8Array(arrayBuf));
            rawText = pdfResult.html.replace(/<[^>]*>/g, " ");
          } else if (fileNameLower.endsWith(".docx") || fileNameLower.endsWith(".doc")) {
            const arrayBuf = await file.arrayBuffer();
            const docxResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuf });
            rawText = docxResult.value.replace(/<[^>]*>/g, " ");
          } else {
            rawText = await file.text();
          }

          set({
            loadingStep: "retrieving",
            loadingStepMessage: "Parsing candidate skills, experience, and contact info...",
          });

          const profile = await apiAi.parseResume(rawText);

          const candidateAction: AiProposedAction = {
            id: `act-cand-${Date.now()}`,
            action_type: "create_candidate",
            title: `Add ${profile.name || "Candidate"} to RecDesk`,
            description: `Role: ${profile.current_role || "N/A"} • Exp: ${profile.experience_years ? profile.experience_years + " yrs" : "N/A"} • Location: ${profile.location || "N/A"}`,
            payload_json: JSON.stringify(profile),
            status: "pending",
          };

          const assistantContent = `### Resume Extracted: **${profile.name || "New Candidate"}**\n\nI parsed the details from **${file.name}**. Review the summary below and select an active job requisition to add this candidate to your database.\n\n- 👤 **Name:** **${profile.name}**\n- 🏢 **Role:** ${profile.current_role || "Not specified"}\n- 📍 **Location:** ${profile.location || "Not specified"}\n- ✉️ **Contact:** \`${profile.email || "N/A"}\` • \`${profile.phone || "N/A"}\`\n- ⏱️ **Experience:** ${profile.experience_years ? profile.experience_years + " years" : "N/A"}\n- 🛠️ **Skills:** ${profile.skills && profile.skills.length > 0 ? profile.skills.join(", ") : "Extracted from resume"}`;

          set((state) => ({
            messages: [
              ...state.messages,
              {
                id: assistantMsgId,
                role: "assistant",
                content: assistantContent,
                timestamp: Date.now(),
                proposedAction: candidateAction,
                suggestedFollowups: [
                  "Show all open job requisitions",
                  "Who are all candidates in interview stage?",
                ],
              },
            ],
            loadingStep: "idle",
            loadingStepMessage: "",
          }));
        } catch (err: any) {
          set((state) => ({
            messages: [
              ...state.messages,
              {
                id: assistantMsgId,
                role: "assistant",
                content: `⚠️ **Resume Extraction Notice**: Could not parse **${file.name}**: ${err?.message || String(err)}`,
                timestamp: Date.now(),
              },
            ],
            loadingStep: "idle",
            loadingStepMessage: "",
          }));
        }
      },

      askAboutCandidate: async (_candidateId: string, candidateName: string) => {
        const initialQuery = `Tell me everything about candidate ${candidateName} including interview feedback and status`;
        set({ isOpen: true });
        await get().sendMessage(initialQuery);
      },

      sendMessage: async (customText?: string) => {
        const state = get();
        const text = (customText ?? state.input).trim();
        if (!text) return;

        // Reset input immediately
        set({ input: "" });

        const userMsgId = `user-${Date.now()}`;
        const assistantMsgId = `assistant-${Date.now() + 1}`;

        const userMessage: AiChatMessage = {
          id: userMsgId,
          role: "user",
          content: text,
          timestamp: Date.now(),
        };

        const placeholderAssistantMessage: AiChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          isStreaming: true,
        };

        // Create AbortController for cancellation
        const abortController = new AbortController();

        set((s) => ({
          messages: [...s.messages, userMessage, placeholderAssistantMessage],
          loadingStep: "analyzing",
          loadingStepMessage: "Analyzing query & RecDesk context...",
          abortController,
        }));

        try {
          // 1. Retrieve structured context & proposed actions from local Rust SQLite engine
          set({
            loadingStep: "retrieving",
            loadingStepMessage: "Searching candidates, jobs, and pipeline...",
          });

          const contextPayload = await apiAiChat.getContext(text);

          set({
            loadingStep: "generating",
            loadingStepMessage:
              state.activeProvider === "openrouter"
                ? `Synthesizing with ${state.selectedOpenRouterModel.split("/").pop()}...`
                : `Synthesizing with ${state.selectedLocalModelId === "qwen-1.5b" ? "Qwen 1.5B" : "Qwen 3B"}...`,
          });

          let accumulatedContent = "";

          // If a natural language action is proposed, handle it immediately
          if (contextPayload.proposed_action) {
            accumulatedContent = contextPayload.context_markdown;

            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantMsgId
                  ? {
                    ...m,
                    content: accumulatedContent || m.content,
                    isStreaming: false,
                    sources: contextPayload.sources,
                    suggestedFollowups: contextPayload.suggested_followups,
                    proposedAction: contextPayload.proposed_action,
                  }
                  : m
              ),
              loadingStep: "idle",
              loadingStepMessage: "",
              abortController: null,
            }));
            return;
          }

          if (state.activeProvider === "openrouter") {
            const routerStore = useOpenRouterStore.getState();
            const hasKeys = routerStore.apiKeys.length > 0;

            const systemPrompt = `You are RecDesk AI Assistant, the built-in intelligent recruiting copilot in the RecDesk Desktop App.

CRITICAL INSTRUCTIONS & GROUNDING RULES:
1. You have direct access to the recruiter's local database via the structured context below.
2. Ground all answers strictly in the provided Context. If a candidate, job, or fact is NOT in the context, do NOT invent or hallucinate it.
3. Be conversational, helpful, and concise. Format lists with clean Markdown tables, bold headers, and bullet points.
4. When asked about candidates or jobs, reference their exact names, locations, and stages as given in the context.

CURRENT RETRIEVED RECDESK CONTEXT:
${contextPayload.context_markdown}
`;

            const historyMessages: ChatMessage[] = state.messages
              .filter((m) => m.content && !m.isStreaming && m.id !== assistantMsgId)
              .slice(-6)
              .map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
              }));

            const openAiMessages: ChatMessage[] = [
              { role: "system", content: systemPrompt },
              ...historyMessages,
            ];

            if (!hasKeys) {
              throw new Error(
                "No OpenRouter API key found. Please add your free/paid OpenRouter key in Settings (or switch to Local AI)."
              );
            }

            accumulatedContent = await completeOpenRouterChatStream(
              openAiMessages,
              (_token, currentAccumulated) => {
                set((s) => ({
                  messages: s.messages.map((m) =>
                    m.id === assistantMsgId
                      ? {
                        ...m,
                        content: currentAccumulated,
                        sources: contextPayload.sources,
                        suggestedFollowups: contextPayload.suggested_followups,
                        proposedAction: contextPayload.proposed_action || null,
                      }
                      : m
                  ),
                }));
              },
              {
                model: state.selectedOpenRouterModel,
                signal: abortController.signal,
                temperature: 0.15,
              }
            );
          } else {
            // Local AI Execution / Intelligent Synthesis
            const isCasual = contextPayload.intent_type === "casual";
            const isModelInfo = contextPayload.intent_type === "ai_model_info";
            const modelName =
              state.selectedLocalModelId === "qwen-1.5b"
                ? "Qwen 2.5 1.5B Instruct (Local • Fast & Private)"
                : "Qwen 2.5 3B Instruct (Local • High Precision)";

            if (isModelInfo) {
              accumulatedContent = `You are currently using **${modelName}**.\n\n**Key Details:**\n- **Model Type:** Local offline GGUF inference\n- **Capabilities:** Fast candidate retrieval, note summarization, open job filtering, interview tracking\n- **Alternative Models:** You can switch to **Qwen 3B** or **OpenRouter Cloud** (Llama 3.3 70B, Gemini 2.0 Flash) from the model selector in the top bar.`;
            } else if (isCasual) {
              accumulatedContent =
                "Hello! I am your **RecDesk AI Assistant** running locally on your device. I have direct access to your recruiter database and can perform actions. Ask me to find candidates, move candidate stages, add reminders, or drop a resume right here!";
            } else if (
              contextPayload.intent_type === "list_jobs" ||
              contextPayload.intent_type === "list_candidates" ||
              contextPayload.intent_type === "list_reminders" ||
              contextPayload.matched_entity_count > 0
            ) {
              accumulatedContent = contextPayload.context_markdown;
            } else {
              accumulatedContent = `I searched your workspace for **"${text}"**.\n\n${contextPayload.context_markdown}`;
            }

            // Simulate smooth chunked streaming for local output (low CPU overhead)
            let streamBuf = "";
            const words = accumulatedContent.split(" ");
            let i = 0;
            while (i < words.length) {
              if (abortController.signal.aborted) break;
              const chunkCount = Math.min(3, words.length - i);
              const chunk = words.slice(i, i + chunkCount).join(" ");
              streamBuf += (streamBuf ? " " : "") + chunk;
              i += chunkCount;

              set((s) => ({
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                      ...m,
                      content: streamBuf,
                      sources: contextPayload.sources,
                      suggestedFollowups: contextPayload.suggested_followups,
                      proposedAction: contextPayload.proposed_action || null,
                    }
                    : m
                ),
              }));
              await new Promise((r) => setTimeout(r, 20));
            }
          }

          // Finalize assistant message
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsgId
                ? {
                  ...m,
                  content: accumulatedContent || m.content,
                  isStreaming: false,
                  sources: contextPayload.sources,
                  suggestedFollowups: contextPayload.suggested_followups,
                  proposedAction: contextPayload.proposed_action || null,
                }
                : m
            ),
            loadingStep: "idle",
            loadingStepMessage: "",
            abortController: null,
          }));
        } catch (err: any) {
          const errorMsg = err?.message || String(err);
          const isCancelled = errorMsg.includes("cancelled");

          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsgId
                ? {
                  ...m,
                  content: isCancelled
                    ? m.content || "*(Generation stopped by user)*"
                    : `⚠️ **AI Chat Notice**: ${errorMsg}`,
                  isStreaming: false,
                }
                : m
            ),
            loadingStep: "idle",
            loadingStepMessage: "",
            abortController: null,
          }));
        }
      },
    }),
    {
      name: "recdesk-ai-chat-store",
      partialize: (state) => ({
        messages: state.messages.slice(-30), // persist last 30 messages
        activeProvider: state.activeProvider,
        selectedLocalModelId: state.selectedLocalModelId,
        selectedOpenRouterModel: state.selectedOpenRouterModel,
      }),
    }
  )
);
