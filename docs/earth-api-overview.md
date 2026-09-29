# Earth API — developer launch preview

[Earth API](https://api.earth.icu) is an independent, maintainer-operated AI API relay for developers using OpenAI-style request formats. The documented base URL is `https://api.earth.icu/v1`.

> **Launch status — checked 29 September 2026 (Asia/Shanghai):** the public product page documents the base URL and presents an Ogin login/registration entry. Public model pricing is still empty, and the page says paid model calls are not yet open. This is an integration preview, not a general-availability announcement.

## What developers can review now

- Request shapes for model discovery, Chat Completions, and Responses.
- A machine-readable [service metadata manifest](earth-api-service.json) with canonical URLs, observed launch status, interface paths, resources, safety checks, and limitations.
- A machine-readable [OpenAPI 3.1 preview](earth-api-openapi.yaml).
- An importable [Postman collection](earth-api-postman-collection.json).
- Safe examples for [Node.js](examples/earth-api-node.mjs), [JavaScript SDK](examples/earth-api-openai-sdk.mjs), [Python SDK](examples/earth_api_openai_sdk.py), [Go](examples/earth-api-go.go), and [PHP](examples/earth-api-php.php).
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
