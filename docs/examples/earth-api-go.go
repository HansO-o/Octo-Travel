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
	generate bool
	model    string
	prompt   string
	timeout  time.Duration
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
	if opts.generate && strings.TrimSpace(opts.model) == "" {
		return errors.New("-generate also requires -model with an ID from GET /models")
	}

	client := &http.Client{Timeout: opts.timeout}
	ctx := context.Background()

	if !opts.generate {
		fmt.Fprintln(os.Stderr, "Listing the authenticated model catalog; no generation request will be sent.")
		return request(ctx, client, http.MethodGet, baseURL+"/models", apiKey, nil)
	}

	fmt.Fprintln(os.Stderr, "Sending one generation request. It may incur charges; a local timeout does not guarantee server-side cancellation.")
	path, payload := generationRequest(opts)
	return request(ctx, client, http.MethodPost, baseURL+path, apiKey, payload)
}

func generationRequest(opts options) (string, map[string]any) {
	if opts.api == "responses" {
		return "/responses", map[string]any{
			"model":  opts.model,
			"input":  opts.prompt,
			"stream": false,
		}
	}
	return "/chat/completions", map[string]any{
		"model": opts.model,
		"messages": []map[string]string{
			{"role": "user", "content": opts.prompt},
		},
		"stream": false,
	}
}

func request(ctx context.Context, client *http.Client, method, endpoint, apiKey string, payload any) error {
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

	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes+1))
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}
	if len(responseBody) > maxBodyBytes {
		return fmt.Errorf("response exceeds %d bytes", maxBodyBytes)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("HTTP %s: %s", resp.Status, strings.TrimSpace(string(responseBody)))
	}

	var decoded any
	if json.Unmarshal(responseBody, &decoded) == nil {
		pretty, err := json.MarshalIndent(decoded, "", "  ")
		if err == nil {
			fmt.Println(string(pretty))
			return nil
		}
	}
	fmt.Println(string(responseBody))
	return nil
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
