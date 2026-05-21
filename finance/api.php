<?php
// Finance Tracker — JSON storage API
// GET  /api.php                    → current data
// POST /api.php (JSON)             → save data; requires X-Auth
// POST /api.php?action=subscribe   → save push subscription
// POST /api.php?action=unsubscribe → remove push subscription
// GET  /api.php?action=push        → send push to all subscriptions (admin only)

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

$DATA_FILE   = __DIR__ . '/finance-data.json';
$SEED_FILE   = __DIR__ . '/data-seed.json';
$BACKUP_DIR  = __DIR__ . '/.backups';
$SUBS_FILE   = __DIR__ . '/.backups/.push-subscriptions.json';
$MAX_BACKUPS = 50;

// VAPID credentials — generated once, never change
define('VAPID_PUBLIC',  'BBuMAdxjsZTzSuxJSSUCO0L72WzjbnMtOrvWMSErxfvXqb5wu9L_rfkBsY1-Hg3nmZXrLEoBKDFZ0NxH04LvS3M');
define('VAPID_PRIVATE', 'AZoNMlBFW-fmHminqVqxcXtLrTutmSnJzJugbCwI_4k');
define('VAPID_SUBJECT', 'mailto:pampozya@gmail.com');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

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

function ensureBackupDir(): void {
    global $BACKUP_DIR;
    if (!is_dir($BACKUP_DIR)) {
        mkdir($BACKUP_DIR, 0775, true);
    }
    $htaccess = $BACKUP_DIR . '/.htaccess';
    if (!file_exists($htaccess)) {
        file_put_contents($htaccess, "Require all denied\nDeny from all\n");
    }
}

function rotateBackups(): void {
    global $BACKUP_DIR, $MAX_BACKUPS;
    $files = glob($BACKUP_DIR . '/finance-data-*.json') ?: [];
    sort($files);
    while (count($files) > $MAX_BACKUPS) {
        $oldest = array_shift($files);
        if (is_string($oldest)) {
            @unlink($oldest);
        }
    }
}

function backupCurrentData(string $contents): void {
    global $BACKUP_DIR;
    if (trim($contents) === '') return;
    ensureBackupDir();
    $name = $BACKUP_DIR . '/finance-data-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.json';
    file_put_contents($name, $contents, LOCK_EX);
    rotateBackups();
}

function backupPathFromName(string $file): string {
    global $BACKUP_DIR;
    $base = basename($file);
    if ($base !== $file || !preg_match('/^finance-data-\d{8}-\d{6}-[a-f0-9]{6}\.json$/', $base)) {
        fail(400, 'invalid backup file');
    }
    $path = $BACKUP_DIR . '/' . $base;
    if (!is_file($path)) fail(404, 'backup not found');
    return $path;
}

function backupRevision(string $path): ?int {
    $contents = @file_get_contents($path);
    if (!is_string($contents) || $contents === '') return null;
    $decoded = json_decode($contents, true);
    if (!is_array($decoded)) return null;
    $revision = $decoded['_meta']['revision'] ?? null;
    return is_numeric($revision) ? (int)$revision : null;
}

function loadSubscriptions(): array {
    global $SUBS_FILE;
    if (!file_exists($SUBS_FILE)) return [];
    $raw = @file_get_contents($SUBS_FILE);
    if (!is_string($raw) || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function saveSubscriptions(array $subs): void {
    global $SUBS_FILE;
    ensureBackupDir(); // guarantees .backups/ exists with its own .htaccess
    file_put_contents($SUBS_FILE, json_encode(array_values($subs), JSON_PRETTY_PRINT), LOCK_EX);
    @chmod($SUBS_FILE, 0600);
}

function sendPushToAll(string $title, string $body, ?string $excludeEndpoint = null): array {
    $subs = loadSubscriptions();
    if (count($subs) === 0) return ['sent' => 0, 'staleRemoved' => 0];

    $autoload = __DIR__ . '/vendor/autoload.php';
    if (!file_exists($autoload)) return ['sent' => 0, 'error' => 'web-push not installed'];
    require_once $autoload;

    $webPush = new \Minishlink\WebPush\WebPush([
        'VAPID' => [
            'subject'    => VAPID_SUBJECT,
            'publicKey'  => VAPID_PUBLIC,
            'privateKey' => VAPID_PRIVATE,
        ]
    ]);

    $pushPayload = json_encode(['title' => $title, 'body' => $body, 'url' => '/finance/']);
    $stale = [];
    $sent  = 0;

    foreach ($subs as $sub) {
        if ($excludeEndpoint && $sub['endpoint'] === $excludeEndpoint) continue;
        $subscription = \Minishlink\WebPush\Subscription::create([
            'endpoint' => $sub['endpoint'],
            'keys'     => [
                'p256dh' => $sub['keys']['p256dh'],
                'auth'   => $sub['keys']['auth'],
            ]
        ]);
        $webPush->queueNotification($subscription, $pushPayload);
    }

    foreach ($webPush->flush() as $report) {
        if ($report->isSuccess()) {
            $sent++;
        } else {
            $code = $report->getResponse()?->getStatusCode();
            if ($code === 404 || $code === 410) {
                $stale[] = $report->getRequest()->getUri()->__toString();
            }
        }
    }

    if (!empty($stale)) {
        $subs = loadSubscriptions();
        $subs = array_filter($subs, fn($s) => !in_array($s['endpoint'], $stale, true));
        saveSubscriptions($subs);
    }

    return ['sent' => $sent, 'staleRemoved' => count($stale)];
}

function listBackups(): array {
    global $BACKUP_DIR;
    if (!is_dir($BACKUP_DIR)) return [];
    $files = glob($BACKUP_DIR . '/finance-data-*.json') ?: [];
    rsort($files);
    return array_map(function (string $path): array {
        return [
            'file' => basename($path),
            'size' => filesize($path) ?: 0,
            'createdAt' => date('c', filemtime($path) ?: time()),
            'revision' => backupRevision($path)
        ];
    }, array_slice($files, 0, 50));
}

if ($method === 'GET') {
    if ($action === 'vapid-public-key') {
        echo json_encode(['key' => VAPID_PUBLIC]);
        exit;
    }

    if ($action === 'backups') {
        echo json_encode(['backups' => listBackups()]);
        exit;
    }

    if ($action === 'backup') {
        $file = $_GET['file'] ?? '';
        if (!is_string($file) || $file === '') fail(400, 'missing backup file');
        $path = backupPathFromName($file);
        echo file_get_contents($path);
        exit;
    }

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

    if ($action === 'push') {
        $title = $decoded['title'] ?? 'Finance Alert';
        $body  = $decoded['body']  ?? '';
        $result = sendPushToAll($title, $body);
        echo json_encode(['ok' => true] + $result);
        exit;
    }

    if ($action === 'subscribe') {
        $endpoint  = $decoded['endpoint'] ?? '';
        $p256dh    = $decoded['keys']['p256dh'] ?? '';
        $auth      = $decoded['keys']['auth'] ?? '';
        if (!$endpoint || !$p256dh || !$auth) fail(400, 'invalid subscription');

        $subs = loadSubscriptions();
        // Replace existing sub with same endpoint, or append
        $found = false;
        foreach ($subs as &$s) {
            if ($s['endpoint'] === $endpoint) { $s = $decoded; $found = true; break; }
        }
        unset($s);
        if (!$found) $subs[] = $decoded;
        saveSubscriptions($subs);
        echo json_encode(['ok' => true, 'total' => count($subs)]);
        exit;
    }

    if ($action === 'unsubscribe') {
        $endpoint = $decoded['endpoint'] ?? '';
        if (!$endpoint) fail(400, 'missing endpoint');
        $subs = loadSubscriptions();
        $subs = array_filter($subs, fn($s) => $s['endpoint'] !== $endpoint);
        saveSubscriptions($subs);
        echo json_encode(['ok' => true]);
        exit;
    }

    if ($action === 'restore') {
        $file = $decoded['file'] ?? '';
        if (!is_string($file) || $file === '') fail(400, 'missing backup file');
        $restorePath = backupPathFromName($file);
        $restoreContents = file_get_contents($restorePath);
        if (!is_string($restoreContents) || $restoreContents === '') fail(500, 'cannot read backup');

        ensureDataFile();
        $fp = @fopen($DATA_FILE, 'c+b');
        if ($fp === false) fail(500, 'cannot open data file for restore');

        flock($fp, LOCK_EX);
        rewind($fp);
        $previous = stream_get_contents($fp);
        if ($previous !== false) {
            backupCurrentData($previous);
        }
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $restoreContents);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        echo json_encode(['ok' => true, 'restoredAt' => date('c'), 'file' => $file]);
        exit;
    }

    ensureDataFile();
    $fp = @fopen($DATA_FILE, 'c+b');
    if ($fp === false) fail(500, 'cannot open data file for write');

    flock($fp, LOCK_EX);
    rewind($fp);
    $previous = stream_get_contents($fp);
    if ($previous !== false) {
        backupCurrentData($previous);
    }
    ftruncate($fp, 0);
    rewind($fp);
    $pretty = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    fwrite($fp, $pretty);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    $revision = $decoded['_meta']['revision'] ?? null;

    // Push notification to OTHER devices that data was updated.
    // The saving device sends its subscription endpoint in X-Device-Id so it
    // doesn't notify itself. Failures here never block the save response.
    $excludeEndpoint = $_SERVER['HTTP_X_DEVICE_ID'] ?? null;
    try {
        sendPushToAll('Finance updated', 'Sync to see latest changes', $excludeEndpoint);
    } catch (\Throwable $e) { /* never block save on push failure */ }

    echo json_encode(['ok' => true, 'savedAt' => date('c'), 'revision' => $revision]);
    exit;
}

fail(405, 'method not allowed');
