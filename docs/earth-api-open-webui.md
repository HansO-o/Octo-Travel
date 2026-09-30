# Use Earth API with Open WebUI

This guide connects [Open WebUI](https://openwebui.com/) to Earth API as a standard OpenAI-compatible provider.

Earth API is an independent, maintainer-operated AI API relay. It is not an official Open WebUI or upstream-model-provider service. This setup follows Open WebUI's current connection workflow and Earth API's public interface, but it is not a claim that every Open WebUI feature or every Earth model has been tested end to end.

## Before you start

1. Review the live [Earth API models and pricing](https://api.earth.icu/models).
2. Sign in through the [Earth API console](https://api.earth.icu/console).
3. Create a model-access key in [API keys](https://api.earth.icu/console/keys).
4. Start with one short chat and review the Earth API Usage record before enabling more users or tools.

The Earth API base URL is:

```text
https://api.earth.icu/v1
```

Model access, upstream capacity, and prices can change.

## Add the connection

In Open WebUI:

1. Open **Settings → Admin → Connections**.
2. Find **Manage OpenAI API Connections**.
3. Click **Add Connection**.
4. Enter the values below.
5. Click **Verify Connection**, then **Save**.

| Open WebUI field | Value |
| --- | --- |
| URL | `https://api.earth.icu/v1` |
| API Key | Your Earth API model-access key |
| Model IDs | Leave empty for discovery, or allowlist exact current IDs |
| Provider under Advanced | `Default` |

Open WebUI's **Default** provider mode treats the server as a plain OpenAI-compatible endpoint. Do not choose Azure, LiteLLM, llama.cpp, or LM Studio for this connection.

As checked on 1 October 2026 at 07:32 Asia/Shanghai, the public Earth API catalog displayed:

- `gpt-6-astra`
- `gpt-6-luna`
- `gpt-6.1-sol`

This is a timestamped observation, not a permanent model-availability promise.

## Model discovery

Open WebUI uses `GET /v1/models` for discovery and `POST /v1/chat/completions` for chat. Earth API documents both endpoints.

If Verify Connection or discovery does not show models:

1. Confirm the URL ends in `/v1`.
2. Confirm the key is an Earth model-access key, not an OGS login token or management token.
3. Open the Earth [models page](https://api.earth.icu/models).
4. Add an exact current model ID to the connection's **Model IDs** allowlist.
5. Save and test one short chat.

## Multi-user security

An admin-configured connection can make the Earth API key available to every Open WebUI user who is allowed to use that connection. Use a dedicated key with the narrowest practical scope, monitor Usage, and rotate it if exposure is suspected.

Keep these rules:

- Do not commit or paste the key into public files, issues, prompts, logs, or screenshots.
- Do not use an Earth management token as the model API key.
- Keep **Forward cookies** disabled. Open WebUI warns that enabling it sends the browser's cookies, including session cookies, to the provider endpoint. Earth API does not require those cookies for model requests.
- Use separate connections or keys when different user groups need separate accounting or revocation.
- Disable the connection before rotating a shared key.

## Feature boundaries

Earth API currently documents model discovery, OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages. Open WebUI's provider connection uses the Chat Completions path.

Do not assume that every Open WebUI subsystem uses the same endpoint:

- **RAG embeddings:** Earth API does not currently publish a `/v1/embeddings` endpoint. Configure a separate supported embedding provider.
- **Image generation:** Earth API does not currently publish an OpenAI image-generation endpoint. Configure a separate image provider.
- **Tools:** Open WebUI can send OpenAI-style `tools` and `tool_choice`, but support depends on the selected Earth model and relay path. Validate with a disposable task before broader use.
- **Optional parameters:** unsupported or unrepresentable options may be ignored instead of rejecting the request. Do not assume `temperature`, `top_p`, or output-token fields took effect.
- **Usage:** reconciliation may finish after a response, so Usage and balance views can update later.
- **Timeouts:** a client timeout does not prove that the upstream request was cancelled.

Keep user approval and tool restrictions in place while validating a new model.

## Troubleshooting

### Authentication error

Create or rotate the key in the Earth console and update the Open WebUI connection. Remove credentials and private content before sharing diagnostics.

### Model not found

Refresh the Earth models page, copy an exact model ID, and add it to Open WebUI's Model IDs allowlist.

### Chat works but RAG fails

Use a separate embedding provider. A working Chat Completions connection does not add an embeddings endpoint.

### A tool call or optional setting fails

Disable unverified tools and advanced settings, test text-only chat, then add one capability at a time.

### Timeout or uncertain charge

Do not immediately retry. Check the Earth API Usage view first because the browser may not know whether the upstream request completed.

## Verification scope

This page documents a configuration path based on Open WebUI's official OpenAI-compatible connection fields and Earth API's current public interface. It does not claim:

- official partnership with Open WebUI or an upstream provider;
- complete compatibility with every Open WebUI feature;
- fixed pricing, models, capacity, or service level;
- unlimited use, lowest-price status, or zero data retention.

## Disclosure

This guide is maintained by the Earth API operator and was prepared with AI assistance. Verify current Open WebUI behavior, Earth API access, pricing, models, and compatibility before production use.
