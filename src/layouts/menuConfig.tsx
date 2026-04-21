import { MessageSquare, Box } from "lucide-react";
import type { MenuProps } from "antd";

// 定义菜单项类型，方便后续扩展路径等属性
export type MenuItem = Required<MenuProps>["items"][number] & {
  path?: string;
};

export const menuItems: MenuItem[] = [
  {
    key: "1",
    icon: <MessageSquare size={18} />,
    label: "AI Chat",
    path: "/",
  },
  {
    key: "2",
    icon: <Box size={18} />,
    label: "3D View",
    path: "/cargo-3d",
  },
  // 后续增加新功能只需在此处添加即可
];
