<?php
declare(strict_types=1);

// /sitemap.xml: home, service pages (with language alternates), FAQ, work index
// and one entry per film, built from the live portfolio.

require __DIR__ . '/lib.php';

$data = seo_data();
$en = seo_content('en');
$hasAr = seo_content('ar') !== null;
$latest = '';
foreach ($data['items'] as $item) {
    $stamp = substr((string) ($item['updated_at'] ?? $item['created_at'] ?? ''), 0, 10);
    if ($stamp > $latest) $latest = $stamp;
}
if ($latest === '') $latest = gmdate('Y-m-d');

function x(string $value): string {
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function sitemap_url(string $path, string $lastmod, array $alternates = [], string $extra = ''): string {
    $out = '<url><loc>' . x(SEO_SITE . $path) . '</loc><lastmod>' . x($lastmod) . '</lastmod>';
    foreach ($alternates as $lang => $altPath) {
        $out .= '<xhtml:link rel="alternate" hreflang="' . x($lang) . '" href="' . x(SEO_SITE . $altPath) . '"/>';
    }
    return $out . $extra . "</url>\n";
}

header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: public, max-age=600');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">' . "\n";

$homeAlt = $hasAr ? ['en' => '/', 'ar' => '/ar/', 'x-default' => '/'] : [];
echo sitemap_url('/', $latest, $homeAlt);
if ($hasAr) echo sitemap_url('/ar/', $latest, $homeAlt);

if ($en) {
    $keys = array_keys(SEO_PAGES);
    $keys[] = 'faq';
    foreach ($keys as $key) {
        if ($key !== 'faq' && !isset($en['pages'][$key])) continue;
        $alt = $hasAr ? ['en' => seo_page_path($key, 'en'), 'ar' => seo_page_path($key, 'ar'), 'x-default' => seo_page_path($key, 'en')] : [];
        echo sitemap_url(seo_page_path($key, 'en'), $latest, $alt);
        if ($hasAr) echo sitemap_url(seo_page_path($key, 'ar'), $latest, $alt);
    }
    echo sitemap_url('/work/', $latest);

    foreach ($data['items'] as $item) {
        $stamp = substr((string) ($item['updated_at'] ?? $item['created_at'] ?? $latest), 0, 10) ?: $latest;
        $extra = '';
        $thumb = seo_abs($item['thumbnail_url'] ?? '');
        $videoUrl = trim((string) ($item['video_url'] ?? ''));
        if ($thumb !== '' && ($item['video_type'] ?? '') === 'direct' && preg_match('#^https?://#i', $videoUrl)) {
            $desc = seo_clean($item['seo_description'] ?? '', 300);
            if ($desc === '') $desc = seo_clean($item['description'] ?? '', 300);
            if ($desc === '') $desc = seo_clean($item['title'], 300);
            $extra = '<video:video><video:thumbnail_loc>' . x($thumb) . '</video:thumbnail_loc><video:title>' . x(seo_clean($item['title'], 100)) . '</video:title><video:description>' . x($desc) . '</video:description><video:content_loc>' . x($videoUrl) . '</video:content_loc>';
            if (!empty($item['created_at'])) $extra .= '<video:publication_date>' . x((string) $item['created_at']) . '</video:publication_date>';
            $extra .= '</video:video>';
        }
        echo sitemap_url(seo_work_path($item), $stamp, [], $extra);
    }
}
echo '</urlset>';
