# Use Earth API with Cline

This guide shows how to connect [Cline](https://cline.bot/) to Earth API using Cline's built-in **OpenAI Compatible** provider.

Earth API is an independent, maintainer-operated AI API relay. It is not an official Cline or upstream-model-provider service. This setup follows Cline's current provider configuration fields, but it is not a claim that every Cline agent workflow or every Earth model has been tested end to end.

## Before you start

1. Review the live [Earth API models and pricing](https://api.earth.icu/models).
2. Sign in through the [Earth API console](https://api.earth.icu/console).
3. Create an API key in [API keys](https://api.earth.icu/console/keys).
4. Copy an exact model ID from the current catalog.
5. Begin with one small task and review the Earth API Usage record before enabling broader automation.

The documented base URL is:

```text
https://api.earth.icu/v1
```

Model availability, account access, upstream capacity, and pricing can change.

## Configure Cline

Open Cline's settings with the gear icon, then set:

| Cline field | Value |
| --- | --- |
| API Provider | `OpenAI Compatible` |
| Base URL | `https://api.earth.icu/v1` |
| API Key | Your Earth API key |
| Model ID | An exact current ID from the Earth API models page |

Click **Verify** to test the connection.

As checked on 1 October 2026 at 06:33 Asia/Shanghai, the public Earth API catalog displayed:

- `gpt-6-astra`
- `gpt-6-luna`
- `gpt-6.1-sol`

Treat that as a timestamped observation, not a permanent availability promise. Refresh the catalog before configuring a new environment.

## Protect the key

Treat the API key as a production secret:

- Do not commit it to a repository.
- Do not paste it into issues, prompts, logs, screenshots, or support messages.
- Use a separate key for each environment when practical.
- Rotate or disable the key in the Earth console if it may have been exposed.

Cline runs model-driven file and command tools. Keep approvals enabled while validating a new model and endpoint. Review every proposed terminal command and file change before allowing it.

## Advanced model fields

Cline exposes fields such as context size, maximum output tokens, image support, computer use, and local price metadata. Configure only capabilities you have verified for the selected model.

Earth API currently documents these relay boundaries:

- Output-token limit fields can be accepted without becoming enforced generation or spending caps.
- Sampling fields such as `temperature` and `top_p` can be accepted without taking effect.
- Unknown or unrepresentable optional parameters may be ignored instead of blocking a request.
- Tool or function calling depends on the selected model and request path.
- A client timeout does not prove that an upstream request was cancelled.
- Usage reconciliation can complete after the response, so Usage and balance views may update later.

Do not enable computer-use or tool capabilities solely because the UI offers a toggle. Validate the current model with a small disposable task first.

## Troubleshooting

### Cline reports an invalid API key

Create or rotate the key in the Earth console and enter it only in the Cline provider settings. Make sure it is an Earth model-access key, not an OGS login token or management token.

### Cline reports “Model Not Found”

Open the [current models page](https://api.earth.icu/models), copy the model ID exactly, and confirm that your account can access it.

### Verification or connection fails

Confirm:

- API Provider is **OpenAI Compatible**.
- Base URL is exactly `https://api.earth.icu/v1`.
- The model ID is current.
- Your machine can reach `https://api.earth.icu`.
- The key is enabled and the account has a positive balance.

### A tool call or optional setting does not work

Turn off unverified advanced capabilities, keep approvals enabled, and retry with a short text-only task. Add tool behavior back one feature at a time.

### Timeout or uncertain charge

Do not immediately repeat the task. Check the Earth API Usage view first, because the client may not know whether the upstream request completed.

## Verification scope

This page documents a configuration path based on Cline's official OpenAI Compatible provider fields and Earth API's current public interface. It does not claim:

- official partnership with Cline or an upstream provider;
- complete compatibility with every Cline workflow;
- fixed pricing, model availability, capacity, or service level;
- unlimited usage, lowest-price status, or zero data retention.

## Disclosure

This guide is maintained by the Earth API operator and was prepared with AI assistance. Verify current Cline behavior, Earth API access, pricing, models, and compatibility before production use.
