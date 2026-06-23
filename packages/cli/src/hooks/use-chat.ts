import { useState, useRef,useCallback,useEffect } from "react";
import {EventSourceParserStream} from "eventsource-parser/stream"
import prettyMs from "pretty-ms";
import type { ClientResponse } from "hono/client";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import type { Mode } from "@owlcode/database/enums";
import{
    chatStreamEventSchema,
    type SupportedChatModelId
} from "@owlcode/shared"
import { requestId } from "hono/request-id";

export type ClientMessagePart = { type: "text"; text: string};

export type Message = 
 | {id: string;
    role:"user";
     content: string;
     mode:Mode;
     model:SupportedChatModelId}
 | {
    id:String;
    role:"assistant";
    conttent:string;
    mode: Mode;
    model: SupportedChatModelId;
    parts: ClientMessagePart[];
    duration?:string;
 }
| {id:string; role: "error"; content: string};

type StreamingState = 
| {status: "idle"}
| {
    status: "streaming";
    parts:  ClientMessagePart[];
    mode: Mode;
    model: SupportedChatModelId
}

type ActiveStream = {
    requestId: string;
    controller: AbortController;
    mode:Mode;
    model:SupportedChatModelId;
    parts: ClientMessagePart[];
};

type SubmitParams = {
    userText : string;
    mode : Mode;
    model: SupportedChatModelId
};

type RunStreamParams = {
    mode: Mode;
    model: SupportedChatModelId;
    request: (controller: AbortController) => Promise<ClientResponse<unknown>>;
};

export function useChat (
    sessionId:string,
    initialMessage: Message[],
) {
    const [messages, setMessages] = useState<Message[]>(initialMessage);
    const[streaming, setStreaming] = useState<StreamingState>({
        status:"idle"
    });
    const activeStreamRef = useRef<ActiveStream | null>(null);

    const updateMessages = useCallback((updater: (prev:Message[]) => Message[]) =>{
        setMessages((prev) =>updater(prev));
    },[]);

    const isActiveRequest =useCallback((requestId:string)=> { 
     return activeStreamRef.current?.requestId === requestId;
    },[]);

    const emitParts = useCallback((
        requestId:string,
        parts:ClientMessagePart[]
    )=>{
        if(!isActiveRequest(requestId)) return;

        const snapshot = [...parts];
        const activeStream = activeStreamRef.current;
        if(!activeStream) return;

        activeStream.parts = snapshot;
        setStreaming({
            status:"streaming",
            parts: snapshot,
            mode :activeStream.mode,
            model:activeStream.model
        })
    },[isActiveRequest]);

    const clearStream = useCallback(
        (requestId: string) => {
          if(!isActiveRequest(requestId)) return;

          activeStreamRef.current = null;
          setStreaming({status:"idle"});
        },[isActiveRequest]);

        const handleStream = useCallback(async(
            response: ClientResponse<unknown>,
            activeStream: ActiveStream
        )=> {
            if(!isActiveRequest(activeStream.requestId)) return;

            if(!response.ok) {
                const message = await getErrorMessage(response);
                updateMessages((prev) => [
                    ...prev,
                    {
                        id:crypto.randomUUID(),
                        role:"error",
                        content:message,
                    }
                ]);
                return
            };

            const parts: ClientMessagePart[] = [];

            const stream = response
            .body!.pipeThrough(new TextDecoderStream())
            .pipeThrough(new EventSourceParserStream());

            for await (const {data} of stream) {
                if(!isActiveRequest(activeStream.requestId)) return;

                let event;

                try {
                    event = chatStreamEventSchema.parse(JSON.parse(data));
                } catch (err) {
                    const message = err instanceof Error ? err.message : "Invalid Stream event";
                    updateMessages((prev) => [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            role:"error",
                            content:message,
                        }
                    ]);
                    break;
                }
            }
        },[])
    
}
