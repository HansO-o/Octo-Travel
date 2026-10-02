# Earth API with the official OpenAI JavaScript/TypeScript SDK

This guide shows a conservative first integration with the official [OpenAI JavaScript/TypeScript SDK](https://github.com/openai/openai-node) and Earth API's OpenAI-style endpoints.

Earth API is an independent, maintainer-operated relay. It is not affiliated with OpenAI. The SDK is used only as an HTTP client for the documented Earth API base URL.

## What this guide covers

- authenticated model discovery;
- Chat Completions;
- Responses;
- a custom base URL;
- disabling SDK retries so they do not multiply Earth API's bounded server-side retry;
- a finite request timeout;
- terminal usage and Earth-facing request IDs;
- an optional per-request Fast tier;
- server-side secret handling.

The examples use `openai` version `7.27.0`, the current release when this guide was checked on 2 October 2026. The current package requires Node.js 22 or newer.

## 1. Install the SDK

```bash
npm install openai@7.27.0
```

Keep the key outside source control:

```bash
read -r -s -p "Earth API key: " EARTH_API_KEY
export EARTH_API_KEY
printf '\n'
```

Use the public [models and pricing page](https://api.earth.icu/models) as a human-readable reference. The authenticated catalog is the source of truth for the current account.

Do not put an Earth API key in browser code, mobile bundles, public environment variables, or client-rendered pages. The official SDK disables browser use by default because a bundled secret is exposed to end users.

## 2. Create one shared server-side client

The official SDK automatically retries temporary connection errors and HTTP 408, 409, 429, and 5xx responses twice by default. Its default request timeout is ten minutes. Earth API already performs bounded server-side handling for eligible upstream failures, so the first integration should disable SDK retries and use a shorter finite timeout.

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.EARTH_API_KEY,
  baseURL: "https://api.earth.icu/v1",
  maxRetries: 0,
  timeout: 60_000,
});
```

Create one client per server process in normal use so its HTTP connection pool can be reused.

A local timeout does not prove that the server cancelled the request and does not rule out billing. Reconcile an uncertain request in the Earth API console before sending it again.

## 3. Discover models before generating

```js
const models = await client.models.list();

for (const model of models.data) {
  console.log(model.id);
}
```

Use an ID returned for the current account. Do not hard-code the public catalog forever: availability and prices can change.

## 4. Send one Chat Completions request

This call may incur a charge.

```js
const model = process.env.EARTH_MODEL;
if (!model) throw new Error("Set EARTH_MODEL to an ID returned by models.list().");

const completion = await client.chat.completions.create({
  model,
  messages: [
    { role: "user", content: "Reply with one short greeting." },
  ],
});

console.log(completion.choices[0]?.message?.content ?? "");

if (completion.usage) {
  console.error({
    input: completion.usage.prompt_tokens,
    output: completion.usage.completion_tokens,
    total: completion.usage.total_tokens,
  });
} else {
  console.error(
    "Terminal usage was not present; check the Earth API console before reconciling cost.",
  );
}

if (completion._request_id) {
  console.error({ earth_request_id: completion._request_id });
}
```

The content check and usage check serve different purposes. A non-empty answer proves that this request returned text; terminal usage is the billing evidence exposed in that response.

## 5. Use the Responses endpoint

This call may incur a charge.

```js
const model = process.env.EARTH_MODEL;
if (!model) throw new Error("Set EARTH_MODEL to an ID returned by models.list().");

const response = await client.responses.create({
  model,
  input: "Reply with one short greeting.",
});

console.log(response.output_text);

if (response.usage) {
  console.error({
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
    total: response.usage.total_tokens,
  });
} else {
  console.error(
    "Terminal usage was not present; check the Earth API console before reconciling cost.",
  );
}

if (response._request_id) {
  console.error({ earth_request_id: response._request_id });
}
```

Start with plain text. Test streaming, tools, structured output, built-in web search, background requests, and other advanced Responses features separately before production use.

## Optional Fast tier

The official SDK accepts `service_tier: "fast"` for Chat Completions and Responses. Use it only after checking that the selected Earth API model supports the requested tier.

Chat Completions:

```js
const completion = await client.chat.completions.create({
  model: process.env.EARTH_MODEL,
  messages: [{ role: "user", content: "Reply with one short greeting." }],
  service_tier: "fast",
});

console.error({ actual_service_tier: completion.service_tier ?? null });
```

Responses:

```js
const response = await client.responses.create({
  model: process.env.EARTH_MODEL,
  input: "Reply with one short greeting.",
  service_tier: "fast",
});

console.error({ actual_service_tier: response.service_tier ?? null });
```

The request value is a preference, not proof of how it was served. Confirm the actual tier from the terminal response or the Earth API Usage record. A model with an operator-defined default Fast tier does not need a client override.

## Retry and fallback behavior

Keep `maxRetries: 0` for the first test. This avoids multiplying attempts across the JavaScript SDK and Earth API.

Earth API may perform its own bounded retry and configured model fallback. A client should treat the public response as the Earth API result and should not depend on upstream identifiers or internal routing details. Do not add an immediate application retry loop until you have classified the returned status and verified whether a request may already have completed.

## Usage, errors, and request IDs

- Check terminal usage when it is present.
- Reconcile the request in the Earth API console.
- A completed response without terminal usage is not proof of a free request.
- Usage and balance display may settle asynchronously.
- Never estimate missing billed tokens from output length.
- Log `_request_id` on successful object responses.
- On `OpenAI.APIError`, log `status`, `name`, and `requestID` without secrets.
- Remove API keys, account tokens, prompts, personal data, and unredacted headers before sharing diagnostics.

```js
try {
  await client.responses.create({
    model: process.env.EARTH_MODEL,
    input: "Reply with one short greeting.",
  });
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    console.error({
      status: error.status,
      type: error.name,
      earth_request_id: error.requestID,
    });
  }
  throw error;
}
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 401 or 403 JSON error | Confirm the Earth API key and account access. Do not use an OGS login token as the API key. |
| Model error | Refresh the authenticated catalog and choose an enabled Earth API model ID. |
| 429 or temporary upstream error | Let Earth API finish its bounded internal handling; avoid stacking immediate SDK or application retries. |
| Timeout | Treat the result as unknown until Usage is checked; a client-side timeout is not cancellation proof. |
| Successful text but no terminal usage | Record `_request_id` and the timestamp, then reconcile the Earth API Usage page. |
| SDK rejects an optional field | Retry the minimal text request without that feature; OpenAI-compatible does not mean every optional field is supported. |
| Browser import is blocked | Keep the call on a server route; do not enable `dangerouslyAllowBrowser` for a secret Earth API key. |

## Production checklist

Before production traffic:

1. retrieve models with the production key;
2. review the live price for the selected model;
3. send one minimal paid request;
4. verify output, terminal state, usage, actual service tier, and the console record;
5. set a request timeout and spending limit;
6. log Earth-facing request IDs without secrets;
7. test every advanced feature your application depends on;
8. keep a rollback path.

Disclosure: this guide is maintained by the Earth API operator and was prepared with AI assistance. It does not claim an official relationship with OpenAI, fixed capacity, lowest pricing, unlimited usage, zero retention, or complete API equivalence.
