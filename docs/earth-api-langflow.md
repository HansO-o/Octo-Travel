# Connect Langflow to Earth API

Use Langflow's built-in **OpenAI Compatible** model provider to discover and use the models exposed by Earth API.

Earth API is an independent, maintainer-operated API relay. This guide is maintained by the Earth API operator, was prepared with AI assistance, and was checked against Langflow's official OpenAI Compatible documentation and the public Earth API surface. It does not imply a partnership with Langflow or any upstream model provider.

## Before you start

You need:

- a Langflow installation that includes the OpenAI Compatible provider;
- an Earth API account and API key from [the Earth API console](https://api.earth.icu/console);
- enough account balance for the requests you choose to send.

Review the live [models and pricing page](https://api.earth.icu/models) before use. The catalog and rates can change. Never paste an API key into a flow export, screenshot, issue, repository, or shared chat.

## Configure the provider

In Langflow:

1. Click your profile icon.
2. Open **Settings**.
3. Select **Model Providers**.
4. Select **OpenAI Compatible**.
5. Set **Base URL** to:

   ```text
   https://api.earth.icu/v1
   ```

6. Set **API Key** to your Earth API key.
7. Click **Save**.

Langflow validates the connection against `/v1/models` and discovers available models. Enable only the models you intend to use.

Langflow also documents environment variables for this provider:

```bash
export OPENAI_COMPATIBLE_BASE_URL="https://api.earth.icu/v1"
export OPENAI_COMPATIBLE_API_KEY="YOUR_EARTH_API_KEY"
```

Keep the real key in a secret manager or the protected environment for your Langflow deployment. Do not commit it to source control.

## Use a discovered model

In a **Language Model** or **Agent** field:

1. Choose **OpenAI Compatible**.
2. Select one of the models Langflow discovered from Earth API.
3. Start with a small, non-sensitive prompt and no automatic retries.
4. Check the Langflow result and the Earth API console's Usage record before increasing traffic.

As checked on 1 October 2026 at 08:36 Asia/Shanghai, the public Earth API page listed `gpt-6-astra`, `gpt-6-luna`, and `gpt-6.1-sol`, with rates in USD per million tokens. Treat these names as a dated snapshot, not a permanent allowlist. Use live discovery instead of hard-coding the list when possible.

## Feature boundaries

- Earth API currently documents `/v1/models`, `/v1/chat/completions`, `/v1/responses`, and `/v1/messages`.
- Earth API does not currently publish an embeddings endpoint. Do not select this connection for Langflow **Embedding Model** fields just because Langflow exposes that field type.
- A model appearing in discovery does not prove that every optional parameter, tool mode, media type, or Langflow component is supported.
- Unknown or unrepresentable optional parameters may be ignored. Verify any parameter your flow depends on.
- Tool calling depends on the selected model and route. Keep human approval around side-effecting tools until the exact flow has been tested.
- A client timeout does not prove that server-side work was cancelled. Usage and balance displays can update after a short delay.
- Do not assume a service-level agreement, fixed capacity, lowest pricing, unlimited usage, zero retention, or an official upstream relationship.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Save fails during validation | Confirm the Base URL is exactly `https://api.earth.icu/v1`, then verify the key and account access. |
| No models appear | Open the Earth API models page, confirm the account can access `/v1/models`, and save the provider again. |
| Authentication error | Create or rotate the key in the Earth API console. Do not use an OGS login token as the API key. |
| Model error | Choose a model returned by current discovery; do not rely on an old screenshot or copied model name. |
| Embedding component fails | Use a separate embeddings provider. Earth API does not currently publish `/v1/embeddings`. |
| Agent or tool call behaves differently | Reduce the flow to one prompt without tools, then add capabilities one at a time and inspect the raw error. |
| Unexpected spend or duplicate work | Disable automatic retries while testing and review request-level Usage records. |

## References

- [Earth API documentation](https://api.earth.icu/docs)
- [Earth API models and pricing](https://api.earth.icu/models)
- [Langflow: OpenAI Compatible](https://docs.langflow.org/bundles-openai-compatible)
- [Earth API compatibility snapshot](earth-api-compatibility.md)
- [Production-readiness checklist](earth-api-production-readiness.md)

For sanitized setup feedback, use the [operator-maintained integration form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml). Remove keys, account tokens, billing data, private prompts, personal data, and unredacted headers before posting.
