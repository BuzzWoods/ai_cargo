# 项目关键流程备注

这份文档是读代码用的路线图。代码里的详细备注分散在关键函数旁边，这里先把主链路串起来。

## 1. 应用入口和路由

入口文件是 `src/main.tsx`，它只负责把 React 挂到 `#root`。

路由在 `src/App.tsx`：

- `/chat`：主聊天页，负责用户输入、HTTP 发消息、SSE 收消息、渲染 Markdown 和 3D 小卡片。
- `/cargo-3d`：完整 3D 装箱页，从聊天 store 里读取已生成的 artifact。
- `/3d-preview`：后端调试页，手动粘贴 artifact JSON 后直接渲染 3D。

布局在 `src/layouts/ChatLayout.tsx`，自研侧栏在 `src/layouts/AppSidebar.tsx`。侧栏负责折叠/展开、路由跳转、会话历史切换和本地删除；聊天 SSE 与 3D 页面状态仍留在各自 view/store 中。

## 2. 聊天发送和接收流程

用户点击发送后，入口在 `src/views/agent-chat/index.tsx` 的 `onSend`。

流程是：

1. `addUserMessage`：先把用户输入放进本地 store，生成本地消息和 `clientMessageId`。
2. `addAssistantPlaceholder`：插入一个空 assistant 气泡，等待后端流式内容填充。
3. `sendChatMessage`：调用 `src/api/chat.ts`，先 HTTP POST 发消息。
4. 后端返回 accepted 后，前端拿到 `conversationId/requestId/sseChannel`。
5. 前端用 `fetch-event-source` 连接 SSE 通道。
6. 收到 `markdown.delta` 时 append 到 assistant 的 markdown 文本。
7. 收到 `artifact.replace` 时把 3D artifact 存到当前 assistant 消息里。
8. 收到 `message.done` 时把 assistant 状态改成 done。

关键点：

- HTTP 只负责“发消息并接受任务”。
- SSE 才负责“收正文、收 3D 结构、收完成状态”。
- `src/api/chat.ts` 会按 `eventId/seq` 去重，避免页面切回导致重复 delta。

## 3. Store 如何组织消息

状态集中在 `src/store/useChatStore.ts`。

关键字段：

- `serverConversationId`：当前后端会话 id，下一次发送会带上。
- `activeArtifactId`：用户点击“在 3D 页面查看”时记录当前 artifact。
- `messages`：聊天气泡列表，里面同时包含 user 和 assistant。

关键 action：

- `appendAssistantMarkdown`：处理 `markdown.delta`。
- `replaceAssistantArtifact`：处理 `artifact.replace`。
- `completeAssistantMessage`：处理 `message.done`。
- `failAssistantMessage`：处理错误。

## 4. Markdown 和 3D 小卡片如何渲染

assistant 气泡内容在 `src/components/chat/AssistantMessageContent.tsx`。

它会做两件事：

- 把 `message.markdownText` 交给 `src/components/markdown/MarkdownRenderer.tsx` 渲染。
- 遍历 `message.artifacts`，用推荐计划的第一个箱子生成聊天内 3D 小预览。

Markdown 渲染使用：

- `react-markdown`
- `remark-gfm`
- `rehype-sanitize`

所以后端返回的是普通 Markdown 文本即可，前端负责安全渲染。

## 5. 3D 数据如何转换成 three.js 视图

核心转换在 `src/components/cargo/cargoPackingView.ts`。

后端给的 `cargo_packing_plans` artifact 是业务结构，不能直接喂给 three.js。前端会转换为 `CargoLayoutView`：

- `getPreferredPlan`：取推荐计划，没有推荐就取第一个计划。
- `getContainerByNo`：取当前计划中的某个箱子，没有指定就取第一个箱子。
- `createCargoLayoutView`：把后端货物尺寸和坐标转换成 3D mesh 需要的中心点坐标。

坐标转换时统一用 `decimal.js`，减少浮点精度尾巴。

## 6. 3D 工作台如何运行

完整 3D 工作台在 `src/components/cargo/CargoPackingPreviewWorkspace.tsx`。

它负责：

- 切换计划。
- 切换箱子。
- 保存当前选中的货物。
- 渲染左侧 3D Canvas。
- 渲染右侧货物信息和装载摘要。

真正的 three.js 画布在 `src/components/cargo/CargoLayoutCanvas.tsx`：

- `getCameraConfig`：根据箱体大小计算初始 40 度左右俯瞰视角。
- `CargoCamera`：同步设置相机位置，减少初始化抖动。
- `CargoLayoutScene`：画集装箱外框和每个货物 mesh。
- `OrbitControls`：允许完整页旋转查看，小卡片不启用交互。

## 7. 业务单号弹窗流程

业务单号选择弹窗在 `src/components/chat/ShipmentBatchSelectorModal.tsx`。

入口按钮在聊天输入框左侧，点击后打开弹窗。

流程是：

1. 弹窗打开后调用 `fetchShipmentBatchPlanList`。
2. API 在 `src/api/shipmentBatch.ts`，它只负责列表查询，不参与聊天 SSE。
3. 表格父行是出货批次，展开后子表是出货计划。
4. 勾选父行会同步勾选子计划。
5. 子表只要选中任意计划，就认为父批次被选中。
6. 点击确定后，把已选批次号追加到聊天输入框末尾。

这里使用 `useRequest` 只管理 loading/error/onSuccess，真实查询参数放在 `queryRef`，避免依赖 ahooks 的上次入参缓存。

## 8. 后端调试页

`src/views/3d-preview/index.tsx` 给后端联调使用。

它支持粘贴：

- 完整 artifact。
- `artifact.replace` 的 payload。
- 直接粘贴 artifact.data。

页面只做外层包装归一化，不修改 `data.plans` 里的业务内容，然后交给和 `/cargo-3d` 一样的工作台渲染。
