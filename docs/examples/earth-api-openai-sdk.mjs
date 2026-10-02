#!/usr/bin/env node

import process from 'node:process';

const BASE_URL = 'https://api.earth.icu/v1';

class SafeExampleError extends Error {}

function printUsage() {
  console.log(`Usage:
  EARTH_API_KEY=... node earth-api-openai-sdk.mjs
  EARTH_API_KEY=... node earth-api-openai-sdk.mjs --generate --model MODEL_ID
  EARTH_API_KEY=... node earth-api-openai-sdk.mjs --generate --api responses --model MODEL_ID
  EARTH_API_KEY=... node earth-api-openai-sdk.mjs --generate --model MODEL_ID --fast

Options:
  --generate        Send one generation request. Without this flag, the script
                    only lists models and does not generate text.
  --api INTERFACE   Generation interface: chat or responses (default: chat).
  --model MODEL_ID  Model ID returned by the model-list request.
  --stream          Print text as it arrives (requires --generate).
  --fast            Request service_tier="fast" (requires --generate).
  --help            Show this help.

Install:
  npm install openai@7.27.0

Runtime:
  Node.js 22 or newer
`);
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) {
    throw new SafeExampleError(`${flag} requires a value.`);
  }
  return args[index + 1];
}

function printMetadata({ requestId, serviceTier, usage, api }) {
  console.error('\nResponse metadata:');
  console.error(`- request_id: ${requestId ?? 'not returned'}`);
  console.error(`- service_tier: ${serviceTier ?? 'not returned'}`);

  if (!usage) {
    console.error(
      '- usage: not returned; check the Earth API console before reconciling cost',
    );
    return;
  }

  const fields =
    api === 'responses'
      ? ['input_tokens', 'output_tokens', 'total_tokens']
      : ['prompt_tokens', 'completion_tokens', 'total_tokens'];
  const summary = fields
    .filter((field) => usage[field] != null)
    .map((field) => `${field}=${usage[field]}`);

  console.error(
    summary.length > 0
      ? `- usage: ${summary.join(', ')}`
      : '- usage: returned without recognized token totals; check the Earth API console',
  );
}

const args = process.argv.slice(2);

if (args.includes('--help')) {
  printUsage();
  process.exit(0);
}

const allowedArgs = new Set([
  '--generate',
  '--api',
  '--model',
  '--stream',
  '--fast',
]);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!allowedArgs.has(arg)) {
    throw new SafeExampleError(`Unknown option: ${arg}`);
  }
  if (arg === '--api' || arg === '--model') index += 1;
}

const generate = args.includes('--generate');
const streaming = args.includes('--stream');
const fast = args.includes('--fast');
const api = valueAfter(args, '--api') ?? 'chat';
const requestedModel = valueAfter(args, '--model');

if (!['chat', 'responses'].includes(api)) {
  throw new SafeExampleError('--api must be either chat or responses.');
}
if (args.includes('--api') && !generate) {
  throw new SafeExampleError('--api is only used together with --generate.');
}
if (streaming && !generate) {
  throw new SafeExampleError('--stream is only used together with --generate.');
}
if (fast && !generate) {
  throw new SafeExampleError('--fast is only used together with --generate.');
}
if (requestedModel && !generate) {
  throw new SafeExampleError('--model is only used together with --generate.');
}
if (generate && !requestedModel) {
  throw new SafeExampleError('--generate requires --model MODEL_ID.');
}
if (!process.env.EARTH_API_KEY) {
  throw new SafeExampleError('Set EARTH_API_KEY before running this script.');
}

let OpenAI;
try {
  ({ default: OpenAI } = await import('openai'));
} catch {
  throw new SafeExampleError(
    'Install the official SDK first: npm install openai@7.27.0',
  );
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
    console.log(
      '\nNo generation request was sent. Add --generate --model MODEL_ID to test one.',
    );
    process.exit(0);
  }

  if (!modelIds.includes(requestedModel)) {
    throw new SafeExampleError(
      `Model "${requestedModel}" was not returned by GET /models. Choose an ID from the list above.`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    if (api === 'responses') {
      const body = {
        model: requestedModel,
        input: 'Reply with one short greeting.',
        stream: streaming,
        ...(fast ? { service_tier: 'fast' } : {}),
      };
      const { data: response, request_id: requestId } =
        await client.responses
          .create(body, { signal: controller.signal })
          .withResponse();

      console.log('\nResponses API output:');
      if (streaming) {
        let terminalResponse;
        for await (const event of response) {
          if (event.type === 'response.output_text.delta') {
            process.stdout.write(event.delta);
          } else if (event.type === 'response.refusal.delta') {
            process.stdout.write(event.delta);
          } else if (
            ['error', 'response.failed', 'response.incomplete'].includes(event.type)
          ) {
            throw new SafeExampleError(
              `Responses stream ended with ${event.type}; check Usage before retrying.`,
            );
          } else if (event.type === 'response.completed') {
            terminalResponse = event.response;
          }
        }
        console.log();
        if (!terminalResponse || terminalResponse.status !== 'completed') {
          throw new SafeExampleError(
            'Responses stream ended without a completed terminal response; output may be partial.',
          );
        }
        printMetadata({
          requestId,
          serviceTier: terminalResponse.service_tier,
          usage: terminalResponse.usage,
          api,
        });
      } else {
        console.log(response.output_text || '(empty response)');
        printMetadata({
          requestId,
          serviceTier: response.service_tier,
          usage: response.usage,
          api,
        });
      }
    } else {
      const body = {
        model: requestedModel,
        messages: [{ role: 'user', content: 'Reply with one short greeting.' }],
        stream: streaming,
        ...(streaming ? { stream_options: { include_usage: true } } : {}),
        ...(fast ? { service_tier: 'fast' } : {}),
      };
      const { data: completion, request_id: requestId } =
        await client.chat.completions
          .create(body, { signal: controller.signal })
          .withResponse();

      console.log('\nChat Completions output:');
      if (streaming) {
        let finishReason;
        let terminalUsage;
        let actualServiceTier;
        for await (const chunk of completion) {
          if (chunk.error) {
            throw new SafeExampleError(
              'Chat stream returned an error; check Usage before retrying.',
            );
          }
          const choice = chunk.choices?.find((item) => item.index === 0);
          process.stdout.write(
            choice?.delta?.content ?? choice?.delta?.refusal ?? '',
          );
          if (choice?.finish_reason != null) finishReason = choice.finish_reason;
          if (chunk.usage != null) terminalUsage = chunk.usage;
          if (chunk.service_tier != null) actualServiceTier = chunk.service_tier;
        }
        console.log();
        if (finishReason == null) {
          throw new SafeExampleError(
            'Chat stream ended without a finish reason; output may be partial.',
          );
        }
        console.log(`Finish reason: ${finishReason}`);
        if (finishReason !== 'stop') {
          console.warn(
            'The stream ended without a normal text stop; inspect the result before using it.',
          );
        }
        printMetadata({
          requestId,
          serviceTier: actualServiceTier,
          usage: terminalUsage,
          api,
        });
      } else {
        const text = completion.choices?.[0]?.message?.content;
        console.log(text || '(empty response)');
        printMetadata({
          requestId,
          serviceTier: completion.service_tier,
          usage: completion.usage,
          api,
        });
      }
    }
  } finally {
    clearTimeout(timer);
  }
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    const details = [];
    if (error.status != null) details.push(`HTTP ${error.status}`);
    if (error.requestID) details.push(`request ID ${error.requestID}`);
    console.error(
      `Earth API request failed: ${error.constructor.name}${
        details.length > 0 ? ` (${details.join(', ')})` : ''
      }`,
    );
  } else if (error instanceof SafeExampleError) {
    console.error(`Earth API example stopped: ${error.message}`);
  } else {
    const name = error instanceof Error ? error.constructor.name : 'UnknownError';
    console.error(`Earth API request failed: ${name}`);
  }
  console.error(
    'Local timeouts or interrupted streams do not prove cancellation. Check Usage before retrying.',
  );
  process.exitCode = 1;
}
