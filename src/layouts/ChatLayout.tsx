import { Outlet, useNavigate, useLocation } from "react-router-dom";
import React, { useEffect, useMemo } from "react";
import { App as AntdApp, Layout, Menu, Tooltip, Button } from "antd";
import type { MenuProps } from "antd";
import {
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { Box, MessageSquare } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const { Header, Sider, Content } = Layout;

const CHAT_ROOT_KEY = "chat-root";
const CARGO_3D_KEY = "cargo-3d";
const HISTORY_KEY_PREFIX = "chat-history:";

const getHistoryMenuKey = (localConversationId: string) =>
  `${HISTORY_KEY_PREFIX}${localConversationId}`;

const ChatLayout: React.FC = () => {
  const [collapsed, setCollapsed] = React.useState(true);
  const [openKeys, setOpenKeys] = React.useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { message: antdMessage } = AntdApp.useApp();
  const {
    activeLocalConversationId,
    historyIndex,
    loadConversation,
    deleteConversation,
  } = useChatStore();

  const navigateToActiveConversation = React.useCallback(
    (replace = false) => {
      const state = useChatStore.getState();
      const conversationId =
        state.serverConversationId ?? state.activeLocalConversationId;

      navigate(`/chat?conversationId=${encodeURIComponent(conversationId)}`, {
        replace,
      });
    },
    [navigate],
  );

  useEffect(() => {
    if (!location.pathname.startsWith("/chat")) {
      return;
    }

    const conversationId = new URLSearchParams(location.search).get(
      "conversationId",
    );

    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [loadConversation, location.pathname, location.search]);

  useEffect(() => {
    if (collapsed || !location.pathname.startsWith("/chat")) {
      return;
    }

    setOpenKeys([CHAT_ROOT_KEY]);
  }, [collapsed, location.pathname]);

  const menuItems = useMemo<MenuProps["items"]>(() => {
    const historyChildren: MenuProps["items"] = historyIndex.map((item) => ({
      key: getHistoryMenuKey(item.localConversationId),
      label: (
        <div className="group/chat-history-menu flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate" title={item.title}>
            {item.title}
          </span>
          <Tooltip title="删除会话" placement="right">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              className="shrink-0 opacity-0 transition-opacity group-hover/chat-history-menu:opacity-100 focus:opacity-100"
              aria-label={`删除会话：${item.title}`}
              onClick={(event) => {
                event.stopPropagation();
                deleteConversation(item.localConversationId);
                navigateToActiveConversation(true);
                antdMessage.success("已删除会话");
              }}
            />
          </Tooltip>
        </div>
      ),
    }));

    return [
      {
        key: CHAT_ROOT_KEY,
        icon: <MessageSquare size={18} className="menu-icon" />,
        label: (
          <span
            onClick={(event) => {
              event.stopPropagation();
              navigateToActiveConversation();
            }}
          >
            AI Chat
          </span>
        ),
        children: historyChildren.length
          ? historyChildren
          : [
              {
                key: "chat-empty",
                label: <span className="text-slate-400">暂无历史</span>,
                disabled: true,
              },
            ],
      },
      {
        key: CARGO_3D_KEY,
        icon: <Box size={18} className="menu-icon" />,
        label: "3D View",
      },
    ];
  }, [
    antdMessage,
    deleteConversation,
    historyIndex,
    navigateToActiveConversation,
  ]);

  // 左侧菜单只负责切路由和切会话，具体页面状态都留给 view/store 管理。
  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === CARGO_3D_KEY) {
      navigate("/cargo-3d");
      return;
    }

    if (key.startsWith(HISTORY_KEY_PREFIX)) {
      const localConversationId = key.slice(HISTORY_KEY_PREFIX.length);
      const item = historyIndex.find(
        (historyItem) =>
          historyItem.localConversationId === localConversationId,
      );

      if (!item) {
        return;
      }

      loadConversation(localConversationId);
      navigate(
        `/chat?conversationId=${encodeURIComponent(
          item.serverConversationId ?? item.localConversationId,
        )}`,
      );
    }
  };

  const selectedKeys = (() => {
    if (location.pathname.startsWith("/cargo-3d")) {
      return [CARGO_3D_KEY];
    }

    if (location.pathname.startsWith("/chat")) {
      const hasActiveHistory = historyIndex.some(
        (item) => item.localConversationId === activeLocalConversationId,
      );
      return hasActiveHistory
        ? [getHistoryMenuKey(activeLocalConversationId)]
        : [CHAT_ROOT_KEY];
    }

    return [];
  })();

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
          inlineIndent={16}
          selectedKeys={selectedKeys}
          openKeys={collapsed ? [] : openKeys}
          items={menuItems}
          onClick={handleMenuClick}
          onOpenChange={(keys) => setOpenKeys(keys)}
        />
      </Sider>
      <Layout style={{ background: "transparent" }}>
        <Header
          style={{
            padding: 0,
            background: "transparent",
            height: "48px",
            lineHeight: "48px",
          }}
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
