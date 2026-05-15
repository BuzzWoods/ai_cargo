import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import ChatLayout from './layouts/ChatLayout';
import AgentChat from './views/agent-chat';
import Cargo3DPage from './views/cargo-3d';
import Cargo3DPreviewPage from './views/3d-preview';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
        components: {
          Button: {
            // 某些版本可能需要在此处显式禁用
          }
        }
      }}
      wave={{ disabled: true }}
    >
      <BrowserRouter>
        {/* 顶层路由表：所有页面先进入 ChatLayout，再通过 Outlet 渲染子页面。 */}
        <Routes>
          <Route path="/" element={<ChatLayout />}>
            <Route index element={<Navigate to="/chat" replace />} />
            {/* /chat 是主流程：输入自然语言、发 HTTP、收 SSE、渲染 Markdown/3D 卡片。 */}
            <Route path="chat" element={<AgentChat />} />
            {/* /cargo-3d 复用聊天中保存的 artifact，展示完整 3D 装箱工作台。 */}
            <Route path="cargo-3d" element={<Cargo3DPage />} />
            {/* /3d-preview 给后端调试用：手动粘贴 artifact JSON 直接预览 3D。 */}
            <Route path="3d-preview" element={<Cargo3DPreviewPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
