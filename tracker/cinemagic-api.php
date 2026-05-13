<?php
// Cinemagic tracker — JSON storage API
// GET  /cinemagic-api.php          → returns the current data array (JSON)
// POST /cinemagic-api.php (JSON)   → replaces stored data; requires X-Auth header
//
// Mirrors api.php in pattern, but uses a separate data file and token so the
// Cinemagic tracker is fully isolated from the all-pending tracker.
// Also keeps a rolling .bak snapshot of the previous contents before each write
// so a bad save is recoverable via one scp.

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Shared write token. Anyone with this can write — not real auth, just a
// barrier against random scanners. Change here AND in the HTML if rotating.
$TOKEN = 'r62sGUz0Y7sE3gd77wgPKe3w5BxNLkXh';

$DATA_FILE = __DIR__ . '/cinemagic-data.json';
$BAK_FILE  = __DIR__ . '/cinemagic-data.json.bak';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function fail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

if ($method === 'GET') {
    if (!file_exists($DATA_FILE)) {
        echo '[]';
        exit;
    }
    $fp = @fopen($DATA_FILE, 'rb');
    if ($fp === false) fail(500, 'cannot open data file');
    flock($fp, LOCK_SH);
    $contents = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    echo ($contents !== false && $contents !== '') ? $contents : '[]';
    exit;
}

if ($method === 'POST') {
    $sent = $_SERVER['HTTP_X_AUTH'] ?? '';
    if (!is_string($sent) || !hash_equals($TOKEN, $sent)) {
        fail(401, 'unauthorized');
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') fail(400, 'empty body');

    if (strlen($raw) > 1024 * 1024) fail(413, 'payload too large');

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) fail(400, 'invalid json');

    // Snapshot current contents before overwrite (best-effort, never fatal).
    if (file_exists($DATA_FILE)) {
        @copy($DATA_FILE, $BAK_FILE);
    }

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

    echo json_encode(['ok' => true, 'count' => count($decoded), 'savedAt' => date('c')]);
    exit;
}

fail(405, 'method not allowed');
