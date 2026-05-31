export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionOptions = {
  temperature?: number;
  maxTokens?: number;
};

type AiProviderConfig = {
  name: "sub2api" | "deepseek";
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getTimeoutMs() {
  const parsed = Number.parseInt(process.env.AI_TIMEOUT_MS || "30000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
}

function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs = getTimeoutMs()) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return operation(controller.signal).finally(() => clearTimeout(timeout));
}

function getProviderConfigs() {
  const baseUrl = process.env.SUB2API_BASE_URL || "http://127.0.0.1:8080";
  const apiKey = process.env.SUB2API_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.SUB2API_MODEL || "gpt-5.5";
  const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
  const deepSeekBaseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const deepSeekModel = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const providers: AiProviderConfig[] = [];

  if (apiKey) {
    providers.push({
      apiKey,
      baseUrl: normalizeBaseUrl(baseUrl),
      label: "Sub2API",
      model,
      name: "sub2api"
    });
  }

  if (deepSeekApiKey) {
    providers.push({
      apiKey: deepSeekApiKey,
      baseUrl: normalizeBaseUrl(deepSeekBaseUrl),
      label: "DeepSeek",
      model: deepSeekModel,
      name: "deepseek"
    });
  }

  if (providers.length === 0) {
    throw new Error("缺少 AI API 密钥，请配置 SUB2API_API_KEY 或 DEEPSEEK_API_KEY。");
  }

  return providers;
}

async function createChatCompletionWithProvider(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
) {
  const response = await withTimeout((signal) =>
    fetch(`${provider.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"
    },
    signal,
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens
    })
    })
  );

  const data = (await response.json().catch(() => ({}))) as ChatCompletionResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || `${provider.label} 请求失败：HTTP ${response.status}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`${provider.label} 没有返回有效内容。`);
  }

  return content;
}

function normalizeAiError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "请求超时。";
    }

    return error.message;
  }

  return "未知错误。";
}

export async function createChatCompletion(messages: ChatMessage[], options: ChatCompletionOptions = {}) {
  const providers = getProviderConfigs();
  let lastError: unknown;

  for (const provider of providers) {
    try {
      return await createChatCompletionWithProvider(provider, messages, options);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`AI 请求失败：${normalizeAiError(lastError)}`);
}

async function fetchStream(provider: AiProviderConfig, messages: ChatMessage[], options: ChatCompletionOptions = {}) {
  const response = await withTimeout((signal) =>
    fetch(`${provider.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"
    },
    signal,
    body: JSON.stringify({
      model: provider.model,
      messages,
      stream: true,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens
    })
    })
  );

  if (!response.ok || !response.body) {
    throw new Error(`${provider.label} 流式请求失败：HTTP ${response.status}`);
  }

  return response as Response & { body: ReadableStream<Uint8Array> };
}

async function readWithTimeout<T>(operation: () => Promise<T>, timeoutMs = getTimeoutMs()) {
  let timeout: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("等待模型输出超时。")), timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

async function* streamChatCompletionWithProvider(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
) {
  const response = await fetchStream(provider, messages, options);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasYielded = false;

  while (true) {
    const { done, value } = hasYielded ? await reader.read() : await readWithTimeout(() => reader.read());
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string;
            };
          }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          hasYielded = true;
          yield delta;
        }
      } catch {
        // Ignore malformed SSE fragments and continue streaming.
      }
    }
  }
}

export async function* streamChatCompletion(messages: ChatMessage[], options: ChatCompletionOptions = {}) {
  const providers = getProviderConfigs();
  let lastError: unknown;

  for (const provider of providers) {
    let hasEmitted = false;

    try {
      for await (const delta of streamChatCompletionWithProvider(provider, messages, options)) {
        hasEmitted = true;
        yield delta;
      }

      return;
    } catch (error) {
      if (hasEmitted) {
        throw new Error(`${provider.label} 已开始输出后中断：${normalizeAiError(error)} 请重新发送，系统会重新选择可用模型。`);
      }

      lastError = error;
    }
  }

  throw new Error(`AI 流式请求失败：${normalizeAiError(lastError)}`);
}
