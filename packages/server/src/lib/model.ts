import {google} from "@ai-sdk/google"
import{groq} from "@ai-sdk/groq"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
    findSupportedChatModel,
    type SupportedChatModel,
    type SupportedChatModelId,
    type SupportedProvider,
} from "@owlcode/shared"
import {
    extractReasoningMiddleware,
    wrapLanguageModel,
    type LanguageModel,
} from "ai";

type ProviderOptions = Record<string, Record<string, any>>;

type GoogleModelId = Extract<SupportedChatModel,{ provider: "google" }>["id"];
type GroqModelId = Extract<SupportedChatModel,{ provider: "groq" }>["id"];
type NvidiaModelId = Extract<SupportedChatModel,{ provider: "nvidia" }>["id"];

const nvidia = createOpenAICompatible<NvidiaModelId, never, never, never>({
    name: "nvidia",
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.NVIDIA_API_KEY,
    includeUsage: true,
    supportsStructuredOutputs: true,
    transformRequestBody: (body) => ({
        ...body,
        chat_template_kwargs: {
            enable_thinking: true,
            force_nonempty_content: true,
        },
    }),
});

export type ResolvedModel = {
    model:LanguageModel;
    provider:SupportedProvider;
    modelId: SupportedChatModelId
    providerOptions?: ProviderOptions;
}

const GOOGLE_PROVIDER_OPTIONS: Partial<
  Record<GoogleModelId, ProviderOptions>
> = {
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
  "openai/gpt-oss-120b": {
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

function resolveNvidiaModel(modelId: NvidiaModelId): ResolvedModel {
    if (!process.env.NVIDIA_API_KEY) {
        throw new Error("NVIDIA_API_KEY is required to use NVIDIA models");
    }

    return {
        // Nemotron streams its reasoning in `content` and starts the response
        // inside the thinking block, so only the closing </think> tag is sent.
        model: wrapLanguageModel({
            model: nvidia(modelId),
            middleware: extractReasoningMiddleware({
                tagName: "think",
                startWithReasoning: true,
            }),
        }),
        provider: "nvidia",
        modelId,
    };
}

function resolveSupportedChatModel(model: SupportedChatModel) : ResolvedModel {
    const provider = model.provider

    switch(provider) {
        case "google": 
           return resolveGoogleModel(model.id);
        case "groq":
            return resolveGroqModel(model.id);
        case "nvidia":
            return resolveNvidiaModel(model.id);
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
