export type ModelPricing = {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
};

export type SupportedProvider =
  | "google"
  | "groq";

type SupportedChatModelDefinition = {
  id: string;
  provider: SupportedProvider;
  pricing: ModelPricing;
};

export const SUPPORTED_CHAT_MODELS = [
  // Google
  {
  id: "gemini-3-flash-preview",
  provider: "google",
  pricing: {
    inputUsdPerMillionTokens: 0,
    outputUsdPerMillionTokens: 0,
  },
},

  {
    id: "gemini-2.5-flash",
    provider: "google",
    pricing: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
    },
  },
  // Groq
  {
  id: "openai/gpt-oss-120b",
  provider: "groq",
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
