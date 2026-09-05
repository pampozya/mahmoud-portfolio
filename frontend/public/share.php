<?php
declare(strict_types=1);

$siteUrl = 'https://portfolio.lensmania.ae';
$apiUrl = 'https://mahmoud-portfolio-api.pampozya.workers.dev/api';
$fallbackImage = $siteUrl . '/og-image.png?v=20260524-logo';
$fallbackTitle = 'Mahmoud Adel - Videographer';
$fallbackDescription = 'Professional Videographer based in Dubai, UAE.';
$shareCardVersion = 'fit-v2';

function esc(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function clean_text(string $value, int $limit = 220): string {
    $value = trim(preg_replace('/\s+/', ' ', strip_tags($value)));
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        return mb_strlen($value) > $limit ? rtrim(mb_substr($value, 0, $limit - 1)) . '…' : $value;
    }
    return strlen($value) > $limit ? rtrim(substr($value, 0, $limit - 1)) . '...' : $value;
}

function absolute_url(?string $url, string $siteUrl): ?string {
    if (!$url) return null;
    if (preg_match('/^https?:\/\//i', $url)) return $url;
    if (substr($url, 0, 1) === '/') return $siteUrl . $url;
    return $url;
}

function youtube_thumbnail(?string $url): ?string {
    if (!$url) return null;
    if (preg_match('/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/', $url, $m)) {
        return 'https://img.youtube.com/vi/' . $m[1] . '/hqdefault.jpg';
    }
    return null;
}

function http_json(string $url): ?array {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 7,
            CURLOPT_USERAGENT => 'LensmaniaShareCard/1.0',
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($body !== false && $status >= 200 && $status < 300) {
            $data = json_decode($body, true);
            return is_array($data) ? $data : null;
        }
        return null;
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => 7,
            'ignore_errors' => true,
            'header' => "User-Agent: LensmaniaShareCard/1.0\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    if ($body === false) return null;
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}

function parse_ratio(?string $ratio): ?array {
    if (!$ratio) return null;
    if (preg_match('/([0-9.]+)\s*[:x\/]\s*([0-9.]+)/i', $ratio, $m)) {
        $w = (float)$m[1];
        $h = (float)$m[2];
        if ($w > 0 && $h > 0) return [$w, $h];
    }
    return null;
}

function share_image_dimensions(?array $item): array {
    $ratio = parse_ratio((string)($item['aspect_ratio'] ?? ''));
    if (!$ratio) return [1200, 675];
    $aspect = $ratio[0] / $ratio[1];
    if ($aspect < 0.8) return [1080, 1920];
    if ($aspect > 1.95) return [1200, 514];
    if ($aspect > 1.2) return [1200, 675];
    return [1200, 1200];
}

$rawId = $_GET['item'] ?? $_GET['id'] ?? '';
$itemId = filter_var($rawId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$item = null;
$contentPath = __DIR__ . '/content.json';

if ($itemId && file_exists($contentPath)) {
    $json = @file_get_contents($contentPath);
    if ($json !== false) {
        $data = json_decode($json, true);
        $items = $data['projects'] ?? [];
        if (is_array($items)) {
            foreach ($items as $candidate) {
                if ((int)($candidate['id'] ?? 0) === (int)$itemId) {
                    $item = $candidate;
                    break;
                }
            }
        }
    }
}

$title = $fallbackTitle;
$description = $fallbackDescription;
$image = $fallbackImage;
$imageType = 'image/png';
$imageWidth = 1200;
$imageHeight = 630;
$humanUrl = $siteUrl . '/';
$shareUrl = $siteUrl . '/';

if ($item) {
    $title = clean_text((string)($item['title'] ?? ''), 90) ?: $fallbackTitle;
    $description = clean_text((string)($item['seo_description'] ?? '') ?: (string)($item['description'] ?? ''));
    if ($description === '' || preg_match('/^cinematic social media reel\.?$/i', $description)) {
        $description = 'Selected portfolio reel by Mahmoud Adel.';
    }
    $version = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($_GET['v'] ?? ($item['updated_at'] ?? '')));
    $imageVersion = $version;
    if ($imageVersion === '' || substr($imageVersion, -strlen($shareCardVersion)) !== $shareCardVersion) {
        $imageVersion = trim($imageVersion . '-' . $shareCardVersion, '-');
    }
    $image = $siteUrl . '/share-image/' . (int)$item['id'] . '.jpg' . ($imageVersion ? '?v=' . $imageVersion : '');
    $imageType = 'image/jpeg';
    [$imageWidth, $imageHeight] = share_image_dimensions($item);
    $humanUrl = $siteUrl . '/?item=' . (int)$item['id'];
    $shareUrl = $siteUrl . '/share/' . (int)$item['id'] . ($version ? '?v=' . $version : '');
}
?>
<!doctype html>
<html lang="en" dir="auto">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, follow">
    <title><?= esc($title) ?></title>
    <meta name="description" content="<?= esc($description) ?>">

    <meta property="og:type" content="video.other">
    <meta property="og:url" content="<?= esc($shareUrl) ?>">
    <meta property="og:title" content="<?= esc($title) ?>">
    <meta property="og:description" content="<?= esc($description) ?>">
    <meta property="og:image" content="<?= esc($image) ?>">
    <meta property="og:image:secure_url" content="<?= esc($image) ?>">
    <meta property="og:image:type" content="<?= esc($imageType) ?>">
    <meta property="og:image:width" content="<?= esc((string)$imageWidth) ?>">
    <meta property="og:image:height" content="<?= esc((string)$imageHeight) ?>">
    <meta property="og:image:alt" content="<?= esc($title) ?>">
    <meta property="og:site_name" content="Mahmoud Adel Portfolio">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?= esc($title) ?>">
    <meta name="twitter:description" content="<?= esc($description) ?>">
    <meta name="twitter:image" content="<?= esc($image) ?>">

    <script>
      window.location.replace(<?= json_encode($humanUrl, JSON_UNESCAPED_SLASHES) ?>);
    </script>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #080808;
        color: #eae6dc;
        font-family: Inter, Arial, sans-serif;
      }
      a { color: #c8a86a; }
    </style>
  </head>
  <body>
    <main>
      <p>Opening portfolio reel...</p>
      <p><a href="<?= esc($humanUrl) ?>">Open <?= esc($title) ?></a></p>
    </main>
  </body>
</html>
