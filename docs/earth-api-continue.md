# Use Earth API with Continue

This guide shows how to point the [Continue](https://www.continue.dev/) coding assistant at Earth API through Continue's OpenAI-compatible provider configuration.

Earth API is an independent, maintainer-operated AI API relay. It is not an official service of Continue or any upstream model provider. This configuration path has been reviewed against Continue's current `config.yaml` reference, but it has not been claimed as a full end-to-end Continue compatibility test.

## Before you start

1. Review the live [Earth API models and pricing](https://api.earth.icu/models).
2. Sign in through the [Earth API console](https://api.earth.icu/console) and create an API key.
3. Query the authenticated model catalog or copy a model ID from the current public catalog.
4. Start with a small request and review the Usage record before enabling broader IDE workflows.

The documented Earth API base URL is:

```text
https://api.earth.icu/v1
```

Model availability, account access, upstream capacity, and prices can change.

## Configure Continue

Continue's local configuration file is normally:

- macOS or Linux: `~/.continue/config.yaml`
- Windows: `%USERPROFILE%\.continue\config.yaml`

Add a model entry like this, replacing both placeholders locally:

```yaml
name: Earth API
version: 1.0.0
schema: v1

models:
  - name: Earth API
    provider: openai
    model: YOUR_CURRENT_MODEL_ID
    apiBase: https://api.earth.icu/v1
    apiKey: YOUR_EARTH_API_KEY
    roles:
      - chat
      - edit
      - apply
```

Save the file. Continue should reload local configuration automatically.

Treat `config.yaml` as a sensitive local file while it contains an API key. Never commit it, paste it into an issue, or share it in logs or screenshots. Prefer Continue's supported secret-management facilities when your setup provides them.

## Agent mode and tools

Do not add `capabilities: [tool_use]` just to make Agent mode appear available. Continue's configuration reference says that capability must be declared for Agent mode, but the selected model and relay path must actually support tool calls.

If you have independently verified tool calling for the current Earth model, you can add:

```yaml
    capabilities:
      - tool_use
```

Keep human review enabled for file edits and terminal actions. A historical Earth API launch check covered tool calls, but it is not a promise that every current model or Continue workflow supports them.

## Current compatibility notes

Earth API currently documents OpenAI Responses and Chat Completions request formats. For Continue, use the OpenAI provider with the custom `apiBase` above.

Known relay behavior:

- Codex upstreams receive `system` messages as `developer` messages while preserving content and order.
- Unrecognized or unrepresentable optional parameters may be ignored instead of rejecting the request. Do not assume an optional field took effect without testing it.
- Usage reconciliation can finish after a response, so a Usage record may appear or settle later.
- A client timeout does not by itself prove that the upstream request was cancelled.

These points matter when testing editor actions, agent tools, automatic retries, and spending controls.

## Troubleshooting

### Authentication error

Create or rotate the key in the Earth API console, then replace only the local `apiKey` value. Remove secrets from diagnostics before sharing them.

### Model not found

Check [the current models page](https://api.earth.icu/models) and the authenticated model catalog, then copy an exact current model ID into `model`.

### Continue rejects the configuration

Validate YAML indentation, confirm the file is named `config.yaml`, and check Continue's [configuration reference](https://docs.continue.dev/reference). Continue reloads saved local configuration automatically, so a restart is normally unnecessary.

### A tool or optional setting is ignored

Remove unverified capabilities and optional parameters, keep only `chat`, and retry with one short prompt. Add edit, apply, or tool behavior back one step at a time.

### Timeout or uncertain charge

Do not immediately retry. Check the Earth API Usage view first, because a timed-out client may not know whether the upstream request completed.

## Disclosure

This guide is maintained by the Earth API operator and was prepared with AI assistance. Verify current Continue configuration semantics, Earth API access, pricing, model availability, and compatibility before production use.
