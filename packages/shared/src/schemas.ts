import {record, z} from "zod";

// keep the explicit key  schema here because the one-argument z. record (...) from
// does not type-check cleanly with the Zod typings used in this workspace.e
export const toolcallArgsSchema = z.record(z.string(), z.json())

export const messagePartSchema = z.discriminatedUnion("type", [
    z.object({
        type:z.literal("reasoning"),
        text: z.string()
    }),
    z.object ({
        type:z.literal("tool-call"),
        id:z.string(),
        name:z.string(),
        args: toolcallArgsSchema,
        result: z.string().optional()
    }),
    z.object({
        type:z.literal("text"),
        text: z.string()
    }),
]);

export const messagePartsSchema = z.array(messagePartSchema);

export type MessagePart = z.infer<typeof messagePartSchema>;

//Tool- call args stay as nested Json on the wire so the client does not need
// a second JSON.parse step after decoding the SSE event payload itself.
export const chatStreamEventSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("text-delta"),
        text: z.string()
    }),
    z.object({
        type: z.literal("reasoning-data"),
        text:z.string(),
    }),
    z.object({
        type: z.literal("tool-call"),
        toolCallId: z.string(),
        toolName: z.string(),
        args: toolcallArgsSchema,
    }),
    z.object({
        type:z.literal("tool-result"),
        toolCallId:z.string(),
        result: z.string()
    }),
    z.object({
        type:z.literal("done"),
        messageId: z.string(),
        durationMs:z.number(),
    }),
    z.object({
        type:z.literal("error"),
        message: z.string()
    })
])

export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>
