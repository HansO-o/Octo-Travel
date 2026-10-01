# Use Earth API with LiteLLM

This guide connects [LiteLLM](https://docs.litellm.ai/) to Earth API's OpenAI-compatible base URL. It covers a direct Python call and an optional local LiteLLM proxy while keeping API keys server-side and avoiding duplicate retry loops.

Earth API is an independent, maintainer-operated relay. It is not an official LiteLLM or upstream-model integration. Model access, pricing, and capacity can change, so discover the authenticated catalog before selecting a model.

## What you need

- An Earth API account and API key from [the console](https://api.earth.icu/console)
- A current model ID returned to your account
- Python 3.10 or newer

Keep the key out of browser code, source control, screenshots, and public logs.

## 1. Discover your current model IDs

This request is authenticated but does not generate model output:

```bash
export EARTH_API_KEY="replace-with-your-key"

curl --fail-with-body \
  --silent \
  --show-error \
  https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"
```

Choose an ID from that response, then review the [live pricing page](https://api.earth.icu/models). Do not copy a model name from an old example and assume it is available to your account.

## 2. Direct LiteLLM Python call

Install LiteLLM in a virtual environment:

```bash
python -m pip install litellm
export EARTH_MODEL_ID="replace-with-a-current-id"
```

Save this as `earth_litellm.py`:

```python
import os

from litellm import completion

response = completion(
    model=f"openai/{os.environ['EARTH_MODEL_ID']}",
    api_base="https://api.earth.icu/v1",
    api_key=os.environ["EARTH_API_KEY"],
    messages=[
        {
            "role": "user",
            "content": "Reply with exactly: Earth API is connected.",
        }
    ],
    max_retries=0,
    timeout=60,
)

print(response.choices[0].message.content)
print(response.usage)
```

Run it only when you are ready to make a billable generation request:

```bash
python earth_litellm.py
```

The `openai/` prefix selects LiteLLM's OpenAI-compatible provider adapter; `api_base` points that adapter at Earth API. Setting `max_retries=0` prevents the provider transport from silently repeating a paid request. Earth API already applies its own bounded upstream retry and configured fallback behavior.

## 3. Optional local LiteLLM proxy

Use a local proxy only if you need a shared LiteLLM endpoint for multiple server-side applications. Create `litellm_config.yaml`:

```yaml
model_list:
  - model_name: earth-chat
    litellm_params:
      model: openai/YOUR_EARTH_MODEL_ID
      api_base: https://api.earth.icu/v1
      api_key: os.environ/EARTH_API_KEY
      max_retries: 0

router_settings:
  num_retries: 0
```

Replace `YOUR_EARTH_MODEL_ID` with an ID returned by your authenticated catalog, then start the proxy:

```bash
litellm --config ./litellm_config.yaml --port 4000
```

A server-side client can now call the local model group:

```bash
curl --fail-with-body http://127.0.0.1:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "earth-chat",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Earth API is connected."
      }
    ]
  }'
```

Keep the LiteLLM proxy bound to a trusted network or add its authentication controls before exposing it. The local alias `earth-chat` is only a LiteLLM routing name; Earth API receives the configured catalog ID.

## Why both retry settings are zero

LiteLLM distinguishes its router retry loop (`num_retries`) from the provider SDK or transport retry setting (`max_retries`). When you place LiteLLM in front of another gateway that already retries upstream failures, stacking retry loops can multiply latency and billable attempts.

This guide therefore uses:

- `max_retries: 0` on the Earth deployment
- `num_retries: 0` in LiteLLM router settings
- no LiteLLM fallback model

If you later add LiteLLM retries or fallbacks, first test one failure at a time and confirm how Earth API records every attempt. Do not assume a retried or fallback response is free.

## Usage and cost checks

`response.usage` is useful application telemetry, but the Earth API console Usage record is the billing reference for an Earth request. A missing or zero LiteLLM cost estimate does not mean the request was free: third-party cost maps may not recognize Earth-specific model IDs or Earth prices.

After the first minimal request:

1. Confirm the response completed.
2. Check the Earth API Usage entry for terminal token usage and charge state.
3. Compare the selected model against the live pricing page.
4. Keep concurrency and spending limits low until the behavior is understood.

## Compatibility boundaries

This example validates the OpenAI-style Chat Completions shape only. Test separately before relying on:

- streaming and terminal usage events
- tool or function calls
- Responses API-only features
- built-in web search
- embeddings, images, audio, or other endpoint families
- per-request `service_tier` / fast-mode forwarding through LiteLLM

Do not infer support from a parameter being accepted by LiteLLM. Verify the final Earth API response and Usage record.

## Troubleshooting

**401 or 403**

Check that the Earth API key is present in the server process. Do not paste it into an issue.

**404 or model-not-found**

Refresh `GET /v1/models`, update `EARTH_MODEL_ID` or the YAML deployment, and retry once with a minimal request.

**Unexpected repeated requests**

Confirm both LiteLLM retry settings are zero. Also inspect application, job-runner, and reverse-proxy retries.

**A successful response but no trustworthy cost estimate**

Use the Earth API console Usage entry and public Earth pricing. LiteLLM's local cost calculation may not contain Earth-specific configuration IDs.

**Upstream or capacity error**

Preserve the Earth request ID and timestamp, remove secrets and prompt content, and report only sanitized diagnostics through the [integration feedback form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml).

## References

- [Earth API developer documentation](https://api.earth.icu/docs)
- [Earth API live models and pricing](https://api.earth.icu/models)
- [LiteLLM getting started](https://docs.litellm.ai/docs/)
- [LiteLLM API keys, base URL, and version configuration](https://docs.litellm.ai/docs/set_keys)
- [LiteLLM Router retries and fallbacks](https://docs.litellm.ai/docs/routing)
- [LiteLLM proxy quickstart](https://docs.litellm.ai/docs/proxy/docker_quick_start)

Disclosure: the Earth API operator maintains this guide. Earth API is independent and does not claim an official relationship with LiteLLM or an upstream model provider. The guide was prepared with AI assistance and checked against Earth API's live public surface and LiteLLM's official documentation on 2 October 2026.
