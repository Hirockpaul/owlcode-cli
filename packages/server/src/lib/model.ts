import {google} from "@ai-sdk/google"
import{groq} from "@ai-sdk/groq"
import {
    findSupportedChatModel,
    type SupportedChatModel,
    type SupportedChatModelId,
    type SupportedProvider,
} from "@owlcode/shared"
import type{LanguageModel} from "ai";

type GoogleModelId = Extract<SupportedChatModel,{ provider: "google" }>["id"];
type GroqModelId = Extract<SupportedChatModel,{ provider: "groq" }>["id"];

export type ResolvedModel = {
    model:LanguageModel;
    provider:SupportedProvider;
    modelId: SupportedChatModelId
}

function assertUnsupportedProvider(provider: never): never {
    throw new Error(`Unsupported provider: ${provider}`);
}

function resolveGoogleModel(modelId: GoogleModelId): ResolvedModel {
    return {
        model: google(modelId ),
        provider: "google",
        modelId,
    };
}

function resolveGroqModel(modelId: GroqModelId): ResolvedModel {
    return {
        model: groq(modelId as unknown as string),
        provider: "groq",
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