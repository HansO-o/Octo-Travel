#!/usr/bin/env python3
"""Safe-start example for using the OpenAI Python SDK with Earth API."""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

EARTH_API_BASE_URL = "https://api.earth.icu/v1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "List Earth API models. Add --generate and --model to send exactly "
            "one non-streaming generation request."
        )
    )
    parser.add_argument(
        "--generate",
        action="store_true",
        help="send one generation request after listing models",
    )
    parser.add_argument(
        "--api",
        choices=("chat", "responses"),
        default="chat",
        help="generation interface to use (default: chat)",
    )
    parser.add_argument(
        "--model",
        help="model ID returned by the current model catalog (required with --generate)",
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help='request service_tier="fast" for the generation call',
    )
    return parser.parse_args()


def print_metadata(
    *,
    request_id: str | None,
    service_tier: str | None,
    usage: dict[str, int | None] | None,
) -> None:
    """Print terminal response metadata without estimating unavailable usage."""
    print("\nResponse metadata:", file=sys.stderr)
    print(f"- request_id: {request_id or 'not returned'}", file=sys.stderr)
    print(f"- service_tier: {service_tier or 'not returned'}", file=sys.stderr)
    if usage is None:
        print(
            "- usage: not returned; check the Earth API console before reconciling cost",
            file=sys.stderr,
        )
        return

    print(
        "- usage: " + ", ".join(f"{name}={value}" for name, value in usage.items()),
        file=sys.stderr,
    )


def main() -> int:
    args = parse_args()
    if args.generate and not args.model:
        print("error: --model is required with --generate", file=sys.stderr)
        return 2
    if args.fast and not args.generate:
        print("error: --fast requires --generate", file=sys.stderr)
        return 2

    api_key = os.environ.get("EARTH_API_KEY")
    if not api_key:
        print("error: set EARTH_API_KEY first", file=sys.stderr)
        return 2

    try:
        from openai import APIStatusError, OpenAI, OpenAIError
    except ImportError:
        print(
            'error: install the SDK with: python -m pip install "openai==3.23.0"',
            file=sys.stderr,
        )
        return 2

    client = OpenAI(
        api_key=api_key,
        base_url=EARTH_API_BASE_URL,
        max_retries=0,
        timeout=30.0,
    )

    try:
        catalog = client.models.list()
        model_ids = sorted(model.id for model in catalog.data)
        if not model_ids:
            print("No models were returned for this account.", file=sys.stderr)
            return 1

        print("Models available to this account:")
        for model_id in model_ids:
            print(f"- {model_id}")

        if not args.generate:
            print("\nNo generation request was sent.")
            return 0

        if args.model not in model_ids:
            print(
                f"error: {args.model!r} was not returned by the current model catalog",
                file=sys.stderr,
            )
            return 2

        print(
            "\nSending one request. It may incur a charge; a local timeout does not "
            "guarantee cancellation."
        )

        request_id: str | None
        service_tier: str | None
        usage: dict[str, int | None] | None

        if args.api == "responses":
            request: dict[str, Any] = {
                "model": args.model,
                "input": "Reply with one short greeting.",
                "stream": False,
            }
            if args.fast:
                request["service_tier"] = "fast"

            response = client.with_options(timeout=120.0).responses.create(**request)
            content = response.output_text
            request_id = response._request_id
            service_tier = response.service_tier
            usage = (
                {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.total_tokens,
                }
                if response.usage is not None
                else None
            )
            interface_name = "Responses"
        else:
            request = {
                "model": args.model,
                "messages": [
                    {"role": "user", "content": "Reply with one short greeting."}
                ],
                "stream": False,
            }
            if args.fast:
                request["service_tier"] = "fast"

            completion = client.with_options(
                timeout=120.0
            ).chat.completions.create(**request)
            content = completion.choices[0].message.content
            request_id = completion._request_id
            service_tier = completion.service_tier
            usage = (
                {
                    "prompt_tokens": completion.usage.prompt_tokens,
                    "completion_tokens": completion.usage.completion_tokens,
                    "total_tokens": completion.usage.total_tokens,
                }
                if completion.usage is not None
                else None
            )
            interface_name = "Chat Completions"

        if not content:
            print(
                f"The {interface_name} response did not contain text content.",
                file=sys.stderr,
            )
            print_metadata(
                request_id=request_id,
                service_tier=service_tier,
                usage=usage,
            )
            return 1

        print(f"{interface_name} output:")
        print(content)
        print_metadata(
            request_id=request_id,
            service_tier=service_tier,
            usage=usage,
        )
        return 0
    except OpenAIError as error:
        if isinstance(error, APIStatusError):
            details = [f"HTTP {error.status_code}"]
            if error.request_id:
                details.append(f"request ID {error.request_id}")
            print(
                f"Earth API request failed: {error.__class__.__name__} "
                f"({', '.join(details)})",
                file=sys.stderr,
            )
        else:
            print(
                f"Earth API request failed: {error.__class__.__name__}",
                file=sys.stderr,
            )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
