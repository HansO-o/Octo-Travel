# Use Earth API with OpenCode

This quickstart connects [OpenCode](https://opencode.ai) to [Earth API](https://api.earth.icu), an independent, maintainer-operated AI API relay. Earth API exposes OpenAI-style Chat Completions and Responses interfaces at `https://api.earth.icu/v1`.

Check the [live model catalog and pricing](https://api.earth.icu/models) before use. Model access, rates, and upstream capacity can change, and generation requests may incur charges.

## 1. Keep the API key outside the project

Create an Earth API key in the [console](https://api.earth.icu/console), then export it in your shell:

```bash
read -r -s -p "Earth API key: " EARTH_API_KEY
export EARTH_API_KEY
printf '\n'
```

Do not commit the key to `opencode.json`, shell history, logs, or a repository.

## 2. Add the provider

Create or update `opencode.json` in your project directory:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "earth": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Earth API",
      "options": {
        "baseURL": "https://api.earth.icu/v1",
        "apiKey": "{env:EARTH_API_KEY}"
      },
      "models": {
        "YOUR_MODEL_ID": {
          "name": "Earth API model"
        }
      }
    }
  }
}
```

Replace `YOUR_MODEL_ID` with an ID shown on the current Earth API model page. This configuration uses OpenCode's OpenAI-compatible Chat Completions provider. OpenCode's official provider guide documents `@ai-sdk/openai-compatible` for `/v1/chat/completions`, custom `baseURL`, environment-backed keys, and explicit model maps: <https://opencode.ai/docs/providers/>.

If you intentionally want the OpenAI Responses transport instead, OpenCode documents `@ai-sdk/openai` for `/v1/responses`. Start with one transport and validate tool calls and streaming for the selected model before production use.

## 3. Select the model

Start OpenCode, run `/models`, and choose the model under **Earth API**. The provider ID in the picker is `earth`.

A successful model selection does not prove that the account has enough balance or that the upstream currently has capacity. Send a small request first, then review request-level usage in the Earth API console.

## Compatibility notes

- Earth API normalizes `system` instructions for upstreams that require the `developer` role, preserving the instruction content and order.
- Unknown or upstream-unsupported optional parameters are ignored when they cannot be translated, rather than blocking an otherwise usable request.
- Output-token and sampling fields can be accepted without taking effect on every upstream. Do not treat them as hard spending caps.
- One request awaiting usage reconciliation does not globally block later or concurrent requests on the same key or account. Charges may settle asynchronously, so recent usage and balance displays can briefly lag.
- Usage pending means a validated final token report has not been recorded, rather than a token-counting job still running. See [Fast mode and final usage](earth-api-fast-and-usage.md) for the dated Codex keepalive fix and streaming diagnostics.
- Streaming, tools, structured output, and reasoning behavior vary by model. Validate the exact workflow you need.
- Keep automatic retry loops conservative. A local timeout does not prove server-side cancellation or that a request was not billed.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Provider or model is missing | Confirm the provider ID, model map, JSON syntax, and that `EARTH_API_KEY` is exported in the shell that starts OpenCode. |
| Authentication error | Use an Earth API key, not an OGS login token or an upstream provider key. |
| `System messages are not allowed` | Retry through the current Earth API endpoint. The relay converts system instructions for upstreams that require the developer role. |
| Model or balance error | Refresh the live catalog, review the selected model's current price, and check the account balance. |
| Tool call fails | Reduce the request to one simple tool, verify the schema, and test the selected model's current tool support. |
| Stream stops early | Preserve the request ID when available and check Usage before retrying. |

For endpoint-level coverage and known boundaries, see the [Earth API compatibility snapshot](earth-api-compatibility.md). For sanitized integration feedback, use the [operator-maintained issue form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml). Never include API keys, account tokens, billing details, private prompts, personal data, or production secrets.
