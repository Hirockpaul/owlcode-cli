import {google} from "@ai-sdk/google"
import{groq} from "@ai-sdk/groq"
import {
    findSupportedChatModel,
    type SupportedChatModel,
    type SupportedChatModelId,
    type SupportedProvider,
} from "@owlcode/shared"
import type{LanguageModel} from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";

type GoogleModelId = Extract<SupportedChatModel,{ provider: "google" }>["id"];
type GroqModelId = Extract<SupportedChatModel,{ provider: "groq" }>["id"];

export type ResolvedModel = {
    model:LanguageModel;
    provider:SupportedProvider;
    modelId: SupportedChatModelId
    providerOptions?: ProviderOptions;
}

const GOOGLE_PROVIDER_OPTIONS: Partial<
  Record<GoogleModelId, ProviderOptions>
> = {
  "gemini-2.5-pro": {
    google: {
      thinkingConfig: {
        thinkingBudget: 1000,
      },
    },
  },

  "gemini-2.5-flash": {
    google: {
      thinkingConfig: {
        thinkingBudget: 1000,
      },
    },
  },

  "gemini-3-flash-preview": {
    google: {
      thinkingConfig: {
        thinkingBudget: 1000,
      },
    },
  },
};

const GROQ_PROVIDER_OPTIONS: Partial<Record<GroqModelId, ProviderOptions>> = {
  "llama-3.3-70b-versatile": {
    groq: { temperature: 0.6 },
  },
  "llama-3.1-8b-instant": {
    groq: { temperature: 0.6 },
  },
  "openai/gpt-oss-120b": {
    groq: { temperature: 0.6 },
  },
  "meta-llama/llama-4-scout-17b-16e-instruct": {
    groq: { temperature: 0.6 },
  },
};

function assertUnsupportedProvider(provider: never): never {
    throw new Error(`Unsupported provider: ${provider}`);
}

function resolveGoogleModel(modelId: GoogleModelId): ResolvedModel {
    return {
        model: google(modelId ),
        provider: "google",
        modelId,
        providerOptions: GOOGLE_PROVIDER_OPTIONS[modelId],
    };
}

function resolveGroqModel(modelId: GroqModelId): ResolvedModel {
    return {
        model: groq(modelId as unknown as string),
        provider: "groq",
        modelId,
        providerOptions: GROQ_PROVIDER_OPTIONS[modelId],
    };
}

function resolveSupportedChatModel(model: SupportedChatModel) : ResolvedModel {
    const provider = model.provider

    switch(provider) {
        case "google": 
           return resolveGoogleModel(model.id);
        case "groq":
            return resolveGroqModel(model.id);
        default:
            return assertUnsupportedProvider(provider)          
    }
}

export function isSupportedChatModel(modelId:string) : modelId is SupportedChatModelId {
    return findSupportedChatModel(modelId) != null;
}

export function resolveChatModel(modelId:string) :ResolvedModel {
    const model = findSupportedChatModel(modelId);
    if(!model) {
        throw new Error(`Unsupported model: ${modelId}`);
    }
    
    return resolveSupportedChatModel(model);
}