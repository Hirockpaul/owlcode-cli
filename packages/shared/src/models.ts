export type ModelPricing = {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
};

export type SupportedProvider =
  | "google"
  | "groq"
  | "nvidia";

export type ModelCapabilities = {
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  reasoning: boolean;
  systemMessages: boolean;
};

type SupportedChatModelDefinition = {
  id: string;
  name: string;
  provider: SupportedProvider;
  pricing: ModelPricing;
  capabilities?: ModelCapabilities;
};

export const SUPPORTED_CHAT_MODELS = [
  // Google
  {
  id: "gemini-3-flash-preview",
  name: "Gemini 3 Flash Preview",
  provider: "google",
  pricing: {
    inputUsdPerMillionTokens: 0,
    outputUsdPerMillionTokens: 0,
  },
},

  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    pricing: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
    },
  },
  // Groq
  {
  id: "openai/gpt-oss-120b",
  name: "GPT OSS 120B",
  provider: "groq",
  pricing: {
    inputUsdPerMillionTokens: 0,
    outputUsdPerMillionTokens: 0,
  },
},
  // NVIDIA NIM hosted API
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    name: "NVIDIA Nemotron 3 Ultra",
    provider: "nvidia",
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      reasoning: true,
      systemMessages: true,
    },
    pricing: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
    },
  },
] as const satisfies readonly SupportedChatModelDefinition[];

export type SupportedChatModel =
  (typeof SUPPORTED_CHAT_MODELS)[number];

export type SupportedChatModelId =
  SupportedChatModel["id"];

export function findSupportedChatModel(
  modelId: string
) {
  return SUPPORTED_CHAT_MODELS.find(
    (model) => model.id === modelId
  );
}

export const DEFAULT_CHAT_MODEL_ID: SupportedChatModelId =
  "openai/gpt-oss-120b";
