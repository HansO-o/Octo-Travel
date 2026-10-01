# Earth API + LangChain quickstart

This guide configures LangChain's `ChatOpenAI` client for Earth API's
OpenAI-compatible Chat Completions route.

- Earth API base URL: `https://api.earth.icu/v1`
- Live model and pricing page: https://api.earth.icu/models
- Official Earth API documentation: https://api.earth.icu/docs
- LangChain Python reference: https://docs.langchain.com/oss/python/concepts/providers-and-models
- LangChain JavaScript reference: https://docs.langchain.com/oss/javascript/concepts/providers-and-models

LangChain documents custom OpenAI-compatible endpoints for basic chat
functionality. `ChatOpenAI` targets the official OpenAI API shape, so
provider-specific or non-standard fields may not be preserved. This guide does
not claim a LangChain partnership, complete feature equivalence, or successful
inference for every account and model.

## 1. Choose a model before generation

Create an Earth API key in the console and query the authenticated catalog. This
request does not generate model output:

```bash
read -r -s -p "Earth API key: " EARTH_API_KEY
export EARTH_API_KEY
printf '\n'

curl --fail-with-body --silent --show-error \
  https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"
```

Select an enabled model returned for the same account and review its current
price. Do not paste a key into source files, notebooks, public issues, or shell
history.

## 2. Python

Install the current LangChain OpenAI integration:

```bash
python -m pip install -U langchain-openai
read -r -p "Earth model ID: " EARTH_MODEL
export EARTH_MODEL
```

The following invocation sends one generation request and may incur a charge.
Automatic SDK retries are disabled so a local retry loop does not multiply a
failed or ambiguous request:

```python
import os
from langchain_openai import ChatOpenAI

model = ChatOpenAI(
    model=os.environ["EARTH_MODEL"],
    base_url="https://api.earth.icu/v1",
    api_key=os.environ["EARTH_API_KEY"],
    max_retries=0,
    temperature=0,
)

reply = model.invoke("Reply with exactly: LangChain connected")
print(reply.content)
print(reply.usage_metadata)
```

For streaming, LangChain's Python documentation exposes `stream_usage=True`.
Read the stream to completion before treating token usage as final.

## 3. JavaScript / TypeScript

Install the current packages:

```bash
npm install @langchain/openai @langchain/core
```

This invocation also sends one potentially billable generation request:

```javascript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: process.env.EARTH_MODEL,
  apiKey: process.env.EARTH_API_KEY,
  maxRetries: 0,
  temperature: 0,
  configuration: {
    baseURL: "https://api.earth.icu/v1",
  },
});

const reply = await model.invoke("Reply with exactly: LangChain connected");
console.log(reply.content);
console.log(reply.usage_metadata);
```

LangChain JavaScript documents `streamUsage: false` for proxies that cannot
return streaming usage metadata. Earth API can return final measured usage, but
a missing or interrupted terminal report remains pending rather than being
estimated as zero. Start non-streaming, then test streaming with the exact model
and account you plan to use.

## 4. Compatibility and retry boundaries

- Use `ChatOpenAI` here for Chat Completions. Do not assume that every
  Responses-only, hosted-tool, multimodal, structured-output, or provider-native
  option maps through this integration.
- Unknown or unrepresentable optional parameters may be ignored. Verify any
  parameter that materially affects correctness or cost.
- Earth API may retry an eligible transient upstream failure once before public
  output begins. Keep LangChain/SDK retries disabled during initial validation
  to avoid stacked retries.
- A timeout or disconnected client does not prove server-side cancellation or
  zero cost. Check the Earth API Usage page after ambiguous results.
- Model access, prices, upstream capacity, and supported capabilities can change.
  Re-query the catalog before deployment and after model changes.
- Keep human approval around agents and tools until tool-call behavior has been
  tested with the selected model.

## 5. Troubleshooting

| Result | Check |
| --- | --- |
| HTTP 401 | Confirm this is an Earth API key and that the `/v1` base URL is exact. |
| Model not found | Re-run authenticated `GET /v1/models` and use an ID returned for that account. |
| HTTP 400 | Remove optional parameters and test a minimal text-only invocation first. |
| HTTP 429 or temporary upstream error | Respect `Retry-After`; avoid an immediate client retry storm. |
| Empty or interrupted stream | Test non-streaming, inspect the Usage record, and do not assume zero tokens. |
| Unexpected response metadata | Depend on documented OpenAI-compatible fields; non-standard fields may be omitted by LangChain. |

When reporting a problem, include the Earth API public request ID, time, endpoint,
streaming mode, model catalog ID, and sanitized error code. Remove API keys,
account tokens, billing details, private prompts, personal data, and unredacted
headers.

## Disclosure

I operate Earth API. Earth API is an independent relay and does not claim an
official relationship with LangChain or an upstream model provider. This guide
was prepared with AI assistance and reviewed against the public Earth API
surface and LangChain's official OpenAI-compatible endpoint documentation on
1 October 2026.
