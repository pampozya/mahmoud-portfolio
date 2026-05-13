<?php
// Finance Tracker — JSON storage API
// GET  /api.php          → returns the current data (JSON)
// POST /api.php (JSON)   → replaces stored data; requires X-Auth header

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Auth');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Shared write token — change here AND in the HTML
$TOKEN = 'xZwQp8mKL9cVf2nRoJ4tYsH6bGuA5dE';

$DATA_FILE = __DIR__ . '/finance-data.json';
$SEED_FILE = __DIR__ . '/data-seed.json';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function fail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function ensureDataFile(): void {
    global $DATA_FILE, $SEED_FILE;
    if (!file_exists($DATA_FILE)) {
        if (file_exists($SEED_FILE)) {
            copy($SEED_FILE, $DATA_FILE);
        } else {
            file_put_contents($DATA_FILE, json_encode([
                'month' => date('Y-m'),
                'expenses' => [],
                'income' => [],
                'payouts' => []
            ]));
        }
        chmod($DATA_FILE, 0664);
    }
}

if ($method === 'GET') {
    ensureDataFile();
    if (!file_exists($DATA_FILE)) {
        echo json_encode(['month' => date('Y-m'), 'expenses' => [], 'income' => [], 'payouts' => []]);
        exit;
    }

    $fp = @fopen($DATA_FILE, 'rb');
    if ($fp === false) fail(500, 'cannot open data file');
    flock($fp, LOCK_SH);
    $contents = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    echo ($contents !== false && $contents !== '') ? $contents : json_encode(['month' => date('Y-m'), 'expenses' => [], 'income' => [], 'payouts' => []]);
    exit;
}

if ($method === 'POST') {
    $sent = $_SERVER['HTTP_X_AUTH'] ?? '';
    if (!is_string($sent) || !hash_equals($TOKEN, $sent)) {
        fail(401, 'unauthorized');
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') fail(400, 'empty body');

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) fail(400, 'invalid json');

    // Reject absurdly large payloads (5 MB)
    if (strlen($raw) > 5 * 1024 * 1024) fail(413, 'payload too large');

    ensureDataFile();
    $fp = @fopen($DATA_FILE, 'c+b');
    if ($fp === false) fail(500, 'cannot open data file for write');

    flock($fp, LOCK_EX);
    ftruncate($fp, 0);
    rewind($fp);
    $pretty = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    fwrite($fp, $pretty);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    echo json_encode(['ok' => true, 'savedAt' => date('c')]);
    exit;
}

fail(405, 'method not allowed');
