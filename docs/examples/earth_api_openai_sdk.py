#!/usr/bin/env python3
"""Safe-start example for using the OpenAI Python SDK with Earth API."""

from __future__ import annotations

import argparse
import os
import sys

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
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.generate and not args.model:
        print("error: --model is required with --generate", file=sys.stderr)
        return 2

    api_key = os.environ.get("EARTH_API_KEY")
    if not api_key:
        print("error: set EARTH_API_KEY first", file=sys.stderr)
        return 2

    try:
        from openai import OpenAI, OpenAIError
    except ImportError:
        print(
            'error: install the SDK with: python -m pip install "openai>=3,<4"',
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
        if args.api == "responses":
            response = client.with_options(timeout=120.0).responses.create(
                model=args.model,
                input="Reply with one short greeting.",
                stream=False,
            )
            content = response.output_text
            interface_name = "Responses"
        else:
            completion = client.with_options(timeout=120.0).chat.completions.create(
                model=args.model,
                messages=[
                    {"role": "user", "content": "Reply with one short greeting."}
                ],
                stream=False,
            )
            content = completion.choices[0].message.content
            interface_name = "Chat Completions"

        if not content:
            print(
                f"The {interface_name} response did not contain text content.",
                file=sys.stderr,
            )
            return 1
        print(f"{interface_name} output:")
        print(content)
        return 0
    except OpenAIError as error:
        print(f"Earth API request failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
