import { Outlet, useNavigate, useLocation } from "react-router-dom";
import React from "react";
import { Layout, Menu, Button, theme, Tooltip } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { menuItems } from "./menuConfig";

const { Header, Sider, Content } = Layout;

const ChatLayout: React.FC = () => {
  const [collapsed, setCollapsed] = React.useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleMenuClick = ({ key }: { key: string }) => {
    const item = menuItems.find((i) => i?.key === key);
    if (item?.path) {
      navigate(item.path);
    }
  };

  // 根据当前路径匹配菜单高亮状态
  const activeItem = menuItems.find((i) => {
    if (i?.path === '/') {
      return location.pathname === '/' || location.pathname === '/chat';
    }
    return location.pathname.startsWith(i?.path as string);
  });
  const activeKey = activeItem ? (activeItem.key as string) : '1';

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="shadow-lg z-10"
      >
        <div className="flex items-center justify-center h-16 m-4 overflow-hidden">
          <Tooltip title={collapsed ? "展开" : "关闭侧边"} placement="right">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                color: "white",
                fontSize: "20px",
                width: "100%",
                height: "100%",
                borderRadius: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
              }}
              className="hover:!bg-white/20 transition-colors"
            />
          </Tooltip>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{ padding: 0, background: colorBgContainer }}
          className="flex items-center justify-end px-4 shadow-sm z-10"
        >
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
