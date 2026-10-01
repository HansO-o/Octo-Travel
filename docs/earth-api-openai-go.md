# Earth API + official OpenAI Go SDK

This guide connects the official `openai-go` client to Earth API through its OpenAI-compatible base URL.

Earth API is an independent, maintainer-operated relay. This guide does not imply an official relationship with OpenAI or another upstream provider. It was prepared with AI assistance and reviewed against the public Earth API surface and the official SDK source.

## Scope

The examples cover:

- explicit Earth API credentials and base URL;
- one non-streaming Chat Completions request;
- an optional non-streaming Responses request;
- a total context deadline and per-attempt timeout;
- disabled SDK retries for an observable first test;
- final text and provider-reported usage when present.

Tools, structured output, streaming, web search, images, audio, embeddings, Realtime, and Fast-tier forwarding require separate validation. Parameter acceptance alone does not prove a model supports a capability.

## Prerequisites

- Go 1.25 or newer for the current SDK
- an Earth API key stored outside source control
- a current model ID returned for the same account
- current pricing reviewed at [api.earth.icu/models](https://api.earth.icu/models)

The official repository showed `openai-go/v3` version `v3.69.0` when this guide was checked on 2 October 2026:

```bash
go get github.com/openai/openai-go/v3@v3.69.0
```

Check the [current official release](https://github.com/openai/openai-go) before pinning production. The official compatibility note says SDK v3.45.0 and later require Go 1.25+; applications staying on Go 1.22–1.24 can pin v3.44.0, which no longer has guaranteed fixes or security backports.

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

Save as `main.go`:

```go
package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
)

func main() {
	apiKey := requiredEnv("EARTH_API_KEY")
	modelID := requiredEnv("EARTH_MODEL_ID")

	client := openai.NewClient(
		option.WithAPIKey(apiKey),
		option.WithBaseURL("https://api.earth.icu/v1"),
		option.WithMaxRetries(0),
		option.WithRequestTimeout(60*time.Second),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 75*time.Second)
	defer cancel()

	completion, err := client.Chat.Completions.New(
		ctx,
		openai.ChatCompletionNewParams{
			Model: modelID,
			Messages: []openai.ChatCompletionMessageParamUnion{
				openai.UserMessage("Reply with exactly: Earth API is connected."),
			},
		},
	)
	if err != nil {
		panic(err)
	}

	if len(completion.Choices) == 0 {
		panic("completed response contained no choices")
	}
	fmt.Println(completion.Choices[0].Message.Content)

	if completion.JSON.Usage.Valid() {
		fmt.Printf("usage=%+v\n", completion.Usage)
	} else {
		fmt.Println("usage=missing; reconcile in Earth API Usage")
	}
}

func requiredEnv(name string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		panic(name + " is required")
	}
	return value
}
```

Run:

```bash
go run .
```

The SDK exposes field-presence metadata through `completion.JSON.Usage.Valid()`. Never replace missing usage with zero or a local billing estimate.

## Optional Responses example

Use this as a separate compatibility test, not proof that every Responses feature is available:

```go
package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/responses"
)

func main() {
	apiKey := requiredEnv("EARTH_API_KEY")
	modelID := requiredEnv("EARTH_MODEL_ID")

	client := openai.NewClient(
		option.WithAPIKey(apiKey),
		option.WithBaseURL("https://api.earth.icu/v1"),
		option.WithMaxRetries(0),
		option.WithRequestTimeout(60*time.Second),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 75*time.Second)
	defer cancel()

	response, err := client.Responses.New(
		ctx,
		responses.ResponseNewParams{
			Model: modelID,
			Input: responses.ResponseNewParamsInputUnion{
				OfString: openai.String("Reply with exactly: Earth API Responses works."),
			},
		},
	)
	if err != nil {
		panic(err)
	}

	fmt.Println(response.OutputText())

	if response.JSON.Usage.Valid() {
		fmt.Printf("usage=%+v\n", response.Usage)
	} else {
		fmt.Println("usage=missing; reconcile in Earth API Usage")
	}
}

func requiredEnv(name string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		panic(name + " is required")
	}
	return value
}
```

## Why retries are disabled

The official Go SDK retries connection errors and HTTP 408, 409, 429, and 5xx responses twice by default. Earth API can already perform a bounded internal retry before public output begins. `option.WithMaxRetries(0)` makes the first integration test issue one client attempt and avoids multiplying retries.

The SDK has no request timeout by default. This guide uses both:

- `context.WithTimeout(...)` for the entire call;
- `option.WithRequestTimeout(...)` for each attempt.

With retries disabled there is one attempt, but keeping both limits makes later configuration changes easier to review.

If production requirements justify client retries later:

1. use a small bounded budget;
2. keep a total context deadline;
3. add jittered backoff;
4. do not replay after output has begun;
5. account for duplicate side effects and tool calls;
6. reconcile every attempt against Earth API Usage.

A client timeout does not prove the server cancelled the request or that no billable work occurred.

## Optional response diagnostics

The official SDK can place the raw HTTP response into a variable with `option.WithResponseInto(&httpResponse)`. Use it when you need the status code or Earth response headers:

```go
var httpResponse *http.Response

completion, err := client.Chat.Completions.New(
	ctx,
	params,
	option.WithResponseInto(&httpResponse),
)
```

Do not log authorization headers, cookies, API keys, private prompts, personal data, or raw billing information.

## Production checklist

1. Query authenticated `GET /v1/models` using the same key and environment.
2. Keep `EARTH_API_KEY` only in a server-side secret store.
3. Pin and test the SDK and Go versions used by the application.
4. Reuse one client where practical.
5. Log the Earth public request ID, selected Earth catalog model ID, status code, terminal state, optional retry header, and returned usage.
6. Review Earth API Usage and billing records instead of relying on local token estimates.
7. Test Chat Completions and Responses independently.
8. Add tools, streaming, structured output, web search, and other capabilities one at a time.

## Troubleshooting

### The model is rejected

Refresh `GET /v1/models` with the same key and use the exact Earth API catalog ID. Do not infer an upstream model name.

### One application action creates multiple attempts

Confirm the client uses `option.WithMaxRetries(0)`. Also inspect job queues, HTTP middleware, reverse proxies, framework policies, and application loops.

### Usage is absent

Wait for the terminal response. If `JSON.Usage.Valid()` is false, keep the request pending reconciliation. Missing SDK usage does not mean zero tokens or a free request.

### Chat works but Responses fails

Keep the Chat Completions path in production while testing Responses separately. Remove tools and optional parameters, then start with one plain text request.

### A request hangs longer than expected

Confirm the caller context has a total deadline and that `WithRequestTimeout` is set. Remember that a timeout at the client is not proof of server-side cancellation.

## Official references

- [Official OpenAI Go SDK](https://github.com/openai/openai-go)
- [SDK retry, timeout, and raw-response controls](https://github.com/openai/openai-go#retries)
- [Earth API documentation](https://api.earth.icu/docs)
- [Earth API models and pricing](https://api.earth.icu/models)

For sanitized compatibility feedback, use the [operator-maintained integration form](https://github.com/HansO-o/Octo-Travel/issues/new?template=earth-api-integration.yml).
