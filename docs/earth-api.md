# Connect Roamline to Earth API

Roamline (Octo Travel) is a small, local-first travel planner with an optional AI itinerary assistant. Its Cloudflare Pages Function already accepts a configurable Chat Completions endpoint, so you can connect an OpenAI-compatible provider without changing the frontend or installing another SDK.

This guide shows the configuration for **Earth API**, an API relay operated by this project's maintainer.

> **Migration preview — 29 September 2026 (Asia/Shanghai):** The Earth API domain is scheduled to become the public endpoint during the morning migration. The examples below use the intended address, `https://api.earth.icu/v1`. Confirm that the domain, your account, and your selected model are available before switching a running deployment. This guide does not announce a completed migration or guarantee current model availability or pricing.

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

Implementation references: [Pages Function](../functions/%5B%5Bpath%5D%5D.js), [Wrangler configuration](../wrangler.jsonc), and [project README](../README.md).
