import React from "react";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import CargoPackingPreviewWorkspace from "../../components/cargo/CargoPackingPreviewWorkspace";
import { useChatStore } from "../../store/useChatStore";

const Cargo3DPage: React.FC = () => {
  const navigate = useNavigate();
  const { messages, activeArtifactId } = useChatStore();

  const artifacts = messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => Object.values(message.artifacts));

  const activeArtifact =
    artifacts.find((artifact) => artifact.id === activeArtifactId) ??
    (artifacts.length ? artifacts[artifacts.length - 1] : null) ??
    null;

  return (
    <CargoPackingPreviewWorkspace
      artifact={activeArtifact}
      emptyDescription="这里还没有生成的多箱装箱计划，快去让 AI 帮您规划一下吧。"
      emptyAction={
        <Button type="primary" onClick={() => navigate("/chat")}>
          前往 AI 规划
        </Button>
      }
      backTooltip="返回会话"
      onBack={() => navigate("/chat")}
    />
  );
};

export default Cargo3DPage;
