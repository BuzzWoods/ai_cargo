import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import ChatLayout from './layouts/ChatLayout';
import AgentChat from './views/agent-chat';
import Cargo3DPage from './views/cargo-3d';

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
        <Routes>
          <Route path="/" element={<ChatLayout />}>
            <Route index element={<Navigate to="/chat" replace />} />
            <Route path="chat" element={<AgentChat />} />
            <Route path="cargo-3d" element={<Cargo3DPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
