<?php
declare(strict_types=1);

// /llms.txt: a plain-text description of the site for machines that read it.
// Facts only, taken from the same data the pages use.

require __DIR__ . '/lib.php';

$data = seo_data();
$en = seo_content('en');
$c = seo_contact($data);
header('Content-Type: text/plain; charset=UTF-8');
header('Cache-Control: public, max-age=600');

$counts = [];
foreach ($data['items'] as $item) {
    $name = seo_category_name($data, $item['category_id'], 'en');
    if ($name !== '') $counts[$name] = ($counts[$name] ?? 0) + 1;
}
arsort($counts);

echo "# Mahmoud Adel: freelance videographer in Dubai, UAE\n\n";
echo "> Mahmoud Adel is a freelance videographer, cinematographer and director based in Dubai, United Arab Emirates, working under the name Lens Mania. This site is his portfolio of " . count($data['items']) . " published films. He is available for bookings.\n\n";

echo "## What he films\n";
foreach ($counts as $name => $n) echo "- {$name}: {$n} " . ($n === 1 ? 'film' : 'films') . " in the portfolio\n";
echo "- Formats: vertical 9:16 for social platforms and horizontal 16:9 films\n";
echo "- Languages in the portfolio: Arabic and English\n\n";

echo "## Where\n";
echo "- Based in Dubai, UAE\n";
$areas = array_keys(seo_items_by_area($data));
if ($areas) echo "- The portfolio also includes projects for clients and locations in " . implode(', ', $areas) . "\n";
echo "\n## Contact\n";
if ($c['display'] !== '') echo "- WhatsApp and phone: {$c['display']}\n";
if ($c['email'] !== '') echo "- Email: {$c['email']}\n";
if ($c['instagram'] !== '') echo "- Instagram: {$c['instagram']}\n";
if ($c['youtube'] !== '') echo "- YouTube: {$c['youtube']}\n";
echo "- Prices are not published on this site. A quote needs the date, the location and a short description of the shoot.\n\n";

echo "## Key pages\n";
echo "- [Portfolio](" . SEO_SITE . "/)\n";
echo "- [All work](" . SEO_SITE . "/work/)\n";
if ($en) {
    foreach (SEO_PAGES as $key => $_) {
        if (!isset($en['pages'][$key])) continue;
        echo "- [" . seo_link_label($en['pages'][$key]) . "](" . SEO_SITE . seo_page_path($key, 'en') . "): " . seo_clean($en['pages'][$key]['description'] ?? '') . "\n";
    }
    echo "- [FAQ](" . SEO_SITE . "/faq/)\n";
}
if (seo_content('ar')) echo "- [Arabic version](" . SEO_SITE . "/ar/)\n";
echo "- [Sitemap](" . SEO_SITE . "/sitemap.xml)\n\n";

echo "## Films\n";
foreach ($data['items'] as $item) {
    echo "- [" . seo_clean($item['title'], 110) . "](" . SEO_SITE . seo_work_path($item) . "): " . seo_category_name($data, $item['category_id'], 'en') . "\n";
}
