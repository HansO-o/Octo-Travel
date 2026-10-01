# Use Earth API with Pydantic AI

This guide connects [Pydantic AI](https://pydantic.dev/docs/ai/) to Earth API's OpenAI-compatible endpoints. It starts with a minimal Chat Completions agent, disables client-side retry layers, and shows how to switch to the Responses API deliberately.

Earth API is an independent, maintainer-operated relay. It is not an official Pydantic AI or upstream-model integration. Model access, pricing, and capacity can change.

## What you need

- Python 3.10 or newer
- An Earth API account and API key from [the console](https://api.earth.icu/console)
- A current model ID returned to your account

Keep the key in server-side environment variables. Do not place it in browser code, source control, screenshots, or public logs.

## 1. Discover your current model IDs

This authenticated request does not generate model output:

```bash
export EARTH_API_KEY="replace-with-your-key"

curl --fail-with-body \
  --silent \
  --show-error \
  https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"
```

Select an ID returned for the same account, then review the [live pricing page](https://api.earth.icu/models):

```bash
export EARTH_MODEL_ID="replace-with-a-current-id"
```

Do not copy a model name from an old example and assume it remains available.

## 2. Install Pydantic AI with OpenAI support

```bash
python -m pip install "pydantic-ai-slim[openai]"
```

Use a virtual environment and pin a tested dependency version for production.

## 3. Minimal Chat Completions agent

Save this as `earth_pydantic_ai.py`:

```python
import os

from openai import AsyncOpenAI
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

client = AsyncOpenAI(
    api_key=os.environ["EARTH_API_KEY"],
    base_url="https://api.earth.icu/v1",
    max_retries=0,
    timeout=60.0,
)

model = OpenAIChatModel(
    os.environ["EARTH_MODEL_ID"],
    provider=OpenAIProvider(openai_client=client),
)

agent = Agent(
    model,
    retries=0,
)

result = agent.run_sync(
    "Reply with exactly: Earth API is connected."
)

print(result.output)
print(result.usage)
```

Run it only when you are ready to make a billable generation request:

```bash
python earth_pydantic_ai.py
```

The custom `AsyncOpenAI` client points Pydantic AI at Earth API and sets the provider SDK retry budget to zero. `Agent(retries=0)` also disables automatic tool/output-validation correction requests in this initial test. The example defines no tools or structured output, so one logical agent run should require one model request from Pydantic AI.

Earth API may still perform its own bounded upstream retry or configured model fallback before returning the public result.

## 4. Responses API variant

Pydantic AI treats Chat Completions and Responses as separate model classes. After the Chat example works, you can test Earth API's Responses endpoint by replacing `OpenAIChatModel` with `OpenAIResponsesModel`:

```python
from pydantic_ai.models.openai import OpenAIResponsesModel

model = OpenAIResponsesModel(
    os.environ["EARTH_MODEL_ID"],
    provider=OpenAIProvider(openai_client=client),
)

agent = Agent(model, retries=0)
```

Do not assume that success on one endpoint proves feature parity on the other. Start with one short, non-streaming request and inspect the final response and Usage record.

## Why both retry controls are zero

Pydantic AI documents multiple retry layers that have independent budgets and can multiply:

- the OpenAI provider SDK can repeat the same HTTP request;
- the agent can make another model request to correct tool arguments or output validation;
- an application, job runner, or workflow engine may retry the whole run;
- Earth API already has bounded retry/fallback logic inside the gateway.

The OpenAI client defaults to `max_retries=2`, which can produce three wire attempts for one model request. This guide therefore sets both `max_retries=0` and `Agent(retries=0)` for the first integration check.

If you later enable tools, structured output, workflow retries, or Pydantic AI fallback models, budget each layer explicitly and verify every Earth Usage entry. A fallback response is still a billable model request unless the service states otherwise.

## Usage and billing

Current Pydantic AI exposes the completed run's aggregate usage as `result.usage`. Treat it as application telemetry, not as a replacement for Earth API billing records.

After the first minimal request:

1. Confirm `result.output` contains the expected final text.
2. Inspect `result.usage` for the request count and token fields Pydantic AI received.
3. Check the Earth API console Usage entry and charge state.
4. Compare the selected model against the live pricing page.

Missing or zero local cost information does not mean the request was free. A client library may not know Earth-specific model IDs or rates, and final usage can settle asynchronously.

## Fast mode

Do not pass `service_tier="fast"` through Pydantic AI based only on this guide. Pydantic AI's current documented OpenAI service-tier values do not include Earth API's `fast` extension, and accepting a parameter would not prove that the requested tier served the request.

If the selected Earth model has an operator-configured default tier, no client override is needed. For an explicit fast request, use a separately verified client path and confirm the actual terminal `service_tier` plus the Earth Usage record.

## Compatibility boundaries

This guide covers basic text generation through Chat Completions and a separate Responses model class. Test these features individually before production use:

- streaming and terminal usage
- function tools and tool-call continuation
- structured output and validation retries
- Responses-only built-in web search
- long-running or background responses
- service-tier / fast-mode forwarding
- embeddings, image, audio, or realtime endpoint families

Pydantic AI model profiles can shape tool schemas and provider-specific request fields. A custom Base URL does not guarantee that every Pydantic AI or OpenAI feature is supported by the target endpoint.

## Troubleshooting

**401 or 403**

Confirm that `EARTH_API_KEY` belongs to Earth API and is available to the server process. Do not paste it into an issue.

**404 or model-not-found**

Refresh `GET /v1/models`, update `EARTH_MODEL_ID`, and try one minimal request.

**Unexpected repeated requests**

Confirm both `AsyncOpenAI(max_retries=0)` and `Agent(retries=0)`. Also inspect application, workflow-engine, task-queue, and reverse-proxy retries.

**Structured output fails without correction**

That is expected when `Agent(retries=0)`. Validate basic text generation first, then add a small, explicit output-retry budget only after estimating the extra request cost.

**A run succeeds but cost is unknown**

Use the Earth API console Usage record and current Earth pricing. Pydantic AI cannot be assumed to contain Earth-specific pricing for every configured model ID.

**Temporary upstream or capacity error**

Preserve the Earth public request ID and timestamp, remove secrets and prompt content, and submit only sanitized diagnostics through the [integration feedback form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml).

## References

- [Earth API developer documentation](https://api.earth.icu/docs)
- [Earth API models and pricing](https://api.earth.icu/models)
- [Pydantic AI: OpenAI models and custom client](https://pydantic.dev/docs/ai/models/openai/)
- [Pydantic AI: other OpenAI-compatible endpoints](https://pydantic.dev/docs/ai/models/compatible-apis/)
- [Pydantic AI: retry layers and multiplication](https://pydantic.dev/docs/ai/core-concepts/retries/)
- [Pydantic AI result usage](https://pydantic.dev/docs/ai/core-concepts/output/)

Disclosure: the Earth API operator maintains this guide. Earth API is independent and does not claim an official relationship with Pydantic AI or an upstream model provider. The guide was prepared with AI assistance and checked against Earth API's live public surface and Pydantic AI's official documentation on 2 October 2026.
