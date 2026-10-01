# Earth API production-readiness checklist

This checklist helps a developer decide whether an Earth API integration is ready to move beyond local evaluation. It is published by the Earth API operator and was prepared with AI assistance.

> **Live launch verified 30 September 2026 at 22:27 (Asia/Shanghai):** the English product page, documentation, OGS-backed console and sign-up entry, public pricing rows, authenticated catalog, and paid requests are live. Thirteen end-to-end checks passed across the advertised interfaces. Your own account, enabled models, balance, current rates, and minimal request still need verification before production traffic.

This is an engineering checklist, not a security certification, legal opinion, service-level agreement, or promise of general availability.

## Go/no-go summary

| Area | Go when | Do not proceed when |
| --- | --- | --- |
| Account | You can sign in, create an Earth API model-access key, and identify the account that will be billed. | Access depends on an unverified token, shared login, or unknown account. |
| Models | `GET /v1/models` returns an expected model ID for the same authenticated account. | A model name comes only from documentation, an old screenshot, or another account. |
| Inference | One minimal request succeeds and returns the response shape your client expects. | Only catalog access is verified, or generation returns an error, partial output, or an unexplained denial. |
| Pricing | You have reviewed a current rate published for the selected model and understand the billed units. | The price is missing, still loading, inferred from an upstream provider, or copied from an old page. |
| Request shape | A minimal request matches the documented endpoint and authentication scheme. | The client silently appends a different path, uses the wrong key header, or adds unsupported parameters. |
| Spend controls | You have an explicit test budget, concurrency limit, timeout, and retry policy. | Retries are unlimited, traffic can fan out unexpectedly, or there is no spending stop. |
| Secrets | Keys exist only in a server-side secret store and are redacted from logs and support reports. | A key appears in browser code, source control, screenshots, analytics, or issue text. |
| Data | The submitted prompt and metadata are appropriate for the current service terms and your own obligations. | The request contains unnecessary personal, regulated, confidential, or production data. |
| Rollback | You can disable the integration or restore the previous provider without waiting for a new client release. | The integration has no kill switch, fallback decision, or accountable operator. |

A single red item is a no-go for production traffic. A yellow or unknown item keeps the integration out of production traffic.

## 1. Verify the exact public surface

Use only the canonical product link, [https://api.earth.icu](https://api.earth.icu), and the documented base URL, `https://api.earth.icu/v1`.

Confirm these resources at the time of the test:

- [Official developer documentation](https://api.earth.icu/docs)
- [Models & pricing](https://api.earth.icu/models)
- [Console](https://api.earth.icu/console)
- [Repository-hosted OpenAPI reference](earth-api-openapi.yaml)
- [Machine-readable service metadata](earth-api-service.json)

Do not treat DNS resolution, a landing page, an HTTP authentication error, or a successful health check as proof that paid inference is available.

## 2. Keep the authentication schemes separate

| Interface | Endpoint | Authentication |
| --- | --- | --- |
| Model discovery | `GET /v1/models` | `Authorization: Bearer EARTH_API_KEY` |
| Chat Completions | `POST /v1/chat/completions` | `Authorization: Bearer EARTH_API_KEY` |
| Responses | `POST /v1/responses` | `Authorization: Bearer EARTH_API_KEY` |
| Anthropic Messages | `POST /v1/messages` | `x-api-key: EARTH_API_KEY` and `anthropic-version: 2023-06-01` |

An Ogin login token, application-specific access key, upstream-provider key, and Earth API model-access key are different credentials. Do not substitute one for another.

## 3. Run the least expensive useful verification

1. Query the authenticated model catalog. This is not a generation request.
2. Select a model returned for the same account.
3. Review its current account price.
4. Use a documented output limit where supported, and verify that your selected endpoint/model enforces it. A token parameter is not an account spending cap.
5. Keep client-side retries disabled during the first verification. The gateway may perform one bounded internal retry for an eligible transient failure before any public output starts.
6. Send one non-streaming request with non-sensitive test text.
7. Record the UTC time, endpoint, configured Earth model ID, HTTP status, Earth API public request ID if supplied, optional `X-Earth-Retry-Count`, and sanitized response shape.
8. Review the resulting usage or billing record before increasing traffic. If final verified usage is unavailable, treat the request as pending reconciliation rather than zero-cost.

A client timeout stops the local wait. It does not prove that the server cancelled the request or that billing cannot occur.

Use the safe [Python](examples/earth_api_anthropic_messages.py), [Node.js](examples/earth-api-anthropic-messages.mjs), [OpenAI SDK](examples/earth-api-openai-sdk.mjs), or [Postman](earth-api-postman-collection.json) examples as starting points. They default to model discovery or require an explicit generation opt-in.

## 4. Set operational limits before rollout

Define and test:

- a maximum request body size and prompt length;
- a per-request output-token limit, with enforcement verified for the selected endpoint/model;
- a concurrency limit;
- a request timeout;
- a retry policy that accounts for the gateway's bounded pre-output retry, respects `Retry-After`, and never retries non-idempotent work blindly;
- a per-user and global spending limit;
- a daily alert threshold and a hard stop;
- log redaction for authorization headers, account tokens, prompts, and response content;
- a kill switch that can disable generation without redeploying the client;
- a rollback path to the previous configuration.

A requested token limit or client timeout is not a verified hard spending stop. Configure spending controls separately and confirm their scope, especially with concurrent requests.

Start with one internal caller. Increase traffic only after comparing expected usage with the account record.

## 5. Validate compatibility, not just HTTP success

Check the response shape your application actually consumes.

- Chat Completions clients may expect `choices[0].message.content`.
- Responses clients may expect items in `output` or named streaming events.
- Anthropic Messages clients may expect a `content` array and a `stop_reason`.
- Tool calling, streaming, caching, sampling controls, token limits, stored responses, and background work can vary by model and endpoint.

An HTTP 200 response does not establish full SDK or upstream-provider equivalence. Keep feature flags narrow and test every parameter your application relies on.

## 6. Understand public response identity, retries, and usage

Earth API projects public responses at the gateway boundary. Public response IDs and model fields identify the Earth API response and configured catalog model; clients should not depend on raw upstream response IDs, upstream model names, request identifiers, or internal routing metadata. Supported content, tool arguments, citations, signed thinking blocks, and verified usage remain part of their documented public shapes.

For an eligible transient failure, the gateway can make at most two upstream attempts in total, and only before public output starts, while no measured usage is known and the retry remains within its cooldown, deadline, and account constraints. A successful response with `X-Earth-Retry-Count: 1` means one internal retry occurred. Once output starts, the gateway does not replay the request.

Do not add an immediate client retry simply because this header is absent or present. After a final error, retry only when your operation is safe to repeat, the documented status is retryable, and any `Retry-After` delay has elapsed.

For streaming responses, read through the terminal event before deciding whether usage is present. If no verifiable final usage is available, Earth API can leave the accounting state pending instead of inventing token counts or treating the request as free. A client timeout or interrupted stream does not prove cancellation and does not prove zero usage.

## 7. Prepare support evidence without leaking secrets

Before reporting a problem, collect:

- interface and endpoint;
- client or SDK name and version;
- sanitized request shape;
- model ID;
- UTC timestamp;
- HTTP status, Earth API public request ID if present, and `X-Earth-Retry-Count` if supplied;
- expected and actual response shape;
- whether streaming, tools, or retries were enabled.

Remove API keys, login tokens, billing details, private prompts, personal data, full authorization headers, and production secrets. Use the [structured integration feedback form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml).

### Interpret unavailable and rate-limit responses carefully

A model appearing in the authenticated catalog does not prove that a generation request can be served. If an error reports `upstream_unavailable`, collect the request evidence rather than concluding that your client key is invalid or that a quota is exhausted. An HTTP 429 or `rate_limit_error` without a specific explanation does not identify which account, quota window, or request limit caused the rejection. Availability through a different client or channel does not establish this route's availability.

Preserve a supplied `Retry-After` value and request ID. Respect a specified retry delay. If no delay is supplied, avoid immediate retry loops; review Usage and report one sanitized failed attempt through the feedback form. A new key, different endpoint, or repeated request is not a verified fix.

## 8. Recheck before each rollout

Model access, prices, limits, documentation, and account state can change. Repeat the catalog and pricing checks before:

- enabling a new model;
- raising concurrency;
- deploying to a new region;
- changing endpoint format;
- enabling tools or streaming;
- moving from internal evaluation to customer traffic.

Earth API is an independent service. These materials do not claim an official relationship with an upstream model provider, guaranteed uptime, complete API equivalence, fixed pricing, or any unverified data-retention behavior.
