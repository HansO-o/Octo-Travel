# Connect Roamline to Earth API

Roamline (Octo Travel) is a small, local-first travel planner with an optional AI itinerary assistant. Its Cloudflare Pages Function already accepts a configurable Chat Completions endpoint, so you can connect an OpenAI-compatible provider without changing the frontend or installing another SDK.

This guide shows the configuration for **Earth API**, an API relay operated by this project's maintainer.

Machine-readable preview: [Earth API OpenAPI 3.1 specification](earth-api-openapi.yaml). It is an importable request-shape reference, not a live-availability or pricing guarantee.

Postman preview: [import the Earth API collection](earth-api-postman-collection.json). It defaults to model discovery only. Generation requests are blocked until you explicitly set `runGeneration` to `YES` and choose a model returned by the current catalog; generation may incur charges.

AI-agent index: [repository-scoped `docs/llms.txt`](llms.txt) provides a compact map to these preview resources. It is not deployed at the Earth API domain root and does not change the live launch status.

> **Launch preview — checked 29 September 2026 (Asia/Shanghai):** The public Earth API page now documents `https://api.earth.icu/v1` and presents an Ogin login/registration link, but public pricing is still empty and the page says paid model calls are not yet open. The examples below use the documented address. Verify your account, the current model catalog, and pricing before switching a running deployment. This guide does not claim general paid availability or guarantee model access.

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

Use these checks only after your Earth API account can obtain a key and the model catalog is available to it. They isolate the upstream connection from Roamline's configuration. These are request templates, not a report of a successful live inference test.

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
| `AI provider request failed` | Check the endpoint, key, account balance, available model ID, and provider error message. |
| `AI provider returned an invalid response` | Use a model and endpoint that return standard text Chat Completions JSON. |
| `Streaming is not supported` | Omit `stream` or set it to `false`. |
| `Unauthorized` from Roamline | Use the same-origin browser UI, or send your `APP_ACCESS_KEY` to Roamline's private route. |
| `/health` succeeds but chat fails | Health is local to Roamline; check the upstream configuration separately. |

## Share integration feedback

If you are evaluating the launch preview, [open the Earth API integration feedback form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml). It asks for the client or framework, endpoint format, expected result, and a sanitized error or example request.

This public form is maintained by the Earth API operator. Remove API keys, account tokens, billing details, private prompts, personal data, and unredacted headers before submitting. A report documents developer feedback; it does not confirm service availability, model access, pricing, or an official relationship with an upstream provider.

Implementation references: [Pages Function](../functions/%5B%5Bpath%5D%5D.js), [Wrangler configuration](../wrangler.jsonc), and [project README](../README.md).
