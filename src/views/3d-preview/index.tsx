import React, { useState } from "react";
import { Alert, Button, Input, Modal, Tag, Typography } from "antd";
import type {
  CargoPackingPlansArtifact,
  CargoPackingPlansArtifactData,
} from "../../api/protocol";
import CargoPackingPreviewWorkspace from "../../components/cargo/CargoPackingPreviewWorkspace";

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

const STORAGE_KEY = "cargo-3d-preview-json";

const examplePlaceholder = `{
  "id": "debug_artifact_001",
  "kind": "cargo_packing_plans",
  "version": "1.0.0",
  "title": "装箱调试数据",
  "data": {
    "recommendedPlanNo": "PLAN_A",
    "plans": []
  }
}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getArtifactCandidate = (value: unknown) => {
  if (!isRecord(value)) {
    return value;
  }

  // 调试时常见输入有三种：完整 artifact、artifact.replace payload、或者 artifact.data。
  const payload = value.payload;

  if (isRecord(payload) && isRecord(payload.artifact)) {
    return payload.artifact;
  }

  if (isRecord(value.artifact)) {
    return value.artifact;
  }

  return value;
};

const getStringValue = (
  value: Record<string, unknown>,
  key: string,
  fallback: string,
) => (typeof value[key] === "string" ? value[key] : fallback);

const normalizeCargoPackingArtifact = (
  input: unknown,
): CargoPackingPlansArtifact => {
  // 这里只做外层包装归一化，不修改 data.plans 里的业务内容。
  const candidate = getArtifactCandidate(input);

  if (!isRecord(candidate)) {
    throw new Error("JSON 根节点必须是对象。");
  }

  if (
    typeof candidate.kind === "string" &&
    candidate.kind !== "cargo_packing_plans"
  ) {
    throw new Error("当前页面只支持 kind 为 cargo_packing_plans 的数据。");
  }

  const rawData =
    isRecord(candidate.data) && Array.isArray(candidate.data.plans)
      ? candidate.data
      : Array.isArray(candidate.plans)
        ? candidate
        : null;

  if (!rawData) {
    throw new Error(
      "未找到 data.plans。请粘贴完整 artifact、artifact.data，或 artifact.replace 的 payload。",
    );
  }

  const data = rawData as unknown as CargoPackingPlansArtifactData;

  if (!Array.isArray(data.plans) || data.plans.length === 0) {
    throw new Error("data.plans 至少需要包含一个装箱计划。");
  }

  const recommendedPlanNo =
    typeof data.recommendedPlanNo === "string" && data.recommendedPlanNo
      ? data.recommendedPlanNo
      : (data.plans.find((plan) => plan.recommended) ?? data.plans[0]).planNo;

  return {
    id: getStringValue(candidate, "id", "debug-preview-artifact"),
    kind: "cargo_packing_plans",
    version: "1.0.0",
    title: getStringValue(candidate, "title", "3D 调试预览"),
    data: {
      ...data,
      recommendedPlanNo,
    },
  };
};

const readSavedJson = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(STORAGE_KEY) ?? "";
};

const parseSavedArtifact = (jsonText: string) => {
  // 页面刷新后尽量恢复上次调试数据；恢复失败则静默回到输入态。
  if (!jsonText.trim()) {
    return null;
  }

  try {
    return normalizeCargoPackingArtifact(JSON.parse(jsonText));
  } catch {
    return null;
  }
};

const Cargo3DPreviewPage: React.FC = () => {
  const savedJson = readSavedJson();
  const [jsonText, setJsonText] = useState(savedJson);
  const [artifact, setArtifact] = useState<CargoPackingPlansArtifact | null>(
    () => parseSavedArtifact(savedJson),
  );
  const [editorOpen, setEditorOpen] = useState(!artifact);
  const [error, setError] = useState<string | null>(null);

  const parseJson = () => {
    // 点击“解析并渲染”后，把 JSON 转成与聊天页一致的 artifact，再交给同一个 3D 工作台。
    try {
      const nextArtifact = normalizeCargoPackingArtifact(JSON.parse(jsonText));

      setArtifact(nextArtifact);
      setError(null);
      setEditorOpen(false);
      window.localStorage.setItem(STORAGE_KEY, jsonText);
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "JSON 解析失败，请检查数据格式。",
      );
    }
  };

  const clearPreview = () => {
    setJsonText("");
    setArtifact(null);
    setError(null);
    setEditorOpen(true);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const editor = (
    <div className="space-y-4">
      <TextArea
        value={jsonText}
        rows={18}
        placeholder={examplePlaceholder}
        onChange={(event) => setJsonText(event.target.value)}
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        }}
      />
        {error ? <Alert type="error" showIcon title={error} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text type="secondary" className="text-xs">
          支持完整 artifact、artifact.data，或 SSE artifact.replace 的 payload。
        </Text>
        <div className="flex gap-2">
          <Button onClick={clearPreview}>清空</Button>
          <Button type="primary" onClick={parseJson} disabled={!jsonText.trim()}>
            解析并渲染
          </Button>
        </div>
      </div>
    </div>
  );

  if (!artifact) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto bg-transparent p-6">
        <div className="w-full max-w-5xl rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-5 space-y-2">
            <Title level={3} style={{ margin: 0 }}>
              3D 渲染调试预览
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              粘贴后端返回的装箱 artifact JSON，页面会按现有 3D 视图结构解析并渲染。
            </Paragraph>
          </div>
          {editor}
        </div>
      </div>
    );
  }

  return (
    <>
      <CargoPackingPreviewWorkspace
        artifact={artifact}
        emptyDescription="当前 JSON 没有可渲染的装箱计划，请重新输入调试数据。"
        headerExtra={
          <>
            <Tag color="purple" variant="filled" className="m-0">
              调试预览
            </Tag>
            <Button size="small" onClick={() => setEditorOpen(true)}>
              重新输入 JSON
            </Button>
          </>
        }
      />
      <Modal
        title="输入 3D 装箱 JSON"
        open={editorOpen}
        width={960}
        onCancel={() => setEditorOpen(false)}
        footer={null}
        destroyOnHidden
      >
        {editor}
      </Modal>
    </>
  );
};

export default Cargo3DPreviewPage;
