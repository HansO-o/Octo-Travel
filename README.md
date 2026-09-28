# Roamline（Octo Travel）

Roamline 是一个可独立复制、安装、构建和部署的 Cloudflare Pages 旅行计划 App。
静态前端负责行程编辑，Pages Function 提供可选的 AI 行程助手。项目没有源码级
Octo 依赖，也不读取 Octo Core 的文件或 `node_modules`。

## English integration guide

Want to use a configurable AI backend with this travel planner? See [Connect Roamline to Earth API](docs/earth-api.md) for the server-side endpoint and key configuration, supported request format, and troubleshooting. Earth API is a maintainer-operated API relay; the guide currently documents the planned `https://api.earth.icu/v1` domain migration as a preview.

Tooling can import the [Earth API OpenAPI 3.1 preview](docs/earth-api-openapi.yaml). The specification documents request shapes and does not guarantee migration status, enabled models, or pricing.

## 独立边界

- 运行形态：Cloudflare Pages 静态资源 + Pages Functions（Workers runtime）。
- 本机数据：行程和网页聊天历史保存在浏览器 `localStorage`。
- 服务端职责：注入行程助手 prompt，将有限大小的非流式请求转发给模型提供商。
- Octo 依赖：仅依赖 HTTP 层的非流式 Chat Completions App 协议。

跨项目 wire contract 以 [Octo-Protocol](https://github.com/HansO-o/Octo-Protocol) 发布版本为准；本项目不引用任何 Core 源文件。

复制本目录后可直接执行：

前置条件为 Node.js 22 或更高版本。

```bash
npm ci
npm run types
npm run check
npm run dev
```

## 配置

`wrangler.jsonc` 中只保存非秘密默认值：

- `OPENAI_BASE_URL`：Chat Completions 完整 endpoint。
- `OPENAI_MODEL`：服务端实际调用的模型。

本地 `.dev.vars`（不提交）和生产 Cloudflare Secrets：

```text
OPENAI_API_KEY=模型提供商密钥
APP_ACCESS_KEY=Octo或其他服务端调用此App时使用的Bearer密钥
```

## HTTP 输入与输出

### `GET /health`

输出 `{"ok":true,"app":"roamline"}`，不访问模型。

### `POST /api/chat`

网页同源接口。输入：

```json
{
  "messages": [
    { "role": "user", "content": "帮我检查第三天是否太赶" }
  ],
  "context": {
    "destination": "京都",
    "startDate": "2026-09-20",
    "days": []
  }
}
```

`context` 是可选、不可信的只读界面数据，序列化后最多使用 12000 字符。成功输出为
标准、非流式 Chat Completions JSON。

### `POST /v1/chat/completions`

服务端/Octo 使用的非流式兼容接口。请求必须包含：

```http
Authorization: Bearer <APP_ACCESS_KEY>
Content-Type: application/json
```

- 输入：1–40 条 `system`、`developer`、`user`、`assistant` 或 `tool` 文本消息；
  每条内容最多 8000 字符；请求体最大 64 KiB。
- 固定行为：拒绝 `stream: true`；服务端注入 Roamline system prompt；请求中的
  模型值不会覆盖 `OPENAI_MODEL`。
- 输出：成功时返回标准 Chat Completions JSON；失败时返回
  `{"error":{"message","type","param","code"}}`。

### 接入 Octo

本项目是“私有模型 App”：

```json
{
  "appid": "Travel",
  "description": "整理旅行日程、检查节奏、提出备选活动和出发清单；实时信息需核验。",
  "url": "https://octo-travel.o3o3o.com/v1/chat/completions",
  "apiKey": "与APP_ACCESS_KEY相同的值",
  "requestBody": { "model": "travel-private-model" },
  "prompt": "把自然语言旅行计划任务交给行程助手处理。",
  "contents": [],
  "tools": []
}
```

`requestBody.model` 是 Octo 选择远端 App URL 所需的非空标识；实际模型由本服务
配置。Octo 可能额外发送 `X-Octo-App-Key`、`X-Octo-Notify-Id` 和
`X-Octo-Tool-Call-Id`，当前版本只用 `Authorization: Bearer <APP_ACCESS_KEY>`
鉴权。

## 构建与部署

```bash
npm run check
npm run deploy
```

Cloudflare Pages 项目名为 `octo-travel-app`，输出目录为 `public`。本项目不包含
真实密钥，也不会创建、导入或修改其他 Octo 项目。
