# Earth API compatibility snapshot

This page records capabilities that were exercised against the live Earth API on **30 September 2026 at 22:27 Asia/Shanghai**. It is a launch-validation snapshot, not an SLA, capacity guarantee, fixed model list, or promise of complete upstream API equivalence.

Base URL: `https://api.earth.icu/v1`

Before integrating, query `GET /models` with your own Earth API key and review the current [Models & pricing page](https://api.earth.icu/models). Model access, upstream capacity, parameters, and rates can change.

## Verified interfaces

| Capability | OpenAI-style route | Anthropic-style route | Launch check |
| --- | --- | --- | --- |
| Authenticated model discovery | `GET /models` with Bearer auth | Use the same catalog before choosing a Messages model | Passed |
| Invalid key handling | JSON `401` error | JSON `401` error | Passed |
| Invalid model handling | JSON `404` error | Not separately claimed | Passed on OpenAI-style route |
| Non-streaming text | `POST /chat/completions` and `POST /responses` | `POST /messages` | Passed |
| Streaming text | Chat Completions SSE and named Responses events | Messages SSE | Passed with terminal events |
| Tool calls | Function call returned in OpenAI-compatible output | Automatic tool selection returned a tool call | Passed |
| Usage reporting | Final usage present in successful JSON/SSE workflows | Final usage present in successful JSON/SSE workflows | Passed |

The launch suite completed **13 of 13** checks for the catalog entries `gpt-6-sol` and `claude-opus-5-5`. Those model IDs describe the verified snapshot only; they are not a permanent availability promise.

## Endpoint selection

| If your client expects… | Use… | Authentication |
| --- | --- | --- |
| OpenAI Chat Completions | `POST /chat/completions` | `Authorization: Bearer EARTH_API_KEY` |
| OpenAI Responses | `POST /responses` | `Authorization: Bearer EARTH_API_KEY` |
| Anthropic Messages | `POST /messages` | `x-api-key: EARTH_API_KEY` plus `anthropic-version: 2023-06-01` |
| Model discovery | `GET /models` | `Authorization: Bearer EARTH_API_KEY` |

Use each endpoint's native response and streaming format. Chat Completions uses `choices[].message` or `choices[].delta`; Responses uses output items and named events; Messages uses Anthropic-style content blocks and events.

## Known boundaries

- For the verified Claude workflow, automatic tool selection worked. Forced `tool_choice` modes `tool` and `any` were rejected by the upstream during launch testing.
- Recognized parameters are translated when the selected upstream can represent them. Unrecognized or unrepresentable optional fields are ignored instead of blocking the request, so clients must not assume that every submitted option took effect.
- A successful catalog request does not prove that a later generation will have sufficient balance or upstream capacity.
- A client timeout or dropped stream does not prove server-side cancellation or establish whether usage was billed.
- Earth API is independently operated and does not claim an official relationship with an upstream model provider.

## Integration resources

- [Official documentation](https://api.earth.icu/docs)
- [OpenAPI 3.1 reference](https://raw.githubusercontent.com/HansO-o/Octo-Travel/main/docs/earth-api-openapi.yaml)
- [Postman collection](https://raw.githubusercontent.com/HansO-o/Octo-Travel/main/docs/earth-api-postman-collection.json)
- [Integration guide](https://raw.githubusercontent.com/HansO-o/Octo-Travel/main/docs/earth-api.md)
- [Production-readiness checklist](https://raw.githubusercontent.com/HansO-o/Octo-Travel/main/docs/earth-api-production-readiness.md)
- [Sanitized integration feedback form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml)

Keep API keys, account tokens, billing details, private prompts, personal data, and production secrets out of public issues and client-side code.

Published by the Earth API operator. Prepared with AI assistance and reviewed against the live launch-validation results.
