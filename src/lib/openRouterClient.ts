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
  } catch (err) {
    console.error("OpenRouter model fetch error:", err);
    // Return cached list if available
    const cached = useOpenRouterStore.getState().modelsCache;
    if (cached.length > 0) return cached;
    throw err;
  }
}

/**
 * Validates an API key with OpenRouter
 */
export async function testOpenRouterConnection(apiKey: string): Promise<boolean> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) throw new Error("Please enter an OpenRouter API key.");

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
 * Sends chat completion to OpenRouter with automatic multi-key rotation and multi-model fallback on 429 rate limits.
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

  // Candidate models to try in order: primary model first, then fallback free models
  const candidateModels = [
    primaryModel,
    ...FREE_MODEL_FALLBACKS.filter((m) => m !== primaryModel),
  ];

  let lastError: Error | null = null;

  for (const modelToTry of candidateModels) {
    // Try across all configured keys for this model
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const currentKey = store.getActiveApiKey() || keys[attempt];

      try {
        const payload: any = {
          model: modelToTry,
          messages,
          temperature: options.temperature ?? 0.05,
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

        // If rate-limited (429) or unauthorized (401), rotate key and pause briefly
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
