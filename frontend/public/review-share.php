<?php
declare(strict_types=1);

// OG/share handler for CLIENT REVIEW links: /portfolio?review=<token>
// Social scrapers get the reviewed video's thumbnail card; humans are bounced
// to the SPA review page (?...&og=1 so the rewrite doesn't loop back here).

$siteUrl = 'https://portfolio.lensmania.ae';
$apiUrl = 'https://mahmoud-portfolio-api.pampozya.workers.dev/api';
$fallbackImage = $siteUrl . '/og-image.png?v=20260524-logo';
$fallbackTitle = 'Mahmoud Adel - Videographer';
$fallbackDescription = 'Private review link - watch and leave timestamped notes.';

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

function http_json(string $url): ?array {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 7,
            CURLOPT_USERAGENT => 'LensmaniaReviewCard/1.0',
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
    $context = stream_context_create(['http' => ['timeout' => 7, 'ignore_errors' => true,
        'header' => "User-Agent: LensmaniaReviewCard/1.0\r\n"]]);
    $body = @file_get_contents($url, false, $context);
    if ($body === false) return null;
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}

function parse_ratio(?string $ratio): ?array {
    if ($ratio && preg_match('/([0-9.]+)\s*[:x\/]\s*([0-9.]+)/i', $ratio, $m)) {
        $w = (float)$m[1]; $h = (float)$m[2];
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

// Token: from ?review= (rewrite passes the query through) or trailing path segment.
$token = (string)($_GET['review'] ?? '');
if ($token === '' && preg_match('#/review-share\.php/([A-Za-z0-9_-]+)#', $_SERVER['REQUEST_URI'] ?? '', $m)) {
    $token = $m[1];
}
$token = preg_replace('/[^A-Za-z0-9_-]/', '', $token);

$title = $fallbackTitle;
$description = $fallbackDescription;
$image = $fallbackImage;
$imageType = 'image/png';
$imageWidth = 1200;
$imageHeight = 630;
$humanUrl = $siteUrl . '/portfolio';

if ($token !== '') {
    $data = http_json($apiUrl . '/review/' . rawurlencode($token));
    $item = is_array($data) ? ($data['portfolio'] ?? null) : null;
    if (is_array($item) && !empty($item['id'])) {
        $title = clean_text((string)($item['title'] ?? ''), 90) ?: $fallbackTitle;
        $description = clean_text((string)($item['seo_description'] ?? '') ?: (string)($item['description'] ?? '')) ?: $fallbackDescription;
        // Reuse the existing image generator; pass the review token so it works
        // even for unpublished items (not in the public /portfolio list).
        $ver = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($item['updated_at'] ?? $item['id']));
        $image = $siteUrl . '/share-image.php?review=' . rawurlencode($token) . ($ver ? '&v=' . $ver : '');
        $imageType = 'image/jpeg';
        [$imageWidth, $imageHeight] = share_image_dimensions($item);
    }
    $humanUrl = $siteUrl . '/portfolio?review=' . rawurlencode($token) . '&og=1';
}
?>
<!doctype html>
<html lang="en" dir="auto">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title><?= esc($title) ?></title>
    <meta name="description" content="<?= esc($description) ?>">

    <meta property="og:type" content="video.other">
    <meta property="og:url" content="<?= esc($siteUrl . '/portfolio?review=' . rawurlencode($token)) ?>">
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
      body { margin:0; min-height:100vh; display:grid; place-items:center;
        background:#080808; color:#eae6dc; font-family:Inter, Arial, sans-serif; }
      a { color:#c8a86a; }
    </style>
  </head>
  <body>
    <main>
      <p>Opening review…</p>
      <p><a href="<?= esc($humanUrl) ?>">Open <?= esc($title) ?></a></p>
    </main>
  </body>
</html>
