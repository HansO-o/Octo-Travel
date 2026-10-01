# Connect Qwen Code to Earth API

Qwen Code can use Earth API through its OpenAI-compatible model provider. This guide configures both Chat Completions and Responses routes so you can select the transport explicitly with Qwen Code's `/model` command.

Earth API is an independent, maintainer-operated API relay. This guide is maintained by the Earth API operator, was prepared with AI assistance, and was checked against Qwen Code's official model-provider documentation and the public Earth API surface. It does not imply a partnership with Qwen Code or any upstream model provider.

## Before you start

You need:

- a current Qwen Code installation;
- an Earth API account and API key from [the Earth API console](https://api.earth.icu/console);
- enough account balance for the requests you choose to send.

Review the live [models and pricing page](https://api.earth.icu/models) before use. Model IDs and rates can change.

## Keep the key out of settings

Qwen Code can read a provider credential from the environment variable named by `envKey`. Enter the key in the shell that will launch Qwen Code:

```bash
read -r -s -p "Earth API key: " EARTH_API_KEY
export EARTH_API_KEY
printf '\n'
```

Do not put the real key in `settings.json`, a project `.env`, a repository, a screenshot, or a public issue. If you use a persistent secret store, inject `EARTH_API_KEY` into the Qwen Code process without committing it.

## Add Earth API routes

Edit the user-level `~/.qwen/settings.json`. Merge the following `modelProviders` block with any existing settings instead of replacing unrelated configuration:

```json
{
  "modelProviders": {
    "openai": [
      {
        "id": "gpt-6.1-sol",
        "name": "Earth gpt-6.1-sol — Chat Completions",
        "envKey": "EARTH_API_KEY",
        "baseUrl": "https://api.earth.icu/v1",
        "wireApi": "chat-completions",
        "generationConfig": {
          "timeout": 120000,
          "maxRetries": 0
        }
      },
      {
        "id": "gpt-6.1-sol",
        "name": "Earth gpt-6.1-sol — Responses",
        "envKey": "EARTH_API_KEY",
        "baseUrl": "https://api.earth.icu/v1",
        "wireApi": "responses",
        "generationConfig": {
          "timeout": 120000,
          "maxRetries": 0
        }
      }
    ]
  }
}
```

The `baseUrl` must be the `/v1` root, not the full `/v1/chat/completions` or `/v1/responses` path. Qwen Code appends the request path for the selected wire format.

As checked on 1 October 2026 at 09:43 Asia/Shanghai, the public Earth API page listed `gpt-6-astra`, `gpt-6-luna`, and `gpt-6.1-sol`, with rates in USD per million tokens. The example uses one dated model ID for clarity. Replace both `id` values with a model that your current account can discover and use.

Qwen Code supports the same model ID and Base URL on two routes when `wireApi` differs. It does not automatically fall back from one transport to the other when a request fails.

## Select a route

Start Qwen Code from the shell where `EARTH_API_KEY` is available. Then:

1. Run `/model`.
2. Select the Earth Chat Completions or Responses entry.
3. Start with one small, non-sensitive task.
4. Keep tool execution approval enabled until the exact route and model have been tested.
5. Review the result and the Earth API console's Usage record before increasing traffic.

Qwen Code hot-reloads `modelProviders` edits in an interactive session. Reopen `/model` after changing the file. If a route does not appear, restart Qwen Code and inspect the configuration for warnings.

## Transport and capability boundaries

| Setting | Result |
| --- | --- |
| `wireApi: "chat-completions"` | Uses the OpenAI-compatible Chat Completions transport. |
| `wireApi: "responses"` | Uses the Responses transport. |
| Omitted `wireApi` | Defaults to Chat Completions for the `openai` provider. |
| `maxRetries: 0` | Avoids automatic duplicate requests while you validate behavior and billing. |

Additional boundaries:

- A model appearing on the public page does not prove that every account, optional parameter, tool mode, media type, or Qwen Code feature is available.
- Unknown or unrepresentable optional parameters may be ignored. Verify every field your workflow depends on.
- Tool calling depends on the selected model and route. Review side-effecting actions before approval.
- Qwen Code's Responses transport does not automatically fall back to Chat Completions.
- A local timeout does not prove that server-side work was cancelled. Usage and balance displays can update after a short delay.
- Earth API does not currently publish an embeddings or image-generation endpoint; do not enable those Qwen Code capabilities for this route without separate verification.
- Do not assume a service-level agreement, fixed capacity, lowest pricing, unlimited usage, zero retention, or an official upstream relationship.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Earth entries do not appear in `/model` | Confirm `modelProviders.openai` is an array, the JSON is valid, and the file is `~/.qwen/settings.json`. |
| Authentication error | Confirm Qwen Code was launched from a process that has `EARTH_API_KEY`; rotate the key in the Earth API console if needed. |
| Request goes to the wrong host | Ensure `baseUrl` is exactly `https://api.earth.icu/v1` and remove deprecated credential/base URL overrides. |
| Model error | Select a model returned by current Earth API discovery, not an old screenshot or copied name. |
| Responses route fails but Chat works | Select the Chat Completions route explicitly; Qwen Code does not auto-fallback. |
| Tool behavior differs | Reduce the task to text-only output, then add tools one at a time with manual approval. |
| Unexpected spend or duplicate work | Keep `maxRetries` at `0` while testing and inspect request-level Usage records. |

When finished with the temporary shell session:

```bash
unset EARTH_API_KEY
```

## References

- [Earth API documentation](https://api.earth.icu/docs)
- [Earth API models and pricing](https://api.earth.icu/models)
- [Qwen Code: Model Providers](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/model-providers/)
- [Earth API compatibility snapshot](earth-api-compatibility.md)
- [Production-readiness checklist](earth-api-production-readiness.md)

For sanitized setup feedback, use the [operator-maintained integration form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml). Remove keys, account tokens, billing data, private prompts, personal data, and unredacted headers before posting.
