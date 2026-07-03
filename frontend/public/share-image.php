<?php
declare(strict_types=1);

$siteUrl = 'https://portfolio.lensmania.ae';
$apiUrl = 'https://mahmoud-portfolio-api.pampozya.workers.dev/api';
$fallbackImage = __DIR__ . '/og-image.png';

function http_body(string $url): ?string {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_USERAGENT => 'LensmaniaShareImage/1.0',
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return ($body !== false && $status >= 200 && $status < 300) ? $body : null;
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'ignore_errors' => true,
            'header' => "User-Agent: LensmaniaShareImage/1.0\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    return $body === false ? null : $body;
}

function http_json(string $url): ?array {
    $body = http_body($url);
    if ($body === null) return null;
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
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

function image_from_bytes(?string $bytes) {
    if (!$bytes || !function_exists('imagecreatefromstring')) return false;
    return @imagecreatefromstring($bytes);
}

function emit_fallback(string $fallbackImage): void {
    if (is_file($fallbackImage)) {
        header('Content-Type: image/png');
        header('Cache-Control: public, max-age=3600');
        readfile($fallbackImage);
        return;
    }
    http_response_code(404);
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

function target_dimensions(?array $item, int $srcW, int $srcH): array {
    $ratio = parse_ratio((string)($item['aspect_ratio'] ?? ''));
    $aspect = $ratio ? ($ratio[0] / $ratio[1]) : ($srcW / max(1, $srcH));

    if ($aspect < 0.8) return [1080, 1920];   // 9:16 / portrait reels
    if ($aspect > 1.95) return [1200, 514];   // 21:9
    if ($aspect > 1.2) return [1200, 675];    // 16:9 / landscape reels
    return [1200, 1200];                      // square or near-square
}

// Resolve the item by published id (?item=) OR by review token (?review=); the
// review path lets client-review share cards work even for unpublished items.
$reviewToken = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($_GET['review'] ?? ''));
$item = null;
if ($reviewToken !== '') {
    $data = http_json($apiUrl . '/review/' . rawurlencode($reviewToken));
    if (is_array($data) && isset($data['portfolio']) && is_array($data['portfolio'])) {
        $item = $data['portfolio'];
    }
} else {
    $rawId = $_GET['item'] ?? $_GET['id'] ?? '';
    $itemId = filter_var($rawId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($itemId) {
        $items = http_json($apiUrl . '/portfolio');
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
if (!$item) {
    emit_fallback($fallbackImage);
    exit;
}

$sourceUrl = $item
    ? (absolute_url((string)($item['thumbnail_url'] ?? ''), $siteUrl) ?: youtube_thumbnail((string)($item['video_url'] ?? '')))
    : null;
$source = $sourceUrl ? image_from_bytes(http_body($sourceUrl)) : false;
if (!$source) {
    emit_fallback($fallbackImage);
    exit;
}

$srcW = imagesx($source);
$srcH = imagesy($source);
[$targetW, $targetH] = target_dimensions($item, $srcW, $srcH);
$canvas = imagecreatetruecolor($targetW, $targetH);

// Blurred cover background from the exact selected thumbnail.
$coverScale = max($targetW / $srcW, $targetH / $srcH);
$coverW = (int) ceil($srcW * $coverScale);
$coverH = (int) ceil($srcH * $coverScale);
$coverX = (int) (($targetW - $coverW) / 2);
$coverY = (int) (($targetH - $coverH) / 2);
imagecopyresampled($canvas, $source, $coverX, $coverY, 0, 0, $coverW, $coverH, $srcW, $srcH);
if (function_exists('imagefilter')) {
    for ($i = 0; $i < 12; $i++) imagefilter($canvas, IMG_FILTER_GAUSSIAN_BLUR);
    imagefilter($canvas, IMG_FILTER_BRIGHTNESS, -28);
}

// Full selected thumbnail on top, preserving the exact frame.
$fitScale = min($targetW / $srcW, $targetH / $srcH);
$fitW = (int) floor($srcW * $fitScale);
$fitH = (int) floor($srcH * $fitScale);
$fitX = (int) (($targetW - $fitW) / 2);
$fitY = (int) (($targetH - $fitH) / 2);
imagecopyresampled($canvas, $source, $fitX, $fitY, 0, 0, $fitW, $fitH, $srcW, $srcH);

// --- name branding overlay ("MAHMOUD ADEL") ---
$fontFile = __DIR__ . '/assets/brand-font.ttf';
if (function_exists('imagettftext') && is_file($fontFile)) {
    // Bottom gradient scrim so the name stays legible over any frame.
    $scrimH = max(60, (int)($targetH * 0.24));
    for ($y = 0; $y < $scrimH; $y++) {
        $a = 127 - (int)(95 * ($y / $scrimH)); // fade to darker at the very bottom
        $col = imagecolorallocatealpha($canvas, 0, 0, 0, $a);
        imagefilledrectangle($canvas, 0, $targetH - $scrimH + $y, $targetW, $targetH - $scrimH + $y + 1, $col);
    }
    $name = 'MAHMOUD ADEL';
    $fontSize = max(20, (int)round($targetW * 0.040));
    $pad = (int)round($targetW * 0.035);
    $baseline = $targetH - $pad;
    $shadow = imagecolorallocatealpha($canvas, 0, 0, 0, 55);
    $gold = imagecolorallocate($canvas, 200, 168, 106); // #c8a86a brand gold
    imagettftext($canvas, $fontSize, 0, $pad + 2, $baseline + 2, $shadow, $fontFile, $name);
    imagettftext($canvas, $fontSize, 0, $pad, $baseline, $gold, $fontFile, $name);
}

header('Content-Type: image/jpeg');
header('Cache-Control: public, max-age=3600');
imagejpeg($canvas, null, 90);
imagedestroy($source);
imagedestroy($canvas);
