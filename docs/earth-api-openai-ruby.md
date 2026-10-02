# Earth API with the official OpenAI Ruby SDK

This guide shows a conservative first integration with the official [OpenAI Ruby SDK](https://github.com/openai/openai-ruby) and Earth API's OpenAI-style endpoints.

Earth API is an independent, maintainer-operated relay. It is not affiliated with OpenAI. The SDK is used only as an HTTP client for the documented Earth API base URL.

## What this guide covers

- authenticated model discovery;
- Chat Completions;
- Responses;
- a custom base URL;
- disabling SDK retries so they do not multiply Earth API's bounded server-side retry;
- a finite request timeout;
- terminal usage checks;
- an optional per-request Fast tier.

The examples use `openai` gem version `0.96.0`, the current release when this guide was checked on 2 October 2026. The official SDK requires Ruby 3.3 or newer.

## 1. Install the gem

Add this to `Gemfile`:

```ruby
source "https://rubygems.org"

gem "openai", "0.96.0"
```

Then install:

```bash
bundle install
```

Keep the key outside source control:

```bash
read -r -s -p "Earth API key: " EARTH_API_KEY
export EARTH_API_KEY
printf '\n'
```

Use the public [models and pricing page](https://api.earth.icu/models) as a human-readable reference. The authenticated catalog is the source of truth for the current account.

## 2. Create one shared client

The Ruby SDK has a configured retry budget of two by default and a default request timeout of 600 seconds. Earth API already performs bounded server-side handling for eligible upstream failures, so the first integration should disable SDK retries and use a shorter finite timeout.

```ruby
require "bundler/setup"
require "openai"

client = OpenAI::Client.new(
  api_key: ENV.fetch("EARTH_API_KEY"),
  base_url: "https://api.earth.icu/v1",
  max_retries: 0,
  timeout: 60
)
```

Create one client per application in normal use so its HTTP connection pool can be reused.

A local timeout does not prove that the server cancelled the request and does not rule out billing. Reconcile an uncertain request in the Earth API console before sending it again.

## 3. Discover models before generating

```ruby
models = client.models.list

models.data.each do |model|
  puts model.id
end
```

Use an ID returned for the current account. Do not hard-code the public catalog forever: availability and prices can change.

## 4. Send one Chat Completions request

This call may incur a charge.

```ruby
model = ENV.fetch("EARTH_MODEL")

completion = client.chat.completions.create(
  model: model,
  messages: [
    {role: :user, content: "Reply with one short greeting."}
  ],
  request_options: {
    max_retries: 0,
    timeout: 60
  }
)

puts completion.choices.first.message.content

if completion.usage
  warn(
    "input=#{completion.usage.prompt_tokens} " \
    "output=#{completion.usage.completion_tokens} " \
    "total=#{completion.usage.total_tokens}"
  )
else
  warn "Terminal usage was not present; check the Earth API console before reconciling cost."
end

warn "earth_request_id=#{completion._request_id}" if completion._request_id
```

The content check and usage check serve different purposes. A non-empty answer proves that this request returned text; terminal usage is the billing evidence exposed in that response.

## 5. Use the Responses endpoint

This call may incur a charge.

```ruby
model = ENV.fetch("EARTH_MODEL")

response = client.responses.create(
  model: model,
  input: "Reply with one short greeting.",
  request_options: {
    max_retries: 0,
    timeout: 60
  }
)

puts response.output_text

if response.usage
  warn(
    "input=#{response.usage.input_tokens} " \
    "output=#{response.usage.output_tokens} " \
    "total=#{response.usage.total_tokens}"
  )
else
  warn "Terminal usage was not present; check the Earth API console before reconciling cost."
end

warn "earth_request_id=#{response._request_id}" if response._request_id
```

Start with plain text. Test streaming, tools, structured output, built-in web search, background requests, and other advanced Responses features separately before production use.

## Optional Fast tier

The official Ruby SDK accepts `service_tier: :fast` for Chat Completions and Responses. Use it only after checking that the selected Earth API model supports the requested tier.

Chat Completions:

```ruby
completion = client.chat.completions.create(
  model: ENV.fetch("EARTH_MODEL"),
  messages: [{role: :user, content: "Reply with one short greeting."}],
  service_tier: :fast,
  request_options: {max_retries: 0, timeout: 60}
)

warn "actual_service_tier=#{completion.service_tier.inspect}"
```

Responses:

```ruby
response = client.responses.create(
  model: ENV.fetch("EARTH_MODEL"),
  input: "Reply with one short greeting.",
  service_tier: :fast,
  request_options: {max_retries: 0, timeout: 60}
)

warn "actual_service_tier=#{response.service_tier.inspect}"
```

The request value is a preference, not proof of how it was served. Confirm the actual tier from the terminal response or the Earth API Usage record. A model with an operator-defined default Fast tier does not need a client override.

## Retry and fallback behavior

Keep `max_retries: 0` for the first test. This avoids multiplying attempts across the Ruby SDK and Earth API.

Earth API may perform its own bounded retry and configured model fallback. A client should treat the public response as the Earth API result and should not depend on upstream identifiers or internal routing details. Do not add an immediate application retry loop until you have classified the returned status and verified whether a request may already have completed.

## Usage and billing checks

- Check terminal usage when it is present.
- Reconcile the request in the Earth API console.
- A completed response without terminal usage is not proof of a free request.
- Usage and balance display may settle asynchronously.
- Never estimate missing billed tokens from output length.
- Keep the Earth-facing request ID and timestamp when reporting a problem.
- Remove API keys, account tokens, prompts, personal data, and unredacted headers before sharing diagnostics.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 401 or 403 JSON error | Confirm the Earth API key and account access. Do not use an OGS login token as the API key. |
| Model error | Refresh the authenticated catalog and choose an enabled Earth API model ID. |
| 429 or temporary upstream error | Let Earth API finish its bounded internal handling; avoid stacking immediate SDK or application retries. |
| Timeout | Treat the result as unknown until Usage is checked; a client-side timeout is not cancellation proof. |
| Successful text but no terminal usage | Record `_request_id` and the timestamp, then reconcile the Earth API Usage page. |
| SDK rejects an optional field | Retry the minimal text request without that feature; OpenAI-compatible does not mean every optional field is supported. |

## Production checklist

Before production traffic:

1. retrieve models with the production key;
2. review the live price for the selected model;
3. send one minimal paid request;
4. verify output, terminal state, usage, actual service tier, and the console record;
5. set a request timeout and spending limit;
6. log Earth-facing request IDs without secrets;
7. test every advanced feature your application depends on;
8. keep a rollback path.

Disclosure: this guide is maintained by the Earth API operator and was prepared with AI assistance. It does not claim an official relationship with OpenAI, fixed capacity, lowest pricing, unlimited usage, zero retention, or complete API equivalence.
