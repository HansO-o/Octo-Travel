#!/usr/bin/env node

const BASE_URL = "https://api.earth.icu/v1";
const runGeneration = process.env.EARTH_RUN_GENERATION === "1";
const requestFast = process.env.EARTH_FAST === "1";
const apiKey = process.env.EARTH_API_KEY;
const selectedModel = process.env.EARTH_MODEL;

class EarthHttpError extends Error {
  constructor(status, requestId) {
    super("Earth API returned a non-success HTTP response.");
    this.status = status;
    this.requestId = requestId;
  }
}

class SafeExampleError extends Error {}

if (process.argv.includes("--help")) {
  console.log(`
Earth API Node.js 22 dependency-free example

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

4. Optional: request Fast for that generation call:
   export EARTH_FAST=1

The script has no automatic retries. Generation may incur charges. Confirm
account access, the enabled model, and current pricing before step 3. A requested
Fast tier is not proof of the actual tier; inspect the terminal response metadata.
`.trim());
  process.exit(0);
}

if (!apiKey) {
  console.error(
    "EARTH_API_KEY is required. Run with --help for safe setup instructions.",
  );
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

  const requestId = response.headers.get("x-request-id");
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new EarthHttpError(response.status, requestId);
  }

  if (!payload || typeof payload !== "object") {
    throw new SafeExampleError(
      `Earth API returned a non-JSON or empty response${
        requestId ? ` (request ID ${requestId})` : ""
      }.`,
    );
  }

  return { payload, requestId };
}

function printMetadata({ requestId, serviceTier, usage }) {
  console.error("\nResponse metadata:");
  console.error(`- request_id: ${requestId ?? "not returned"}`);
  console.error(`- service_tier: ${serviceTier ?? "not returned"}`);

  if (!usage || typeof usage !== "object") {
    console.error(
      "- usage: not returned; check the Earth API console before reconciling cost",
    );
    return;
  }

  const fields = ["prompt_tokens", "completion_tokens", "total_tokens"];
  const summary = fields
    .filter((field) => Number.isFinite(usage[field]))
    .map((field) => `${field}=${usage[field]}`);

  console.error(
    summary.length > 0
      ? `- usage: ${summary.join(", ")}`
      : "- usage: returned without recognized token totals; check the Earth API console",
  );
}

try {
  const { payload: catalog } = await requestJson("/models");
  const modelIds = Array.isArray(catalog.data)
    ? catalog.data.map((item) => item?.id).filter((id) => typeof id === "string")
    : [];

  if (modelIds.length === 0) {
    throw new SafeExampleError(
      "The model catalog contained no usable model IDs.",
    );
  }

  console.log("Models available to this account:");
  for (const id of modelIds) console.log(`- ${id}`);

  if (!runGeneration) {
    console.log(
      "\nModel listing completed. No generation request was sent. " +
        "Review current pricing, then use EARTH_RUN_GENERATION=1 explicitly.",
    );
    process.exit(0);
  }

  if (!selectedModel) {
    throw new SafeExampleError(
      "EARTH_MODEL is required when EARTH_RUN_GENERATION=1.",
    );
  }
  if (!modelIds.includes(selectedModel)) {
    throw new SafeExampleError(
      "EARTH_MODEL was not present in this account's current model list.",
    );
  }

  const { payload: completion, requestId } = await requestJson(
    "/chat/completions",
    {
      method: "POST",
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: "user",
            content:
              process.env.EARTH_PROMPT || "Reply with one short greeting.",
          },
        ],
        stream: false,
        ...(requestFast ? { service_tier: "fast" } : {}),
      }),
    },
    120_000,
  );

  const output = completion?.choices?.[0]?.message?.content;
  if (typeof output !== "string" || !output.trim()) {
    printMetadata({
      requestId,
      serviceTier: completion?.service_tier,
      usage: completion?.usage,
    });
    throw new SafeExampleError(
      "The response did not contain choices[0].message.content.",
    );
  }

  console.log("\nGeneration result:");
  console.log(output);
  printMetadata({
    requestId,
    serviceTier: completion.service_tier,
    usage: completion.usage,
  });
} catch (error) {
  if (error instanceof EarthHttpError) {
    const details = [`HTTP ${error.status}`];
    if (error.requestId) details.push(`request ID ${error.requestId}`);
    console.error(`Earth API request failed (${details.join(", ")}).`);
  } else if (error instanceof SafeExampleError) {
    console.error(`Earth API example stopped: ${error.message}`);
  } else {
    const name = error instanceof Error ? error.constructor.name : "UnknownError";
    console.error(`Earth API request failed: ${name}`);
  }
  console.error(
    "Local timeouts do not prove cancellation. Check Usage before retrying.",
  );
  process.exit(1);
}
