# AI 智能装柜前端统一需求说明

版本：v1.1  
日期：2026-05-15  
适用范围：当前 `ai_cargo` 前端项目

## 1. 项目目标

本项目是一个 AI 智能装柜前端工作台，核心目标是让用户用自然语言发起装柜需求，由后端/AI 编排生成：

- Markdown 方案说明
- 多计划、多箱子的 3D 装箱结构数据
- 可交互的 3D 预览和货物明细查看

当前前端不负责计算装箱方案，也不负责生产结构化装箱输入。前端负责：

- 提交用户自然语言和上下文
- 接收后端 SSE 流式结果
- 渲染 Markdown
- 保存并展示 3D artifact
- 提供业务单号快捷选择
- 提供后端 3D 数据调试预览页

## 2. 当前统一口径

### 2.1 前端输入口径

用户输入框当前以自然语言为主。

前端可以追加业务单号文本，例如：

```text
出货批次编号：BATCH_001、BATCH_002
```

但前端当前不要求用户或页面生产以下结构化 JSON：

- container
- items
- packing plans
- 货物清单明细
- AI prompt 中间态

这些数据应由后端基于自然语言、业务单号、文件、数据库或其他业务系统自行整理。

### 2.2 后端输出口径

前端当前主要消费两类 SSE 输出：

- `markdown.delta`
- `artifact.replace`

当前协议里，`markdown.delta` 只表示一段 Markdown 增量，**没有**内置 `segmentType` 语义来区分“进度文案”还是“正式正文”。因此：

- 前端不能只靠纯文本兜底判断进度态
- 如果需要“正文生成后自动隐藏进度文案”，后端需要在流式内容里显式补充 `segmentType`
- 推荐约定为：`segmentType: "progress"` 表示中间态提示，`segmentType: "body"` 表示正式正文
- 在后端未升级前，前端只能做兼容降级，不能把文本内容当协议边界

其中 3D 结构化数据以当前代码为准，统一使用：

```json
{
  "kind": "cargo_packing_plans",
  "version": "1.0.0"
}
```

说明：

- 旧文档里出现过 `cargo_layout`，当前前端实现已经按 `cargo_packing_plans` 消费。
- `artifact.replace` 必须发送完整 artifact 快照，不发送半截 JSON。
- 前端不修改 `artifact.data.plans` 里的业务内容，只做读取、选择、坐标转换和渲染。

## 3. 页面与模块需求

### 3.1 主聊天页 `/chat`

文件入口：

- `src/views/agent-chat/index.tsx`

功能需求：

- 展示欢迎态。
- 用户输入自然语言后发起装柜请求。
- 请求中途禁止重复发送新消息。
- 支持在左侧菜单栏新开对话。
- 支持侧边对话历史。
- 支持打开业务单号选择弹窗。
- 输入框下方展示 Prompts 提示集合，点击后填入输入框。
- 接收 SSE 后增量渲染 assistant 回复。
- assistant 消息支持 Markdown 文本和 3D 小预览卡片。
- 点击 3D 小预览进入完整 3D 页面。

状态要求：

- 首次发送时先插入用户消息。
- 再插入 assistant 占位消息。
- HTTP accepted 后绑定服务端 `conversationId/requestId`。
- SSE `markdown.delta` 到达后追加 Markdown。
- SSE `artifact.replace` 到达后保存 artifact。
- SSE `message.done` 到达后结束 loading。
- SSE `message.error` 或请求异常时展示错误。

### 3.1.1 侧边对话历史产品原型

目标：

- 在左侧导航的 `/chat` 菜单下展示本地对话历史二级菜单。
- 一个对话对应一个 `conversationId`。
- 点击某个二级菜单后切换到对应会话，聊天区恢复该会话的消息、`serverConversationId` 和 `activeArtifactId`。
- 每条会话历史可单独删除。
- “开启新对话”不再清空全部历史，而是创建一个新的空会话并切换过去。

侧边菜单形态与交互：

- 左侧菜单栏展示 `开启新对话` 入口（图标使用写作/编辑语义图标，不使用简单加号），点击后立即创建新的空会话并切换过去。
- 一级菜单重命名与汉化：
  - “AI Chat” 一级菜单重命名为更符合语境的 **“对话历史”**。
  - “3D View” 一级菜单重命名为 **“3D 视图”**。
- **展开状态下**：
  - “对话历史”下方平铺展示最近会话列表。
  - 会话标题优先取第一条用户消息的前 `20` 个字符（若无消息则显示 `新对话`）。
  - 子菜单（会话历史项）的宽度拉宽至 100%，鼠标悬停时的背景高亮可以撑满整行，视觉更为统一。
  - 当前激活会话高亮，且每条会话右侧提供删除入口。
- **收缩（折叠）状态下**：
  - 点击“对话历史”图标，不再展示侧边栏展开时的列表，而是弹出一个 Popover（悬浮气泡卡片）展示历史会话列表，点击列表项即可直接切换历史会话，免去手动展开/收起侧边栏的繁琐操作。
- **动画平滑处理**：
  - 侧边栏在展开与收缩过渡期间，图标的位置采用左侧固定对齐，避免因容器宽度及对齐方式瞬变产生的突兀跳动，确保过渡动画流畅平滑。
- 删除当前会话后，优先切换到最近一条剩余会话；如果没有剩余会话，则自动创建一个空会话。

推荐交互：

- 点击 `AI Chat` 一级菜单进入 `/chat`，并保持当前激活会话。
- 点击二级会话菜单进入 `/chat?conversationId=xxx`，同时加载对应本地历史。
- 点击菜单栏 `开启新对话` 后：
  - abort 当前 SSE。
  - 保存当前会话快照。
  - 创建新的本地空会话。
  - 切换到新会话。
  - 首次发送时 `conversationId` 传 `null`，由后端创建真正的服务端 `conversationId`。
- 新会话拿到 HTTP accepted 后，将服务端返回的 `conversationId` 回写到当前会话记录。

边界规则：

- 前端本地可以先生成 `localConversationId` 承载空会话；服务端 `conversationId` 返回后再绑定。
- 已绑定服务端 `conversationId` 的会话，后续发送必须携带该 `conversationId`。
- 空会话如果用户未发送任何消息，可以不展示在历史列表中，或仅在当前会话展示；推荐不展示，避免历史列表堆积空项。
- 删除会话只删除前端本地存储，不调用后端删除接口。
- 当前阶段不支持从后端拉取历史消息，也不做多端同步。
- 正在流式生成的会话被切走或删除时，必须先 abort 当前 SSE，避免旧事件写入错误会话。

### 3.2 完整 3D 页面 `/cargo-3d`

文件入口：

- `src/views/cargo-3d/index.tsx`
- `src/components/cargo/CargoPackingPreviewWorkspace.tsx`

功能需求：

- 从聊天 store 中读取已生成的 artifact，不重新请求后端。
- 默认展示用户点击的小预览对应 artifact。
- 如果没有指定 artifact，则展示最近一次生成的 artifact。
- 默认展示推荐计划；没有推荐计划时展示第一个计划。
- 默认展示当前计划的第一个箱子。
- 支持切换计划。
- 支持切换箱子。
- 支持点击 3D 货物或底部货物按钮查看货物信息。
- 右侧展示货物信息、装载摘要、当前箱信息、风险计划。

当前不支持：

- 拖拽货物
- 物理碰撞模拟
- 重力模拟
- 纹理加载

### 3.3 3D 调试预览页 `/3d-preview`

文件入口：

- `src/views/3d-preview/index.tsx`

功能需求：

- 给后端联调使用。
- 支持手动粘贴 JSON。
- 支持输入完整 artifact。
- 支持输入 `artifact.replace.payload`。
- 支持输入 `artifact.data`。
- 页面只做 artifact 外层包装归一化。
- 不修改 `data.plans` 内部业务数据。
- 成功解析后复用完整 3D 工作台渲染。
- 支持 localStorage 记住上次调试 JSON。

### 3.4 业务单号选择弹窗

文件入口：

- `src/components/chat/ShipmentBatchSelectorModal.tsx`
- `src/api/shipmentBatch.ts`

功能需求：

- 点击聊天输入框左侧业务按钮打开弹窗。
- 弹窗展示父子嵌套表格。
- 父级为出货批次。
- 子级为出货计划。
- 支持分页。
- 支持按出货批次编号模糊搜索。
- 支持父子勾选联动。
- 勾选父批次时，子计划同步选中。
- 子计划任意选中时，父批次视为选中。
- 确定后把选中的出货批次编号追加到输入框末尾。

接口口径：

```http
POST chat/getShipmentBatchPlanList
Content-Type: application/json
```

当前请求参数：

```json
{
  "dateQuery": {
    "beginTime": "2026-03-29",
    "endTime": "2026-04-27",
    "timeType": "create_time"
  },
  "queryType": {
    "qryField": "batchPlanNo",
    "qryType": "fuzzy",
    "value": "",
    "values": []
  },
  "pageNum": 1,
  "pageSize": 20
}
```

说明：

- 如果后端最终接口仍为 `/logisticsShipmentBatchPlan/getShipmentBatchPlanList`，应统一在 `src/api/shipmentBatch.ts` 调整，不要在页面中散落接口地址。
- 当前 `useRequest` 只负责 loading、error、onSuccess。
- 查询参数通过 `queryRef` 传入，避免依赖 useRequest 的上一次入参缓存。

### 3.5 产品节点级需求细化

本节按当前代码真实业务逻辑拆解产品节点。后续新增需求时，应优先判断新增能力属于哪个节点，避免把同一类状态或接口逻辑散落在多个组件中。

#### 节点 01：应用启动与路由初始化

代码入口：

- `src/main.tsx`
- `src/App.tsx`
- `src/layouts/ChatLayout.tsx`
- `src/layouts/AppSidebar.tsx`

触发条件：

- 用户打开前端应用。

输入：

- 浏览器当前 URL。
- 本地缓存中的聊天 store 状态。

处理逻辑：

- `main.tsx` 将 React 应用挂载到 `#root`。
- `App.tsx` 注册 `/chat`、`/cargo-3d`、`/3d-preview` 三个业务路由。
- 根路径 `/` 自动重定向到 `/chat`。
- `ChatLayout` 提供整体布局和顶部标题栏。
- `AppSidebar` 提供自研左侧导航、折叠/展开、会话历史子菜单和删除入口。
- 左侧菜单图标使用固定 `40px` 槽位，折叠和展开时图标中心点必须保持一致。
- 左侧菜单点击后只做路由切换、会话切换、新建会话或删除本地会话，不参与聊天 SSE 或 3D 渲染逻辑。

输出：

- `/chat` 渲染聊天页。
- `/cargo-3d` 渲染完整 3D 工作台。
- `/3d-preview` 渲染后端调试页。

边界规则：

- 页面级状态不放在 `ChatLayout`。
- 新增页面时应在 `App.tsx` 注册路由，并在 `AppSidebar` 中维护导航项。

#### 节点 02：聊天缓存恢复

代码入口：

- `src/store/useChatStore.ts`
- `src/views/agent-chat/index.tsx`
- `src/layouts/ChatLayout.tsx`

触发条件：

- 页面首次加载。
- 用户刷新页面。
- 用户点击侧边对话历史二级菜单。

输入：

- localStorage 中对话索引和会话快照数据。
- URL 中的 `conversationId` 查询参数。

处理逻辑：

- Zustand persist 自动读取当前激活会话。
- 如果 URL 指定了 `conversationId`，优先加载该会话。
- 如果没有指定 `conversationId`，加载最近一次激活会话。
- 单个会话最多保留最近 `50` 条消息。
- 只有在页面首次加载、刷新页面或手动切换历史会话时，才允许把恢复出的未完成 assistant 消息改成 `cancelled`。
- 正常发送、HTTP accepted、SSE streaming 和实时写缓存时，必须保留 `pending`、`accepted`、`streaming` 原始状态。
- `AgentChat` 根据恢复后的 `messages.length` 判断是否展示历史消息区域。

输出：

- 已完成聊天内容重新展示。
- 已完成 artifact 仍可进入 `/cargo-3d` 查看。
- 未完成流式消息不再 loading，而是显示已取消。
- 左侧 `/chat` 二级菜单展示本地会话历史。

边界规则：

- 当前不做刷新后的 SSE 续接。
- 当前不做服务端历史恢复。
- localStorage 只作为前端本地历史，不作为长期业务存档。
- URL 从本地 `localConversationId` 替换为服务端 `conversationId` 时，如果仍指向当前激活会话，不应重复从缓存加载会话。

#### 节点 03：聊天空态与输入态

代码入口：

- `src/views/agent-chat/index.tsx`

触发条件：

- `messages.length === 0`。
- 用户新开对话后回到空态。

输入：

- `messages`
- `inputValue`

处理逻辑：

- 页面显示 `Welcome` 欢迎文案。
- 输入框使用 `@ant-design/x` 的 `Sender`。
- Sender 不展示 placeholder 文案。
- Sender 内不再展示 `开启新对话` 按钮。
- **提示词智能隐藏**：快捷提示词区域（`Prompts`）仅在没有历史消息时展示。一旦在当前对话中发出过消息，提示词区域自动隐藏，以保持聊天界面的极简清爽。
- 输入框下方展示两个 Prompts 提示卡片：
  - `我要智能分柜`（带有 ✨ 图标）
  - `计划出货批次单号：...`（带有 📝 图标）
- **现代化“毛玻璃”卡片 UI 视觉设计**：
  - 取消死板的固定宽度限制，根据内容自适应。
  - 提示词背景使用半透明微白底色（`rgba(255, 255, 255, 0.4)`）与极淡的线条边框，不再使用纯白和粗硬边框，使其能极佳地融入环境背景。
  - 带有悬浮微动效：Hover 时卡片轻微上浮（`translateY(-1px)`）、背景不透明度提升至 0.8、并伴随柔和的阴影扩散反馈。
- **提示词点击逻辑**：点击提示词后，会将模板内容**追加**到输入框已有文案的后方（若已有文案会自动换行追加），而不是覆盖输入框，以防止误操作导致用户已有内容丢失。
- `showHistory` 控制欢迎态、历史区和输入框的位置过渡。

输出：

- 用户可以输入自然语言。
- 用户可以点击 Prompt 将模板填入输入框。
- 用户可以打开业务单号弹窗。
- 用户可以通过左侧菜单栏开启新对话。

边界规则：

- 空输入不允许发送。
- 当前没有文件上传入口，`files` 仍为接口预留字段。

#### 节点 04：业务单号弹窗打开与列表查询

代码入口：

- `src/views/agent-chat/index.tsx`
- `src/components/chat/ShipmentBatchSelectorModal.tsx`
- `src/api/shipmentBatch.ts`

触发条件：

- 用户点击输入框左侧 `ProfileOutlined` 按钮。

输入：

- `open`
- `pageNum`
- `pageSize`
- `queryKeyword`

处理逻辑：

- `AgentChat` 将 `batchSelectorOpen` 置为 `true`。
- `ShipmentBatchSelectorModal` 打开后调用 `loadBatchPlans`。
- `loadBatchPlans` 先更新 `queryRef.current`，再调用无参 `run()`。
- `useRequest` 只负责请求生命周期，不缓存业务入参。
- API 请求由 `fetchShipmentBatchPlanList` 统一发出。

输出：

- 父表展示出货批次。
- 展开行展示对应出货计划。
- 表格分页信息来自接口返回的 `total/pageNum/pageSize`。

边界规则：

- 接口失败时清空表格并展示错误。
- `list` 缺失时按空数组处理。
- 当前弹窗状态保存在组件内，关闭弹窗不等于自动清空已选批次；如需每次打开重置，需要后续单独调整。

#### 节点 05：业务单号父子勾选与确认追加

代码入口：

- `src/components/chat/ShipmentBatchSelectorModal.tsx`
- `src/views/agent-chat/index.tsx`

触发条件：

- 用户勾选父批次。
- 用户勾选子计划。
- 用户点击“确定添加”。

输入：

- `selectedBatchMap`
- `selectedPlanKeys`
- 当前页父子表格数据。

处理逻辑：

- 勾选父批次时，同步勾选该批次下所有子计划。
- 取消父批次时，同步取消该批次下所有子计划。
- 子表只要存在任意选中计划，父批次就进入已选集合。
- 子表选中清空时，父批次从已选集合移除。
- 点击确定后，将所有已选父批次的 `batchPlanNo` 返回给 `AgentChat`。
- `AgentChat` 将批次号追加到输入框末尾。

输出：

```text
出货批次编号：BATCH_001、BATCH_002
```

边界规则：

- 没有选中批次时，确定按钮禁用。
- 只追加父级出货批次编号，不把子计划明细写入输入框。
- 追加文本是自然语言上下文，不是结构化业务 JSON。

#### 节点 06：用户发送消息

代码入口：

- `src/views/agent-chat/index.tsx`
- `src/store/useChatStore.ts`

触发条件：

- 用户在输入框提交文本。

输入：

- `inputValue`
- `serverConversationId`
- 当前是否存在 streaming 消息。

处理逻辑：

- 提交内容先做 `trim`。
- 空文本直接忽略。
- 如果当前已有 assistant 消息处于 `pending`、`accepted`、`streaming`，禁止重复发送。
- 首次发送时会先播放欢迎态退出动画，再进入真实发送逻辑。
- `addUserMessage` 写入用户消息，并生成 `clientMessageId`。
- `addAssistantPlaceholder` 写入 assistant 占位消息。
- 创建 `AbortController` 保存到 `abortControllerRef`。
- 清空输入框。

输出：

- 页面立即出现用户气泡。
- 页面出现 assistant loading 占位。
- 前端开始调用后端 HTTP 接口。

边界规则：

- `clientMessageId` 每次发送新生成，不要求全 App 永久唯一，但应满足单次请求幂等追踪。
- 本地 `localUserMessageId` 和 `localAssistantMessageId` 只服务前端渲染，不传给后端。

#### 节点 07：HTTP accepted 受理

代码入口：

- `src/api/chat.ts`
- `src/views/agent-chat/index.tsx`

触发条件：

- `sendChatMessage` 调用 `POST /api/chat/messages`。

输入：

```json
{
  "conversationId": null,
  "clientMessageId": "client_msg_xxx",
  "text": "用户自然语言",
  "context": {
    "bizType": "cargo_packing",
    "mode": "new_plan",
    "hints": {}
  }
}
```

处理逻辑：

- `postChatMessage` 使用统一 `createApiUrl` 生成请求地址。
- 请求成功后通过 `unwrapApiResponseData` 读取 `data`。
- `isAcceptedResponse` 校验 `accepted/conversationId/requestId/sseChannel`。
- accepted 只代表后端已受理，不代表 AI 已完成。
- `AgentChat` 将 `conversationId` 绑定到 store。
- 用户消息和 assistant 消息写入服务端会话元数据。

输出：

- `serverConversationId` 更新。
- 当前 assistant 消息状态进入 `accepted`。
- 前端拿到 `sseChannel`，准备连接 SSE。

边界规则：

- accepted 响应结构不正确时，当前 assistant 消息进入 error。
- HTTP 非 2xx 时读取后端错误文本并展示。

#### 节点 08：SSE 建连、校验与去重

代码入口：

- `src/api/chat.ts`

触发条件：

- HTTP accepted 成功后。

输入：

- `acceptedResponse.sseChannel`
- `AbortController.signal`

处理逻辑：

- 使用 `@microsoft/fetch-event-source` 发起 GET 请求。
- 请求头设置 `Accept: text/event-stream`。
- `openWhenHidden: true`，允许页面隐藏后继续接收。
- `onopen` 校验 HTTP 状态和 `Content-Type`。
- `onmessage` 解析 `message.data`。
- `isKnownStreamEvent` 校验事件外壳。
- 如果浏览器事件名和 data 内 `type` 不一致，则抛错。
- 使用 `seenEventIds` 和 `latestSeq` 做前端去重。
- `message.done` 或 `message.error` 会标记终止事件已收到。

输出：

- 合法事件交给 `AgentChat.onEvent`。
- 重复事件被静默忽略。
- 异常事件进入错误流程。

边界规则：

- `eventId` 重复不处理。
- `seq <= latestSeq` 不处理。
- SSE 在 `message.done` 前关闭，视为异常。
- 用户新开对话、删除当前会话或组件卸载时，通过 `AbortController` 终止连接。

#### 节点 09：SSE 事件分发与消息绑定

代码入口：

- `src/views/agent-chat/index.tsx`
- `src/store/useChatStore.ts`

触发条件：

- `sendChatMessage` 收到合法 SSE 事件。

输入：

- `ChatStreamEvent`
- 当前 `localAssistantMessageId`
- 当前 `currentServerRequestId`
- 当前 `currentServerMessageId`

处理逻辑：

- 如果事件 `requestId` 和当前请求不一致，直接忽略。
- `message.start` 到达时绑定 assistant 服务端元数据。
- 每个事件都会尝试调用 `ensureAssistantServerBinding`。
- 如果事件 `messageId` 和当前 assistant 不一致，直接忽略。
- 事件按 `type` 分发给 markdown、artifact、done、error 分支。

输出：

- 当前 assistant 气泡被持续更新。
- 非当前请求或非当前消息的事件不会污染 UI。

边界规则：

- 当前代码一次只允许一个 streaming 请求。
- 多并发对话不是当前阶段目标。

#### 节点 10：Markdown 增量渲染

代码入口：

- `src/views/agent-chat/index.tsx`
- `src/store/useChatStore.ts`
- `src/components/chat/AssistantMessageContent.tsx`
- `src/components/markdown/MarkdownRenderer.tsx`

触发条件：

- 收到 `markdown.delta`。

输入：

```json
{
  "format": "markdown",
  "delta": "一段 Markdown 增量文本"
}
```

处理逻辑：

- `appendAssistantMarkdown` 找到当前 assistant 消息。
- 将新 `delta` 拼接到旧 `markdownText` 末尾。
- 消息状态置为 `streaming`。
- Zustand 更新后触发 `AgentChat` 重新渲染。
- `AssistantMessageContent` 将完整 `markdownText` 交给 `MarkdownRenderer`。
- `MarkdownRenderer` 使用 `react-markdown`、`remark-gfm`、`rehype-sanitize` 渲染。

输出：

- 页面看到 Markdown 内容逐步增长。

边界规则：

- Markdown 是 append 模式，不是 replace 模式。
- 每次 delta 当前都会触发一次 store 更新和 Markdown 重解析。
- 后续大文本场景建议增加 delta 合并节流。

#### 节点 11：artifact.replace 存储与聊天小预览

代码入口：

- `src/views/agent-chat/index.tsx`
- `src/store/useChatStore.ts`
- `src/components/chat/AssistantMessageContent.tsx`
- `src/components/cargo/cargoPackingView.ts`

触发条件：

- 收到 `artifact.replace`。

输入：

- `payload.artifact`
- artifact.kind 当前要求为 `cargo_packing_plans`。

处理逻辑：

- 如果 `payload.artifact` 不存在，直接忽略。
- `replaceAssistantArtifact` 用 `artifact.id` 作为 key 保存完整快照。
- `activeArtifactId` 更新为当前 artifact id。
- 同一个 artifact id 再次到达时覆盖旧快照。
- 聊天小预览读取 assistant 消息中的 artifacts。
- 小预览调用 `getPreferredPlan` 取推荐计划。
- 如果没有推荐计划，则取第一个计划。
- 小预览调用 `getContainerByNo(plan, null)` 取第一个箱子。
- `createCargoLayoutView` 把业务 artifact 转成 3D canvas 使用的数据结构。

输出：

- assistant 气泡中出现 3D 小预览卡片。
- 用户可点击“在 3D 页面查看”。

边界规则：

- artifact 是 replace 模式，不是 delta append 模式。
- 前端不修改 `artifact.data.plans` 业务内容。
- artifact 结构不完整时，小预览返回 `null`，不渲染卡片。

#### 节点 12：assistant 完成、失败与取消

代码入口：

- `src/views/agent-chat/index.tsx`
- `src/store/useChatStore.ts`

触发条件：

- 收到 `message.done`。
- 收到 `message.error`。
- HTTP/SSE 抛出异常。
- 用户新开对话、删除当前会话或页面卸载触发 abort。

输入：

- SSE 终止事件。
- Error 或 DOMException。

处理逻辑：

- `message.done` 调用 `completeAssistantMessage`，状态置为 `done`。
- `message.error` 调用 `failAssistantMessage`，状态置为 `error`。
- `AbortError` 调用 `cancelAssistantMessage`，状态置为 `cancelled`。
- 其他异常统一转成用户可读错误信息。
- finally 中如果当前 controller 仍是本次请求，则清空 `abortControllerRef`。

输出：

- loading 消失。
- 错误信息或取消状态在 assistant 气泡中展示。

边界规则：

- 已经 `done` 或 `error` 的消息不会被 cancel 覆盖。
- 新开对话或删除当前会话会先 abort 当前 SSE，再切换当前会话状态。

#### 节点 13：完整 3D 页面展示

代码入口：

- `src/views/cargo-3d/index.tsx`
- `src/components/cargo/CargoPackingPreviewWorkspace.tsx`
- `src/components/cargo/CargoInfoCard.tsx`
- `src/components/cargo/CargoLayoutCanvas.tsx`

触发条件：

- 用户在聊天小预览点击“在 3D 页面查看”。
- 用户直接访问 `/cargo-3d`。

输入：

- store 中所有 assistant 消息的 artifacts。
- `activeArtifactId`。

处理逻辑：

- `Cargo3DPage` 从 store 收集所有 assistant artifacts。
- 优先按 `activeArtifactId` 找当前 artifact。
- 如果找不到，则使用最近一个 artifact。
- 没有 artifact 时展示空态，并提供返回聊天按钮。
- 工作台默认选择推荐计划和第一个箱子。
- 切换 artifact 后重置计划和箱子选择。
- 切换计划后，如果当前箱号不存在，则回到该计划第一个箱子。
- 切换箱子后默认选中第一件货物。

输出：

- 左侧展示 3D canvas。
- 右侧展示货物信息和装载摘要。
- 底部展示当前箱货物切换按钮。

边界规则：

- 完整 3D 页面不重新请求后端。
- 3D 页面完全依赖聊天过程中保存到 store 的 artifact。

#### 节点 14：3D 坐标转换与 Canvas 渲染

代码入口：

- `src/components/cargo/cargoPackingView.ts`
- `src/components/cargo/CargoLayoutCanvas.tsx`

触发条件：

- 聊天小预览或完整 3D 工作台需要渲染某个箱子。

输入：

- `CargoPackingPlansArtifact`
- 当前 `CargoPackingPlan`
- 当前 `CargoPackingContainer`

处理逻辑：

- `createCargoLayoutView` 将后端箱内坐标转换为 three.js mesh 中心点坐标。
- `cargoSpecs` 按 `boxId` 记录每个货物尺寸、重量、体积。
- `placements` 按货物生成 3D 位置、颜色和元数据。
- `getItemColor` 根据 `skuCode` 或 `boxId` 生成稳定颜色。
- `CargoLayoutCanvas` 根据集装箱尺寸计算相机位置。
- 初始相机视角约为 40 度俯瞰。
- `CargoCamera` 使用 `useLayoutEffect` 同步相机，减少初始化抖动。
- `CargoLayoutScene` 渲染透明集装箱外框、深色底面和货物 box mesh。

输出：

- 可旋转查看的 3D 装箱效果。
- 点击货物时同步选中状态和右侧信息卡。

边界规则：

- 所有坐标展示和转换中的关键数字通过 `decimal.js` 降低浮点尾巴。
- 当前不加载纹理。
- 当前不支持拖拽、碰撞、重力模拟。

#### 节点 15：3D 调试预览

代码入口：

- `src/views/3d-preview/index.tsx`
- `src/components/cargo/CargoPackingPreviewWorkspace.tsx`

触发条件：

- 用户访问 `/3d-preview`。
- 用户粘贴 JSON 并点击“解析并渲染”。

输入：

- 完整 artifact。
- `artifact.replace.payload`。
- `artifact.data`。

处理逻辑：

- `getArtifactCandidate` 兼容三种常见输入格式。
- `normalizeCargoPackingArtifact` 只做外层包装归一化。
- 如果没有 `data.plans`，展示错误。
- 如果 `data.plans` 为空，展示错误。
- 如果缺少 `recommendedPlanNo`，取推荐计划或第一个计划补齐。
- 成功解析后写入 localStorage，用于刷新恢复调试数据。
- 成功解析后复用完整 3D 工作台渲染。

输出：

- 合法 JSON 被渲染成 3D 工作台。
- 非法 JSON 展示错误提示。

边界规则：

- 不修改 `data.plans` 内部业务结构。
- 当前只支持 `cargo_packing_plans`。

#### 节点 16：新开对话、删除会话与退出清理

代码入口：

- `src/views/agent-chat/index.tsx`
- `src/store/useChatStore.ts`

触发条件：

- 用户点击“开启新对话”。
- 用户删除某条会话历史。
- `AgentChat` 组件卸载。

输入：

- 当前 `abortControllerRef.current`。
- 当前聊天 store。

处理逻辑：

- 新开对话或删除当前会话时先 abort 当前 SSE。
- 清空 `abortControllerRef`。
- 新开对话时保存当前会话快照，并创建一个新的空会话。
- 删除会话时从本地会话索引和会话快照中移除目标会话。
- 删除当前会话后，优先切换到最近一条剩余会话；如果没有剩余会话，则创建空会话。
- Zustand persist 同步更新当前激活会话。
- 组件卸载时，`useEffect` cleanup abort 当前 SSE。

输出：

- 新开对话后页面进入欢迎空态，但旧会话仍保留在侧边历史中。
- 删除某条会话后，缓存中不再恢复该会话内容。
- 后台 SSE 不再继续写入已卸载页面。

边界规则：

- 删除会话是前端本地清理，不会调用后端删除会话。
- 如果未来需要删除服务端历史，需要新增接口和确认弹窗。

## 4. HTTP 与 SSE 需求

### 4.1 API 基础地址

统一由 `src/api/http.ts` 管理。

需求：

- 支持 `VITE_CHAT_API_BASE_URL` 配置。
- 未配置时使用当前代码中的临时联调地址。
- 页面组件不得直接拼接完整后端域名。

### 4.2 发送消息接口

```http
POST /api/chat/messages
Content-Type: application/json
```

请求体：

```json
{
  "conversationId": null,
  "clientMessageId": "client_msg_xxx",
  "text": "请根据这些出货批次生成装柜方案",
  "files": [],
  "context": {
    "bizType": "cargo_packing",
    "mode": "new_plan",
    "hints": {}
  }
}
```

字段说明：

- `conversationId`：后端会话 ID，首次为 `null`。
- `clientMessageId`：前端每次发送生成的幂等 ID。
- `text`：自然语言输入。
- `files`：文件引用，当前预留。
- `context`：轻量上下文，当前固定为装柜业务。

响应体要求：

```json
{
  "data": {
    "accepted": true,
    "conversationId": "conv_xxx",
    "requestId": "req_xxx",
    "sseChannel": "/api/chat/stream?conversationId=conv_xxx&requestId=req_xxx"
  }
}
```

### 4.3 SSE 连接

前端使用 `@microsoft/fetch-event-source` 订阅后端返回的 `sseChannel`。

连接要求：

- 请求方法：`GET`
- `Accept: text/event-stream`
- 支持页面隐藏后继续保持连接。
- 后端需要定期发送心跳，避免代理超时。

前端校验：

- HTTP 状态必须成功。
- `Content-Type` 必须包含 `text/event-stream`。
- SSE 事件名和 data 内的 `type` 必须一致。
- 不认识的事件格式视为异常。

### 4.4 SSE 事件外壳

每条 SSE data 必须是 JSON 字符串：

```json
{
  "eventId": "evt_xxx",
  "conversationId": "conv_xxx",
  "requestId": "req_xxx",
  "messageId": "msg_xxx",
  "seq": 1,
  "type": "markdown.delta",
  "ts": "2026-05-15T00:00:00.000Z",
  "payload": {}
}
```

字段要求：

- `eventId`：事件唯一 ID。
- `seq`：同一个请求内严格递增。
- `requestId`：必须和当前请求一致。
- `messageId`：同一条 assistant 消息保持一致。
- `payload`：不同事件类型对应不同结构。

前端去重规则：

- 已见过的 `eventId` 不再处理。
- `seq <= latestSeq` 不再处理。

## 5. SSE 事件类型需求

### 5.1 `message.start`

含义：assistant 回复开始。

前端行为：

- 绑定服务端 `conversationId/requestId/messageId`。
- 将 assistant 消息置为 accepted/streaming 相关状态。

### 5.2 `markdown.delta`

含义：Markdown 文本增量。

payload：

```json
{
  "format": "markdown",
  "delta": "正在读取业务数据...\n"
}
```

前端行为：

- 将 `delta` append 到当前 assistant 消息的 `markdownText`。
- 重新渲染 Markdown。

要求：

- 后端应尽量按段落或句子推送，不建议一个字一个字推送。
- 未来如果 delta 很碎，前端需要增加节流合并。

### 5.3 `artifact.replace`

含义：完整替换某个 artifact 的最新快照。

payload：

```json
{
  "artifact": {
    "id": "artifact_xxx",
    "kind": "cargo_packing_plans",
    "version": "1.0.0",
    "title": "装箱方案",
    "data": {
      "recommendedPlanNo": "PLAN_A",
      "plans": []
    }
  }
}
```

前端行为：

- 如果 `payload.artifact` 不存在，则忽略。
- 用 `artifact.id` 作为 key 保存。
- 同一个 `artifact.id` 后续 replace 会覆盖旧值。
- 不改变 `artifact.data` 的业务内容。

### 5.4 `message.done`

含义：assistant 回复完成。

前端行为：

- 将消息状态置为 done。
- 清理当前请求 controller。

### 5.5 `message.error`

含义：后端处理失败。

前端行为：

- 将消息状态置为 error。
- 展示错误信息。

### 5.6 `heartbeat`

含义：保活。

前端行为：

- 当前无需展示。
- 可用于调试连接状态。

## 6. 3D artifact 数据需求

当前前端消费的核心结构：

```ts
interface CargoPackingPlansArtifact {
  id: string;
  kind: "cargo_packing_plans";
  version: "1.0.0";
  title: string;
  data: {
    recommendedPlanNo: string;
    plans: CargoPackingPlan[];
  };
}
```

计划结构：

```ts
interface CargoPackingPlan {
  planNo: string;
  strategyCode: string;
  recommended: boolean;
  summary: {
    containerCount: number;
    containerMix: string;
    totalVolumeCbm: number;
    totalWeightKg: number;
    avgVolumeUtilization: number;
    avgWeightUtilization: number;
    totalScore: number;
  };
  containers: CargoPackingContainer[];
  risks: CargoPackingRisk[];
}
```

箱子结构：

```ts
interface CargoPackingContainer {
  containerNo: string;
  containerType: string;
  innerLength: number;
  innerWidth: number;
  innerHeight: number;
  totalVolumeCbm: number;
  totalWeightKg: number;
  volumeUtilization: number;
  weightUtilization: number;
  items: CargoPackingItem[];
}
```

货物结构：

```ts
interface CargoPackingItem {
  boxId: string;
  skuCode: string;
  skuName: string;
  factoryCode: string;
  warehouseCode: string;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  rotateType: number;
  volumeCbm: number;
  weightKg: number;
  cartonCount: number;
}
```

坐标口径：

- 后端给的是箱内坐标。
- 前端会转换成 three.js mesh 中心点坐标。
- 前端统一使用 `decimal.js` 处理坐标、百分比、尺寸展示相关计算。
- 后端暂时不要下发需要前端加载的纹理资源。

## 7. 渲染需求

### 7.1 Markdown 渲染

组件：

- `src/components/markdown/MarkdownRenderer.tsx`

要求：

- 支持 GFM 表格、列表等格式。
- 使用 `rehype-sanitize` 过滤不安全 HTML。
- 不支持直接执行后端返回的脚本。

### 7.2 聊天 3D 小预览

组件：

- `src/components/chat/AssistantMessageContent.tsx`

要求：

- 只展示推荐计划。
- 没有推荐计划时展示第一个计划。
- 只展示当前计划的第一个箱子。
- 小预览不启用货物点击交互。
- 点击按钮进入 `/cargo-3d`。

### 7.3 完整 3D 渲染

组件：

- `src/components/cargo/CargoLayoutCanvas.tsx`

要求：

- 使用 `@react-three/fiber` 渲染。
- 使用 `OrbitControls` 支持旋转视角。
- 初始视角约 40 度俯瞰。
- 集装箱外框透明，底面深色。
- 货物按 `boxId/skuCode` 生成稳定颜色。
- 选中货物时高亮边缘和 emissive。

## 8. 状态管理需求

状态库：

- Zustand

文件：

- `src/store/useChatStore.ts`

状态要求：

- `messages` 保存全部聊天消息。
- user 消息包含 `clientMessageId`。
- assistant 消息包含 `markdownText` 和 `artifacts`。
- `activeArtifactId` 用于完整 3D 页定位当前 artifact。
- `serverConversationId` 用于下一次消息继续同一会话。

ID 生成职责：

- 前端生成 `clientMessageId` 和本地渲染 ID。
- 后端生成 `conversationId/requestId/messageId/eventId/artifact.id`。

## 9. 聊天缓存方案

当前代码已采用方案一实现单会话临时缓存。侧边对话历史属于多会话本地历史，需要在现有方案上升级存储结构。

### 9.1 方案一：localStorage + Zustand persist

适用场景：

- 当前阶段快速落地。
- 聊天记录量较小。
- artifact 数据规模可控。
- 主要目标是刷新页面后恢复最近聊天内容。

实现文件：

- `src/store/useChatStore.ts`

当前实现：

- 使用 `zustand/middleware` 的 `persist`。
- 缓存 key 为 `ai-cargo-chat-cache`。
- 缓存版本号为 `1`。
- 最多缓存最近 `50` 条消息。

缓存字段：

- `messages`
- `serverConversationId`
- `activeArtifactId`

恢复策略：

- 页面刷新后自动恢复缓存。
- 如果 assistant 消息处于 `pending`、`accepted`、`streaming`，恢复时统一改为 `cancelled`。
- 原因是刷新后原 SSE 连接已经丢失，前端不能假装仍在生成。

优点：

- 改动最小。
- 不需要新增依赖。
- 和现有 Zustand store 贴合。
- 清理当前会话时会同步更新缓存状态。

限制：

- localStorage 容量较小，通常约 5MB。
- 写入是同步操作，超大 artifact 可能阻塞主线程。
- 不适合长期保存大量会话。
- 不适合保存敏感内容。

### 9.2 方案二：sessionStorage + Zustand persist

适用场景：

- 只希望当前标签页临时保留聊天内容。
- 关闭浏览器或标签页后自动丢弃。
- 对隐私更敏感，不希望长期落盘。

实现方式：

- 仍使用 `zustand/middleware` 的 `persist`。
- 把 storage 从 `localStorage` 改为 `sessionStorage`。

优点：

- 实现成本和方案一几乎一样。
- 生命周期更短，隐私风险更低。

限制：

- 浏览器或标签页关闭后无法恢复。
- 不能跨标签页共享聊天缓存。

### 9.3 方案三：IndexedDB

适用场景：

- 未来存在大量聊天历史。
- artifact 数据很大。
- 需要多会话列表。
- 需要更稳定的本地历史管理。

建议实现：

- 使用 IndexedDB 保存消息和 artifact。
- `messages` 中只保留 artifact 引用 ID。
- 大 artifact 单独入库。
- UI 进入 3D 页面时按需读取 artifact。

优点：

- 容量更大。
- 更适合保存结构化数据。
- 可以按会话、时间、artifact 类型建立索引。

限制：

- 实现复杂度更高。
- 需要处理异步初始化、迁移和异常恢复。
- UI 读取数据时要处理 loading 状态。

### 9.4 当前缓存验收标准

- 刷新页面后，最近聊天记录可以恢复。
- 刷新页面后，已完成的 Markdown 和 artifact 可以继续查看。
- 刷新前未完成的 assistant 消息恢复后显示为已取消。
- 新开对话后，旧会话仍保留在侧边历史中。
- 删除某条会话后，该会话不再出现在侧边历史中。
- 单个会话最多保留最近 `50` 条消息，避免无限膨胀。
- 正在生成时新开对话、accepted 后更新 URL，页面不应出现“页面刷新后已停止本次生成”。
- `cancelled` 状态只展示为取消提示，不按红色错误正文展示；真正的 `message.error` 才展示错误样式。

### 9.5 多会话历史推荐方案：localStorage 分片存储

评估结论：

- 当前协议已返回 `conversationId`，足够支撑“切回某个会话后继续发送消息”。
- 当前没有服务端历史查询接口，无法从后端恢复旧消息；历史内容必须存前端本地。
- 当前历史是前端体验增强，不是业务归档；第一阶段推荐继续使用 `localStorage`。
- 不建议继续沿用单个 `ai-cargo-chat-cache` 保存全部会话，否则历史增加后每次写入都会重写大 JSON，容易触发容量和性能问题。

推荐存储结构：

```text
ai-cargo-chat-history-index
ai-cargo-chat-history-active
ai-cargo-chat-history-session:{localConversationId}
```

`ai-cargo-chat-history-index` 保存轻量索引：

```ts
type ChatHistoryIndexItem = {
  localConversationId: string;
  serverConversationId: string | null;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessagePreview: string;
};
```

`ai-cargo-chat-history-active` 保存当前激活会话：

```ts
type ActiveChatHistory = {
  localConversationId: string;
};
```

`ai-cargo-chat-history-session:{localConversationId}` 保存会话详情：

```ts
type ChatHistorySession = {
  localConversationId: string;
  serverConversationId: string | null;
  activeArtifactId: string | null;
  messages: ChatMessage[];
};
```

写入策略：

- 创建新对话时先生成 `localConversationId`，此时 `serverConversationId` 为 `null`。
- 首次 HTTP accepted 后，把后端返回的 `conversationId` 写入当前会话详情和索引。
- 每次消息变化后，只更新当前会话详情和索引摘要。
- 实时写入会话详情时必须保留消息真实状态，不允许把 `pending`、`accepted`、`streaming` 提前改成 `cancelled`。
- 未完成消息改成 `cancelled` 只属于“恢复策略”，不属于“写入策略”。
- 索引按 `updatedAt` 倒序展示。
- 单会话继续沿用最近 `50` 条消息上限。
- 建议保留最近 `20` 到 `30` 个会话；超过数量时只清理最旧的本地会话。

读取策略：

- 打开 `/chat` 时读取 `ai-cargo-chat-history-active`。
- 打开 `/chat?conversationId=xxx` 时先按 `serverConversationId` 匹配索引；匹配不到时按 `localConversationId` 匹配。
- 如果 URL 中的 `conversationId` 等于当前激活会话的 `localConversationId` 或 `serverConversationId`，直接保持当前内存状态，不重复读取缓存。
- 找到会话后加载对应 session，并恢复 `messages/serverConversationId/activeArtifactId`。
- 恢复时继续把未完成 assistant 消息改为 `cancelled`。

删除策略：

- 删除会话时删除索引项和对应 session key。
- 如果删除的是当前会话，切换到最近更新的剩余会话。
- 如果没有剩余会话，创建一个新的空会话。
- 删除只影响前端本地历史，不向后端发送删除请求。

升级到 IndexedDB 的触发条件：

- 单个 artifact 或单个会话详情接近 localStorage 容量上限。
- 会话历史需要超过 `30` 条。
- 需要更细粒度地按 artifact、消息、会话做异步读取。
- 需要降低大 JSON 同步写入对主线程的影响。

## 10. 性能需求

当前实现可以支撑普通 demo 和中小数据量。

风险点：

- `markdown.delta` 太碎会导致频繁 store 更新和 Markdown 重解析。
- 单条 Markdown 过长会增加字符串拼接和渲染成本。
- artifact 很大或 replace 很频繁会导致 3D 数据转换和 canvas 渲染压力。
- 聊天历史过长时，列表整体渲染成本会上升。

优化优先级：

1. 对 `markdown.delta` 做 50ms 到 100ms 合并刷新。
2. 聊天历史做虚拟滚动。
3. 聊天小卡片只低频更新 artifact 或只渲染最终 artifact。
4. 大 artifact 存引用，消息中只保存 artifactId。
5. 3D 视图按需加载或拆分 chunk。

## 11. 安全与稳定性需求

安全要求：

- Markdown 必须 sanitize。
- 页面不得执行后端返回的 HTML 脚本。
- SSE 数据必须做运行时结构校验。
- artifact 缺失或结构不完整时不能导致页面崩溃。

稳定性要求：

- 组件卸载时必须 abort 当前 SSE。
- 新开对话或删除当前会话时必须 abort 当前 SSE。
- SSE 在 `message.done` 前异常关闭时视为错误。
- 持久化写入不得改变进行中消息状态；只有恢复丢失 SSE 连接的会话时才允许转为 `cancelled`。
- `artifact.replace` 缺少 artifact 时忽略。
- `data.plans` 不存在时不能调用 `.find` 导致崩溃。
- localStorage 缓存只用于临时体验，不应用于长期保存敏感业务数据。

## 12. 当前非目标

以下能力当前不作为本阶段需求：

- 前端计算装箱方案。
- 前端生产 container/items 结构化入参。
- 货物拖拽编辑。
- 物理碰撞和重力模拟。
- 纹理资源加载。
- 多端会话同步。
- 页面刷新后的未完成 SSE 恢复。
- 服务端聊天历史持久化。
- 服务端删除聊天历史。
- cookie、x-trace 等自定义请求头接入。

## 13. 验收标准

聊天主链路：

- 用户输入自然语言后，可以成功 POST 到后端。
- accepted 后能连接 SSE。
- `markdown.delta` 可以逐步显示。
- `artifact.replace` 可以生成聊天 3D 小卡片。
- 点击小卡片能进入完整 3D 页面。
- `message.done` 后 loading 消失。
- 异常时能显示错误。

业务单号弹窗：

- 点击输入框左侧按钮能打开弹窗。
- 表格能请求并展示父子数据。
- 分页和搜索可用。
- 父子勾选联动符合预期。
- 确认后批次号追加到输入框末尾。

3D 页面：

- 默认展示推荐计划第一个箱子。
- 可切换计划和箱子。
- 可选中货物并更新右侧信息。
- 坐标展示无明显浮点精度尾巴。

调试页：

- 粘贴合法 artifact 后可以渲染。
- 粘贴非法 JSON 时显示错误。
- 不修改 artifact 内层业务数据。

聊天缓存：

- 刷新页面后可以恢复当前激活会话。
- 左侧 `/chat` 二级菜单可以展示本地会话历史。
- 左侧菜单栏 `开启新对话` 可以创建并切换到新空会话。
- 点击某条历史可以切换到对应会话。
- 每条历史可以单独删除。
- 新开对话不会清空全部历史。
- 未完成流式消息恢复后不继续 loading，而是显示为已取消。
- 删除某条会话后刷新页面不会再恢复该会话内容。

聊天输入区：

- Sender 不展示 placeholder 文案。
- Sender 内不展示 `开启新对话` 按钮。
- 输入框下方展示 `我要智能分柜` 和装柜信息模板两个 Prompt。
- Prompt 背景透明、保留边框，文字前有 Unicode 图标，并提供 hover 反馈。
- 装柜信息模板在桌面宽度优先单行展示。
- 点击 Prompt 后，对应文案填入输入框。

## 14. 待确认问题

- 后端业务单号查询最终接口路径是否固定为 `chat/getShipmentBatchPlanList`。
- 后端真实 artifact 是否完全稳定为 `cargo_packing_plans`。
- 大货量情况下单个 artifact 的最大数据规模。
- 是否需要支持上传文件或从飞书/OSS 选择文件。
- 是否需要将聊天历史持久化到后端。
- 是否需要后端提供删除服务端会话历史接口。

## 15. UI 样式与交互迭代记录 (最新)

### 15.1 侧边栏交互与视觉优化
*   **动画平滑处理**：修复了侧边栏展开/收起时，由于内部容器对齐方式瞬变导致的菜单图标突兀跳动问题，确保过渡动画自然平滑。
*   **子菜单宽度满格**：优化了历史会话子菜单的缩进方式（将 `margin` 改为 `padding`），使子菜单的宽度拉宽至 100%，鼠标悬停时的背景高亮可以撑满整行，视觉更为统一。
*   **折叠态悬浮菜单 (Popover)**：为了提高操作效率，在侧边栏收缩状态下，只需点击“对话历史”菜单，即会通过 Popover（悬浮气泡卡片）展示历史会话子菜单，无需展开整个侧边栏即可快速切换历史会话。
*   **文案汉化与优化**：将左侧菜单的英文导航 "AI Chat" 优化为 "对话历史"，"3D View" 改为 "3D 视图"。

### 15.2 对话界面 (Chat) 输入区与提示词体验升级
*   **提示词 (Prompts) 智能隐藏**：当用户在当前对话中已经发出过消息（即对话历史不为空）时，自动隐藏输入框下方的快捷提示词区域，保持聊天界面的极简清爽。
*   **提示词追加逻辑**：修正了点击提示词会覆盖输入框已有内容的逻辑。现在点击提示词会将内容**追加**到已有文案的后方（若已有文案会自动换行），防止误操作导致用户长文丢失。
*   **现代化“毛玻璃”卡片 UI 重构**：
    *   取消了原先固定死板的宽度限制，让卡片宽度根据内容自适应。
    *   彻底优化了提示词背景，由原先突兀的纯白 (`#ffffff`) 替换为极具质感的半透明微白 (`rgba(255, 255, 255, 0.4)`)，并去掉了生硬的边框和默认重阴影，使其更自然地融入环境底色，不再刺眼。
    *   新增悬浮微动效（卡片轻微上浮，伴随柔和的弥散投影），大幅增强了界面的互动感和现代 UI 质感。
    *   引入了 `✨` 和 `📝` 等生动 Emoji 替换了原本单调的符号。
