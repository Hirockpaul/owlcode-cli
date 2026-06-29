export const Mode = {
  BUILD: "BUILD",
  PLAN: "PLAN",
} as const;

export type Mode = (typeof Mode)[keyof typeof Mode];

export const MessageStatus = {
  COMPLETE: "COMPLETE",
  INTERRUPTED: "INTERRUPTED",
} as const;

export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];
