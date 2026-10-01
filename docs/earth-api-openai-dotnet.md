# Earth API with the official OpenAI .NET SDK

This guide shows a conservative first integration with the official [OpenAI .NET SDK](https://github.com/openai/openai-dotnet) and Earth API's OpenAI-style endpoints.

Earth API is an independent, maintainer-operated relay. It is not affiliated with OpenAI. The SDK is used only as an HTTP client for the documented Earth API base URL.

## What this guide covers

- authenticated model discovery;
- Chat Completions;
- Responses;
- a custom base URL;
- disabling SDK retries so they do not multiply Earth API's bounded server-side retry;
- a per-attempt network timeout;
- terminal usage checks.

The examples use package version `2.14.0`, which was the current stable NuGet release when this guide was checked on 2 October 2026. The package targets .NET Standard 2.0; the sample project below uses .NET 8.

## 1. Create a project

```bash
dotnet new console --framework net8.0 -n EarthApiDotNet
cd EarthApiDotNet
dotnet add package OpenAI --version 2.14.0
```

Keep the key outside source control:

```bash
read -r -s -p "Earth API key: " EARTH_API_KEY
export EARTH_API_KEY
printf '\n'
```

On PowerShell:

```powershell
$env:EARTH_API_KEY = Read-Host "Earth API key"
```

Use the public [models and pricing page](https://api.earth.icu/models) as a human-readable reference. The authenticated catalog is the source of truth for the current account.

## 2. Create one shared client

The official SDK normally retries selected 408, 429, and 5xx responses up to three additional times. Earth API already performs a bounded server-side retry for eligible upstream failures, so the first integration should disable client retries.

```csharp
using OpenAI;
using System.ClientModel;
using System.ClientModel.Primitives;

string apiKey = Environment.GetEnvironmentVariable("EARTH_API_KEY")
    ?? throw new InvalidOperationException("EARTH_API_KEY is required.");

OpenAIClientOptions options = new()
{
    Endpoint = new Uri("https://api.earth.icu/v1"),
    NetworkTimeout = TimeSpan.FromSeconds(60),
    RetryPolicy = new ClientRetryPolicy(maxRetries: 0),
};

OpenAIClient client = new(new ApiKeyCredential(apiKey), options);
```

`NetworkTimeout` limits one network attempt. An application-level cancellation token can enforce a shorter total budget. A local timeout does not prove the server cancelled the request and does not rule out billing.

## 3. Discover models before generating

```csharp
using OpenAI.Models;

OpenAIModelClient models = client.GetOpenAIModelClient();

foreach (OpenAIModel model in models.GetModels().Value)
{
    Console.WriteLine(model.Id);
}
```

Use an ID returned for the current account. Do not hard-code the public catalog forever: availability and prices can change.

## 4. Send one Chat Completions request

This call may incur a charge.

```csharp
using OpenAI.Chat;

string model = Environment.GetEnvironmentVariable("EARTH_MODEL")
    ?? throw new InvalidOperationException("EARTH_MODEL is required.");

using CancellationTokenSource deadline =
    new(TimeSpan.FromSeconds(75));

ChatClient chat = client.GetChatClient(model);
ChatCompletion completion = await chat.CompleteChatAsync(
    [
        new UserChatMessage("Reply with one short greeting.")
    ],
    cancellationToken: deadline.Token);

Console.WriteLine(completion.Content[0].Text);

if (completion.Usage is not null)
{
    Console.Error.WriteLine(
        $"input={completion.Usage.InputTokenCount} " +
        $"output={completion.Usage.OutputTokenCount} " +
        $"total={completion.Usage.TotalTokenCount}");
}
else
{
    Console.Error.WriteLine(
        "Terminal usage was not present; check the Earth API console before reconciling cost.");
}
```

The content check and usage check serve different purposes. A non-empty answer proves that this request returned text; terminal usage is the billing evidence exposed in that response.

## 5. Use the Responses endpoint

The SDK currently marks parts of the Responses surface as experimental, so the compiler diagnostic must be acknowledged explicitly. This call may incur a charge.

```csharp
#pragma warning disable OPENAI001

using OpenAI.Responses;

string model = Environment.GetEnvironmentVariable("EARTH_MODEL")
    ?? throw new InvalidOperationException("EARTH_MODEL is required.");

ResponsesClient responses = client.GetResponsesClient();
ResponseResult response = await responses.CreateResponseAsync(
    model,
    "Reply with one short greeting.");

Console.WriteLine(response.GetOutputText());

if (response.Usage is not null)
{
    Console.Error.WriteLine(
        $"input={response.Usage.InputTokenCount} " +
        $"output={response.Usage.OutputTokenCount} " +
        $"total={response.Usage.TotalTokenCount}");
}
else
{
    Console.Error.WriteLine(
        "Terminal usage was not present; check the Earth API console before reconciling cost.");
}

#pragma warning restore OPENAI001
```

Start with plain text. Test streaming, tools, structured output, built-in web search, background requests, and other advanced Responses features separately before production use.

## Retry and fallback behavior

Keep `maxRetries: 0` for the first test. This avoids multiplying attempts across the .NET SDK and Earth API.

Earth API may perform its own bounded retry and configured model fallback. A client should treat the public response as the Earth API result and should not depend on upstream identifiers or internal routing details. Do not add an immediate application retry loop until you have classified the returned status and verified whether a request may already have completed.

## Fast mode

A selected Earth API model can have an operator-defined default service tier. The current public catalog identifies models that default to Fast.

This guide does not force `service_tier: "fast"` through the strongly typed .NET SDK. The Earth extension and future SDK enum values should be validated separately. Confirm the actual tier from the terminal API response or Earth API Usage record rather than from elapsed time.

## Usage and billing checks

- Check terminal usage when it is present.
- Reconcile the request in the Earth API console.
- A completed response without terminal usage is not proof of a free request.
- Usage and balance display may settle asynchronously.
- Never estimate missing billed tokens from output length.
- Keep client request IDs and timestamps when reporting a problem, but remove API keys, account tokens, prompts, personal data, and unredacted headers.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 401 or 403 JSON error | Confirm the Earth API key and account access. Do not use an OGS login token as the API key. |
| Model error | Refresh the authenticated catalog and choose an enabled Earth API model ID. |
| 429 or temporary upstream error | Let Earth API finish its bounded internal handling; avoid stacking immediate SDK or application retries. |
| Timeout | Treat the result as unknown until Usage is checked; a client-side timeout is not cancellation proof. |
| Successful text but no terminal usage | Record the Earth request ID and timestamp, then reconcile the Earth API Usage page. |
| SDK rejects an optional field | Retry the minimal text request without that feature; OpenAI-compatible does not mean every optional field is supported. |

## Production checklist

Before production traffic:

1. retrieve models with the production key;
2. review the live price for the selected model;
3. send one minimal paid request;
4. verify output, terminal state, usage, and the console record;
5. set an application deadline and spending limit;
6. log Earth-facing request IDs without secrets;
7. test every advanced feature your application depends on;
8. keep a rollback path.

Disclosure: this guide is maintained by the Earth API operator and was prepared with AI assistance. It does not claim an official relationship with OpenAI, fixed capacity, lowest pricing, unlimited usage, zero retention, or complete API equivalence.
