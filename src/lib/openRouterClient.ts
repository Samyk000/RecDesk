import { useOpenRouterStore, type OpenRouterModel, DEFAULT_FREE_MODEL } from "../store/openRouterStore";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

/**
 * Fetches the live model catalog from OpenRouter, identifying free models.
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "HTTP-Referer": "https://recdesk.app",
        "X-Title": "RecDesk",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch models from OpenRouter: HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawList: any[] = data?.data || [];

    const mapped: OpenRouterModel[] = rawList.map((m) => {
      const isFree =
        m.id?.endsWith(":free") ||
        (m.pricing?.prompt === "0" && m.pricing?.completion === "0") ||
        (m.pricing?.prompt === 0 && m.pricing?.completion === 0);

      return {
        id: m.id,
        name: m.name || m.id,
        description: m.description || "",
        context_length: m.context_length || 4096,
        pricing: {
          prompt: String(m.pricing?.prompt ?? "0"),
          completion: String(m.pricing?.completion ?? "0"),
        },
        is_free: Boolean(isFree),
      };
    });

    // Sort: Free models first, then alphabetically by name
    mapped.sort((a, b) => {
      if (a.is_free && !b.is_free) return -1;
      if (!a.is_free && b.is_free) return 1;
      return a.name.localeCompare(b.name);
    });

    useOpenRouterStore.getState().setModelsCache(mapped);
    return mapped;
  } catch (err: any) {
    console.error("Failed to fetch OpenRouter models:", err);
    throw err;
  }
}

/**
 * Validates an OpenRouter API key by making a lightweight request.
 */
export async function testOpenRouterConnection(apiKey: string): Promise<boolean> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error("API key cannot be empty.");
  }

  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      "HTTP-Referer": "https://recdesk.app",
      "X-Title": "RecDesk",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Invalid API Key (HTTP ${res.status})`
    );
  }

  return true;
}

const FREE_MODEL_FALLBACKS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "mistralai/mistral-small-24b-instruct-2501:free",
  "deepseek/deepseek-r1:free",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends chat completion to OpenRouter with automatic key rotation and model fallbacks.
 */
export async function completeOpenRouterChat(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<string> {
  const store = useOpenRouterStore.getState();
  const keys = store.apiKeys;

  if (keys.length === 0) {
    throw new Error(
      "No OpenRouter API key configured. Please add your OpenRouter API key in Settings."
    );
  }

  const primaryModel = options.model || store.selectedModel || DEFAULT_FREE_MODEL;

  const candidateModels = [
    primaryModel,
    ...FREE_MODEL_FALLBACKS.filter((m) => m !== primaryModel),
  ];

  let lastError: Error | null = null;

  for (const modelToTry of candidateModels) {
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const currentKey = store.getActiveApiKey() || keys[attempt];

      try {
        const payload: any = {
          model: modelToTry,
          messages,
          temperature: options.temperature ?? 0.1,
        };

        if (options.max_tokens) {
          payload.max_tokens = options.max_tokens;
        }

        if (options.response_format) {
          payload.response_format = options.response_format;
        }

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentKey}`,
            "HTTP-Referer": "https://recdesk.app",
            "X-Title": "RecDesk",
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return content;
          }
          throw new Error("Received empty completion from OpenRouter.");
        }

        const errorPayload = await res.json().catch(() => ({}));
        const errorMsg =
          errorPayload?.error?.message || `OpenRouter error HTTP ${res.status}`;

        if (res.status === 429 || res.status === 401) {
          console.warn(`Model ${modelToTry} rate-limited on key. Rotating key...`);
          if (keys.length > 1) {
            store.rotateApiKey(currentKey);
          }
          lastError = new Error(errorMsg);
          await sleep(350);
          continue;
        }

        lastError = new Error(errorMsg);
      } catch (err: any) {
        lastError = err;
        if (keys.length > 1) {
          store.rotateApiKey(currentKey);
        }
      }
    }
  }

  throw lastError || new Error("OpenRouter completion failed across all keys and models.");
}

/**
 * Sends chat completion to OpenRouter with real-time SSE streaming callback.
 */
export async function completeOpenRouterChatStream(
  messages: ChatMessage[],
  onToken: (token: string, accumulated: string) => void,
  options: CompletionOptions & { signal?: AbortSignal } = {}
): Promise<string> {
  const store = useOpenRouterStore.getState();
  const keys = store.apiKeys;

  if (keys.length === 0) {
    throw new Error(
      "No OpenRouter API key configured. Please add your OpenRouter API key in Settings."
    );
  }

  const primaryModel = options.model || store.selectedModel || DEFAULT_FREE_MODEL;

  const candidateModels = [
    primaryModel,
    ...FREE_MODEL_FALLBACKS.filter((m) => m !== primaryModel),
  ];

  let lastError: Error | null = null;

  for (const modelToTry of candidateModels) {
    for (let attempt = 0; attempt < keys.length; attempt++) {
      if (options.signal?.aborted) {
        throw new Error("Chat generation cancelled by user.");
      }

      const currentKey = store.getActiveApiKey() || keys[attempt];

      try {
        const payload: any = {
          model: modelToTry,
          messages,
          temperature: options.temperature ?? 0.1,
          stream: true,
        };

        if (options.max_tokens) {
          payload.max_tokens = options.max_tokens;
        }

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentKey}`,
            "HTTP-Referer": "https://recdesk.app",
            "X-Title": "RecDesk",
          },
          body: JSON.stringify(payload),
          signal: options.signal,
        });

        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";
          let buffer = "";

          while (true) {
            if (options.signal?.aborted) {
              await reader.cancel();
              return accumulated;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":")) continue;
              if (trimmed === "data: [DONE]") {
                return accumulated;
              }
              if (trimmed.startsWith("data: ")) {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const delta = json?.choices?.[0]?.delta?.content;
                  if (delta) {
                    accumulated += delta;
                    onToken(delta, accumulated);
                  }
                } catch {
                  // Ignore JSON parse chunk boundaries
                }
              }
            }
          }

          if (accumulated.trim().length > 0) {
            return accumulated;
          }
          throw new Error("Received empty streaming response from OpenRouter.");
        }

        const errorPayload = await res.json().catch(() => ({}));
        const errorMsg =
          errorPayload?.error?.message || `OpenRouter error HTTP ${res.status}`;

        if (res.status === 429 || res.status === 401) {
          console.warn(`Model ${modelToTry} rate-limited on key. Rotating key...`);
          if (keys.length > 1) {
            store.rotateApiKey(currentKey);
          }
          lastError = new Error(errorMsg);
          await sleep(350);
          continue;
        }

        lastError = new Error(errorMsg);
      } catch (err: any) {
        if (err.name === "AbortError" || options.signal?.aborted) {
          throw new Error("Chat generation cancelled by user.");
        }
        lastError = err;
        if (keys.length > 1) {
          store.rotateApiKey(currentKey);
        }
      }
    }
  }

  throw lastError || new Error("OpenRouter streaming completion failed across all keys and models.");
}
