# Request Fast mode and verify final usage with Earth API

[Earth API](https://api.earth.icu) supports a per-request Fast service tier and an optional administrator default for selected OpenAI models. This guide also explains how to read final token usage and investigate a request marked **Usage pending**.

Published by the Earth API operator, with AI assistance. Earth API is an independent relay. Check [current models and pricing](https://api.earth.icu/models) and your account access before sending generation requests; the examples below can incur charges.

## Send an explicit Fast request

Use `service_tier: "fast"` in the JSON body of a Chat Completions or Responses request. OpenAI documents `priority` as an equivalent request value for supported models. Fast access depends on the selected upstream model and account; accepting the field does not establish that priority processing occurred.

Keep your Earth API key outside source files and shell history:

```bash
read -r -s -p "Earth API key: " EARTH_API_KEY
export EARTH_API_KEY
printf '\n'
```

First query the authenticated catalog:

```bash
curl --silent --show-error --fail-with-body \
  https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"
```

The generation examples use `gpt-6.1-sol`, a configured catalog ID checked on 1 October 2026. Replace it if your current catalog differs. Run only the example you need; neither command enables automatic retries.

Responses:

```bash
curl --silent --show-error --fail-with-body \
  https://api.earth.icu/v1/responses \
  -H "Authorization: Bearer $EARTH_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{
    "model": "gpt-6.1-sol",
    "input": "Explain an HTTP keepalive in one sentence.",
    "service_tier": "fast",
    "stream": false
  }'
```

Chat Completions:

```bash
curl --silent --show-error --fail-with-body \
  https://api.earth.icu/v1/chat/completions \
  -H "Authorization: Bearer $EARTH_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{
    "model": "gpt-6.1-sol",
    "messages": [{"role": "user", "content": "Explain an HTTP keepalive in one sentence."}],
    "service_tier": "fast",
    "stream": false
  }'
```

Read the returned `service_tier` to check the actual upstream tier. A final `default` can indicate standard processing even after a Fast request. If no actual tier is reported, do not infer Fast from the request body or elapsed time. Earth API preserves a reported tier when converting Responses output to Chat JSON or SSE; a terminal value takes precedence over an earlier value.

For Codex OAuth routes, Earth API normalizes `fast`/`priority` to `priority`. API-key OpenAI routes preserve the submitted alias. This setting is separate from reasoning effort and native Anthropic service tiers.

## Set a default for selected models

Operators can open [model administration](https://api.earth.icu/admin/models), edit an OpenAI model, and choose **Default service tier → Fast**. The setting applies when a request omits its own tier; an explicit request tier takes precedence. An unset default follows the upstream configuration.

The feature was deployed without enabling Fast on any existing model or changing model routing or prices. Upstream tier access and quota consumption remain account-dependent. Earth API billing uses the configured model rates; check live pricing before use. This guide does not claim a speed multiplier or confirmed Fast execution for a particular account.

## Why a finished request can show Usage pending

Final token counts usually arrive in a completed response or a terminal stream report, rather than in each text delta. A stream can deliver text, then disconnect before that report. **Usage pending means no validated final token report was durably recorded for that request.** It does not mean a token-counting job is still running, and it does not mean the request cost is zero.

On 1 October 2026, we identified a gateway conversion defect: a Codex `keepalive` transport event was treated as an invalid response event, interrupting some streams at about 32 seconds before final usage arrived. The fix accepts the recognized Codex transport events without treating their contents as token usage. Final measured usage remains the billing source.

The console now keeps the original request outcome, such as Completed, Timeout, or Interrupted, visible alongside Usage pending. One unresolved request does not globally block later or concurrent requests on the same key or account; account balance checks still apply. Previously lost token reports cannot be reconstructed from this fix, and the gateway does not replace missing usage with estimated counts or silently charge it as zero.

For a streaming client:

- Continue reading beyond visible text to the terminal event. For Responses, inspect the terminal response's `status` and `usage`: an incomplete or failed generation can still report billable usage. For Chat, request `stream_options: {"include_usage": true}` and inspect the final usage report.
- Keep the request ID and the exact outcome when reporting a problem. A timeout or disconnected client does not prove server-side cancellation.
- Check the console before repeating a generation request. Automatic retries can produce another billable request.

## Dated verification

The keepalive fix went live on **1 October 2026 at 12:31 Asia/Shanghai**. Through 12:36, the new deployment's first 11 completed gateway requests all returned HTTP 200; eight explicitly recorded real terminal token usage after keepalive events. No unknown-usage or response-conversion error events were observed in that short window. Requests still running were excluded. This is a bounded operational check, not a future availability or latency guarantee, and it does not verify every upstream Fast entitlement.

The release passed 337 regression tests and nine website checks. These checks are separate from account-level Fast execution and final external debit delivery.

See the [endpoint compatibility snapshot](earth-api-compatibility.md), [official Earth API documentation](https://api.earth.icu/docs), and [OpenAI Fast mode documentation](https://developers.openai.com/api/docs/guides/fast-mode). Submit sanitized integration feedback through the [operator-maintained form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml); keep keys, account tokens, private prompts, and billing details out of public reports.
