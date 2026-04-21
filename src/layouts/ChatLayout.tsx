import { Outlet, useNavigate } from "react-router-dom";
import React from "react";
import { Layout, Menu, Button, theme } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { menuItems } from "./menuConfig";

const { Header, Sider, Content } = Layout;

const ChatLayout: React.FC = () => {
  const [collapsed, setCollapsed] = React.useState(false);
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleMenuClick = ({ key }: { key: string }) => {
    const item = menuItems.find((i) => i?.key === key);
    if (item?.path) {
      navigate(item.path);
    }
  };

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="shadow-lg z-10"
      >
        <div className="flex items-center justify-center h-16 m-4 bg-white/10 rounded-lg text-white overflow-hidden">
          <img src="/logo.svg" className="w-6 h-6 flex-shrink-0" alt="logo" />
          <span
            className={`text-xl font-bold font-mono tracking-tight whitespace-nowrap transition-all duration-300 ${
              collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-2"
            }`}
          >
            CARGO
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["1"]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{ padding: 0, background: colorBgContainer }}
          className="flex items-center justify-between px-4 shadow-sm z-10"
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: "16px",
              width: 64,
              height: 64,
            }}
          />
          <div className="flex items-center space-x-4 pr-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 overflow-hidden">
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                alt="avatar"
              />
            </div>
          </div>
        </Header>
        <Content
          style={{
            margin: "16px",
            padding: 0,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
          className="overflow-hidden relative"
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default ChatLayout;
