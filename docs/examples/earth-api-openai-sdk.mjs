#!/usr/bin/env node

import process from 'node:process';

const BASE_URL = 'https://api.earth.icu/v1';

function printUsage() {
  console.log(`Usage:
  EARTH_API_KEY=... node earth-api-openai-sdk.mjs
  EARTH_API_KEY=... node earth-api-openai-sdk.mjs --generate --model MODEL_ID
  EARTH_API_KEY=... node earth-api-openai-sdk.mjs --generate --api responses --model MODEL_ID

Options:
  --generate        Send one generation request. Without this flag, the script
                    only lists models and does not generate text.
  --api INTERFACE   Generation interface: chat or responses (default: chat).
  --model MODEL_ID  Model ID returned by the model-list request.
  --help            Show this help.

Install:
  npm install openai

Runtime:
  Node.js 22 or newer
`);
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return args[index + 1];
}

const args = process.argv.slice(2);

if (args.includes('--help')) {
  printUsage();
  process.exit(0);
}

const allowedArgs = new Set(['--generate', '--api', '--model']);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!allowedArgs.has(arg)) {
    throw new Error(`Unknown option: ${arg}`);
  }
  if (arg === '--api' || arg === '--model') index += 1;
}

const generate = args.includes('--generate');
const api = valueAfter(args, '--api') ?? 'chat';
const requestedModel = valueAfter(args, '--model');

if (!['chat', 'responses'].includes(api)) {
  throw new Error('--api must be either chat or responses.');
}
if (args.includes('--api') && !generate) {
  throw new Error('--api is only used together with --generate.');
}
if (requestedModel && !generate) {
  throw new Error('--model is only used together with --generate.');
}
if (generate && !requestedModel) {
  throw new Error('--generate requires --model MODEL_ID.');
}
if (!process.env.EARTH_API_KEY) {
  throw new Error('Set EARTH_API_KEY before running this script.');
}

let OpenAI;
try {
  ({ default: OpenAI } = await import('openai'));
} catch {
  throw new Error('Install the official SDK first: npm install openai');
}

const client = new OpenAI({
  apiKey: process.env.EARTH_API_KEY,
  baseURL: BASE_URL,
  maxRetries: 0,
  timeout: 30_000,
});

try {
  const catalog = await client.models.list();
  const modelIds = catalog.data.map((model) => model.id).sort();

  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Available models (${modelIds.length}):`);
  console.log(modelIds.length > 0 ? modelIds.join('\n') : '(none returned)');

  if (!generate) {
    console.log('\nNo generation request was sent. Add --generate --model MODEL_ID to test one.');
    process.exit(0);
  }

  if (!modelIds.includes(requestedModel)) {
    throw new Error(
      `Model "${requestedModel}" was not returned by GET /models. Choose an ID from the list above.`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    if (api === 'responses') {
      const response = await client.responses.create(
        {
          model: requestedModel,
          input: 'Reply with one short greeting.',
          stream: false,
        },
        { signal: controller.signal },
      );
      console.log('\nResponses API output:');
      console.log(response.output_text || '(empty response)');
    } else {
      const completion = await client.chat.completions.create(
        {
          model: requestedModel,
          messages: [{ role: 'user', content: 'Reply with one short greeting.' }],
          stream: false,
        },
        { signal: controller.signal },
      );
      const text = completion.choices?.[0]?.message?.content;
      console.log('\nChat Completions output:');
      console.log(text || '(empty response)');
    }
  } finally {
    clearTimeout(timer);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Earth API request failed: ${message}`);
  process.exitCode = 1;
}
