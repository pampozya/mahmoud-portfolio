<?php
declare(strict_types=1);

// OG/share handler for the MAIN site link ("/" and "/index.html") ONLY.
// Reads the built SPA shell (index.html) and, if the admin has set a custom
// share image in Settings (settings.og_image), swaps the og:image /
// twitter:image URLs for it — then serves the full app inline. No redirect,
// so humans get the normal SPA and scrapers get the custom card.
// Per-video (share.php) and review-link (review-share.php) cards are untouched.
// Falls back to the static og-image.png baked into index.html when unset.

$indexPath = __DIR__ . '/index.html';
$contentPath = __DIR__ . '/content.json';

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
$settings = [];

if (file_exists($contentPath)) {
    $json = @file_get_contents($contentPath);
    if ($json !== false) {
        $data = json_decode($json, true);
        if (is_array($data) && isset($data['settings']) && is_array($data['settings'])) {
            $settings = $data['settings'];
        }
    }
}

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
