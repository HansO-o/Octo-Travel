# Use Earth API with LlamaIndex

This guide connects [LlamaIndex](https://developers.llamaindex.ai/) to [Earth API](https://api.earth.icu) through LlamaIndex's official OpenAI-compatible integrations.

Earth API is an independent, maintainer-operated relay. It is not an official LlamaIndex or upstream-provider integration. This guide was prepared with AI assistance and reviewed by the operator against the public service on 2 October 2026.

## What this guide covers

- Python and `llama-index-llms-openai-like`
- OpenAI-compatible Chat Completions
- OpenAI-compatible Responses
- Server-side API-key handling
- Dynamic model selection
- Client retries disabled during initial verification
- Clear boundaries for tools, streaming, usage, and embeddings

## 1. Check the current catalog and price

Review the live [models and pricing page](https://api.earth.icu/models), create a key in the [Earth API console](https://api.earth.icu/console/keys), then list the models available to that key:

```bash
export EARTH_API_KEY="replace-me"

curl --fail-with-body --silent --show-error \
  https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"
```

This catalog request does not generate model output. Use a returned Earth API configuration ID and review its current rate before inference.

Public labels are Earth API configuration IDs. They are not a promise about an upstream provider's official model name, capacity, or availability.

## 2. Install the official compatible integration

```bash
python -m pip install llama-index-llms-openai-like
```

The official LlamaIndex API reference documents two related classes:

- `OpenAILike` for an OpenAI-compatible Chat Completions endpoint
- `OpenAILikeResponses` for an OpenAI-compatible Responses endpoint

Keep these paths explicit while validating an integration.

## 3. Configure environment variables

Store secrets outside source control:

```bash
export EARTH_API_KEY="replace-me"
export EARTH_MODEL_ID="replace-with-an-id-from-v1-models"
# Conservative client metadata default. Raise only after checking the live model row.
export EARTH_CONTEXT_WINDOW="3900"
```

Do not put the key in notebooks you will publish, browser code, logs, screenshots, or a repository.

## 4. Chat Completions quickstart

Create `earth_llamaindex_chat.py`:

```python
import os

from llama_index.llms.openai_like import OpenAILike

api_key = os.environ["EARTH_API_KEY"]
model_id = os.environ["EARTH_MODEL_ID"]
context_window = int(os.getenv("EARTH_CONTEXT_WINDOW", "3900"))

llm = OpenAILike(
    model=model_id,
    api_base="https://api.earth.icu/v1",
    api_key=api_key,
    context_window=context_window,
    is_chat_model=True,
    is_function_calling_model=False,
    max_retries=0,
    timeout=60.0,
)

response = llm.complete("Reply with exactly: Earth API is connected.")
print(str(response))
```

Run it only after reviewing the selected model's current price:

```bash
python earth_llamaindex_chat.py
```

`is_function_calling_model=False` is deliberate. Change it only after the exact model and route have passed a tool-call test.

## 5. Responses quickstart

If your workflow requires the Responses API, use the separate documented class:

```python
import os

from llama_index.llms.openai_like import OpenAILikeResponses

llm = OpenAILikeResponses(
    model=os.environ["EARTH_MODEL_ID"],
    api_base="https://api.earth.icu/v1",
    api_key=os.environ["EARTH_API_KEY"],
    context_window=int(os.getenv("EARTH_CONTEXT_WINDOW", "3900")),
    is_function_calling_model=False,
    max_retries=0,
    timeout=60.0,
)

response = llm.complete("Reply with exactly: Earth API Responses is connected.")
print(str(response))
```

This example does not enable hosted web search, tools, or Fast mode. Validate those features separately against the selected model, then consult the dedicated [web-search guide](earth-api-web-search.md) or [Fast and final-usage guide](earth-api-fast-and-usage.md).

## Why `max_retries=0` matters

LlamaIndex's official `OpenAILike` and `OpenAILikeResponses` reference currently documents a default of three retries. Earth API may already retry one eligible upstream failure internally before any public output begins.

During initial testing, disable client retries so a timeout or ambiguous failure does not multiply a paid request. Check the Earth API Usage record before deciding whether to send another request. If you later add application retries, keep them bounded, delayed, and limited to failures that are safe to repeat.

## Context-window metadata

LlamaIndex uses `context_window` as client-side model metadata. The conservative `3900` default above is not an Earth API limit.

Set it to the current value published for the selected Earth API record only after checking the live catalog. Model configuration and access can change, so do not permanently hard-code a copied value without an update process.

## Usage and billing boundaries

- Wait for a terminal response before judging token usage.
- Review the Earth API console after the first request.
- A request pending usage reconciliation does not mean zero tokens or a free request.
- A client timeout does not prove server-side cancellation.
- Earth API may settle a known charge asynchronously when terminal usage arrives.
- Do not infer price, capacity, or latency from a short test.

LlamaIndex response metadata can vary by integration and version. Treat the Earth API Usage record as the billing reference rather than assuming every token category will appear in the rendered LlamaIndex response.

## Retrieval and embedding boundary

LlamaIndex retrieval pipelines often require an embedding model in addition to an LLM. Earth API's current public developer documentation does not publish an embeddings endpoint.

Use a separately verified embedding provider or an approved local embedding model. Do not point LlamaIndex's embedding integration at Earth API and assume it is supported.

## Capability checklist

Before enabling a feature, test the exact model and endpoint with one minimal request:

- streaming;
- function or tool calls;
- structured output;
- multi-step agents;
- hosted web search;
- Fast service tier;
- long-context input.

Unsupported optional fields may be ignored or rejected. Do not mark `is_function_calling_model=True` merely because a model is described as capable elsewhere.

## Troubleshooting

### 401 or 403

Re-run the authenticated model-list request. Confirm the key is correct, enabled, and stored only on the server.

### 400

Check the current model ID, selected LlamaIndex class, request shape, and feature flags. Remove unverified optional settings.

### 402

Add funds to the shared OGS balance before another generation request.

### 429, 502, or 503

The upstream may be busy, quota-limited, or unavailable. Review the Earth API Usage record before any retry.

### Chat works but Responses fails

Confirm that the code imports `OpenAILikeResponses`, not `OpenAILike`, and that the selected model supports the required workflow.

### A retrieval example fails before generation

Check whether the pipeline is trying to create embeddings. Configure a separate, supported embedding backend.

## Primary references

- [LlamaIndex OpenAI-like API reference](https://developers.llamaindex.ai/python/framework-api-reference/llms/openai_like/)
- [Earth API documentation](https://api.earth.icu/docs)
- [Earth API models and pricing](https://api.earth.icu/models)
- [Earth API production-readiness checklist](earth-api-production-readiness.md)
