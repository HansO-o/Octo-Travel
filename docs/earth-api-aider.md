# Use Earth API with aider

This quickstart connects [aider](https://aider.chat) to [Earth API](https://api.earth.icu), an independent, maintainer-operated AI API relay. Earth API exposes an OpenAI-compatible endpoint at `https://api.earth.icu/v1`.

Check the [live model catalog and pricing](https://api.earth.icu/models) before use. Model access, rates, and upstream capacity can change, and aider requests may incur charges.

## 1. Install aider

Follow aider's official installation flow:

```bash
python -m pip install aider-install
aider-install
```

Official reference: [aider — OpenAI compatible APIs](https://aider.chat/docs/llms/openai-compat.html).

## 2. Set the endpoint and key

Enter the Earth API key interactively so it is not copied into the command itself:

```bash
read -r -s -p "Earth API key: " OPENAI_API_KEY
export OPENAI_API_KEY
export OPENAI_API_BASE="https://api.earth.icu/v1"
printf '\n'
```

Keep the key out of repositories, shell scripts, screenshots, logs, and client-side code. Create and manage keys in the [Earth API console](https://api.earth.icu/console).

Aider's official compatibility guide documents `OPENAI_API_BASE` and `OPENAI_API_KEY` for OpenAI-compatible endpoints. Its options reference also exposes `--openai-api-base`.

## 3. Choose a current model

Open the [Models & pricing page](https://api.earth.icu/models), copy a currently listed model ID, then start aider from your repository:

```bash
cd /path/to/your/project
aider --model openai/YOUR_MODEL_ID
```

The `openai/` prefix is required by aider for this provider route. Replace `YOUR_MODEL_ID` with a current Earth API catalog entry.

Aider may warn when it does not recognize a model's metadata. That warning is separate from API authentication or model availability. Review aider's [model warnings](https://aider.chat/docs/llms/warnings.html) and configure model metadata only when you have accurate values.

## 4. Start conservatively

Begin with one small task and review the request in Earth API Usage before enabling automated retries or large repository changes.

Earth API currently:

- translates `system` instructions for upstreams that require the `developer` role while preserving content and order;
- ignores unknown or unrepresentable optional parameters instead of blocking an otherwise usable request;
- does not globally block later or concurrent requests because one earlier request is awaiting usage reconciliation.

Ignored parameters do not necessarily take effect. A local timeout does not prove server-side cancellation, and usage or balance displays can briefly lag while charges settle.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Authentication error | Confirm `OPENAI_API_KEY` contains an Earth API key, not an OGS login token or upstream-provider key. |
| Wrong endpoint or HTML response | Confirm `OPENAI_API_BASE=https://api.earth.icu/v1`; do not use the website root as the API base. |
| Model not found | Refresh the live catalog and keep the `openai/` prefix in aider's model argument. |
| `System messages are not allowed` | Retry through the current Earth API endpoint; the relay now translates system instructions for affected upstreams. |
| Unsupported-parameter warning | Start with default aider settings. The relay ignores optional fields it cannot represent, but a model may still reject unsupported native behavior. |
| Stream or request ends early | Preserve the request ID when available and review Usage before retrying. |

For endpoint-level behavior, see the [Earth API compatibility snapshot](earth-api-compatibility.md). For sanitized integration feedback, use the [operator-maintained form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml).

Never post API keys, account tokens, billing details, private prompts, personal data, repository secrets, or unredacted headers.

Published by the Earth API operator. Prepared with AI assistance and checked against aider's official OpenAI-compatible API documentation and the live Earth API developer surface.
