# Use Earth API with AI SDK

This guide connects the [AI SDK](https://ai-sdk.dev/) to [Earth API](https://api.earth.icu) through the SDK's official OpenAI-compatible provider.

Earth API is an independent, maintainer-operated relay. It is not an official upstream provider integration. This guide was prepared with AI assistance and reviewed by the operator against the public service on 2 October 2026.

## What this setup covers

- Server-side Node.js or Next.js code
- Earth API's OpenAI-compatible Chat Completions route
- An API key stored outside source control
- A model ID selected from your account's current catalog
- SDK retries disabled during initial integration
- Usage and warnings returned by the SDK

It does not claim support for AI SDK embeddings, image generation, every provider option, or every agent/tool workflow. Earth API also exposes a Responses route, but the generic OpenAI-compatible provider shown here targets Chat Completions.

## 1. Check the live service first

Review the current [models and pricing page](https://api.earth.icu/models), then create an API key in the [Earth API console](https://api.earth.icu/console/keys).

List the models available to the same key without sending a generation request:

```bash
export EARTH_API_KEY="replace-me"

curl --fail-with-body --silent --show-error \
  https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"
```

Use a returned Earth API configuration ID. Do not infer upstream provider names or availability from the public label.

## 2. Install the AI SDK packages

```bash
npm install ai @ai-sdk/openai-compatible
```

The official AI SDK documentation uses `createOpenAICompatible` from `@ai-sdk/openai-compatible` for providers with a custom `baseURL`.

## 3. Store configuration as environment variables

For local development, use an ignored environment file such as `.env.local`:

```dotenv
EARTH_API_KEY=replace-me
EARTH_MODEL_ID=replace-with-a-model-from-v1-models
```

Never expose the key through `NEXT_PUBLIC_*`, client-side JavaScript, browser storage, logs, screenshots, or a public repository.

## 4. Send one non-streaming request

Create `earth-ai-sdk.mjs`:

```js
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const apiKey = process.env.EARTH_API_KEY;
const modelId = process.env.EARTH_MODEL_ID;

if (!apiKey || !modelId) {
  throw new Error('Set EARTH_API_KEY and EARTH_MODEL_ID first.');
}

const earth = createOpenAICompatible({
  name: 'earth',
  apiKey,
  baseURL: 'https://api.earth.icu/v1',
  includeUsage: true,
});

const result = await generateText({
  model: earth.chatModel(modelId),
  prompt: 'Reply with exactly: Earth API is connected.',
  maxRetries: 0,
});

console.log(result.text);
console.log({
  finishReason: result.finishReason,
  usage: result.usage,
  warnings: result.warnings,
});
```

Run it only after reviewing the selected model's current price:

```bash
node --env-file=.env.local earth-ai-sdk.mjs
```

AI SDK's generation functions default to two retries. This example sets `maxRetries: 0` so an ambiguous client timeout or network failure does not automatically multiply a paid request. Earth API may already retry an eligible upstream failure once internally, before any public output begins. Do not add an immediate application retry until you have checked the Usage record.

## Usage and streaming

The provider option `includeUsage: true` asks the compatible provider to include usage metadata in streamed results. For any request, wait for the terminal result before judging usage.

If a terminal token report is unavailable, Earth API may show the request as pending reconciliation. That does not mean zero tokens or a free request. A browser or SDK timeout also does not prove that server-side work was cancelled.

Start with a non-streaming request as above. Add `streamText` only after the basic request and Usage record both behave as expected.

## Capability boundaries

- Query authenticated `GET /v1/models` for each account instead of hard-coding a permanent catalog.
- Prices and model access can change. Recheck the [live pricing page](https://api.earth.icu/models) before production traffic.
- The generic provider uses Chat Completions. Responses-only features, including hosted web search, need the separate Earth API Responses integration.
- Optional settings unsupported by the selected route or model may be ignored or rejected. Inspect `result.warnings` and test the exact feature.
- Validate tool calls, structured output, and streaming with a minimal request before enabling them in an agent.
- Earth API does not publish an embeddings or image-generation endpoint in the current developer documentation.
- No fixed availability, latency, capacity, lowest-price, unlimited-usage, zero-retention, or upstream-affiliation claim is made.

## Troubleshooting

### 401 or 403

Confirm the key is correct, enabled, and kept on the server. Re-run the authenticated model-list request.

### 400

Check the model ID, prompt shape, and optional settings. Remove unverified provider-specific options and retry only after correcting the request.

### 402

Add funds to the shared OGS balance before starting another request.

### 429, 502, or 503

The upstream may be busy, quota-limited, or unavailable. Check the Earth API Usage record before deciding whether to retry. Keep any later retry bounded and delayed.

### Model appears on the public page but the request fails

Public labels describe configured Earth API records. Your account's authenticated catalog is the source of truth for access.

## Primary references

- [AI SDK: OpenAI-compatible providers](https://ai-sdk.dev/providers/openai-compatible-providers)
- [AI SDK: generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text)
- [Earth API documentation](https://api.earth.icu/docs)
- [Earth API models and pricing](https://api.earth.icu/models)
- [Earth API production-readiness checklist](earth-api-production-readiness.md)
