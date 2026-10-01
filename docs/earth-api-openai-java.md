# Earth API + official OpenAI Java SDK

This guide connects the official `openai-java` client to Earth API through its OpenAI-compatible base URL.

Earth API is an independent, maintainer-operated relay. This guide does not imply an official relationship with OpenAI or another upstream provider. It was prepared with AI assistance and reviewed against the public Earth API surface and the official SDK source.

## Scope

The examples cover:

- a custom `baseUrl` and server-side API key;
- one non-streaming Chat Completions request;
- an optional non-streaming Responses request;
- a 60-second client timeout;
- disabled SDK retries for an observable first test;
- final text and provider-reported usage when present.

Tools, structured output, streaming, web search, images, audio, embeddings, Realtime, and Fast-tier forwarding require separate validation. Parameter acceptance alone does not prove a model supports a capability.

## Prerequisites

- Java 17 or newer
- an Earth API key stored outside source control
- a current model ID returned for the same account
- current pricing reviewed at [api.earth.icu/models](https://api.earth.icu/models)

The official repository showed `openai-java` version `4.74.0` when this guide was checked on 2 October 2026. Review the [current release on Maven Central](https://central.sonatype.com/artifact/com.openai/openai-java) before pinning a production version.

Gradle:

```kotlin
implementation("com.openai:openai-java:4.74.0")
```

Maven:

```xml
<dependency>
  <groupId>com.openai</groupId>
  <artifactId>openai-java</artifactId>
  <version>4.74.0</version>
</dependency>
```

Set environment variables without committing them:

```bash
export EARTH_API_KEY="replace-with-your-key"
export EARTH_MODEL_ID="replace-with-a-current-catalog-id"
```

Before generating text, query the authenticated catalog:

```bash
curl --fail-with-body --silent --show-error \
  https://api.earth.icu/v1/models \
  -H "Authorization: Bearer $EARTH_API_KEY"
```

## Chat Completions example

```java
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.ChatModel;
import com.openai.models.chat.completions.ChatCompletion;
import com.openai.models.chat.completions.ChatCompletionCreateParams;

import java.time.Duration;

public final class EarthChat {
    public static void main(String[] args) {
        String apiKey = requiredEnv("EARTH_API_KEY");
        String modelId = requiredEnv("EARTH_MODEL_ID");

        OpenAIClient client = OpenAIOkHttpClient.builder()
                .apiKey(apiKey)
                .baseUrl("https://api.earth.icu/v1")
                .maxRetries(0)
                .timeout(Duration.ofSeconds(60))
                .build();

        ChatCompletionCreateParams params = ChatCompletionCreateParams.builder()
                .model(ChatModel.of(modelId))
                .addUserMessage("Reply with exactly: Earth API is connected.")
                .build();

        ChatCompletion completion = client.chat().completions().create(params);

        completion.choices().stream()
                .flatMap(choice -> choice.message().content().stream())
                .forEach(System.out::println);

        completion.usage().ifPresent(usage ->
                System.out.println("usage=" + usage)
        );
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required");
        }
        return value;
    }
}
```

The SDK models usage as optional. Treat it as present only when the terminal response included a token report that the client could deserialize. Never replace missing usage with zero or a local billing estimate.

## Optional Responses example

Use this as a separate compatibility test, not as proof that every Responses feature is available:

```java
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.responses.Response;
import com.openai.models.responses.ResponseCreateParams;

import java.time.Duration;

public final class EarthResponses {
    public static void main(String[] args) {
        String apiKey = requiredEnv("EARTH_API_KEY");
        String modelId = requiredEnv("EARTH_MODEL_ID");

        OpenAIClient client = OpenAIOkHttpClient.builder()
                .apiKey(apiKey)
                .baseUrl("https://api.earth.icu/v1")
                .maxRetries(0)
                .timeout(Duration.ofSeconds(60))
                .build();

        ResponseCreateParams params = ResponseCreateParams.builder()
                .model(modelId)
                .input("Reply with exactly: Earth API Responses works.")
                .build();

        Response response = client.responses().create(params);

        response.output().stream()
                .flatMap(item -> item.message().stream())
                .flatMap(message -> message.content().stream())
                .flatMap(content -> content.outputText().stream())
                .forEach(outputText -> System.out.println(outputText.text()));

        response.usage().ifPresent(usage ->
                System.out.println("usage=" + usage)
        );
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required");
        }
        return value;
    }
}
```

## Why `maxRetries(0)`

The official Java SDK automatically retries selected connection errors, HTTP 408, 409, 429, and 5xx responses twice by default. Earth API can already perform a bounded internal retry before public output begins. Disabling client retries for the first test avoids multiplying attempts and makes Usage records easier to reconcile.

If production requirements justify client retries later:

1. use a small, bounded budget;
2. apply a total deadline;
3. add jittered backoff;
4. do not replay after output has begun;
5. keep idempotency and duplicate side effects in mind;
6. reconcile every attempt against Earth API Usage.

A client timeout does not prove the server cancelled the request or that no billable work occurred.

## Production checklist

1. Query authenticated `GET /v1/models` using the same key and environment.
2. Keep `EARTH_API_KEY` only in a server-side secret store.
3. Pin and test the SDK version used by the application.
4. Reuse one `OpenAIClient`; the official SDK maintains connection and thread pools per client.
5. Log the Earth public request ID, selected Earth catalog model ID, status code, terminal state, optional retry header, and returned usage.
6. Review Earth API Usage and billing records instead of relying on client-side token estimates.
7. Test Chat Completions and Responses independently.
8. Add tools, streaming, structured output, web search, and other capabilities one at a time.

## Troubleshooting

### The model is rejected

Refresh `GET /v1/models` with the same Earth API key and use the exact catalog ID. Do not infer an upstream model name.

### One application action creates multiple upstream attempts

Confirm the client uses `maxRetries(0)`. Also inspect job queues, reverse proxies, framework retry policies, and application loops.

### Usage is absent

Wait for the terminal response. If `completion.usage()` or `response.usage()` is empty, keep the request pending reconciliation. Missing SDK usage does not mean zero tokens or a free request.

### Chat works but Responses fails

Keep the Chat Completions path in production while testing Responses separately. Remove tools and optional parameters, then start with one plain text request.

### Deserialization fails

Record the SDK version, endpoint, Earth catalog model ID, HTTP status, Earth public request ID, and a sanitized response shape. Never publish API keys, cookies, account tokens, private prompts, personal data, or raw billing information.

## Official references

- [Official OpenAI Java SDK](https://github.com/openai/openai-java)
- [SDK configuration and retries](https://github.com/openai/openai-java#configuration)
- [Earth API documentation](https://api.earth.icu/docs)
- [Earth API models and pricing](https://api.earth.icu/models)

For sanitized compatibility feedback, use the [operator-maintained integration form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml).
