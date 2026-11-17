<?php
declare(strict_types=1);

// Service pages, the UAE page, the FAQ, the work index and the Arabic home.
// Routed from .htaccess: page.php?p=<key>&lang=<en|ar>

require __DIR__ . '/lib.php';

$key = (string) ($_GET['p'] ?? '');
$lang = ($_GET['lang'] ?? 'en') === 'ar' ? 'ar' : 'en';
$content = seo_content($lang);
if (!$content) seo_not_found();
$data = seo_data();
$ui = $content['ui'];
$hasAr = seo_content('ar') !== null;
$homeName = $lang === 'ar' ? 'محمود عادل' : 'Mahmoud Adel';

function seo_alternates(string $key, bool $hasAr): array {
    $alt = ['en' => seo_page_path($key, 'en')];
    if ($hasAr) $alt['ar'] = seo_page_path($key, 'ar');
    $alt['x-default'] = seo_page_path($key, 'en');
    return $alt;
}

// ---------- work index (English only; titles are shown as published) ----------
if ($key === 'work') {
    $content = seo_content('en');
    $ui = $content['ui'];
    $list = [];
    $pos = 1;
    foreach ($data['items'] as $item) {
        $list[] = ['@type' => 'ListItem', 'position' => $pos++, 'url' => SEO_SITE . seo_work_path($item), 'name' => seo_clean($item['title'], 110)];
    }
    seo_head([
        'lang' => 'en',
        'title' => $ui['all_work_title'],
        'description' => $ui['all_work_description'],
        'path' => '/work/',
        'jsonld' => [
            ['@type' => 'CollectionPage', '@id' => SEO_SITE . '/work/', 'name' => $ui['all_work_h1'], 'url' => SEO_SITE . '/work/', 'about' => ['@id' => SEO_SITE . '/#business'],
                'mainEntity' => ['@type' => 'ItemList', 'numberOfItems' => count($list), 'itemListElement' => $list]],
            seo_breadcrumb(['Mahmoud Adel' => '/', $ui['all_work_h1'] => '/work/']),
        ],
    ], $content);
    echo '<div class="wrap"><p class="kicker">' . e($ui['based_in'] ?? '') . '</p><h1>' . e($ui['all_work_h1']) . '</h1><p class="lede">' . e($ui['all_work_intro']) . '</p></div>';
    $order = ['events', 'aesthetic-clinics', 'social-media', 'cinematic-videos', 'cinematic-interviews', 'music-videos', 'cinematic-ai-generations'];
    $serviceFor = [];
    foreach (SEO_PAGES as $slug => $def) foreach ($def['cats'] as $c) $serviceFor[$c] = $slug;
    foreach ($order as $catSlug) {
        $items = seo_items_in($data, [$catSlug]);
        if (!$items) continue;
        $first = reset($items);
        echo '<section class="wrap group"><h2>' . e(seo_category_name($data, $first['category_id'], 'en')) . ' <span class="count">' . count($items) . '</span></h2>';
        if (isset($serviceFor[$catSlug], $content['pages'][$serviceFor[$catSlug]])) {
            echo '<p class="more"><a href="' . e(seo_page_path($serviceFor[$catSlug], 'en')) . '">' . e(seo_link_label($content['pages'][$serviceFor[$catSlug]])) . '</a></p>';
        }
        echo seo_cards($items, $data, 'en') . '</section>';
    }
    echo '<div class="wrap">' . seo_contact_block($content, $data, 'en') . '</div>';
    seo_foot($content, $data, 'en');
    exit;
}

// ---------- FAQ ----------
if ($key === 'faq') {
    $faq = $content['faq'] ?? null;
    if (!$faq || empty($faq['items'])) seo_not_found();
    $entities = [];
    foreach ($faq['items'] as $qa) {
        $entities[] = ['@type' => 'Question', 'name' => $qa['q'], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $qa['a']]];
    }
    seo_head([
        'lang' => $lang,
        'title' => $faq['title'],
        'description' => $faq['description'],
        'path' => seo_page_path('faq', $lang),
        'alt' => seo_alternates('faq', $hasAr),
        'jsonld' => [
            ['@type' => 'FAQPage', '@id' => SEO_SITE . seo_page_path('faq', $lang), 'inLanguage' => $lang, 'mainEntity' => $entities],
            seo_breadcrumb([$homeName => seo_page_path('home', $lang), $faq['h1'] => seo_page_path('faq', $lang)]),
        ],
    ], $content);
    echo '<div class="wrap"><p class="kicker">' . e($ui['nav_faq'] ?? 'FAQ') . '</p><h1>' . e($faq['h1']) . '</h1><p class="lede">' . e($faq['intro'] ?? '') . '</p><div class="faq">';
    foreach ($faq['items'] as $qa) {
        echo '<section><h2>' . e($qa['q']) . '</h2><p>' . e($qa['a']) . '</p></section>';
    }
    echo '</div>' . seo_contact_block($content, $data, $lang) . '</div>';
    seo_foot($content, $data, $lang);
    exit;
}

// ---------- Arabic home ----------
if ($key === 'home') {
    if ($lang !== 'ar') { header('Location: /', true, 301); exit; }
    $home = $content['home'];
    seo_head([
        'lang' => 'ar',
        'title' => $home['title'],
        'description' => $home['description'],
        'path' => '/ar/',
        'alt' => ['en' => '/', 'ar' => '/ar/', 'x-default' => '/'],
        'jsonld' => [seo_business_node($data, $home['description']), seo_person_node($data)],
    ], $content);
    echo '<div class="wrap"><p class="kicker">' . e($ui['based_in'] ?? '') . '</p><h1>' . e($home['h1']) . '</h1>';
    foreach (($home['intro'] ?? []) as $p) echo '<p class="lede">' . e($p) . '</p>';
    echo '<h2>' . e($home['services_heading'] ?? '') . '</h2><ul class="links links-big">' . seo_service_links($content, 'ar') . '</ul>';
    echo '</div><section class="wrap group"><h2>' . e($home['work_heading'] ?? '') . '</h2>' . seo_cards($data['items'], $data, 'ar', 12);
    echo '<p class="more"><a href="/work/">' . e($ui['nav_work'] ?? '') . '</a></p></section>';
    if ($data['testimonials']) {
        echo '<section class="wrap"><h2>' . e($home['reviews_heading'] ?? '') . '</h2><div class="quotes">';
        foreach ($data['testimonials'] as $t) {
            $role = trim((string) ($t['role'] ?? ''));
            echo '<blockquote dir="auto"><p>' . e(seo_clean($t['text'], 400)) . '</p><cite>' . e(trim((string) $t['name']) . ($role !== '' ? '، ' . $role : '')) . '</cite></blockquote>';
        }
        echo '</div></section>';
    }
    echo '<div class="wrap">' . seo_contact_block($content, $data, 'ar') . '</div>';
    seo_foot($content, $data, 'ar');
    exit;
}

// ---------- service and area pages ----------
$def = SEO_PAGES[$key] ?? null;
$page = $content['pages'][$key] ?? null;
if (!$def || !$page) seo_not_found();

$path = seo_page_path($key, $lang);
$nodes = [
    [
        '@type' => 'Service',
        '@id' => SEO_SITE . $path . '#service',
        'name' => $page['h1'],
        'serviceType' => seo_link_label($page),
        'description' => $page['description'],
        'url' => SEO_SITE . $path,
        'inLanguage' => $lang,
        'provider' => ['@id' => SEO_SITE . '/#business'],
        'areaServed' => ['@type' => 'City', 'name' => 'Dubai'],
    ],
    seo_business_node($data, $content['home']['description'] ?? $page['description']),
    seo_breadcrumb([$homeName => seo_page_path('home', $lang), seo_link_label($page) => $path]),
];
if ($def['kind'] === 'area') {
    $nodes[0]['areaServed'] = ['@type' => 'Country', 'name' => 'United Arab Emirates'];
}

seo_head([
    'lang' => $lang,
    'title' => $page['title'],
    'description' => $page['description'],
    'path' => $path,
    'alt' => seo_alternates($key, $hasAr),
    'jsonld' => $nodes,
], $content);

echo '<div class="wrap"><p class="kicker">' . e($page['kicker'] ?? '') . '</p><h1>' . e($page['h1']) . '</h1>';
foreach (($page['intro'] ?? []) as $p) echo '<p class="lede">' . e($p) . '</p>';
$contact = seo_contact($data);
if ($wa = seo_wa_link($contact, $page['h1'])) {
    echo '<p class="actions"><a class="btn btn-wa" href="' . e($wa) . '" target="_blank" rel="noopener">' . e($ui['cta_whatsapp'] ?? 'WhatsApp') . '</a></p>';
}
echo '</div>';

if ($def['kind'] === 'area') {
    foreach (seo_items_by_area($data) as $name => $items) {
        $label = $lang === 'ar' ? SEO_AREAS[$name]['ar'] : $name;
        echo '<section class="wrap group"><h2>' . e($label) . ' <span class="count">' . count($items) . '</span></h2>' . seo_cards($items, $data, $lang) . '</section>';
    }
} else {
    $items = seo_items_in($data, $def['cats']);
    if ($items) {
        echo '<section class="wrap group"><h2>' . e($ui['projects_heading'] ?? 'Projects') . ' <span class="count">' . count($items) . '</span></h2>' . seo_cards($items, $data, $lang) . '</section>';
    }
}

echo '<div class="wrap prose">';
foreach (($page['sections'] ?? []) as $section) {
    echo '<section><h2>' . e($section['h2'] ?? '') . '</h2>';
    foreach ((array) ($section['body'] ?? []) as $p) echo '<p>' . e($p) . '</p>';
    echo '</section>';
}
echo seo_contact_block($content, $data, $lang, $page['h1']) . '</div>';
seo_foot($content, $data, $lang, $key);
