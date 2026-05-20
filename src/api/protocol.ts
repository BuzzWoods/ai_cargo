export type StreamEventType =
  | "message.start"
  | "markdown.delta"
  | "artifact.replace"
  | "message.done"
  | "message.error"
  | "heartbeat";

// 这个文件是“前后端协议边界”：SSE/HTTP 返回的数据先落到这些类型，再被页面转换成 UI 状态。
export type MessageRole = "user" | "assistant";
export type MessageStatus =
  | "pending"
  | "accepted"
  | "streaming"
  | "done"
  | "error"
  | "cancelled";

export type AssistantContentBlock =
  | {
      id: string;
      type: "markdown";
      startSeq: number;
      endSeq: number;
      text: string;
    }
  | {
      id: string;
      type: "progress";
      segmentType: "progress";
      seq: number;
      text: string;
    }
  | {
      id: string;
      type: "artifact";
      seq: number;
      artifactId: string;
    };

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
}

export type CargoPackageType =
  | "carton"
  | "pallet"
  | "crate"
  | "bag"
  | "drum"
  | "other";

export interface CargoBasicInfo {
  id: string;
  sku: string;
  name: string;
  category?: string;
  quantity: number;
  packageType: CargoPackageType;
  stackable: boolean;
  fragile: boolean;
  dangerousGoods: boolean;
  temperatureControlled: boolean;
  origin?: string;
  destination?: string;
  meta?: {
    note?: string;
  };
}

export interface CargoSpec {
  weightKg: number;
  dimensions: CargoDimensions;
  volumeM3?: number;
}

export interface CargoPlacement {
  id: string;
  cargoId: string;
  position: CargoPosition;
  color: string;
  meta?: {
    note?: string;
    item?: CargoPackingItem;
    packingContainer?: CargoPackingContainer;
  };
}

export interface CargoPackingItem {
  boxId: string;
  skuCode: string;
  skuName: string;
  factoryCode: string;
  warehouseCode: string;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  rotateType: number;
  volumeCbm: number;
  weightKg: number;
  cartonCount: number;
}

export interface CargoPackingContainer {
  containerNo: string;
  containerType: string;
  innerLength: number;
  innerWidth: number;
  innerHeight: number;
  totalVolumeCbm: number;
  totalWeightKg: number;
  volumeUtilization: number;
  weightUtilization: number;
  items: CargoPackingItem[];
}

export interface CargoPackingRisk {
  riskCode: string;
  level: string;
  targetType: string;
  targetId: string;
  message: string;
}

export interface CargoPackingPlan {
  planNo: string;
  strategyCode: string;
  recommended: boolean;
  summary: {
    containerCount: number;
    containerMix: string;
    totalVolumeCbm: number;
    totalWeightKg: number;
    avgVolumeUtilization: number;
    avgWeightUtilization: number;
    totalScore: number;
  };
  containers: CargoPackingContainer[];
  risks: CargoPackingRisk[];
}

export interface CargoPackingPlansArtifactData {
  recommendedPlanNo: string;
  plans: CargoPackingPlan[];
}

export interface CargoPackingPlansArtifact {
  id: string;
  kind: "cargo_packing_plans";
  version: "1.0.0";
  title: string;
  data: CargoPackingPlansArtifactData;
}

export interface ChatInputFileRef {
  fileId?: string;
  fileName: string;
  mimeType?: string;
  source?: "upload" | "feishu" | "oss" | "workspace" | "remote";
  uri?: string;
}

// 前端发消息时只提交自然语言、会话 id 和可选文件；3D 结构由后端/AI 通过 artifact 返回。
export interface ChatPostRequest {
  conversationId?: string | null;
  clientMessageId?: string;
  text: string;
  files?: ChatInputFileRef[];
  context?: {
    bizType?: "cargo_packing";
    mode?: "new_plan" | "adjust_plan";
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
  segmentType?: "progress" | "body";
  delta: string;
}

export interface ArtifactReplacePayload {
  artifact: CargoPackingPlansArtifact;
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
  artifacts: Record<string, CargoPackingPlansArtifact>;
  contentBlocks: AssistantContentBlock[];
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
