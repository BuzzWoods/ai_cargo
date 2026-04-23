export type StreamEventType =
  | "message.start"
  | "markdown.delta"
  | "artifact.replace"
  | "message.done"
  | "message.error"
  | "heartbeat";

export type MessageRole = "user" | "assistant";
export type MessageStatus =
  | "pending"
  | "accepted"
  | "streaming"
  | "done"
  | "error"
  | "cancelled";

export interface CargoDimensions {
  w: number;
  h: number;
  d: number;
}

export interface CargoPosition {
  x: number;
  y: number;
  z: number;
}

export interface CargoContainer {
  id: string;
  size: CargoDimensions;
  unit: "m" | "cm" | "mm";
  origin: "container-center";
  axis: "x-right-y-up-z-forward";
}

export interface CargoLayoutItem {
  id: string;
  label: string;
  size: CargoDimensions;
  position: CargoPosition;
  color: string;
  meta?: {
    sku?: string;
    weightKg?: number;
    stackable?: boolean;
    note?: string;
  };
}

export interface CargoLayoutArtifactData {
  container: CargoContainer;
  items: CargoLayoutItem[];
  summary: {
    totalItems: number;
    fillRate: number;
    notes: string[];
  };
}

export interface CargoLayoutArtifact {
  id: string;
  kind: "cargo_layout";
  version: "1.0.0";
  title: string;
  data: CargoLayoutArtifactData;
}

export interface ChatInputFileRef {
  fileId?: string;
  fileName: string;
  mimeType?: string;
  source?: "upload" | "workspace" | "remote";
  uri?: string;
}

export interface ChatPostRequest {
  conversationId: string | null;
  clientMessageId: string;
  text: string;
  files?: ChatInputFileRef[];
  context?: {
    bizType?: "cargo_layout";
    mode?: "natural_language";
    hints?: Record<string, string | number | boolean | null>;
  };
}

export interface ChatPostAcceptedResponse {
  accepted: true;
  conversationId: string;
  requestId: string;
  sseChannel: string;
}

export interface MessageStartPayload {
  role: MessageRole;
  contentType: "markdown";
}

export interface MarkdownDeltaPayload {
  format: "markdown";
  delta: string;
}

export interface ArtifactReplacePayload {
  artifact: CargoLayoutArtifact;
}

export interface MessageDonePayload {
  finishReason: "completed" | "stopped";
}

export interface MessageErrorPayload {
  code: string;
  message: string;
}

export interface HeartbeatPayload {
  intervalMs: number;
}

export type StreamPayload =
  | MessageStartPayload
  | MarkdownDeltaPayload
  | ArtifactReplacePayload
  | MessageDonePayload
  | MessageErrorPayload
  | HeartbeatPayload;

export interface StreamEventEnvelope<
  TType extends StreamEventType = StreamEventType,
  TPayload extends StreamPayload = StreamPayload,
> {
  eventId: string;
  conversationId: string;
  requestId: string;
  messageId: string;
  seq: number;
  type: TType;
  ts: string;
  payload: TPayload;
}

export interface AssistantMessageViewModel {
  id: string;
  role: "assistant";
  status: MessageStatus;
  markdownText: string;
  artifacts: Record<string, CargoLayoutArtifact>;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export type ChatStreamEvent =
  | StreamEventEnvelope<"message.start", MessageStartPayload>
  | StreamEventEnvelope<"markdown.delta", MarkdownDeltaPayload>
  | StreamEventEnvelope<"artifact.replace", ArtifactReplacePayload>
  | StreamEventEnvelope<"message.done", MessageDonePayload>
  | StreamEventEnvelope<"message.error", MessageErrorPayload>
  | StreamEventEnvelope<"heartbeat", HeartbeatPayload>;
