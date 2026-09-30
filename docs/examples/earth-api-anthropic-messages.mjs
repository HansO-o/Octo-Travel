#!/usr/bin/env node

const BASE_URL = "https://api.earth.icu/v1";
const ANTHROPIC_VERSION = "2023-06-01";

function usage() {
  console.log(`Usage:
  EARTH_API_KEY=... node earth-api-anthropic-messages.mjs
  EARTH_API_KEY=... node earth-api-anthropic-messages.mjs --generate --model MODEL_ID

Options:
  --generate           Send one Anthropic Messages request (may incur charges)
  --model ID           Model returned by the authenticated catalog
  --prompt TEXT        Prompt for the optional request
  --max-tokens NUMBER  Maximum output tokens (default: 256)
  --help               Show this help
`);
}

function parseArgs(argv) {
  const options = {
    generate: false,
    model: "",
    prompt: "Reply with one short greeting.",
    maxTokens: 256,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      usage();
      process.exit(0);
    } else if (argument === "--generate") {
      options.generate = true;
    } else if (argument === "--model" || argument === "--prompt" || argument === "--max-tokens") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${argument} requires a value.`);
      }
      index += 1;
      if (argument === "--model") options.model = value;
      if (argument === "--prompt") options.prompt = value;
      if (argument === "--max-tokens") options.maxTokens = Number(value);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!Number.isSafeInteger(options.maxTokens) || options.maxTokens < 1) {
    throw new Error("--max-tokens must be a positive integer.");
  }
  return options;
}

async function requestJson(url, init, timeoutMs) {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 2000)}`);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("Earth API returned non-JSON content.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Earth API returned an unexpected JSON shape.");
  }
  return body;
}

async function listModels(apiKey) {
  const catalog = await requestJson(
    `${BASE_URL}/models`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    30_000,
  );
  if (!Array.isArray(catalog.data)) {
    throw new Error("Model catalog response does not contain a data array.");
  }
  const models = catalog.data
    .filter((item) => item && typeof item.id === "string")
    .map((item) => item.id);
  console.log(JSON.stringify({ models }, null, 2));
  return models;
}

async function createMessage(apiKey, options) {
  return requestJson(
    `${BASE_URL}/messages`,
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens,
        messages: [{ role: "user", content: options.prompt }],
        stream: false,
      }),
    },
    120_000,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.EARTH_API_KEY;
  if (!apiKey) {
    throw new Error("Set EARTH_API_KEY in the environment.");
  }

  const models = await listModels(apiKey);
  if (!options.generate) {
    console.error(
      "No generation request sent. Review current pricing, then use --generate --model MODEL_ID to opt in.",
    );
    return;
  }
  if (!options.model) {
    throw new Error("--model is required with --generate.");
  }
  if (!models.includes(options.model)) {
    throw new Error("Selected model was not returned by the authenticated catalog.");
  }

  const result = await createMessage(apiKey, options);
  console.log(JSON.stringify(result, null, 2));
  console.error("A local timeout does not prove server-side cancellation.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
