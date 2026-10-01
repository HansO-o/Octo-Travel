# Run built-in web search with Earth API

Use [Earth API](https://api.earth.icu) to send an OpenAI-style web-search request through a Codex OAuth upstream. The search runs on the upstream server; your application does not need to implement a separate search function.

This guide is maintained by the Earth API operator and was prepared with AI assistance. Earth API is an independent relay, with no claimed official relationship with OpenAI. Availability depends on the selected model, route, account access, and upstream capacity. Review [current models and pricing](https://api.earth.icu/models) before use.

## Verified on 1 October 2026

Live checks with `gpt-6.1-sol` passed for Responses JSON/SSE and Chat Completions JSON/SSE, including preview aliases, completed server-side searches, URL citations, and final measured usage. Website checks passed 9/9, and model configuration was unchanged. These results are a dated compatibility snapshot, not a guarantee for every account or upstream.

## Choose the request format

| Client format | Enable search |
| --- | --- |
| Responses | Add `tools: [{"type": "web_search"}]`. This is the preferred interface. |
| Chat Completions through Earth API | Add `web_search_options: {}`. Earth API translates this extension to the Codex Responses search tool. |
| Legacy Responses integrations | `web_search_preview` and `web_search_preview_2025_03_11` are normalized to `web_search`. |

This compatibility path covers Codex OAuth routes using Responses or Chat Completions. It does not establish hosted-search support for API-key upstreams or Anthropic Messages.

A prompt such as “search the internet” does not enable a missing tool. Attach the search setting explicitly. With automatic tool choice, the model may answer without searching when it considers search unnecessary.

## Select a current model and keep the key private

In Bash, enter the key without putting it into the command you type:

```bash
read -r -s -p "Earth API key: " EARTH_API_KEY
export EARTH_API_KEY
printf '\n'

curl --silent --show-error --fail-with-body \
  --connect-timeout 10 --max-time 30 \
  https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"

read -r -p "Available Codex-backed model ID: " EARTH_MODEL
export EARTH_MODEL
```

Choose an available Codex-backed model and review its current account price. Catalog access is a separate check from generation or search support.

## Send one Responses search request

The following command sends one generation request and may incur charges. It performs no automatic retries. A local timeout does not prove server-side cancellation.

```bash
python3 - <<'PY' | curl --silent --show-error --fail-with-body \
  --connect-timeout 10 --max-time 120 \
  https://api.earth.icu/v1/responses \
  -H "Authorization: Bearer $EARTH_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @-
import json
import os

print(json.dumps({
    "model": os.environ["EARTH_MODEL"],
    "input": "Search NASA's website for why Mars looks red. Answer briefly and cite the source.",
    "tools": [{"type": "web_search"}],
    "include": ["web_search_call.action.sources"],
    "stream": False,
}))
PY
```

Responses output can contain a `web_search_call` item and a message containing text with `url_citation` annotations. The `include` setting requests the search call's source list. Confirm that a search call actually occurred; text alone does not prove a search ran. Display source links clearly and make them clickable in your application.

## Python SDK alternative

Install the official `openai` Python package, then use the same environment variables. Run this instead of the curl generation example if you only want to send one request:

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["EARTH_API_KEY"],
    base_url="https://api.earth.icu/v1",
    max_retries=0,
    timeout=120,
)

response = client.responses.create(
    model=os.environ["EARTH_MODEL"],
    input="Search NASA's website for why Mars looks red. Answer briefly and cite the source.",
    tools=[{"type": "web_search"}],
    include=["web_search_call.action.sources"],
)
print(response.output_text)
print(response.model_dump_json(indent=2))
```

Inspect the full output for search items and citation annotations. Keep request and response content private when it includes sensitive information.

## Chat Completions compatibility

For a client that only sends Chat Completions, use this request body with `POST https://api.earth.icu/v1/chat/completions` and your own available Codex-backed model ID:

```json
{
  "model": "YOUR_AVAILABLE_CODEX_MODEL_ID",
  "messages": [
    {
      "role": "user",
      "content": "Search NASA's website for why Mars looks red. Answer briefly and cite the source."
    }
  ],
  "web_search_options": {},
  "stream": false
}
```

This is an Earth API compatibility extension. Citation annotations are retained on the assistant message; search activity is exposed at `provider_data.openai.web_search_calls`. OpenAI's official Chat Completions search route uses specialized search models, so do not assume identical availability or behavior. Prefer Responses for native search output items.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| The model says it cannot browse | Confirm that the outgoing request contains the search setting and uses a compatible Codex-backed route. |
| A plugin searches with its own tool | Client-side search and upstream built-in search are separate integrations. |
| The answer has no search item or sources | Automatic tool choice may have skipped search. Inspect the full response before treating it as current web evidence. |
| An optional search setting has no effect | Unsupported optional fields may be ignored. Basic search support does not imply support for every official search control. |
| A timeout, 429, or upstream error occurs | Retain the request ID, respect any `Retry-After`, and check Usage before submitting another request. |

Keep keys out of browser code, committed configuration, screenshots, and public issues. For sanitized compatibility reports, use the [operator-maintained integration form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml).

After testing:

```bash
unset EARTH_API_KEY EARTH_MODEL
```

## References

- [Earth API documentation](https://api.earth.icu/docs)
- [Earth API models and pricing](https://api.earth.icu/models)
- [Earth API compatibility snapshot](earth-api-compatibility.md)
- [Official OpenAI web-search documentation](https://developers.openai.com/api/docs/guides/tools-web-search)
