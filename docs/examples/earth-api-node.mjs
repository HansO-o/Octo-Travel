#!/usr/bin/env node

const BASE_URL = "https://api.earth.icu/v1";
const runGeneration = process.env.EARTH_RUN_GENERATION === "1";
const apiKey = process.env.EARTH_API_KEY;
const selectedModel = process.env.EARTH_MODEL;

if (process.argv.includes("--help")) {
  console.log(`
Earth API Node.js 22 preview example

1. Enter the key without putting it in the command line:
   read -r -s -p "Earth API key: " EARTH_API_KEY
   export EARTH_API_KEY
   printf '\\n'

2. List models only:
   node docs/examples/earth-api-node.mjs

3. After reviewing current pricing, explicitly allow one generation request:
   export EARTH_MODEL="MODEL_ID_FROM_THE_LIST"
   export EARTH_RUN_GENERATION=1
   node docs/examples/earth-api-node.mjs

The script has no automatic retries. Generation may incur charges. Confirm the
migration, account access, enabled model, and current price before step 3.
`.trim());
  process.exit(0);
}

if (!apiKey) {
  console.error("EARTH_API_KEY is required. Run with --help for safe setup instructions.");
  process.exit(1);
}

async function requestJson(path, options = {}, timeoutMs = 30_000) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : text.slice(0, 800) || response.statusText;
    throw new Error(`Earth API HTTP ${response.status}: ${detail}`);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Earth API returned a non-JSON or empty response.");
  }

  return payload;
}

try {
  const catalog = await requestJson("/models");
  const modelIds = Array.isArray(catalog.data)
    ? catalog.data.map((item) => item?.id).filter((id) => typeof id === "string")
    : [];

  if (modelIds.length === 0) {
    throw new Error("The model catalog contained no usable model IDs.");
  }

  console.log("Models available to this account:");
  for (const id of modelIds) console.log(`- ${id}`);

  if (!runGeneration) {
    console.log(
      "\nModel listing completed. No generation request was sent. " +
        "Review current pricing, then use EARTH_RUN_GENERATION=1 explicitly."
    );
    process.exit(0);
  }

  if (!selectedModel) {
    throw new Error("EARTH_MODEL is required when EARTH_RUN_GENERATION=1.");
  }
  if (!modelIds.includes(selectedModel)) {
    throw new Error("EARTH_MODEL was not present in this account's current model list.");
  }

  const completion = await requestJson(
    "/chat/completions",
    {
      method: "POST",
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: "user",
            content: process.env.EARTH_PROMPT || "Reply with one short greeting.",
          },
        ],
        stream: false,
      }),
    },
    120_000
  );

  const output = completion?.choices?.[0]?.message?.content;
  if (typeof output !== "string" || !output.trim()) {
    throw new Error("The response did not contain choices[0].message.content.");
  }

  console.log("\nGeneration result:");
  console.log(output);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
