# Earth API — developer overview

[Earth API](https://api.earth.icu) is an independent, maintainer-operated AI API relay for developers using OpenAI- and Anthropic-style request formats. The documented base URL is `https://api.earth.icu/v1`.

> **Live launch:** the English product page, official documentation, OGS-backed console and sign-up entry, multilingual selector, public pricing rows, authenticated model catalog, and paid requests were verified at launch on 30 September 2026. A public-surface check on 1 October 2026 at 22:39 (Asia/Shanghai) returned HTTP 200 for the product page, docs, models page, console, public model metadata, and anonymous session endpoint. This is launch and reachability evidence, not an uptime or capacity guarantee.

## What developers can review now

- The official [English developer documentation](https://api.earth.icu/docs), including OpenAI Responses, Chat Completions, Anthropic Messages, streaming, usage, key management, and errors.
- The public [Models & pricing page](https://api.earth.icu/models), which should be checked for published model IDs and rates before use.
- Request shapes for model discovery, Chat Completions, Responses, and Anthropic Messages.
- A [production-readiness checklist](earth-api-production-readiness.md) with concrete go/no-go gates for account access, models, pricing, secrets, spending controls, compatibility, support evidence, and rollback.
- A machine-readable [service metadata manifest](earth-api-service.json) with canonical URLs, observed launch status, interface paths, resources, safety checks, and limitations.
- A machine-readable [OpenAPI 3.1 reference](earth-api-openapi.yaml).
- An importable [Postman collection](earth-api-postman-collection.json) with explicit opt-in templates for Chat Completions, Responses, Anthropic Messages, Fast/service-tier requests, and OpenAI-style web search.
- A focused [Fast and usage troubleshooting guide](earth-api-fast-and-usage.md) explaining configured tiers, terminal usage, streaming heartbeats, and unresolved accounting states.
- Safe examples for [Node.js](examples/earth-api-node.mjs), [JavaScript SDK](examples/earth-api-openai-sdk.mjs), [Python SDK](examples/earth_api_openai_sdk.py), [Anthropic Messages Python](examples/earth_api_anthropic_messages.py), [Anthropic Messages Node.js](examples/earth-api-anthropic-messages.mjs), [Go](examples/earth-api-go.go), and [PHP](examples/earth-api-php.php).
- A detailed [integration guide](earth-api.md) and [structured feedback form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml).

The examples list the authenticated model catalog by default. Generation requires an explicit opt-in and a model ID returned for the current account. They do not contain a fixed model name, promise a price, or report a successful paid inference test.

## Before sending a generation request

1. Confirm that account access and API-key creation are available to you.
2. Query the authenticated `/models` endpoint and select an enabled model ID.
3. Review the current account price before generating.
4. Start with a minimal, non-streaming request and no automatic client retries. For an eligible transient failure, the gateway may retry once before public output starts; a successful response can report `X-Earth-Retry-Count: 1`.
5. Keep API keys, login tokens, billing details, private prompts, personal data, and production secrets out of public issues and client-side code.

## Public response and usage boundaries

Earth API returns its own public response IDs and configured catalog model IDs. Clients should not depend on raw upstream response IDs, upstream model names, request identifiers, or internal routing metadata. Once public output starts, the gateway does not replay the request.

For streaming responses, read through the terminal event before deciding whether final usage is present. If verifiable terminal usage is unavailable, accounting can remain pending; missing usage must not be interpreted as zero tokens or a free request.

The launch check does not guarantee current model access, future pricing, uptime, capacity, complete upstream API equivalence, or data-retention behavior. Earth API is independent and does not claim an official relationship with an upstream model provider.

## Operator disclosure

Earth API is operated by the maintainer publishing these materials. This overview and the linked resources were prepared with AI assistance and checked against the live product, pricing, and end-to-end API results.
