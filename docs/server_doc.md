1. 接入总览

AI 智能排柜采用“提交消息 + SSE 接收结果”的异步模式。

前端接入顺序：

1. 调用 POST /api/chat/messages 提交用户消息。
2. 从返回结果中读取 data.sseChannel。
3. 使用 EventSource 订阅 GET /api/chat/stream。
4. 按 SSE 事件类型渲染进度、markdown、3D 装柜 artifact 和完成状态。
   当前阶段后端已跑通 Java 主控、Java SSE、Java MVP 排柜、cargo_layout artifact。真实 SCM 业务数据和 Python LangGraph 约束解析尚未接入，当前排柜货物仍是后端 demo 数据。

5. 接口一：提交 AI 排柜消息

2.1 基本信息

POST /api/chat/messages
Content-Type: application/json

Controller：

com.lingyi.scm.base.web.controller.aicargo.AiCargoChatController#messages

请求 DTO：

com.lingyi.scm.base.model.dto.aicargo.AiCargoChatMessageRequestDTO

2.2 请求参数

字段
类型
必填
说明
conversationId
string
否
会话 ID。为空时后端自动生成；继续同一轮会话时传上一次返回的 conversationId。
clientMessageId
string
否
前端本地消息 ID，用于前端把本地消息和后端受理结果关联。
text
string
否
用户自然语言输入。当前阶段不会影响 demo 排柜数据，但建议前端正常传。
files
array
否
附件引用列表。当前阶段预留，后续用于上传装柜清单。
context
object
否
页面或业务上下文。当前阶段预留，后续用于查询真实 SCM 数据。

files[] 字段：

字段
类型
说明
fileId
string
文件唯一标识。
fileName
string
文件名。
mimeType
string
文件 MIME 类型。
source
string
文件来源，例如 upload、feishu、oss。
uri
string
文件访问地址或内部对象存储路径。

context 字段：

字段
类型
说明
bizType
string
业务类型，例如 cargo_packing。
mode
string
模式，例如 new_plan、adjust_plan。
hints
object
扩展上下文，例如订单 ID、仓库 ID、页面筛选条件。

2.3 最小请求示例

{
"text": "请帮我生成一个装柜方案"
}

2.4 完整请求示例

{
"conversationId": "conv_001",
"clientMessageId": "client_msg_001",
"text": "请根据当前货物生成一个40HQ装柜方案，并说明风险点",
"files": [
{
"fileId": "file_001",
"fileName": "装柜清单.xlsx",
"mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
"source": "upload",
"uri": "oss://scm-ai-cargo/demo/装柜清单.xlsx"
}
],
"context": {
"bizType": "cargo_packing",
"mode": "new_plan",
"hints": {
"warehouseId": 1001,
"purchaseOrderId": 2001
}
}
}

2.5 响应说明

接口返回项目统一的 R<T> 包装。前端重点读取 data。

data 字段：

字段
类型
说明
accepted
boolean
是否已受理。
conversationId
string
会话 ID。
requestId
string
本次请求 ID，订阅 SSE 时必须携带。
sseChannel
string
SSE 订阅地址。

响应示例：

{
"data": {
"accepted": true,
"conversationId": "conv_001",
"requestId": "req_6a8b2f0d2c11",
"sseChannel": "/api/chat/stream?conversationId=conv_001&requestId=req_6a8b2f0d2c11"
}
}

3. 接口二：订阅 SSE 事件

3.1 基本信息

GET /api/chat/stream?conversationId={conversationId}&requestId={requestId}
Accept: text/event-stream

Controller：

com.lingyi.scm.base.web.controller.aicargo.AiCargoChatController#stream

3.2 query 参数

字段
类型
必填
说明
conversationId
string
是
POST /api/chat/messages 返回的会话 ID。
requestId
string
是
POST /api/chat/messages 返回的请求 ID。

3.3 SSE 事件外壳

每条 SSE 的 event.data 是一个 JSON 字符串，解析后结构如下：

{
"eventId": "req_6a8b2f0d2c11_evt_001",
"conversationId": "conv_001",
"requestId": "req_6a8b2f0d2c11",
"messageId": "msg_assistant_58ac92d0a8b1",
"seq": 1,
"type": "message.start",
"ts": "2026-04-27T11:20:00.000Z",
"payload": {}
}

字段说明：

字段
类型
说明
eventId
string
事件 ID，同一个 requestId 下递增。
conversationId
string
会话 ID。
requestId
string
请求 ID。
messageId
string
本次助手回复消息 ID。
seq
number
事件序号，从 1 开始递增。
type
string
事件类型。
ts
string
后端事件时间。
payload
object
不同事件类型的业务载荷。

4. SSE 事件类型

4.1 message.start

含义：助手消息开始。

示例：

{
"type": "message.start",
"payload": {
"role": "assistant",
"contentType": "markdown"
}
}

前端建议：

1. 创建一条助手消息占位。
2. 将消息状态置为处理中。
3. 准备接收后续 markdown 和 artifact。
   4.2 markdown.delta

含义：markdown 文本增量。

示例：

{
"type": "markdown.delta",
"payload": {
"format": "markdown",
"delta": "正在计算排柜方案...\n\n"
}
}

前端建议：

1. 将 payload.delta 追加到当前助手消息正文。
2. 不要覆盖原 markdown 内容。
3. 可实时渲染 markdown。
   4.3 artifact.replace

含义：完整替换当前 3D 装柜 artifact。

示例：

{
"type": "artifact.replace",
"payload": {
"artifact": {
"id": "artifact_req_6a8b2f0d2c11",
"kind": "cargo_layout",
"version": "1.0.0",
"title": "集装箱三维装柜结果",
"data": {
"container": {
"id": "container_001",
"unit": "m",
"size": {
"w": 16.00,
"h": 6.00,
"d": 6.00
}
},
"cargoBasicInfos": [
{
"id": "cargo_001",
"sku": "SKU-A",
"name": "SKU-A name",
"quantity": 1,
"packageType": "carton",
"stackable": true,
"fragile": false,
"dangerousGoods": false,
"temperatureControlled": false,
"origin": "FACTORY-A",
"destination": "WH-US"
}
],
"cargoSpecs": {
"cargo_001": {
"weightKg": 120.00,
"dimensions": {
"w": 2.00,
"h": 1.00,
"d": 1.00
},
"volumeM3": 2.00
}
},
"placements": [
{
"id": "placement_001",
"cargoId": "cargo_001",
"color": "#60a5fa",
"position": {
"x": -7.00,
"y": -2.50,
"z": -2.50
}
}
],
"summary": {
"totalItems": 3,
"fillRate": 0.0122,
"notes": [
"装载率偏低"
]
}
}
}
}
}

前端建议：

1. 只处理 artifact.kind === "cargo_layout"。
2. 收到 artifact.replace 时，用完整 artifact 覆盖旧 artifact。
3. 使用 data.container.size 渲染柜体。
4. 使用 data.cargoSpecs[cargoId].dimensions 渲染货物尺寸。
5. 使用 data.placements[].position 放置货物中心点。
6. 使用 data.placements[].color 设置货物颜色。
   4.4 message.done

含义：本次助手回复完成。

示例：

{
"type": "message.done",
"payload": {
"finishReason": "completed"
}
}

前端建议：

1. 将当前助手消息状态置为完成。
2. 关闭 EventSource。
3. 停止 loading。
   4.5 message.error

含义：本次助手回复失败。

示例：

{
"type": "message.error",
"payload": {
"code": "ARTIFACT_INVALID",
"message": "container.size must be positive"
}
}

前端建议：

1. 将当前助手消息状态置为失败。
2. 展示 payload.message。
3. 关闭 EventSource。
4. 前端调用示例

5.1 原生 fetch + EventSource

async function submitAiCargoMessage(text) {
const response = await fetch('/api/chat/messages', {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
text,
context: {
bizType: 'cargo_packing',
mode: 'new_plan',
hints: {}
}
})
});

const result = await response.json();
const accepted = result.data;

if (!accepted || !accepted.accepted) {
throw new Error('AI 排柜消息受理失败');
}

subscribeAiCargoStream(accepted.sseChannel);
}

function subscribeAiCargoStream(sseChannel) {
const eventSource = new EventSource(sseChannel);

eventSource.addEventListener('message.start', (event) => {
const data = JSON.parse(event.data);
createAssistantMessage(data.messageId);
});

eventSource.addEventListener('markdown.delta', (event) => {
const data = JSON.parse(event.data);
appendAssistantMarkdown(data.messageId, data.payload.delta);
});

eventSource.addEventListener('artifact.replace', (event) => {
const data = JSON.parse(event.data);
renderCargoLayout(data.payload.artifact);
});

eventSource.addEventListener('message.done', (event) => {
const data = JSON.parse(event.data);
markAssistantMessageDone(data.messageId);
eventSource.close();
});

eventSource.addEventListener('message.error', (event) => {
const data = JSON.parse(event.data);
markAssistantMessageError(data.messageId, data.payload.message);
eventSource.close();
});

eventSource.onerror = () => {
eventSource.close();
};
}

5.2 artifact 渲染数据读取示例

function renderCargoLayout(artifact) {
if (!artifact || artifact.kind !== 'cargo_layout') {
return;
}

const { container, cargoSpecs, placements, summary } = artifact.data;

renderContainer({
id: container.id,
width: Number(container.size.w),
height: Number(container.size.h),
depth: Number(container.size.d),
unit: container.unit
});

placements.forEach((placement) => {
const spec = cargoSpecs[placement.cargoId];
if (!spec) {
return;
}

    renderCargoBox({
      id: placement.id,
      cargoId: placement.cargoId,
      color: placement.color,
      position: {
        x: Number(placement.position.x),
        y: Number(placement.position.y),
        z: Number(placement.position.z)
      },
      size: {
        width: Number(spec.dimensions.w),
        height: Number(spec.dimensions.h),
        depth: Number(spec.dimensions.d)
      }
    });

});

renderCargoSummary(summary);
}

6. 调试命令

提交消息：

curl -X POST "http://localhost:8080/api/chat/messages" `  -H "Content-Type: application/json"`
-d "{\"text\":\"请帮我生成装柜方案\"}"

订阅 SSE：

curl -N "http://localhost:8080/api/chat/stream?conversationId=conv_001&requestId=req_xxx"

注意：requestId 要使用提交消息接口真实返回的值。

7. 前端处理注意事项

1. POST /api/chat/messages 只表示受理成功，不表示排柜完成。
1. 前端必须使用 sseChannel 继续订阅事件。
1. markdown.delta 是增量文本，需要追加。
1. artifact.replace 是完整 artifact，需要整体替换。
1. 收到 message.done 或 message.error 后应关闭 EventSource。
1. seq 可用于调试事件顺序，正常情况下同一 requestId 从 1 递增。
1. 当前 text/files/context 已预留，但后端第一阶段仍使用 demo 货物数据。
1. 3D 坐标原点在柜体中心，尺寸单位当前为米。
1. 当前事件顺序

正常情况下，前端会按以下顺序收到事件：

message.start
markdown.delta 正在读取业务数据
markdown.delta 正在解析业务诉求
markdown.delta 正在计算排柜方案
artifact.replace 完整 cargo_layout
markdown.delta 装柜方案摘要
message.done

如果 artifact 校验失败或排柜结果为空，会收到：

message.start
markdown.delta
message.error

9. 后续变更预期

后续接入真实业务和 LangGraph 后，前端协议优先保持稳定。预计变化点：

1. context.hints 会开始承载真实业务 ID。
2. files 会用于传入装柜清单附件。
3. markdown.delta 会变成真实 AI 解释流。
4. artifact.replace 的货物和柜型会来自真实 SCM 数据。
5. 可能新增更多 artifact 类型，但 cargo_layout 的基础结构会尽量保持兼容。
