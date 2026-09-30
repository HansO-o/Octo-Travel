# Earth API — developer launch preview

[Earth API](https://api.earth.icu) is an independent, maintainer-operated AI API relay for developers using OpenAI- and Anthropic-style request formats. The documented base URL is `https://api.earth.icu/v1`.

> **Launch status — checked 30 September 2026 at 17:33 (Asia/Shanghai):** the English product page, official developer documentation, console entry, multilingual selector, and Models & pricing interface are live. The public pricing interface remained on `Loading current model prices…` and exposed no model or rate rows in this check. This remains an integration preview, not a general-availability announcement.

## What developers can review now

- The official [English developer documentation](https://api.earth.icu/docs), including OpenAI Responses, Chat Completions, Anthropic Messages, streaming, usage, key management, and errors.
- The public [Models & pricing page](https://api.earth.icu/models), which should be checked for published model IDs and rates before use.
- Request shapes for model discovery, Chat Completions, Responses, and Anthropic Messages.
- A machine-readable [service metadata manifest](earth-api-service.json) with canonical URLs, observed launch status, interface paths, resources, safety checks, and limitations.
- A machine-readable [OpenAPI 3.1 preview](earth-api-openapi.yaml).
- An importable [Postman collection](earth-api-postman-collection.json) with opt-in templates for Chat Completions, Responses, and Anthropic Messages.
- Safe examples for [Node.js](examples/earth-api-node.mjs), [JavaScript SDK](examples/earth-api-openai-sdk.mjs), [Python SDK](examples/earth_api_openai_sdk.py), [Anthropic Messages Python](examples/earth_api_anthropic_messages.py), [Anthropic Messages Node.js](examples/earth-api-anthropic-messages.mjs), [Go](examples/earth-api-go.go), and [PHP](examples/earth-api-php.php).
- A detailed [integration guide](earth-api.md) and [structured feedback form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml).

The examples list the authenticated model catalog by default. Generation requires an explicit opt-in and a model ID returned for the current account. They do not contain a fixed model name, promise a price, or report a successful paid inference test.

## Before sending a generation request

1. Confirm that account access and API-key creation are available to you.
2. Query the authenticated `/models` endpoint and select an enabled model ID.
3. Review the current account price before generating.
4. Start with a minimal, non-streaming request and no automatic retries.
5. Keep API keys, login tokens, billing details, private prompts, personal data, and production secrets out of public issues and client-side code.

The preview does not guarantee current model access, pricing, uptime, complete OpenAI API equivalence, data-retention behavior, or an official relationship with an upstream model provider.

## Operator disclosure

Earth API is operated by the maintainer publishing these materials. This overview and the linked preview resources were prepared with AI assistance and checked against the observed public launch state.
