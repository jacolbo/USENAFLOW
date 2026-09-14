// OpenAI credential resolution.
//
// Two sources, checked in this order:
//
//   1. OPENAI_API_KEY - a first-party OpenAI key. baseURL is left undefined so
//      the SDK uses its own default (https://api.openai.com/v1), which works on
//      any host.
//   2. AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL -
//      Replit's AI Integrations proxy, the original path, kept as a fallback.
//
// Same env-var-first shape as googleAuth.ts and emailService.ts: setting
// OPENAI_API_KEY is all that is needed to cut this integration over.

export interface OpenAIConfig {
  apiKey: string | undefined;
  baseURL: string | undefined;
}

export function getOpenAIConfig(): OpenAIConfig {
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    };
  }

  return {
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  };
}

/** Which source is active - used by the /health diagnostics. */
export function describeOpenAIMode(): string {
  return process.env.OPENAI_API_KEY
    ? 'first-party OpenAI (OPENAI_API_KEY)'
    : 'Replit AI Integrations proxy';
}
