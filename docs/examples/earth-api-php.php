<?php

declare(strict_types=1);

const EARTH_API_BASE_URL = 'https://api.earth.icu/v1';

function usage(): void
{
    fwrite(STDOUT, <<<TEXT
Earth API PHP 8.2+ launch-preview example

By default, this script only lists the authenticated account's models.

Usage:
  php earth-api-php.php
  php earth-api-php.php --generate --model=MODEL_ID [--api=chat|responses]

Environment:
  EARTH_API_KEY   Required Earth API model-access key.

Generation is opt-in, may incur charges, has no automatic retries, and uses
the documented https://api.earth.icu/v1 base URL. Check current account pricing
and model access before use.
TEXT);
}

/**
 * @return array{status: int, body: string, json: mixed}
 */
function request(string $method, string $path, string $apiKey, ?array $payload = null): array
{
    $headers = [
        'Accept: application/json',
        'Authorization: Bearer ' . $apiKey,
        'User-Agent: earth-api-php-preview/0.1',
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

    if ($body === false) {
        throw new RuntimeException('Request failed before a readable HTTP response was returned.');
    }

    $json = json_decode($body, true);
    if (!is_int($status) || $status < 200 || $status >= 300) {
        fwrite(STDERR, "HTTP {$status}\n{$body}\n");
        exit(1);
    }

    return ['status' => $status, 'body' => $body, 'json' => $json];
}

$options = getopt('', ['api:', 'generate', 'help', 'model:']);
if (isset($options['help'])) {
    usage();
    exit(0);
}

$apiKey = getenv('EARTH_API_KEY');
if (!is_string($apiKey) || $apiKey === '') {
    fwrite(STDERR, "EARTH_API_KEY is required. Enter it interactively and export it instead of putting it in source code.\n");
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

    if (is_array($catalog['json']) && isset($catalog['json']['data']) && is_array($catalog['json']['data'])) {
        foreach ($catalog['json']['data'] as $item) {
            if (is_array($item) && isset($item['id']) && is_string($item['id'])) {
                $models[] = $item['id'];
            }
        }
    }

    if (!isset($options['generate'])) {
        fwrite(STDOUT, $catalog['body'] . "\n");
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
    $path = $api === 'responses' ? '/responses' : '/chat/completions';
    $result = request('POST', $path, $apiKey, $payload);
    fwrite(STDOUT, $result['body'] . "\n");
} catch (JsonException | RuntimeException $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}

