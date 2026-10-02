package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	defaultBaseURL = "https://api.earth.icu/v1"
	maxBodyBytes   = 4 << 20
)

type options struct {
	api      string
	baseURL  string
	fast     bool
	generate bool
	model    string
	prompt   string
	timeout  time.Duration
}

type safeHTTPError struct {
	status    string
	requestID string
}

func (err safeHTTPError) Error() string {
	return fmt.Sprintf("Earth API HTTP %s (request_id=%s)", err.status, displayValue(err.requestID))
}

func main() {
	opts := parseFlags()
	if err := run(opts); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func parseFlags() options {
	var opts options
	flag.StringVar(&opts.api, "api", "chat", "generation interface: chat or responses")
	flag.StringVar(&opts.baseURL, "base-url", envOrDefault("EARTH_API_BASE_URL", defaultBaseURL), "Earth API base URL")
	flag.BoolVar(&opts.fast, "fast", false, "request service_tier=fast; verify the actual terminal tier")
	flag.BoolVar(&opts.generate, "generate", false, "send one generation request; may incur charges")
	flag.StringVar(&opts.model, "model", "", "model ID returned by the authenticated model catalog")
	flag.StringVar(&opts.prompt, "prompt", "Reply with exactly: Earth API connection test", "test prompt")
	flag.DurationVar(&opts.timeout, "timeout", 30*time.Second, "overall HTTP timeout")
	flag.Parse()
	return opts
}

func run(opts options) error {
	apiKey := strings.TrimSpace(os.Getenv("EARTH_API_KEY"))
	if apiKey == "" {
		return errors.New("set EARTH_API_KEY in the environment; the key is never printed")
	}

	baseURL, err := validateBaseURL(opts.baseURL)
	if err != nil {
		return err
	}
	if opts.timeout <= 0 {
		return errors.New("-timeout must be greater than zero")
	}
	if opts.api != "chat" && opts.api != "responses" {
		return errors.New("-api must be chat or responses")
	}
	if opts.fast && !opts.generate {
		return errors.New("-fast is only valid with -generate")
	}
	if opts.generate && strings.TrimSpace(opts.model) == "" {
		return errors.New("-generate also requires -model with an ID from GET /models")
	}

	client := &http.Client{Timeout: opts.timeout}
	ctx := context.Background()

	if !opts.generate {
		fmt.Fprintln(os.Stderr, "Listing the authenticated model catalog; no generation request will be sent.")
		return request(ctx, client, http.MethodGet, baseURL+"/models", apiKey, nil, false)
	}

	if opts.fast {
		fmt.Fprintln(os.Stderr, "Requesting Fast. The request value is not proof of the actual processing tier.")
	}
	fmt.Fprintln(os.Stderr, "Sending one generation request. It may incur charges; a local timeout does not guarantee server-side cancellation.")
	path, payload := generationRequest(opts)
	return request(ctx, client, http.MethodPost, baseURL+path, apiKey, payload, true)
}

func generationRequest(opts options) (string, map[string]any) {
	var payload map[string]any
	if opts.api == "responses" {
		payload = map[string]any{
			"model":  opts.model,
			"input":  opts.prompt,
			"stream": false,
		}
	} else {
		payload = map[string]any{
			"model": opts.model,
			"messages": []map[string]string{
				{"role": "user", "content": opts.prompt},
			},
			"stream": false,
		}
	}
	if opts.fast {
		payload["service_tier"] = "fast"
	}
	if opts.api == "responses" {
		return "/responses", payload
	}
	return "/chat/completions", payload
}

func request(ctx context.Context, client *http.Client, method, endpoint, apiKey string, payload any, generation bool) error {
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encode request: %w", err)
		}
		body = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	requestID := strings.TrimSpace(resp.Header.Get("X-Request-Id"))
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes+1))
	if err != nil {
		return fmt.Errorf("read Earth response (request_id=%s): %w", displayValue(requestID), err)
	}
	if len(responseBody) > maxBodyBytes {
		return fmt.Errorf("Earth response exceeds %d bytes (request_id=%s)", maxBodyBytes, displayValue(requestID))
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return safeHTTPError{status: resp.Status, requestID: requestID}
	}

	var decoded map[string]any
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		return fmt.Errorf("Earth API returned a non-JSON success response (request_id=%s)", displayValue(requestID))
	}
	if !generation {
		pretty, err := json.MarshalIndent(decoded, "", "  ")
		if err != nil {
			return fmt.Errorf("format model catalog: %w", err)
		}
		fmt.Println(string(pretty))
		fmt.Fprintln(os.Stderr, "Earth request ID:", displayValue(requestID))
		return nil
	}

	text := extractOutputText(decoded)
	if text == "" {
		return fmt.Errorf("terminal response did not contain output text (request_id=%s)", displayValue(requestID))
	}
	fmt.Println(text)
	fmt.Fprintln(os.Stderr, "Earth request ID:", displayValue(requestID))
	fmt.Fprintln(os.Stderr, "Actual service tier:", displayString(decoded["service_tier"]))
	printUsage(decoded["usage"])
	return nil
}

func extractOutputText(decoded map[string]any) string {
	if choices, ok := decoded["choices"].([]any); ok && len(choices) > 0 {
		if first, ok := choices[0].(map[string]any); ok {
			if message, ok := first["message"].(map[string]any); ok {
				if content, ok := message["content"].(string); ok {
					return strings.TrimSpace(content)
				}
			}
		}
	}

	var parts []string
	if output, ok := decoded["output"].([]any); ok {
		for _, item := range output {
			message, ok := item.(map[string]any)
			if !ok {
				continue
			}
			content, _ := message["content"].([]any)
			for _, part := range content {
				entry, ok := part.(map[string]any)
				if !ok {
					continue
				}
				if value, ok := entry["text"].(string); ok && strings.TrimSpace(value) != "" {
					parts = append(parts, strings.TrimSpace(value))
				}
			}
		}
	}
	return strings.Join(parts, "\n")
}

func printUsage(raw any) {
	usage, ok := raw.(map[string]any)
	if !ok {
		fmt.Fprintln(os.Stderr, "Usage: not returned; check the Earth console before retrying. Token counts are not estimated.")
		return
	}
	input := firstValue(usage, "prompt_tokens", "input_tokens")
	output := firstValue(usage, "completion_tokens", "output_tokens")
	total := firstValue(usage, "total_tokens")
	fmt.Fprintf(os.Stderr, "Usage: input=%s output=%s total=%s\n", input, output, total)
}

func firstValue(values map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := values[key]; ok {
			return fmt.Sprint(value)
		}
	}
	return "not returned"
}

func displayString(value any) string {
	text, ok := value.(string)
	if !ok {
		return "not returned"
	}
	return displayValue(text)
}

func displayValue(value string) string {
	if strings.TrimSpace(value) == "" {
		return "not returned"
	}
	return strings.TrimSpace(value)
}

func validateBaseURL(raw string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", errors.New("invalid -base-url")
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return "", errors.New("-base-url must use http or https")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("-base-url must not contain a query or fragment")
	}
	return strings.TrimRight(parsed.String(), "/"), nil
}

func envOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
