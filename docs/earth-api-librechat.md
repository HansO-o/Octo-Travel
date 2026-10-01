# Connect LibreChat to Earth API

Use this guide to add [Earth API](https://api.earth.icu) as a custom OpenAI-compatible endpoint in a self-hosted LibreChat deployment.

Earth API is an independently operated AI API relay. It is not an official OpenAI, Anthropic, or LibreChat service. The example below uses LibreChat's server-side custom endpoint configuration and Earth API's Chat Completions interface. It does not claim that every LibreChat feature or every upstream option is supported.

## Before you start

You need:

- a self-hosted LibreChat deployment that you administer;
- an Earth API key created from the [Earth API console](https://api.earth.icu/console);
- permission to edit LibreChat's environment and `librechat.yaml`;
- a current model ID from the [Earth API models page](https://api.earth.icu/models) or authenticated model discovery.

Keep the key on the LibreChat server. Do not put it in browser code, screenshots, public issues, client-side configuration, or a Git repository.

The public Earth API catalog showed `gpt-6-astra`, `gpt-6-luna`, and `gpt-6.1-sol` when checked on 1 October 2026 at 10:46 Asia/Shanghai. Treat that as a point-in-time observation: models and USD-per-million-token rates can change.

## 1. Store the key in LibreChat's environment

Add a dedicated variable to the environment used by the LibreChat backend:

```dotenv
EARTH_API_KEY=replace_with_your_earth_api_key
```

Restart LibreChat after changing its environment. The exact restart command depends on whether you use Docker Compose, Kubernetes, or another deployment method.

## 2. Add the custom endpoint

Add the following entry under `endpoints.custom` in `librechat.yaml`:

```yaml
version: 1.3.17

endpoints:
  custom:
    - name: "Earth API"
      apiKey: "${EARTH_API_KEY}"
      baseURL: "https://api.earth.icu/v1"
      models:
        default:
          - "gpt-6.1-sol"
        fetch: true
      titleConvo: false
      modelDisplayLabel: "Earth API"
```

If your file already has an `endpoints` block or other custom endpoints, merge this item into the existing `custom` list instead of creating a second top-level block.

Why these settings:

- `baseURL` is the API root. LibreChat appends the request path; do not use a full `/chat/completions` URL.
- `apiKey` resolves from the server environment.
- `models.fetch: true` lets LibreChat request the authenticated `/v1/models` catalog.
- `models.default` provides a startup fallback. Replace it if that model is no longer available to your account.
- `titleConvo: false` avoids an extra automatic title-generation request while you validate the connection.

LibreChat's current example configuration documents this `name`, `apiKey`, `baseURL`, and `models` shape for custom OpenAI-compatible providers. The source is the project's official [`librechat.example.yaml`](https://github.com/LibreChat-AI/LibreChat/blob/main/librechat.example.yaml).

## 3. Restart and verify discovery

Restart LibreChat, sign in, and select **Earth API** from the model endpoint list. Confirm that the model selector shows the current Earth API catalog.

Before sending a paid generation request, check the same key outside LibreChat:

```bash
export EARTH_API_KEY="replace_with_your_earth_api_key"

curl --fail-with-body \
  https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"
```

A successful catalog response proves that the key can authenticate and discover models. It does not prove that every model is available to every account or that a later generation request will have capacity.

Then send one short, non-sensitive test prompt in LibreChat with a current model. Review the Earth API usage and balance before expanding access.

## Shared-key and cost boundary

A LibreChat custom endpoint is configured on the server. If multiple LibreChat users can select the endpoint, they can consume the same Earth API account balance even though they never see the raw key.

Start with a private or tightly restricted LibreChat deployment. Apply LibreChat access controls and Earth API spending controls before allowing a larger user group. Do not treat a UI model list as authorization to expose the endpoint publicly.

Generation requests may be billable. Disable automatic client retries during initial validation where possible. A client timeout does not prove that the upstream request was cancelled, and usage or balance can settle after the response.

## Compatibility boundary

This setup targets LibreChat's custom OpenAI-compatible chat path and Earth API's `POST /v1/chat/completions`.

Do not infer additional capabilities merely because LibreChat displays them:

- Earth API does not currently document `/v1/embeddings` or image-generation endpoints.
- Tool calling depends on the selected model and the exact request path; validate it with non-destructive tools before enabling agent actions.
- Optional parameters that cannot be represented upstream may be ignored rather than causing the whole request to fail.
- Built-in web search is separately documented for explicit Earth API requests; this guide does not claim that LibreChat's custom endpoint UI exposes the required search controls.
- The public model catalog and prices are dynamic, and no fixed capacity or service-level guarantee is implied.

For endpoint-level evidence, see the [Earth API compatibility snapshot](earth-api-compatibility.md).

## Troubleshooting

### The Earth API endpoint is missing

Check that LibreChat loaded the intended `librechat.yaml`, the YAML indentation is valid, and the deployment was restarted after the change.

### No models appear

Run the authenticated `GET /v1/models` curl command with the same key. If curl succeeds, check LibreChat server logs and confirm `fetch: true` is nested under `models`.

### 401 or authentication error

Confirm that `EARTH_API_KEY` exists in the LibreChat backend environment and that the YAML contains `${EARTH_API_KEY}`, not the literal key or a browser-side variable.

### 404 or a doubled path

Use exactly `https://api.earth.icu/v1` as `baseURL`. Do not add `/chat/completions` and do not end up with `/v1/v1`.

### A model is rejected

Refresh the catalog and compare the selected ID with [the live models page](https://api.earth.icu/models). A previously documented model may have been removed or may not be enabled for the current account.

### Chat works but an advanced feature does not

Return to plain text Chat Completions first. Add streaming, tools, structured output, or other optional parameters one at a time and keep LibreChat's human approval controls enabled for actions.

## Disclosure

This guide is maintained by the Earth API operator and was prepared with AI assistance. The configuration was checked against LibreChat's current official example schema and Earth API's public developer surface. It is configuration guidance, not an independent review, a LibreChat partnership, or a claim of complete end-to-end compatibility.
