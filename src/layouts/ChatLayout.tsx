import { Outlet, useNavigate, useLocation } from "react-router-dom";
import React from "react";
import { Layout, Menu, Tooltip } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { menuItems } from "./menuConfig";

const { Header, Sider, Content } = Layout;

const ChatLayout: React.FC = () => {
  const [collapsed, setCollapsed] = React.useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // 左侧菜单只负责切路由，具体页面状态都留给各自 view/store 管理。
  const handleMenuClick = ({ key }: { key: string }) => {
    const item = menuItems.find((i) => i?.key === key);
    if (item?.path) {
      navigate(item.path);
    }
  };

  // 根据当前路径匹配菜单高亮状态
  const activeItem = menuItems.find((i) => {
    if (i?.path === "/") {
      return location.pathname === "/" || location.pathname === "/chat";
    }
    return location.pathname.startsWith(i?.path as string);
  });
  const activeKey = activeItem ? (activeItem.key as string) : "1";

  return (
    <Layout
      className="h-screen overflow-hidden"
      style={{ background: "#f4f6f8" }}
    >
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        className="z-10"
      >
        <div className="flex items-center h-[48px] ml-8 overflow-hidden">
          <Tooltip title={collapsed ? "展开" : "关闭侧边"} placement="right">
            {collapsed ? (
              <MenuUnfoldOutlined
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  color: "#475569",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              />
            ) : (
              <MenuFoldOutlined
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  color: "#475569",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              />
            )}
          </Tooltip>
        </div>
        <Menu
          theme="light"
          mode="inline"
          inlineCollapsed={collapsed}
          inlineIndent={24}
          selectedKeys={[activeKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ background: "transparent" }}>
        <Header
          style={{ padding: 0, background: "transparent", height: "48px", lineHeight: "48px" }}
          className="flex items-center justify-between px-4 z-10"
        >
          <div className="font-bold text-lg ml-6">智慧小柜</div>
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
            margin: 0,
            padding: 0,
            minHeight: 280,
            background: "transparent",
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
