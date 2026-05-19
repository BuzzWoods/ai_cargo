# AI Chat 流式协议与 3D 结构数据规范

本文档用于约定当前阶段前后端协议，方便后端直接实现，或将本文档交给 AI 生成服务端代码。

当前前端只消费两类输出：

1. `markdown` 文本内容
2. `cargo_layout` 3D 结构化数据

当前前端输入形态非常简单：

1. 用户自然语言
2. 可选的文件引用信息

前端当前阶段不负责生产 `container/items` 这类结构化业务 JSON。  
如果后端需要容器尺寸、货物清单、Excel 内容、Word 内容或数据库数据，应由后端根据用户自然语言、上传文件或服务端已有数据自行整理，再交给模型编排。

## 1. 当前阶段的输入原则

### 1.1 前端发送什么

前端当前只发送：

- `text`
  用户自然语言
- `files`
  可选的文件引用信息
- `clientMessageId`
  客户端幂等 ID
- `conversationId`
  已有会话时传入，否则为 `null`

### 1.2 前端不发送什么

前端当前不要求发送：

- `container`
- `items`
- 已清洗的装箱数据
- AI 提示词中间态

这些都属于后端编排层职责。

### 1.3 推荐的后端职责

后端收到自然语言后，可以自行组合这些数据源：

- 用户输入文本
- 用户上传的文件
- 服务端可访问的业务文件
- 数据库记录
- 业务规则

后端将这些内容整理后再交给 AI，最后把结果以：

- `markdown.delta`
- `artifact.replace`

两类流式事件返回给前端。

## 2. ID 生成职责

### 2.1 前端生成

- `clientMessageId`
  客户端消息幂等 ID，仅用于标识“本次发送动作”

### 2.2 后端生成

- `conversationId`
  服务端会话 ID
- `requestId`
  本次处理请求的服务端 ID
- `messageId`
  assistant 消息的服务端 ID
- `artifactId`
  某个结构化产物的服务端 ID
- `eventId`
  每个 SSE 事件的唯一 ID
- `seq`
  SSE 顺序号，需严格递增

### 2.3 前端本地 ID

前端内部还有：

- `localUserMessageId`
- `localAssistantMessageId`

这两个只用于前端本地状态和 React 渲染，不发给后端，也不要求后端理解。

## 3. 关于 clientMessageId 的结论

### 3.1 后端是否需要消费

需要。  
建议后端把 `clientMessageId` 当作本次用户发送动作的幂等键或关联键。

推荐用途：

- 重试去重
- 日志追踪
- 请求关联
- 故障排查

### 3.2 后端是否每次都要再传回前端

不是必须。  
当前前端不依赖后端在 SSE 里回传 `clientMessageId`。

当前前端真正依赖的是：

- `conversationId`
- `requestId`
- `messageId`

如果后端愿意，也可以在 HTTP accepted 或 SSE payload 里附带 `clientMessageId`，但不是前端必需字段。

### 3.3 前端是否需要长期持久化

通常不需要跨应用生命周期长期持久化。

建议规则：

- 每次点击发送时新生成一个 `clientMessageId`
- 在当前会话状态中保存即可
- 页面刷新后，如果不做“未完成消息恢复”，可以不保留

只有在下面场景中，才需要更长时间持久化：

- 离线重发
- 页面崩溃恢复
- 断点续传
- 多端同步幂等

当前阶段不必做这么重。

## 4. HTTP 请求协议

## 4.1 请求地址

示例：

```http
POST /api/chat/messages
Content-Type: application/json
```

## 4.2 当前推荐请求体

最小可用版本：

```json
{
  "conversationId": null,
  "clientMessageId": "client_msg_abc12345",
  "text": "请给我一个 16x6x6 集装箱的装箱方案，并输出说明和 3D 布局。"
}
```

带可选文件引用版本：

```json
{
  "conversationId": null,
  "clientMessageId": "client_msg_abc12345",
  "text": "请读取我上传的货物清单，给我生成装箱说明和 3D 布局。",
  "files": [
    {
      "fileId": "file_manifest_001",
      "fileName": "cargo-manifest.xlsx",
      "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "source": "upload"
    }
  ],
  "context": {
    "bizType": "cargo_layout",
    "mode": "natural_language",
    "hints": {
      "expectedOutput": "markdown_and_3d_artifact"
    }
  }
}
```

## 4.3 字段定义

### 顶层字段

- `conversationId: string | null`
  已有会话时传服务端会话 ID
  首次会话传 `null`
- `clientMessageId: string`
  前端生成的幂等 ID
- `text: string`
  用户自然语言
- `files?: ChatInputFileRef[]`
  可选文件引用
- `context?: object`
  可选上下文提示，不要求前端有复杂结构

### files[]

```ts
type ChatInputFileRef = {
  fileId?: string;
  fileName: string;
  mimeType?: string;
  source?: "upload" | "workspace" | "remote";
  uri?: string;
};
```

说明：

- `fileId`
  如果后端有统一文件中心，建议使用
- `fileName`
  文件展示名
- `mimeType`
  文件类型
- `source`
  文件来源
- `uri`
  如果后端支持按路径或 URL 读取，可选使用

### context

当前只建议放弱约束信息，例如：

```json
{
  "bizType": "cargo_layout",
  "mode": "natural_language",
  "hints": {
    "expectedOutput": "markdown_and_3d_artifact"
  }
}
```

注意：

- `context` 是提示，不是业务主数据
- 前端不负责生产装箱结构化输入

## 4.3.1 多会话历史协议评估

当前协议可以支持前端侧边对话历史：

- 每个会话使用后端返回的 `conversationId` 作为继续对话的服务端标识。
- 前端切换到某条本地历史后，后续发送消息继续把该历史绑定的 `conversationId` 放入请求体。
- 新开对话时请求体中的 `conversationId` 继续传 `null`，后端按现有规则创建新 `conversationId`。
- SSE 事件外壳已经包含 `conversationId/requestId/messageId`，前端可以继续用这些字段防止旧请求事件写入错误会话。

当前协议不提供以下能力：

- 拉取服务端历史列表。
- 拉取某个会话的历史消息。
- 删除服务端会话历史。

因此第一阶段侧边历史应定义为“前端本地历史”：消息快照、标题、更新时间和 artifact 都存在浏览器本地；删除历史只删除本地缓存，不影响后端会话。如果未来需要多端同步或服务端历史管理，需要新增独立的历史查询和删除接口。

## 4.4 服务端处理建议

收到请求后，后端建议这样处理：

1. 若 `conversationId === null`，创建新的服务端会话
2. 使用 `clientMessageId` 作为幂等键或追踪键
3. 根据 `text + files + 服务端业务数据` 自行组织 prompt
4. 调用 AI
5. 将 AI 结果拆成：
   `markdown.delta` 和 `artifact.replace`
6. 通过 SSE 返回给前端

## 5. HTTP 响应协议

服务端在受理成功后，立即返回：

```json
{
  "accepted": true,
  "conversationId": "conv_001",
  "requestId": "req_001",
  "sseChannel": "/api/chat/stream?conversationId=conv_001&requestId=req_001"
}
```

### 字段说明

- `accepted: true`
  表示服务端已受理
- `conversationId: string`
  服务端会话 ID
- `requestId: string`
  本次处理请求 ID
- `sseChannel: string`
  前端当前使用该地址建立 SSE

## 6. SSE 协议

## 6.1 响应头

服务端 SSE 响应建议至少包含：

```http
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

## 6.2 统一事件外壳

每一个 SSE `data:` 都必须是 JSON：

```json
{
  "eventId": "req_001_evt_001",
  "conversationId": "conv_001",
  "requestId": "req_001",
  "messageId": "msg_assistant_001",
  "seq": 1,
  "type": "message.start",
  "ts": "2026-04-22T12:00:00.000Z",
  "payload": {}
}
```

### 顶层字段说明

- `eventId`
  当前事件唯一 ID
- `conversationId`
  服务端会话 ID
- `requestId`
  当前处理请求 ID
- `messageId`
  当前 assistant 消息 ID
- `seq`
  递增顺序号
- `type`
  事件类型，必须和 SSE `event:` 字段一致
- `ts`
  ISO 时间字符串
- `payload`
  事件负载

## 6.3 事件类型

当前前端支持：

- `message.start`
- `markdown.delta`
- `artifact.replace`
- `message.done`
- `message.error`
- `heartbeat`

## 6.4 推荐事件顺序

建议按下面顺序发送：

1. `message.start`
2. 多次 `markdown.delta`
3. 可选 `heartbeat`
4. `artifact.replace`
5. 可继续补充 `markdown.delta`
6. `message.done`

前端对异常顺序有一定容错，但后端仍应尽量遵守。

## 7. 各事件 payload 定义

## 7.1 `message.start`

```json
{
  "role": "assistant",
  "contentType": "markdown"
}
```

## 7.2 `markdown.delta`

```json
{
  "format": "markdown",
  "delta": "## 装箱方案\n\n"
}
```

说明：

- 前端直接 append 所有 `delta`
- `delta` 是增量文本，不是全量文本
- 输出标准 markdown 字符串即可

## 7.3 `artifact.replace`

```json
{
  "artifact": {
    "id": "artifact_001",
    "kind": "cargo_layout",
    "version": "1.0.0",
    "title": "集装箱三维装箱结果",
    "data": {}
  }
}
```

## 7.4 `message.done`

```json
{
  "finishReason": "completed"
}
```

## 7.5 `message.error`

```json
{
  "code": "MODEL_TIMEOUT",
  "message": "模型生成超时"
}
```

## 7.6 `heartbeat`

```json
{
  "intervalMs": 15000
}
```

## 8. cargo_layout 结构定义

后端返回的 3D 数据必须放在 `artifact.replace.payload.artifact` 中，`kind` 固定为 `cargo_layout`。

```ts
type CargoLayoutArtifact = {
  id: string;
  kind: "cargo_layout";
  version: "1.0.0";
  title: string;
  data: {
    container: {
      id: string;
      size: { w: number; h: number; d: number };
      unit: "m" | "cm" | "mm";
    };
    cargoBasicInfos: Array<{
      id: string;
      sku: string;
      name: string;
      category?: string;
      quantity: number;
      packageType: "carton" | "pallet" | "crate" | "bag" | "drum" | "other";
      stackable: boolean;
      fragile: boolean;
      dangerousGoods: boolean;
      temperatureControlled: boolean;
      origin?: string;
      destination?: string;
      meta?: {
        note?: string;
      };
    }>;
    cargoSpecs: Record<
      string,
      {
        weightKg: number;
        dimensions: { w: number; h: number; d: number };
        volumeM3?: number;
      }
    >;
    placements: Array<{
      id: string;
      cargoId: string;
      position: { x: number; y: number; z: number };
      color: string;
      meta?: {
        note?: string;
      };
    }>;
    summary: {
      totalItems: number;
      fillRate: number;
      notes: string[];
    };
  };
};
```

## 8.1 语义约束

- `cargoBasicInfos` 是货物主数据，只描述是什么、数量、包装和业务属性
- `cargoSpecs` 是货物规格数据，按 `cargoId` 维护重量和尺寸
- `placements` 是货物摆放信息，只描述位置和渲染相关信息
- `position` 表示货物几何中心坐标
- `dimensions.w/h/d` 必须大于 0
- `fillRate` 推荐使用 0 到 1 的小数
- `color` 推荐使用十六进制颜色，例如 `#60a5fa`

## 8.2 3D artifact 示例

```json
{
  "id": "artifact_001",
  "kind": "cargo_layout",
  "version": "1.0.0",
  "title": "集装箱三维装箱结果",
  "data": {
    "container": {
      "id": "container_40hq_demo",
      "size": { "w": 16, "h": 6, "d": 6 },
      "unit": "m"
    },
    "cargoBasicInfos": [
      {
        "id": "cargo_001",
        "sku": "SKU-A",
        "name": "电子配件",
        "category": "3C配件",
        "quantity": 2,
        "packageType": "carton",
        "stackable": true,
        "fragile": true,
        "dangerousGoods": false,
        "temperatureControlled": false,
        "origin": "深圳",
        "destination": "上海",
        "meta": {
          "note": "轻拿轻放"
        }
      }
    ],
    "cargoSpecs": {
      "cargo_001": {
        "weightKg": 120,
        "dimensions": { "w": 2, "h": 1, "d": 1 },
        "volumeM3": 0.2
      }
    },
    "placements": [
      {
        "id": "placement_001",
        "cargoId": "cargo_001",
        "position": { "x": -7, "y": -2.5, "z": -2.5 },
        "color": "#60a5fa",
        "meta": {
          "note": "靠左侧底部摆放"
        }
      }
    ],
    "summary": {
      "totalItems": 1,
      "fillRate": 0.38,
      "notes": [
        "重货优先靠近底部和中轴放置。",
        "不可堆叠货物保持顶部无遮挡。"
      ]
    }
  }
}
```

## 9. 关于 artifact.replace 的结论

`artifact.replace` 的含义是：

替换“某一个 artifactId 对应的完整快照”。

它不是说：

- 整个系统里只能有一个 3D 视图
- 全局只能维护一份 artifact

更准确的理解是：

- 每个 artifact 有自己的 `artifact.id`
- 同一个 artifact 如果内容更新，就继续 `replace` 这个 artifact.id
- 不同的 3D 结果可以使用不同的 `artifact.id`

### 当前前端阶段的实际用法

当前前端通常是一条 assistant 消息对应 0 个或 1 个 `cargo_layout` artifact。  
但协议层并不限制未来扩展成：

- 一条消息多个 artifact
- 一个会话多个 3D 结果
- 一个结果被后续 replace 多次

## 10. 完整时序示例

## 10.1 HTTP 请求

```json
{
  "conversationId": null,
  "clientMessageId": "client_msg_abc12345",
  "text": "请读取我上传的货物清单，给我生成装箱说明和 3D 布局。",
  "files": [
    {
      "fileId": "file_manifest_001",
      "fileName": "cargo-manifest.xlsx",
      "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "source": "upload"
    }
  ],
  "context": {
    "bizType": "cargo_layout",
    "mode": "natural_language",
    "hints": {
      "expectedOutput": "markdown_and_3d_artifact"
    }
  }
}
```

## 10.2 HTTP 响应

```json
{
  "accepted": true,
  "conversationId": "conv_001",
  "requestId": "req_001",
  "sseChannel": "/api/chat/stream?conversationId=conv_001&requestId=req_001"
}
```

## 10.3 SSE 原始帧示例

```text
event: message.start
data: {"eventId":"req_001_evt_001","conversationId":"conv_001","requestId":"req_001","messageId":"msg_assistant_001","seq":1,"type":"message.start","ts":"2026-04-22T12:00:00.000Z","payload":{"role":"assistant","contentType":"markdown"}}

event: markdown.delta
data: {"eventId":"req_001_evt_002","conversationId":"conv_001","requestId":"req_001","messageId":"msg_assistant_001","seq":2,"type":"markdown.delta","ts":"2026-04-22T12:00:00.150Z","payload":{"format":"markdown","delta":"## 装箱方案\n\n"}}

event: markdown.delta
data: {"eventId":"req_001_evt_003","conversationId":"conv_001","requestId":"req_001","messageId":"msg_assistant_001","seq":3,"type":"markdown.delta","ts":"2026-04-22T12:00:00.300Z","payload":{"format":"markdown","delta":"我已经根据文件和业务规则生成了一版可视化装箱结果。\n\n"}}

event: artifact.replace
data: {"eventId":"req_001_evt_004","conversationId":"conv_001","requestId":"req_001","messageId":"msg_assistant_001","seq":4,"type":"artifact.replace","ts":"2026-04-22T12:00:00.800Z","payload":{"artifact":{"id":"artifact_001","kind":"cargo_layout","version":"1.0.0","title":"集装箱三维装箱结果","data":{"container":{"id":"container_40hq_demo","size":{"w":16,"h":6,"d":6},"unit":"m","origin":"container-center","axis":"x-right-y-up-z-forward"},"items":[{"id":"cargo_001","label":"SKU-A x2","size":{"w":2,"h":1,"d":1},"position":{"x":-7,"y":-2.5,"z":-2.5},"color":"#60a5fa"}],"summary":{"totalItems":1,"fillRate":0.38,"notes":["重货优先靠近底部和中轴放置。"]}}}}}

event: message.done
data: {"eventId":"req_001_evt_005","conversationId":"conv_001","requestId":"req_001","messageId":"msg_assistant_001","seq":5,"type":"message.done","ts":"2026-04-22T12:00:01.000Z","payload":{"finishReason":"completed"}}
```

## 11. 后端实现注意事项

- `event:` 字段必须与 JSON 中的 `type` 完全一致
- 同一次 assistant 回复的所有 SSE 事件必须复用同一个 `messageId`
- 同一次请求的所有 SSE 事件必须复用同一个 `requestId`
- `seq` 必须严格递增
- `markdown.delta` 请按顺序发送，前端会直接 append
- `artifact.replace` 请发送完整对象，不要发送半截 JSON
- `message.done` 必须显式发送，前端不能只靠断流判断完成
- 首次请求若 `conversationId` 为空，后端必须创建新的 `conversationId`
- 前端当前不要求后端回传 `clientMessageId`

## 12. 给后端 AI 的实现指令

如果你要把这份协议直接交给 AI 生成后端代码，可以把下面这段一起给它：

```text
请实现一个聊天接口，要求：

1. HTTP POST /api/chat/messages 接收 JSON 请求体
2. conversationId 可为空，为空时创建新的服务端 conversationId
3. clientMessageId 由客户端传入，后端使用它做幂等或日志追踪，但不强制在 SSE 中回传
4. 前端当前只提供 text 和可选 files，不会提供 container/items 这类结构化装箱 JSON
5. 后端需要根据 text、files、服务端已有业务数据自行组织 prompt
6. HTTP accepted 响应必须返回 accepted、conversationId、requestId、sseChannel
7. SSE 返回格式为 text/event-stream
8. SSE 每个 data 都是 JSON，必须包含：
   eventId、conversationId、requestId、messageId、seq、type、ts、payload
9. type 必须支持：
   message.start、markdown.delta、artifact.replace、message.done、message.error、heartbeat
10. markdown.delta 的 payload 必须为：
    { "format": "markdown", "delta": "..." }
11. artifact.replace 的 payload.artifact.kind 固定为 cargo_layout
12. cargo_layout 的坐标系固定为：
    origin=container-center
    axis=x-right-y-up-z-forward
13. position 表示货物几何中心
14. 同一条 assistant 回复的所有 SSE 事件必须使用同一个 messageId
15. 最后必须发送 message.done
```

## 13. 当前前端参考实现

- 协议类型：
  [src/api/protocol.ts](/Users/huangwentao/Desktop/ly/ai_cargo/src/api/protocol.ts)
- 前端真实接入层：
  [src/api/chat.ts](/Users/huangwentao/Desktop/ly/ai_cargo/src/api/chat.ts)
- SSE 消费层：
  [src/api/chat.ts](/Users/huangwentao/Desktop/ly/ai_cargo/src/api/chat.ts)
- 前端状态映射：
  [src/store/useChatStore.ts](/Users/huangwentao/Desktop/ly/ai_cargo/src/store/useChatStore.ts)

如果后端严格按本文档实现，前端当前协议层无需再改。
