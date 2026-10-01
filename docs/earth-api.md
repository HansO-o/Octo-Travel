# Connect Roamline to Earth API

Roamline (Octo Travel) is a small, local-first travel planner with an optional AI itinerary assistant. Its Cloudflare Pages Function already accepts a configurable Chat Completions endpoint, so you can connect an OpenAI-compatible provider without changing the frontend or installing another SDK.

This guide shows the configuration for **Earth API**, an API relay operated by this project's maintainer.

Machine-readable reference: [Earth API OpenAPI 3.1 specification](earth-api-openapi.yaml). It is an importable request-shape reference, not a live-availability or pricing guarantee.

Postman collection: [import the Earth API collection](earth-api-postman-collection.json). It defaults to model discovery only. Generation requests are blocked until you explicitly set `runGeneration` to `YES` and choose a model returned by the current catalog; generation may incur charges.

AI-agent index: [repository-scoped `docs/llms.txt`](llms.txt) provides a compact map to these integration resources. It is not deployed at the Earth API domain root.

> **Live launch — verified 30 September 2026 at 22:27 (Asia/Shanghai):** The English product page, documentation, OGS-backed console and sign-up entry, public pricing rows, and paid API requests are live. Thirteen end-to-end checks passed for `gpt-6-sol` and `claude-opus-5-5`, including JSON, SSE, native Messages, tool calls, errors, and final usage. The examples below use `https://api.earth.icu/v1`. Verify the current catalog, account access, balance, and pricing before production use; launch verification is not an uptime or capacity guarantee.

## 1. Set the endpoint and model

In your own deployment's `wrangler.jsonc`, update the non-secret `vars` values:

```json
{
  "vars": {
    "OPENAI_BASE_URL": "https://api.earth.icu/v1/chat/completions",
    "OPENAI_MODEL": "YOUR_AVAILABLE_MODEL_ID"
  }
}
```

This is an excerpt: retain the other fields in the existing file. Replace `YOUR_AVAILABLE_MODEL_ID` with a model identifier available to your Earth API account, and review its current price before sending requests.

**Use the full `/chat/completions` URL in this project.** Despite its name, Roamline's `OPENAI_BASE_URL` is passed directly to `fetch()`; the function does not append a path. An SDK that appends its own route would usually take `https://api.earth.icu/v1` instead.

## 2. Add your server-side key

For local development, create `.dev.vars` at the project root:

```dotenv
OPENAI_API_KEY=YOUR_EARTH_API_KEY
APP_ACCESS_KEY=YOUR_SEPARATE_APP_ACCESS_KEY
```

`.dev.vars` is already ignored by this repository. Keep real keys out of `wrangler.jsonc`, `public/`, Git commits, and browser JavaScript.

For Cloudflare Pages, configure `OPENAI_API_KEY` as a secret on your own Pages project. Configure `APP_ACCESS_KEY` as a separate secret if another server will call Roamline's `/v1/chat/completions` route. Apply the settings to the production or preview environment you intend to use, then redeploy.

These keys serve different purposes:

| Setting | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | The Pages Function authenticates to Earth API. |
| `APP_ACCESS_KEY` | Your external server authenticates to Roamline's private Chat Completions route. |
| `OPENAI_MODEL` | Chooses the model Roamline requests from Earth API. |
| `OPENAI_BASE_URL` | Supplies the complete upstream Chat Completions endpoint. |

## 3. Run the app

Use Node.js 22 or later:

```bash
npm ci
npm run types
npm run check
npm run dev
```

Open the local URL printed by Wrangler. Open the AI assistant and ask, for example:

> Please answer in English. Review my itinerary and suggest one change that would make the day less rushed.

The browser sends messages and the current itinerary to Roamline's `/api/chat`. The Pages Function adds the travel-assistant prompt and forwards the request using your server-side credentials. A model request may incur charges on your provider account.

`GET /health` only checks that the app is responding. It does **not** verify the Earth API domain, credentials, account balance, or model connection; a successful chat reply is the integration check.

## 4. Check Earth API directly before redeploying

Use these checks only after your Earth API account can obtain a key and the model catalog is available to it. They isolate the upstream connection from Roamline's configuration. These templates were live-validated during the launch check, but your account access, balance, model capacity, and current rates can differ.

In Bash, enter the key interactively so it is not included in the command you type:

```bash
read -r -s -p "Earth API key: " EARTH_API_KEY
export EARTH_API_KEY
printf '\n'

```

First request the model catalog. This does not submit a generation request:

```bash
curl --silent --show-error --fail-with-body \
  --connect-timeout 10 --max-time 30 \
  https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"

```

A successful catalog response only verifies that catalog access worked. It does not confirm sufficient balance, a model's current price, or successful inference. Review the current account pricing and select an enabled model before the next step.

**The next command sends one generation request and may incur a charge.** It has no automatic retries. A timeout stops the local wait; it does not guarantee cancellation or prevent billing.

```bash
read -r -p "Available model ID: " EARTH_MODEL
export EARTH_MODEL
python3 - <<'PY' | curl --silent --show-error --fail-with-body \
  --connect-timeout 10 --max-time 120 \
  https://api.earth.icu/v1/chat/completions \
  -H "Authorization: Bearer $EARTH_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @-
import json
import os

print(json.dumps({
    "model": os.environ["EARTH_MODEL"],
    "messages": [{"role": "user", "content": "Reply with one short greeting."}],
    "stream": False,
}))
PY
unset EARTH_API_KEY EARTH_MODEL

```

Roamline needs a non-empty string at `choices[0].message.content`. If this direct request succeeds but the app fails, check the deployed environment and the full `OPENAI_BASE_URL` value above.

| Direct request result | What it tells you |
| --- | --- |
| DNS or TLS failure | The API connection has not reached a usable HTTP response. Check the hostname and migration status. |
| HTML error or browser challenge, including HTTP 403 | The request may have been blocked before the API handled it. This is not proof of a bad key or an unavailable model. |
| JSON authentication error | Check the Earth API key and account access. Do not use an Ogin login token or Roamline's `APP_ACCESS_KEY`. |
| Model-access or balance error | Follow the returned error and check your account's enabled models and balance. |
| HTTP 429 or a temporary upstream error | Respect any `Retry-After` response; avoid rapid retries. |
| HTTP 200 with unexpected JSON | HTTP success alone does not establish compatibility; inspect the Chat Completions response shape. |

These checks use only the planned Earth API host. They do not change a running deployment or fall back to another provider. Remove keys and personal request content before sharing diagnostics.

### Node.js 22 example

A dependency-free [Node.js example](examples/earth-api-node.mjs) is also available. By default it only requests the authenticated model catalog. It sends one non-streaming Chat Completions request only when `EARTH_RUN_GENERATION=1` and `EARTH_MODEL` are both set.

```bash
node docs/examples/earth-api-node.mjs --help
```

The example validates the selected model against the current catalog, follows no redirects, implements no automatic retries, uses timeouts, and never prints the API key. Listing models is not a generation request; confirm applicable account policies and current pricing before use.

### OpenAI Python SDK example

A [Python 3.10+ example](examples/earth_api_openai_sdk.py) shows how to set the SDK's `base_url` to Earth API. It lists the authenticated account's current models by default and disables the SDK's automatic retries.

```bash
python -m pip install "openai>=3,<4"
python docs/examples/earth_api_openai_sdk.py --help
python docs/examples/earth_api_openai_sdk.py
```

It sends one non-streaming generation request only when both `--generate` and a model returned by the current catalog are supplied. Chat Completions is the default interface:

```bash
python docs/examples/earth_api_openai_sdk.py --generate --model YOUR_AVAILABLE_MODEL_ID
```

To exercise the Responses request shape instead, select it explicitly:

```bash
python docs/examples/earth_api_openai_sdk.py --generate --api responses --model YOUR_AVAILABLE_MODEL_ID
```

A generation request may incur a charge. The example uses no automatic retries, does not print the API key, and warns that a local timeout does not guarantee server-side cancellation.

### Anthropic Messages Python example

A dependency-free [Python 3.10+ Anthropic Messages example](examples/earth_api_anthropic_messages.py) uses the documented `POST /v1/messages` endpoint, `x-api-key`, and `anthropic-version: 2023-06-01`. It first lists the authenticated catalog and sends no generation request by default.

```bash
python docs/examples/earth_api_anthropic_messages.py --help
python docs/examples/earth_api_anthropic_messages.py
```

After reviewing current pricing, opt in to one non-streaming request with a model returned by the catalog:

```bash
python docs/examples/earth_api_anthropic_messages.py \
  --generate --model YOUR_AVAILABLE_ANTHROPIC_MODEL_ID
```

Generation may incur a charge. The example performs no automatic retries, refuses redirects, does not print the API key, and warns that a local timeout does not prove server-side cancellation.

### Anthropic Messages Node.js example

A dependency-free [Node.js 22+ Anthropic Messages example](examples/earth-api-anthropic-messages.mjs) uses built-in `fetch` with the documented `POST /v1/messages` endpoint. It first lists the authenticated catalog and sends no generation request by default.

```bash
node docs/examples/earth-api-anthropic-messages.mjs --help
node docs/examples/earth-api-anthropic-messages.mjs
```

After reviewing current pricing, opt in to one non-streaming request with a model returned by the catalog:

```bash
node docs/examples/earth-api-anthropic-messages.mjs \
  --generate --model YOUR_AVAILABLE_ANTHROPIC_MODEL_ID
```

Generation may incur a charge. The example performs no automatic retries, refuses redirects, does not print the API key, and warns that a local timeout does not prove server-side cancellation.

### OpenAI JavaScript SDK example

A [Node.js 22+ SDK example](examples/earth-api-openai-sdk.mjs) configures the official `openai` package with Earth API's `baseURL`. It lists the authenticated account's current models by default and disables the SDK's automatic retries.

```bash
npm install openai
node docs/examples/earth-api-openai-sdk.mjs --help
node docs/examples/earth-api-openai-sdk.mjs
```

It sends one non-streaming generation request only when both `--generate` and a model returned by the current catalog are supplied. Chat Completions is the default interface:

```bash
node docs/examples/earth-api-openai-sdk.mjs --generate --model YOUR_AVAILABLE_MODEL_ID
```

To exercise the Responses request shape instead, select it explicitly:

```bash
node docs/examples/earth-api-openai-sdk.mjs --generate --api responses --model YOUR_AVAILABLE_MODEL_ID
```

A generation request may incur a charge. The example uses no automatic retries, does not print the API key, and warns that a local timeout does not guarantee server-side cancellation.

### Stream text with the JavaScript SDK

The [JavaScript SDK example](examples/earth-api-openai-sdk.mjs) also accepts `--stream`. It uses the SDK's SSE parser and prints text deltas as they arrive.

After checking current pricing and model access, opt in to one generation request:

```bash
node docs/examples/earth-api-openai-sdk.mjs --generate --model YOUR_AVAILABLE_MODEL_ID --stream
node docs/examples/earth-api-openai-sdk.mjs --generate --api responses --model YOUR_AVAILABLE_MODEL_ID --stream
```

Choose one command for the interface you intend to test; each invocation sends a separate generation request and may incur charges. Without `--generate`, the script only lists models; `--stream` alone is rejected.

Chat Completions prints `choices[0].delta.content` and reports the finish reason. Responses prints `response.output_text.delta` events and requires `response.completed`. A failed, incomplete, or truncated Responses stream exits with an error; a Chat stream without a finish reason also exits with an error. Text already printed before an interruption may be partial. The example is for text replies, not tool execution, audio, or a complete event debugger.

A stream ending locally does not prove cancellation or settle the final bill. Review request status in Usage before sending the request again. Automatic retries remain disabled. This is a client example verified with offline fixtures, not evidence of successful paid streaming through Earth API.

### Go standard-library example

A [Go standard-library example](examples/earth-api-go.go) uses only Go's built-in HTTP and JSON packages. It lists the authenticated model catalog by default and performs no automatic retries.

```bash
export EARTH_API_KEY='YOUR_EARTH_API_KEY'
go run docs/examples/earth-api-go.go
```

It sends one non-streaming generation request only when `-generate` and a model returned by the current catalog are both supplied. Chat Completions is the default interface:

```bash
go run docs/examples/earth-api-go.go -generate -model YOUR_AVAILABLE_MODEL_ID
```

Select Responses explicitly with `-api responses`. A generation request may incur a charge; the example never prints the key and warns that a local timeout does not guarantee server-side cancellation.

### PHP 8.2 dependency-free example

A [PHP 8.2+ CLI example](examples/earth-api-php.php) uses PHP's built-in HTTPS stream support, lists the authenticated model catalog by default, follows no redirects, and performs no automatic retries.

```bash
read -r -s -p "Earth API key: " EARTH_API_KEY
export EARTH_API_KEY
printf '\\n'
php docs/examples/earth-api-php.php
```

It sends one non-streaming generation request only when `--generate` and a model returned by the current catalog are both supplied:

```bash
php docs/examples/earth-api-php.php --generate --model=YOUR_AVAILABLE_MODEL_ID
php docs/examples/earth-api-php.php --generate --api=responses --model=YOUR_AVAILABLE_MODEL_ID
```

Generation may incur a charge. The script does not print the API key, has no automatic retries, and does not claim that a local timeout cancels server-side work. PHP must allow HTTPS URL streams in the runtime configuration.

## What this integration supports

This version uses **non-streaming text Chat Completions**. The function sends `model`, `messages`, and `stream: false`, then expects a non-empty string at `choices[0].message.content`.

- The server setting `OPENAI_MODEL` selects the upstream model; an incoming request's `model` value does not override it.
- Incoming requests support 1–40 text messages, at most 8,000 characters per message, and a maximum body size of 64 KiB.
- The browser stores the trip and chat history in `localStorage`. Using the assistant sends the submitted conversation and itinerary context to the configured provider.
- The current UI and default assistant prompt are primarily Chinese. This guide is in English; it does not translate the app.

Roamline's current `/api/chat` route checks the request's `Origin`, which is not per-user authentication or a usage limit. Before exposing a deployment publicly, add appropriate access controls and spending limits for your use case. The separate `/v1/chat/completions` route requires `APP_ACCESS_KEY`.

## Troubleshooting

| Result | Check |
| --- | --- |
| `AI service is not configured` | Set `OPENAI_API_KEY` in the environment actually serving the app, then redeploy. |
| `AI provider request failed` | Check the gateway error code, request ID, `Retry-After`, account balance, and current model access. Upstream response details are not included in the public error. |
| `AI provider returned an invalid response` | Use a model and endpoint that return standard text Chat Completions JSON. |
| `Streaming is not supported` | Omit `stream` or set it to `false`. |
| `Unauthorized` from Roamline | Use the same-origin browser UI, or send your `APP_ACCESS_KEY` to Roamline's private route. |
| `/health` succeeds but chat fails | Health is local to Roamline; check the upstream configuration separately. |

### Catalog access and generation errors

Model discovery and inference are separate checks. A catalog entry is not proof that a generation request can be served. **Verified 1 October 2026:** when a transient upstream failure occurs before any response content is sent, the gateway makes at most one internal retry, subject to its deadline and provider cooldown. If that attempt also fails, the public response contains a sanitized gateway error; raw upstream response fields and messages are not forwarded. The gateway does not replay a request after response content has started.

Keep the returned request ID and `Retry-After` value, if present, and review Usage before sending another request. A network interruption can leave usage pending when no final measured usage was received; that does not prove the upstream did no work or that the request was not billed. Avoid immediate client-side retry loops.

## Share integration feedback

If you are integrating the live service, [open the Earth API integration feedback form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml). It supports Chat Completions, Responses, Anthropic Messages, and model discovery. Include the client or SDK version, model ID, request time with timezone, HTTP status, error code or type, request ID and `Retry-After` value if supplied, streaming mode, retry behavior, and the expected result. Do not paste full headers.

This public form is maintained by the Earth API operator. Remove API keys, account tokens, billing details, private prompts, personal data, and unredacted headers before submitting. A report documents developer feedback; it does not confirm service availability, model access, pricing, or an official relationship with an upstream provider.

Implementation references: [Pages Function](../functions/%5B%5Bpath%5D%5D.js), [Wrangler configuration](../wrangler.jsonc), and [project README](../README.md).
