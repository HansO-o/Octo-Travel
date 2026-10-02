<?php

declare(strict_types=1);

const EARTH_API_BASE_URL = 'https://api.earth.icu/v1';
const UPSTREAM_ONLY_KEYS = [
    'access_programs',
    'upstreamId',
    'upstreamRequestId',
    'upstream_model',
    'upstreamModel',
    'upstream_response_id',
];

final class EarthHttpException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly ?string $requestId,
    ) {
        parent::__construct("Earth API request failed with HTTP {$status}.");
    }
}

function usage(): void
{
    fwrite(STDOUT, <<<TEXT
Earth API PHP 8.2+ dependency-free example

By default, this script only lists the authenticated account's model IDs.

Usage:
  php earth-api-php.php
  php earth-api-php.php --generate --model=MODEL_ID [--api=chat|responses] [--fast]

Environment:
  EARTH_API_KEY   Required Earth API model-access key.

Options:
  --generate      Send one generation request (may incur charges).
  --model=ID      Model returned by the authenticated catalog.
  --api=NAME      Use chat or responses (default: chat).
  --fast          Request service_tier=fast; verify the actual returned tier.
  --help          Show this help.

Generation is opt-in, has no automatic retries, and uses the documented
https://api.earth.icu/v1 base URL. Review current pricing before use.
TEXT);
}

function responseHeader(array $headers, string $wantedName): ?string
{
    foreach ($headers as $header) {
        if (!is_string($header) || !str_contains($header, ':')) {
            continue;
        }
        [$name, $value] = explode(':', $header, 2);
        if (strcasecmp(trim($name), $wantedName) === 0) {
            return trim($value);
        }
    }
    return null;
}

/**
 * @return array{status: int, json: array<string, mixed>, request_id: ?string}
 */
function request(string $method, string $path, string $apiKey, ?array $payload = null): array
{
    $headers = [
        'Accept: application/json',
        'Authorization: Bearer ' . $apiKey,
        'User-Agent: earth-api-php/0.2',
    ];

    $options = [
        'method' => $method,
        'header' => implode("\r\n", $headers),
        'ignore_errors' => true,
        'follow_location' => 0,
        'max_redirects' => 0,
        'timeout' => $payload === null ? 30 : 120,
    ];

    if ($payload !== null) {
        $options['header'] .= "\r\nContent-Type: application/json";
        $options['content'] = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }

    $context = stream_context_create(['http' => $options]);
    $body = @file_get_contents(EARTH_API_BASE_URL . $path, false, $context);
    $responseHeaders = $http_response_header ?? [];
    $status = 0;

    if (isset($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $match) === 1) {
        $status = (int) $match[1];
    }
    $requestId = responseHeader($responseHeaders, 'x-request-id');

    if ($status < 200 || $status >= 300) {
        throw new EarthHttpException($status, $requestId);
    }
    if ($body === false) {
        throw new RuntimeException('Earth API returned no readable response body.');
    }

    $json = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($json)) {
        throw new RuntimeException('Earth API returned an unexpected JSON shape.');
    }

    return ['status' => $status, 'json' => $json, 'request_id' => $requestId];
}

/** @return list<string> */
function findUpstreamOnlyPaths(mixed $value, string $path = '$'): array
{
    if (!is_array($value)) {
        return [];
    }

    $matches = [];
    foreach ($value as $key => $item) {
        $childPath = is_int($key) ? "{$path}[{$key}]" : "{$path}.{$key}";
        if (is_string($key) && in_array($key, UPSTREAM_ONLY_KEYS, true)) {
            $matches[] = $childPath;
        }
        array_push($matches, ...findUpstreamOnlyPaths($item, $childPath));
    }
    return $matches;
}

function extractText(array $json, string $api): string
{
    if ($api === 'chat') {
        $content = $json['choices'][0]['message']['content'] ?? '';
        if (is_string($content)) {
            return $content;
        }
        if (!is_array($content)) {
            return '';
        }
        $parts = [];
        foreach ($content as $part) {
            if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                $parts[] = $part['text'];
            }
        }
        return implode('', $parts);
    }

    $parts = [];
    $output = $json['output'] ?? [];
    if (!is_array($output)) {
        return '';
    }
    foreach ($output as $item) {
        if (!is_array($item) || !isset($item['content']) || !is_array($item['content'])) {
            continue;
        }
        foreach ($item['content'] as $part) {
            if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                $parts[] = $part['text'];
            }
        }
    }
    return implode('', $parts);
}

function printTerminalUsage(array $json, string $api): void
{
    $usage = $json['usage'] ?? null;
    $names = $api === 'responses'
        ? ['input_tokens', 'output_tokens', 'total_tokens']
        : ['prompt_tokens', 'completion_tokens', 'total_tokens'];

    if (!is_array($usage)) {
        fwrite(STDERR, "Terminal Usage: not returned. Check the Earth API console; this example does not estimate tokens.\n");
        return;
    }

    $parts = [];
    foreach ($names as $name) {
        $value = $usage[$name] ?? null;
        if (!is_int($value) && !is_float($value)) {
            fwrite(STDERR, "Terminal Usage: incomplete. Check the Earth API console; this example does not estimate tokens.\n");
            return;
        }
        $parts[] = "{$name}={$value}";
    }
    fwrite(STDERR, 'Terminal Usage: ' . implode(', ', $parts) . "\n");
}

$options = getopt('', ['api:', 'fast', 'generate', 'help', 'model:']);
if (isset($options['help'])) {
    usage();
    exit(0);
}

$apiKey = getenv('EARTH_API_KEY');
if (!is_string($apiKey) || $apiKey === '') {
    fwrite(STDERR, "EARTH_API_KEY is required. Export it instead of putting it in source code.\n");
    exit(2);
}

$api = $options['api'] ?? 'chat';
if (!is_string($api) || !in_array($api, ['chat', 'responses'], true)) {
    fwrite(STDERR, "--api must be chat or responses.\n");
    exit(2);
}

try {
    $catalog = request('GET', '/models', $apiKey);
    $models = [];
    $data = $catalog['json']['data'] ?? [];
    if (is_array($data)) {
        foreach ($data as $item) {
            if (is_array($item) && isset($item['id']) && is_string($item['id'])) {
                $models[] = $item['id'];
            }
        }
    }

    if (!isset($options['generate'])) {
        fwrite(STDOUT, json_encode(['models' => $models], JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT) . "\n");
        fwrite(STDERR, "No generation request sent. Review pricing, then use --generate --model=MODEL_ID to opt in.\n");
        exit(0);
    }

    $model = $options['model'] ?? null;
    if (!is_string($model) || $model === '') {
        fwrite(STDERR, "--generate requires --model=MODEL_ID from the current model catalog.\n");
        exit(2);
    }
    if (!in_array($model, $models, true)) {
        fwrite(STDERR, "The selected model was not found in the current authenticated model catalog.\n");
        exit(2);
    }

    $payload = $api === 'responses'
        ? ['model' => $model, 'input' => 'Reply with one short greeting.', 'stream' => false]
        : [
            'model' => $model,
            'messages' => [['role' => 'user', 'content' => 'Reply with one short greeting.']],
            'stream' => false,
        ];
    if (isset($options['fast'])) {
        $payload['service_tier'] = 'fast';
    }

    $path = $api === 'responses' ? '/responses' : '/chat/completions';
    $result = request('POST', $path, $apiKey, $payload);
    $upstreamOnlyPaths = findUpstreamOnlyPaths($result['json']);
    if ($upstreamOnlyPaths !== []) {
        throw new RuntimeException(
            'Safety check failed: response contained upstream-only metadata at ' . implode(', ', $upstreamOnlyPaths) . '.',
        );
    }

    $text = extractText($result['json'], $api);
    if ($text === '') {
        throw new RuntimeException('Earth API returned no user-visible text content.');
    }
    fwrite(STDOUT, $text . "\n");
    fwrite(STDERR, 'Earth request ID: ' . ($result['request_id'] ?? 'not returned') . "\n");
    fwrite(STDERR, 'Actual service tier: ' . ($result['json']['service_tier'] ?? 'not returned') . "\n");
    printTerminalUsage($result['json'], $api);
    fwrite(STDERR, "A local timeout does not prove server-side cancellation; check Usage before retrying.\n");
} catch (EarthHttpException $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    fwrite(STDERR, 'Earth request ID: ' . ($error->requestId ?? 'not returned') . "\n");
    exit(1);
} catch (JsonException | RuntimeException $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
