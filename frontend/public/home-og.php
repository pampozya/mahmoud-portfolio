<?php
declare(strict_types=1);

// OG/share handler for the MAIN site link ("/" and "/index.html") ONLY.
// Reads the built SPA shell (index.html) and, if the admin has set a custom
// share image in Settings (settings.og_image), swaps the og:image /
// twitter:image URLs for it — then serves the full app inline. No redirect,
// so humans get the normal SPA and scrapers get the custom card.
// Per-video (share.php) and review-link (review-share.php) cards are untouched.
// Falls back to the static og-image.png baked into index.html when unset.

$apiUrl = 'https://mahmoud-portfolio-api.pampozya.workers.dev/api';
$indexPath = __DIR__ . '/index.html';

function http_json(string $url): ?array {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 7,
            CURLOPT_USERAGENT => 'LensmaniaHomeCard/1.0',
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
        'header' => "User-Agent: LensmaniaHomeCard/1.0\r\n"]]);
    $body = @file_get_contents($url, false, $context);
    if ($body === false) return null;
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}

header('Content-Type: text/html; charset=UTF-8');

$html = @file_get_contents($indexPath);
if ($html === false) {
    // Shouldn't happen — index.html sits next to this file. Bail safely.
    http_response_code(500);
    echo 'Site shell unavailable.';
    exit;
}

// Resolve the custom main-link image, if any.
$ogImage = '';
$settings = http_json($apiUrl . '/settings');
if (is_array($settings)) {
    $candidate = trim((string)($settings['og_image'] ?? ''));
    // Only accept absolute http(s) URLs (R2 public URL) to avoid breaking the card.
    if ($candidate !== '' && preg_match('#^https?://#i', $candidate)) {
        $ogImage = $candidate;
    }
}

if ($ogImage !== '') {
    $replacement = function (array $m) use ($ogImage): string {
        return $m[1] . htmlspecialchars($ogImage, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . $m[2];
    };
    // Swap the image URL inside og:image, og:image:secure_url and twitter:image only.
    $patterns = [
        '/(<meta\s+property=["\']og:image["\']\s+content=["\'])[^"\']*(["\'])/i',
        '/(<meta\s+property=["\']og:image:secure_url["\']\s+content=["\'])[^"\']*(["\'])/i',
        '/(<meta\s+name=["\']twitter:image["\']\s+content=["\'])[^"\']*(["\'])/i',
    ];
    foreach ($patterns as $pattern) {
        $out = preg_replace_callback($pattern, $replacement, $html);
        if ($out !== null) { $html = $out; }
    }
}

echo $html;
