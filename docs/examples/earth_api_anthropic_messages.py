#!/usr/bin/env python3
"""Safely inspect Earth API models and optionally call Anthropic Messages."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

BASE_URL = "https://api.earth.icu/v1"
ANTHROPIC_VERSION = "2023-06-01"
FORBIDDEN_UPSTREAM_KEYS = {
    "access_programs",
    "upstreamid",
    "upstreamrequestid",
    "upstream_model",
    "upstreammodel",
    "upstream_response_id",
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(
            req.full_url, code, "Redirect refused", headers, fp
        )


OPENER = urllib.request.build_opener(NoRedirect)


def display_request_id(value: str | None) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else "not returned"


def request_json(
    method: str,
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any] | None = None,
    timeout: float = 30.0,
) -> tuple[dict[str, Any], str | None]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with OPENER.open(request, timeout=timeout) as response:
            request_id = response.headers.get("x-request-id")
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        request_id = error.headers.get("x-request-id") if error.headers else None
        error.close()
        raise RuntimeError(
            f"Earth API HTTP {error.code} "
            f"(request_id={display_request_id(request_id)})"
        ) from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Network error: {error.reason}") from error

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as error:
        raise RuntimeError(
            "Earth API returned non-JSON content "
            f"(request_id={display_request_id(request_id)})"
        ) from error
    if not isinstance(parsed, dict):
        raise RuntimeError(
            "Earth API returned an unexpected JSON shape "
            f"(request_id={display_request_id(request_id)})"
        )
    return parsed, request_id


def list_models(api_key: str) -> list[str]:
    catalog, request_id = request_json(
        "GET",
        f"{BASE_URL}/models",
        {"Authorization": f"Bearer {api_key}"},
    )
    models = catalog.get("data")
    if not isinstance(models, list):
        raise RuntimeError("Model catalog response does not contain a data array")
    identifiers = [
        item["id"]
        for item in models
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    print(json.dumps({"models": identifiers}, indent=2))
    print(
        f"Earth request ID: {display_request_id(request_id)}",
        file=sys.stderr,
    )
    return identifiers


def create_message(
    api_key: str,
    model: str,
    prompt: str,
    max_tokens: int,
) -> tuple[dict[str, Any], str | None]:
    return request_json(
        "POST",
        f"{BASE_URL}/messages",
        {
            "x-api-key": api_key,
            "anthropic-version": ANTHROPIC_VERSION,
            "Content-Type": "application/json",
        },
        {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        },
        timeout=120.0,
    )


def find_forbidden_metadata(value: Any, path: str = "$") -> list[str]:
    hits: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if key.lower() in FORBIDDEN_UPSTREAM_KEYS:
                hits.append(child_path)
            hits.extend(find_forbidden_metadata(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            hits.extend(find_forbidden_metadata(child, f"{path}[{index}]"))
    return hits


def extract_text(response: dict[str, Any]) -> str:
    content = response.get("content")
    if not isinstance(content, list):
        return ""
    parts = [
        block["text"].strip()
        for block in content
        if isinstance(block, dict)
        and block.get("type") == "text"
        and isinstance(block.get("text"), str)
        and block["text"].strip()
    ]
    return "\n".join(parts)


def print_usage(response: dict[str, Any]) -> None:
    usage = response.get("usage")
    if not isinstance(usage, dict):
        print(
            "Usage: not returned; check the Earth console before retrying. "
            "Token counts are not estimated.",
            file=sys.stderr,
        )
        return
    input_tokens = usage.get("input_tokens", "not returned")
    output_tokens = usage.get("output_tokens", "not returned")
    print(
        f"Usage: input={input_tokens} output={output_tokens}",
        file=sys.stderr,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "List Earth API models. Send one Anthropic Messages request only "
            "with --generate and --model; generation may incur charges."
        )
    )
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--model")
    parser.add_argument(
        "--prompt",
        default="Reply with one short greeting.",
        help="Prompt for the optional generation request.",
    )
    parser.add_argument("--max-tokens", type=int, default=256)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    api_key = os.environ.get("EARTH_API_KEY")
    if not api_key:
        print("Set EARTH_API_KEY in the environment.", file=sys.stderr)
        return 2
    if args.max_tokens < 1:
        print("--max-tokens must be at least 1.", file=sys.stderr)
        return 2

    try:
        models = list_models(api_key)
        if not args.generate:
            print(
                "No generation request sent. Review current pricing, then use "
                "--generate --model MODEL_ID to opt in.",
                file=sys.stderr,
            )
            return 0
        if not args.model:
            print("--model is required with --generate.", file=sys.stderr)
            return 2
        if args.model not in models:
            print(
                "Selected model was not returned by the authenticated catalog.",
                file=sys.stderr,
            )
            return 2

        response, request_id = create_message(
            api_key, args.model, args.prompt, args.max_tokens
        )
        if find_forbidden_metadata(response):
            raise RuntimeError(
                "Earth API returned internal metadata; share only the Earth "
                f"request ID with the operator "
                f"(request_id={display_request_id(request_id)})"
            )
        text = extract_text(response)
        if not text:
            raise RuntimeError(
                "Terminal response did not contain text "
                f"(request_id={display_request_id(request_id)})"
            )
        print(text)
        print(
            f"Earth request ID: {display_request_id(request_id)}",
            file=sys.stderr,
        )
        print_usage(response)
        print(
            "A local timeout does not prove server-side cancellation.",
            file=sys.stderr,
        )
        return 0
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
