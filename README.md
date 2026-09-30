# Roamline（Octo Travel）

Roamline 是一个可独立复制、安装、构建和部署的 Cloudflare Pages 旅行计划 App。
静态前端负责行程编辑，Pages Function 提供可选的 AI 行程助手。项目没有源码级
Octo 依赖，也不读取 Octo Core 的文件或 `node_modules`。

## Earth API developer quickstart

Start with the [one-page Earth API developer overview](docs/earth-api-overview.md) for the current launch status, supported resources, safety checks, and operator disclosure. OpenCode users can follow the dedicated [Earth API + OpenCode quickstart](docs/earth-api-opencode.md). Before production traffic, use the [production-readiness checklist](docs/earth-api-production-readiness.md) to verify account access, models, pricing, secrets, spending controls, compatibility, and rollback.

[Earth API](https://api.earth.icu) is a maintainer-operated AI API relay with OpenAI Responses, Chat Completions, and Anthropic Messages request formats. The official English product page, [developer documentation](https://api.earth.icu/docs), OGS-backed console and sign-up entry, public pricing rows, and paid API requests are live. On 30 September 2026, thirteen end-to-end checks passed for `gpt-6-sol` and `claude-opus-5-5`. This repository provides a quickstart for `https://api.earth.icu/v1`, including model discovery, server-side key handling, request examples, and troubleshooting. Verify current access, pricing, and capacity before production use.

Current public status, checked 1 October 2026 at 00:36 (Asia/Shanghai):

| Item | Verified public state |
| --- | --- |
| Product page | An English-first landing page is live at the canonical Earth API link, with 12 additional language options and the `/v1` base URL. |
| Documentation | Official English quickstart, endpoint, streaming, billing, key-management, and error guidance is live at [api.earth.icu/docs](https://api.earth.icu/docs). |
| Account entry | Console and OGS sign-in links are present; this check did not create an account or API key. |
| Models and pricing | The public route currently shows USD-per-million-token rows for `claude-opus-5-5`, `gpt-6-astra`, `gpt-6-luna`, and `gpt-6.1-sol`; review it again before use because the catalog and rates can change. |
| Launch scope | Public developer surface, pricing, authenticated model discovery, and paid inference were live-validated; current account access and upstream capacity can still differ. |

For sanitized setup or compatibility feedback, use the [operator-maintained integration form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml). Do not include API keys, account tokens, billing details, private prompts, personal data, or production secrets.

Want to use a configurable AI backend with this travel planner? See [Connect Roamline to Earth API](docs/earth-api.md) for the server-side endpoint and key configuration.

Tooling can read the [Earth API service metadata](docs/earth-api-service.json) or import the [OpenAPI 3.1 reference](docs/earth-api-openapi.yaml). These files document the public developer surface and request shapes while requiring developers to verify current account access, rates, and capacity.

Developers can also import the [Earth API Postman collection](docs/earth-api-postman-collection.json). It defaults to model discovery and blocks generation until the user explicitly opts in and selects a current model.

The [OpenAI JavaScript SDK example](docs/examples/earth-api-openai-sdk.mjs) uses Node.js 22+, lists models by default, disables automatic retries, and only sends a Chat Completions or Responses request after an explicit `--generate --model` opt-in.

The [OpenAI Python SDK example](docs/examples/earth_api_openai_sdk.py) uses Python 3.10+, lists models by default, disables automatic retries, and applies the same explicit opt-in to Chat Completions and Responses.

The [Anthropic Messages Python example](docs/examples/earth_api_anthropic_messages.py) uses only the Python 3.10+ standard library. It lists models by default and requires explicit `--generate --model` flags before sending one Messages request.

The [Anthropic Messages Node.js example](docs/examples/earth-api-anthropic-messages.mjs) uses built-in Node.js 22+ `fetch`, lists models by default, and applies the same explicit opt-in before sending one Messages request.

The [Go standard-library example](docs/examples/earth-api-go.go) adds a dependency-free backend option. It lists models by default and requires explicit `-generate -model` flags for Chat Completions or Responses.

The [PHP 8.2 dependency-free example](docs/examples/earth-api-php.php) lists the authenticated model catalog by default and requires explicit `--generate --model=...` flags before it sends one Chat Completions or Responses request.

AI coding tools can use the repository-root [Earth API `llms.txt` index](llms.txt) to find the guide, specification, examples, and feedback links. It is repository-scoped, not a deployment at `api.earth.icu/llms.txt`.

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
