import React, { useEffect } from "react";
import { App as AntdApp, Tooltip, Popover } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const getConversationRouteId = () => {
  const state = useChatStore.getState();

  return state.serverConversationId ?? state.activeLocalConversationId;
};

const SidebarIcon = ({ children }: { children: React.ReactNode }) => (
  <span className="app-sidebar-icon">{children}</span>
);

const AppSidebar: React.FC = () => {
  const [collapsed, setCollapsed] = React.useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { message: antdMessage } = AntdApp.useApp();
  const {
    activeLocalConversationId,
    historyIndex,
    createNewConversation,
    loadConversation,
    deleteConversation,
  } = useChatStore();

  const isChatRoute = location.pathname.startsWith("/chat");
  const isCargoRoute = location.pathname.startsWith("/cargo-3d");

  const navigateToActiveConversation = React.useCallback(
    (replace = false) => {
      navigate(
        `/chat?conversationId=${encodeURIComponent(getConversationRouteId())}`,
        {
          replace,
        },
      );
    },
    [navigate],
  );

  useEffect(() => {
    if (!isChatRoute) {
      return;
    }

    const conversationId = new URLSearchParams(location.search).get(
      "conversationId",
    );

    if (!conversationId) {
      return;
    }

    const state = useChatStore.getState();
    if (
      conversationId === state.activeLocalConversationId ||
      conversationId === state.serverConversationId
    ) {
      return;
    }

    loadConversation(conversationId);
  }, [isChatRoute, loadConversation, location.search]);

  const handleStartNewConversation = () => {
    const localConversationId = createNewConversation();

    navigate(`/chat?conversationId=${encodeURIComponent(localConversationId)}`);
  };

  const handleOpenConversation = (
    localConversationId: string,
    routeConversationId: string,
  ) => {
    loadConversation(localConversationId);
    navigate(`/chat?conversationId=${encodeURIComponent(routeConversationId)}`);
  };

  const handleDeleteConversation = (
    event: React.MouseEvent<HTMLButtonElement>,
    localConversationId: string,
  ) => {
    event.stopPropagation();
    deleteConversation(localConversationId);
    navigateToActiveConversation(true);
    antdMessage.success("已删除会话");
  };

  const renderItem = ({
    active,
    icon,
    label,
    onClick,
  }: {
    active?: boolean;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  }) => {
    const item = (
      <button
        type="button"
        className={`app-sidebar-item ${active ? "app-sidebar-item-active" : ""}`}
        onClick={onClick}
        aria-label={label}
      >
        <SidebarIcon>{icon}</SidebarIcon>
        <span className="app-sidebar-label">{label}</span>
      </button>
    );

    return (
      <Tooltip title={collapsed ? label : ""} placement="right">
        {item}
      </Tooltip>
    );
  };

  const renderHistoryContent = (isPopover = false) => (
    <div className={`app-sidebar-history ${isPopover ? 'popover-history' : ''}`}>
      {historyIndex.length ? (
        historyIndex.map((item) => {
          const active =
            item.localConversationId === activeLocalConversationId;
          const routeConversationId =
            item.serverConversationId ?? item.localConversationId;

          const openConversation = () =>
            handleOpenConversation(
              item.localConversationId,
              routeConversationId,
            );

          return (
            <div
              key={item.localConversationId}
              role="button"
              tabIndex={0}
              className={`app-sidebar-history-item ${
                active ? "app-sidebar-history-item-active" : ""
              }`}
              onClick={openConversation}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openConversation();
                }
              }}
            >
              <span className="app-sidebar-history-title">
                {item.title}
              </span>
              <Tooltip title="删除会话" placement="right">
                <span
                  className="app-sidebar-history-delete-wrap"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="app-sidebar-history-delete"
                    onClick={(event) =>
                      handleDeleteConversation(
                        event,
                        item.localConversationId,
                      )
                    }
                    aria-label={`删除会话：${item.title}`}
                  >
                    <Trash2 size={14} strokeWidth={1.9} />
                  </button>
                </span>
              </Tooltip>
            </div>
          );
        })
      ) : (
        <div className="app-sidebar-history-empty">暂无历史</div>
      )}
    </div>
  );

  return (
    <aside
      className={`app-sidebar ${collapsed ? "app-sidebar-collapsed" : ""}`}
    >
      <div className="app-sidebar-toggle-row">
        <Tooltip title={collapsed ? "展开" : "关闭侧边"} placement="right">
          <button
            type="button"
            className="app-sidebar-toggle"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "展开侧边栏" : "关闭侧边栏"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} strokeWidth={1.9} />
            ) : (
              <PanelLeftClose size={18} strokeWidth={1.9} />
            )}
          </button>
        </Tooltip>
      </div>

      <nav className="app-sidebar-nav" aria-label="主导航">
        {renderItem({
          icon: <SquarePen size={18} strokeWidth={1.9} />,
          label: "开启新对话",
          onClick: handleStartNewConversation,
        })}

        <div className="app-sidebar-chat-group">
          {collapsed ? (
            <Popover
              placement="rightTop"
              content={renderHistoryContent(true)}
              trigger="click"
              arrow={false}
              overlayInnerStyle={{ padding: '8px' }}
            >
              <div>
                {renderItem({
                  active: isChatRoute,
                  icon: <MessageSquare size={18} strokeWidth={1.9} />,
                  label: "对话历史",
                  onClick: () => navigateToActiveConversation(),
                })}
              </div>
            </Popover>
          ) : (
            <>
              {renderItem({
                active: isChatRoute,
                icon: <MessageSquare size={18} strokeWidth={1.9} />,
                label: "对话历史",
                onClick: () => navigateToActiveConversation(),
              })}
              {renderHistoryContent(false)}
            </>
          )}
        </div>

        {renderItem({
          active: isCargoRoute,
          icon: <Box size={18} strokeWidth={1.9} />,
          label: "3D 视图",
          onClick: () => navigate("/cargo-3d"),
        })}
      </nav>
    </aside>
  );
};

export default AppSidebar;
