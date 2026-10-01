# Earth API + OpenAI Agents SDK quickstart

This guide connects the Python [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) to Earth API through its OpenAI-compatible base URL.

Earth API is an independent, maintainer-operated relay. This guide does not imply an official relationship with OpenAI or another upstream provider. It was prepared with AI assistance and reviewed against the public Earth API surface and the official SDK documentation.

## What this guide validates

- A custom `AsyncOpenAI` client can use `https://api.earth.icu/v1`.
- The Agents SDK can be switched explicitly to Chat Completions for a compatibility-first setup.
- SDK tracing is disabled so an Earth API key is not sent to OpenAI's tracing service.
- Client retries are disabled, and no runner-managed retry policy is enabled.
- Final text and SDK-normalized usage are read from the completed run.

This is configuration guidance, not a claim that every Agents SDK feature works through every Earth API model. Hosted tools, computer use, MCP, handoffs, structured output, streaming, and Responses-only features need separate validation.

## Prerequisites

- Python 3.10 or newer
- An Earth API key kept in a server-side environment variable
- A current model ID from the authenticated catalog
- Current pricing reviewed at [api.earth.icu/models](https://api.earth.icu/models)

Install the SDK:

```bash
python -m pip install --upgrade openai-agents
```

Set secrets and a model ID without committing them:

```bash
export EARTH_API_KEY="replace-with-your-key"
export EARTH_MODEL_ID="replace-with-a-current-catalog-id"
```

Before sending a paid generation request, confirm what the account can access:

```bash
curl -sS https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"
```

Do not paste the response into a public issue without removing account-specific details.

## Minimal Chat Completions agent

Save as `earth_agent.py`:

```python
import asyncio
import os

from agents import (
    Agent,
    ModelSettings,
    Runner,
    set_default_openai_api,
    set_default_openai_client,
    set_tracing_disabled,
)
from openai import AsyncOpenAI


client = AsyncOpenAI(
    api_key=os.environ["EARTH_API_KEY"],
    base_url="https://api.earth.icu/v1",
    max_retries=0,
    timeout=60.0,
)

# Use the Earth client for model calls, but never for OpenAI trace export.
set_default_openai_client(client, use_for_tracing=False)
set_default_openai_api("chat_completions")
set_tracing_disabled(True)

agent = Agent(
    name="Earth assistant",
    instructions="Reply briefly and accurately.",
    model=os.environ["EARTH_MODEL_ID"],
    model_settings=ModelSettings(timeout=60.0),
)


async def main() -> None:
    result = await Runner.run(
        agent,
        "Reply with exactly: Earth API is connected.",
        max_turns=1,
    )
    print(result.final_output)
    print(result.context_wrapper.usage)


if __name__ == "__main__":
    asyncio.run(main())
```

Run it:

```bash
python earth_agent.py
```

A successful run should print the final text followed by the Agents SDK usage object. Treat usage as present only when the provider returned enough information for the SDK to normalize it. Do not estimate missing token counts for billing.

## Why retries are disabled here

The OpenAI Python client retries selected connection, timeout, rate-limit, and server errors by default. `max_retries=0` makes this example issue one provider request per model call.

The Agents SDK also has an optional runner-managed retry policy. This example does not set `ModelSettings(retry=...)`, so that additional retry layer is not enabled. Start with one observable attempt; add a bounded retry budget only after checking Earth API request and usage records. Avoid retrying after output has started unless your application can detect and discard duplicate partial work.

## Using the Responses route

The Agents SDK uses Responses by default for OpenAI models. To test Earth API's Responses-compatible route, replace:

```python
set_default_openai_api("chat_completions")
```

with:

```python
set_default_openai_api("responses")
```

Keep the same custom client, retry, timeout, and tracing controls. Validate one minimal text request before enabling tools or other Responses-only features. Do not assume a feature is supported merely because the request schema accepts it.

## Production checks

1. Query authenticated `GET /v1/models` at deployment time or during controlled refresh.
2. Keep `EARTH_API_KEY` on the server and rotate it if exposed.
3. Pin and test the Agents SDK version your application deploys.
4. Set an application-level total deadline in addition to per-request timeouts.
5. Store the Earth request identifier, HTTP status, selected catalog model ID, terminal status, and returned usage when available.
6. Reconcile cost from Earth API usage and billing records, not from local token estimates.
7. Test Chat Completions and Responses separately; they are different transports.
8. Confirm current pricing, account access, and upstream capacity before production traffic.

## Troubleshooting

### Trace export fails even though generation works

Confirm both of these lines execute before the first run:

```python
set_default_openai_client(client, use_for_tracing=False)
set_tracing_disabled(True)
```

Tracing is enabled by default in the Agents SDK. A custom Earth API key should not be used as an OpenAI tracing credential.

### The model is rejected

Refresh `GET /v1/models` with the same key. Use the exact Earth API catalog ID available to that account; do not infer an upstream name.

### The request appears more than once

Confirm `max_retries=0` on `AsyncOpenAI` and that no `ModelSettings(retry=...)` policy was added. Also inspect application queues, reverse proxies, and job retry settings.

### Usage is empty or incomplete

Wait for the terminal response before reading `result.context_wrapper.usage`. For streaming runs, totals can lag until final chunks have been processed. If the terminal provider response has no usable token report, keep the request marked for reconciliation instead of inventing counts.

### A Responses feature fails

Return to the Chat Completions example and a plain text request. Then add one capability at a time. Record the exact endpoint, Earth catalog model ID, status code, and sanitized error.

## Official references

- [OpenAI Agents SDK configuration](https://openai.github.io/openai-agents-python/config/)
- [OpenAI Agents SDK models and retry behavior](https://openai.github.io/openai-agents-python/models/)
- [OpenAI Agents SDK results and usage](https://openai.github.io/openai-agents-python/results/)
- [OpenAI Python client retry controls](https://github.com/openai/openai-python#retries)
- [Earth API documentation](https://api.earth.icu/docs)
- [Earth API models and pricing](https://api.earth.icu/models)

For sanitized compatibility feedback, use the [operator-maintained integration form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml). Never include API keys, account tokens, billing details, private prompts, personal data, or production secrets.
