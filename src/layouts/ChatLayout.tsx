import { Outlet } from "react-router-dom";
import React from "react";
import { Layout } from "antd";
import AppSidebar from "./AppSidebar";

const { Header, Content } = Layout;

const ChatLayout: React.FC = () => {
  return (
    <Layout
      hasSider
      className="h-screen overflow-hidden"
      style={{ background: "#f4f6f8" }}
    >
      <AppSidebar />
      <Layout style={{ background: "transparent" }}>
        <Header
          style={{
            padding: 0,
            background: "transparent",
            height: "48px",
            lineHeight: "48px",
          }}
          className="z-10 flex items-center justify-between px-4"
        >
          <div className="ml-6 text-lg font-bold">智慧小柜</div>
        </Header>
        <Content
          style={{
            margin: 0,
            padding: 0,
            minHeight: 280,
            background: "transparent",
          }}
          className="relative overflow-hidden"
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default ChatLayout;
