<?php
declare(strict_types=1);

// Shared engine for the server-rendered pages (services, areas, FAQ, work index,
// one page per film), the sitemap, llms.txt and the home-page prerender.
// Everything factual on these pages comes from the portfolio API or from
// seo/content/{en,ar}.json. Nothing here invents a claim.

const SEO_SITE = 'https://portfolio.lensmania.ae';
const SEO_API = 'https://mahmoud-portfolio-api.pampozya.workers.dev/api';
const SEO_CACHE_TTL = 600;
const SEO_ASSET_VERSION = '20261117b';
// Same list the app hides (UNAVAILABLE_PUBLIC_PORTFOLIO_IDS in src/App.jsx).
const SEO_HIDDEN_IDS = [3, 9, 13, 21, 26, 27];

// URL slug => which portfolio categories feed the page.
const SEO_PAGES = [
    'event-videographer-dubai' => ['kind' => 'service', 'cats' => ['events']],
    'medical-clinic-videographer-dubai' => ['kind' => 'service', 'cats' => ['aesthetic-clinics']],
    'social-media-videographer-dubai' => ['kind' => 'service', 'cats' => ['social-media']],
    'brand-film-videographer-dubai' => ['kind' => 'service', 'cats' => ['cinematic-videos']],
    'corporate-interview-videographer-dubai' => ['kind' => 'service', 'cats' => ['cinematic-interviews']],
    'videographer-uae' => ['kind' => 'area', 'cats' => []],
];

// Emirates other than Dubai that a project names in its own title or description.
const SEO_AREAS = [
    'Abu Dhabi' => ['ar' => 'أبوظبي', 're' => '/Abu Dhabi|أبو ?ظبي/u'],
    'Sharjah' => ['ar' => 'الشارقة', 're' => '/Sharjah|الشارقة/u'],
    'Ras Al Khaimah' => ['ar' => 'رأس الخيمة', 're' => '/Ras Al Khaimah|رأس الخيمة/u'],
];

const SEO_CATEGORY_AR = [
    'aesthetic-clinics' => 'طبي وعيادات',
    'social-media' => 'سوشيال ميديا',
    'cinematic-videos' => 'أفلام سينمائية',
    'cinematic-interviews' => 'مقابلات سينمائية',
    'events' => 'فعاليات',
    'cinematic-ai-generations' => 'أعمال بالذكاء الاصطناعي',
    'music-videos' => 'فيديو كليب',
];

function e(?string $value): string {
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function seo_clean(?string $value, int $limit = 0): string {
    $value = trim((string) preg_replace('/\s+/u', ' ', strip_tags((string) $value)));
    if ($limit > 0 && mb_strlen($value) > $limit) {
        $value = rtrim(mb_substr($value, 0, $limit - 1)) . '…';
    }
    return $value;
}

function seo_http_json(string $url): ?array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_USERAGENT => 'LensmaniaPages/1.0',
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($body === false || $status < 200 || $status >= 300) return null;
    $data = json_decode((string) $body, true);
    return is_array($data) ? $data : null;
}

// API read with a small file cache. A failed refresh serves the stale copy.
function seo_fetch(string $endpoint): array {
    $dir = __DIR__ . '/cache';
    $file = $dir . '/' . preg_replace('/[^a-z0-9-]/', '', $endpoint) . '.json';
    $fresh = is_file($file) && (time() - (int) filemtime($file)) < SEO_CACHE_TTL;
    if ($fresh) {
        $cached = json_decode((string) @file_get_contents($file), true);
        if (is_array($cached)) return $cached;
    }
    $data = seo_http_json(SEO_API . '/' . $endpoint);
    if (is_array($data)) {
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) !== false) {
            @rename($tmp, $file);
        }
        return $data;
    }
    if (is_file($file)) {
        $stale = json_decode((string) @file_get_contents($file), true);
        if (is_array($stale)) return $stale;
    }
    return [];
}

function seo_data(): array {
    static $data = null;
    if ($data !== null) return $data;

    $settings = seo_fetch('settings');
    $categories = [];
    foreach (seo_fetch('categories') as $cat) {
        if (!is_array($cat) || !isset($cat['id'])) continue;
        $categories[(int) $cat['id']] = [
            'id' => (int) $cat['id'],
            'name' => (string) ($cat['name'] ?? ''),
            'slug' => (string) ($cat['slug'] ?? ''),
        ];
    }

    $raw = seo_fetch('portfolio');
    if (isset($raw['items']) && is_array($raw['items'])) $raw = $raw['items'];
    $items = [];
    foreach ($raw as $item) {
        if (!is_array($item) || !isset($item['id'])) continue;
        $id = (int) $item['id'];
        if (in_array($id, SEO_HIDDEN_IDS, true)) continue;
        if (trim((string) ($item['title'] ?? '')) === '') continue;
        $item['id'] = $id;
        $item['category_id'] = (int) ($item['category_id'] ?? 0);
        $items[$id] = $item;
    }
    uasort($items, fn($a, $b) => strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? '')));

    $testimonials = [];
    foreach (seo_fetch('testimonials') as $t) {
        if (!is_array($t) || trim((string) ($t['text'] ?? '')) === '') continue;
        $testimonials[] = $t;
    }

    $data = ['settings' => $settings, 'categories' => $categories, 'items' => $items, 'testimonials' => $testimonials];
    return $data;
}

function seo_content(string $lang): ?array {
    static $cache = [];
    if (array_key_exists($lang, $cache)) return $cache[$lang];
    $file = __DIR__ . '/content/' . ($lang === 'ar' ? 'ar' : 'en') . '.json';
    $content = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
    $cache[$lang] = is_array($content) ? $content : null;
    return $cache[$lang];
}

function seo_slug(string $title): string {
    $slug = strtolower((string) preg_replace('/[^A-Za-z0-9]+/', '-', $title));
    $slug = trim($slug, '-');
    if (strlen($slug) > 70) $slug = rtrim(substr($slug, 0, 70), '-');
    return $slug;
}

function seo_work_path(array $item): string {
    $slug = seo_slug((string) ($item['title'] ?? ''));
    return '/work/' . $item['id'] . ($slug !== '' ? '-' . $slug : '') . '/';
}

function seo_page_path(string $key, string $lang): string {
    $prefix = $lang === 'ar' ? '/ar' : '';
    if ($key === 'home') return $lang === 'ar' ? '/ar/' : '/';
    if ($key === 'work') return '/work/';
    if ($key === 'faq' || $key === 'videographer-uae') return $prefix . '/' . $key . '/';
    return $prefix . '/services/' . $key . '/';
}

function seo_category_name(array $data, int $categoryId, string $lang): string {
    $cat = $data['categories'][$categoryId] ?? null;
    if (!$cat) return '';
    if ($lang === 'ar' && isset(SEO_CATEGORY_AR[$cat['slug']])) return SEO_CATEGORY_AR[$cat['slug']];
    return $cat['name'];
}

function seo_items_in(array $data, array $categorySlugs): array {
    $ids = [];
    foreach ($data['categories'] as $cat) {
        if (in_array($cat['slug'], $categorySlugs, true)) $ids[] = $cat['id'];
    }
    return array_filter($data['items'], fn($item) => in_array($item['category_id'], $ids, true));
}

function seo_items_by_area(array $data): array {
    $groups = [];
    foreach (SEO_AREAS as $name => $area) {
        foreach ($data['items'] as $item) {
            $blob = ($item['title'] ?? '') . ' ' . ($item['description'] ?? '') . ' ' . ($item['seo_title'] ?? '') . ' ' . ($item['seo_description'] ?? '');
            if (preg_match($area['re'], $blob)) $groups[$name][$item['id']] = $item;
        }
    }
    return $groups;
}

function seo_abs(?string $url): string {
    $url = trim((string) $url);
    if ($url === '') return '';
    if (preg_match('#^https?://#i', $url)) return $url;
    return SEO_SITE . '/' . ltrim($url, '/');
}

function seo_contact(array $data): array {
    $s = $data['settings'];
    $digits = preg_replace('/\D+/', '', (string) ($s['whatsapp'] ?? $s['phone'] ?? ''));
    $digits = preg_replace('/^00/', '', (string) $digits);
    $display = $digits;
    if (preg_match('/^971(\d{2})(\d{3})(\d{4})$/', (string) $digits, $m)) $display = "+971 {$m[1]} {$m[2]} {$m[3]}";
    elseif ($digits !== '') $display = '+' . $digits;
    return [
        'digits' => (string) $digits,
        'e164' => $digits !== '' ? '+' . $digits : '',
        'display' => (string) $display,
        'email' => trim((string) ($s['email'] ?? '')),
        'location' => trim((string) ($s['location'] ?? 'Dubai, UAE')),
        'instagram' => trim((string) ($s['instagram'] ?? '')),
        'youtube' => trim((string) ($s['youtube'] ?? '')),
        'linkedin' => trim((string) ($s['linkedin'] ?? '')),
        'tiktok' => trim((string) ($s['tiktok'] ?? '')),
    ];
}

function seo_wa_link(array $contact, string $text = ''): string {
    if ($contact['digits'] === '') return '';
    return 'https://wa.me/' . $contact['digits'] . ($text !== '' ? '?text=' . rawurlencode($text) : '');
}

function seo_same_as(array $contact): array {
    return array_values(array_filter([$contact['instagram'], $contact['youtube'], $contact['linkedin'], $contact['tiktok']],
        fn($u) => (bool) preg_match('#^https?://#i', $u)));
}

function seo_jsonld(array $graph): string {
    $json = json_encode(['@context' => 'https://schema.org', '@graph' => $graph],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
    return '<script type="application/ld+json">' . $json . '</script>';
}

function seo_business_node(array $data, string $description): array {
    $contact = seo_contact($data);
    $areas = [['@type' => 'City', 'name' => 'Dubai']];
    foreach (array_keys(seo_items_by_area($data)) as $name) $areas[] = ['@type' => 'City', 'name' => $name];
    $node = [
        '@type' => 'ProfessionalService',
        '@id' => SEO_SITE . '/#business',
        'name' => 'Mahmoud Adel | Lens Mania',
        'description' => $description,
        'url' => SEO_SITE . '/',
        'image' => SEO_SITE . '/og-image.png',
        'logo' => SEO_SITE . '/favicon-512.png',
        'address' => ['@type' => 'PostalAddress', 'addressLocality' => 'Dubai', 'addressCountry' => 'AE'],
        'areaServed' => $areas,
        'knowsLanguage' => ['en', 'ar'],
        'founder' => ['@id' => SEO_SITE . '/#person'],
    ];
    if ($contact['e164'] !== '') $node['telephone'] = $contact['e164'];
    if ($contact['email'] !== '') $node['email'] = $contact['email'];
    if ($same = seo_same_as($contact)) $node['sameAs'] = $same;
    return $node;
}

function seo_person_node(array $data): array {
    $contact = seo_contact($data);
    $node = [
        '@type' => 'Person',
        '@id' => SEO_SITE . '/#person',
        'name' => 'Mahmoud Adel',
        'jobTitle' => 'Freelance videographer, cinematographer and director',
        'url' => SEO_SITE . '/',
        'worksFor' => ['@id' => SEO_SITE . '/#business'],
        'address' => ['@type' => 'PostalAddress', 'addressLocality' => 'Dubai', 'addressCountry' => 'AE'],
    ];
    if ($same = seo_same_as($contact)) $node['sameAs'] = $same;
    return $node;
}

function seo_breadcrumb(array $trail): array {
    $list = [];
    $i = 1;
    foreach ($trail as $name => $path) {
        $list[] = ['@type' => 'ListItem', 'position' => $i++, 'name' => $name, 'item' => SEO_SITE . $path];
    }
    return ['@type' => 'BreadcrumbList', 'itemListElement' => $list];
}

function seo_link_label(array $page): string {
    $title = (string) ($page['title'] ?? '');
    $cut = preg_split('/\s[|\x{2014}\x{2013}-]\s/u', $title);
    return trim((string) ($cut[0] ?? $title));
}

function seo_service_links(array $content, string $lang, string $current = ''): string {
    $out = '';
    foreach (SEO_PAGES as $key => $_) {
        if (!isset($content['pages'][$key])) continue;
        $attr = $key === $current ? ' aria-current="page"' : '';
        $out .= '<li><a href="' . e(seo_page_path($key, $lang)) . '"' . $attr . '>' . e(seo_link_label($content['pages'][$key])) . '</a></li>';
    }
    return $out;
}

function seo_cards(array $items, array $data, string $lang, int $limit = 0): string {
    if ($limit > 0) $items = array_slice($items, 0, $limit, true);
    if (!$items) return '';
    $out = '<ul class="cards">';
    foreach ($items as $item) {
        $thumb = seo_abs($item['thumbnail_url'] ?? '');
        $vertical = ($item['aspect_ratio'] ?? '') === '9:16';
        $out .= '<li class="card' . ($vertical ? ' card-v' : '') . '"><a href="' . e(seo_work_path($item)) . '">';
        $out .= '<span class="card-thumb">';
        if ($thumb !== '') $out .= '<img src="' . e($thumb) . '" alt="' . e(seo_clean($item['title'] ?? '', 120)) . '" loading="lazy" decoding="async">';
        $out .= '</span>';
        $out .= '<span class="card-cat">' . e(seo_category_name($data, $item['category_id'], $lang)) . '</span>';
        $out .= '<span class="card-title" dir="auto">' . e(seo_clean($item['title'] ?? '', 110)) . '</span>';
        $out .= '</a></li>';
    }
    return $out . '</ul>';
}

function seo_contact_block(array $content, array $data, string $lang, string $waText = ''): string {
    $ui = $content['ui'];
    $c = seo_contact($data);
    $out = '<section class="contact" id="contact"><h2>' . e($ui['contact_heading'] ?? 'Contact') . '</h2>';
    $out .= '<p>' . e($ui['contact_line'] ?? '') . '</p><div class="actions">';
    if ($wa = seo_wa_link($c, $waText)) $out .= '<a class="btn btn-wa" href="' . e($wa) . '" target="_blank" rel="noopener">' . e($ui['cta_whatsapp'] ?? 'WhatsApp') . '</a>';
    if ($c['e164'] !== '') $out .= '<a class="btn" href="tel:' . e($c['e164']) . '">' . e($ui['cta_call'] ?? 'Call') . ' <bdi dir="ltr">' . e($c['display']) . '</bdi></a>';
    if ($c['email'] !== '') $out .= '<a class="btn" href="mailto:' . e($c['email']) . '">' . e($ui['cta_email'] ?? 'Email') . ' <bdi dir="ltr">' . e($c['email']) . '</bdi></a>';
    return $out . '</div></section>';
}

// $opts: lang, title, description, path, alt (lang => path), image, jsonld (array of nodes), type, noindex
function seo_head(array $opts, array $content): void {
    $lang = $opts['lang'] ?? 'en';
    $isAr = $lang === 'ar';
    $canonical = SEO_SITE . $opts['path'];
    $image = ($opts['image'] ?? '') !== '' ? $opts['image'] : SEO_SITE . '/og-image.png?v=20260524-logo';
    $ui = $content['ui'];
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: public, max-age=300');
    echo '<!DOCTYPE html><html lang="' . ($isAr ? 'ar' : 'en') . '" dir="' . ($isAr ? 'rtl' : 'ltr') . '"><head>';
    echo '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
    echo '<meta name="theme-color" content="#050505">';
    echo '<title>' . e($opts['title']) . '</title>';
    echo '<meta name="description" content="' . e($opts['description']) . '">';
    if (!empty($opts['noindex'])) echo '<meta name="robots" content="noindex,follow">';
    echo '<link rel="canonical" href="' . e($canonical) . '">';
    foreach (($opts['alt'] ?? []) as $altLang => $altPath) {
        echo '<link rel="alternate" hreflang="' . e($altLang) . '" href="' . e(SEO_SITE . $altPath) . '">';
    }
    echo '<meta property="og:type" content="' . e($opts['type'] ?? 'website') . '">';
    echo '<meta property="og:url" content="' . e($canonical) . '">';
    echo '<meta property="og:title" content="' . e($opts['title']) . '">';
    echo '<meta property="og:description" content="' . e($opts['description']) . '">';
    echo '<meta property="og:image" content="' . e($image) . '">';
    echo '<meta property="og:site_name" content="Mahmoud Adel Portfolio">';
    echo '<meta property="og:locale" content="' . ($isAr ? 'ar_AE' : 'en_AE') . '">';
    echo '<meta name="twitter:card" content="summary_large_image">';
    echo '<meta name="twitter:title" content="' . e($opts['title']) . '">';
    echo '<meta name="twitter:description" content="' . e($opts['description']) . '">';
    echo '<meta name="twitter:image" content="' . e($image) . '">';
    echo '<link rel="icon" type="image/png" href="/favicon.png?v=20260524-monogram">';
    echo '<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20260524-monogram">';
    echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
    $fonts = 'family=Manrope:wght@200..800&family=Playfair+Display:wght@400;700';
    if ($isAr) $fonts .= '&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600';
    echo '<link href="https://fonts.googleapis.com/css2?' . $fonts . '&display=swap" rel="stylesheet">';
    echo '<link rel="stylesheet" href="/seo/site.css?v=' . SEO_ASSET_VERSION . '">';
    if (!empty($opts['jsonld'])) echo seo_jsonld($opts['jsonld']);
    echo '</head><body>';

    $home = $isAr ? '/ar/' : '/';
    echo '<header class="top"><a class="brand" href="' . $home . '" aria-label="Mahmoud Adel"><img src="/logo-white.svg?v=20260524-monogram" alt="Mahmoud Adel" width="44" height="28"></a><nav aria-label="Main"><ul>';
    echo '<li><a href="/">' . e($ui['nav_home'] ?? 'Portfolio') . '</a></li>';
    echo '<li><a href="/work/">' . e($ui['nav_work'] ?? 'All work') . '</a></li>';
    echo '<li class="opt"><a href="#services">' . e($ui['nav_services'] ?? 'Services') . '</a></li>';
    echo '<li><a href="' . e(seo_page_path('faq', $lang)) . '">' . e($ui['nav_faq'] ?? 'FAQ') . '</a></li>';
    echo '<li class="opt"><a href="#contact">' . e($ui['nav_contact'] ?? 'Contact') . '</a></li>';
    $switch = $opts['alt'][$isAr ? 'en' : 'ar'] ?? null;
    if ($switch) echo '<li><a class="lang" href="' . e($switch) . '" lang="' . ($isAr ? 'en' : 'ar') . '">' . ($isAr ? 'English' : 'العربية') . '</a></li>';
    echo '</ul></nav></header><main>';
}

function seo_foot(array $content, array $data, string $lang, string $current = ''): void {
    $ui = $content['ui'];
    $c = seo_contact($data);
    echo '</main><footer class="foot" id="services"><div class="foot-grid"><div>';
    echo '<h2>' . e($ui['other_services_heading'] ?? ($ui['nav_services'] ?? 'Services')) . '</h2><ul class="links">';
    echo seo_service_links($content, $lang, $current);
    echo '<li><a href="/work/">' . e($ui['nav_work'] ?? 'All work') . '</a></li>';
    echo '<li><a href="' . e(seo_page_path('faq', $lang)) . '">' . e($ui['nav_faq'] ?? 'FAQ') . '</a></li>';
    echo '</ul></div><div><h2>' . e($ui['nav_contact'] ?? 'Contact') . '</h2><ul class="links">';
    if ($wa = seo_wa_link($c)) echo '<li><a href="' . e($wa) . '" target="_blank" rel="noopener">WhatsApp <bdi dir="ltr">' . e($c['display']) . '</bdi></a></li>';
    if ($c['email'] !== '') echo '<li><a href="mailto:' . e($c['email']) . '"><bdi dir="ltr">' . e($c['email']) . '</bdi></a></li>';
    if ($c['instagram'] !== '') echo '<li><a href="' . e($c['instagram']) . '" target="_blank" rel="noopener me">Instagram</a></li>';
    if ($c['youtube'] !== '') echo '<li><a href="' . e($c['youtube']) . '" target="_blank" rel="noopener me">YouTube</a></li>';
    echo '</ul></div></div><p class="foot-line">' . e($ui['footer_line'] ?? '') . '</p></footer></body></html>';
}

function seo_not_found(): void {
    http_response_code(404);
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Robots-Tag: noindex');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found | Mahmoud Adel</title><link rel="stylesheet" href="/seo/site.css?v=' . SEO_ASSET_VERSION . '"></head><body><main class="wrap"><p class="kicker">404</p><h1>Page not found</h1><p><a href="/">Back to the portfolio</a> or <a href="/work/">see all work</a>.</p></main></body></html>';
    exit;
}

// ---------- home page (the app shell) ----------

// Content placed inside <div id="root"> so the page reads without JavaScript.
// React replaces it when the app mounts.
function seo_home_block(array $content, array $data): string {
    $home = $content['home'];
    $ui = $content['ui'];
    $c = seo_contact($data);
    $out = '<div class="pre"><header class="pre-hero"><p class="pre-kicker">' . e($ui['based_in'] ?? 'Based in Dubai, UAE') . '</p>';
    $out .= '<h1>' . e($home['h1']) . '</h1>';
    foreach (($home['intro'] ?? []) as $p) $out .= '<p>' . e($p) . '</p>';
    $out .= '</header>';
    $out .= '<section><h2>' . e($home['services_heading'] ?? 'Services') . '</h2><ul>' . seo_service_links($content, 'en');
    $out .= '<li><a href="/faq/">' . e($ui['nav_faq'] ?? 'FAQ') . '</a></li><li><a href="/ar/" lang="ar">العربية</a></li></ul></section>';
    $out .= '<section><h2>' . e($home['work_heading'] ?? 'Work') . '</h2><ul>';
    foreach ($data['items'] as $item) {
        $out .= '<li><a href="' . e(seo_work_path($item)) . '" dir="auto">' . e(seo_clean($item['title'], 110)) . '</a> <span>' . e(seo_category_name($data, $item['category_id'], 'en')) . '</span></li>';
    }
    $out .= '</ul><p><a href="/work/">' . e($ui['nav_work'] ?? 'All work') . '</a></p></section>';
    if ($data['testimonials']) {
        $out .= '<section><h2>' . e($home['reviews_heading'] ?? 'Reviews') . '</h2>';
        foreach ($data['testimonials'] as $t) {
            $who = trim((string) ($t['name'] ?? ''));
            $role = trim((string) ($t['role'] ?? ''));
            $out .= '<blockquote dir="auto"><p>' . e(seo_clean($t['text'], 400)) . '</p><cite>' . e($who . ($role !== '' ? ', ' . $role : '')) . '</cite></blockquote>';
        }
        $out .= '</section>';
    }
    $out .= '<section><h2>' . e($ui['contact_heading'] ?? 'Contact') . '</h2><p>' . e($ui['contact_line'] ?? '') . '</p><ul>';
    if ($wa = seo_wa_link($c)) $out .= '<li><a href="' . e($wa) . '">WhatsApp ' . e($c['display']) . '</a></li>';
    if ($c['e164'] !== '') $out .= '<li><a href="tel:' . e($c['e164']) . '">' . e($c['display']) . '</a></li>';
    if ($c['email'] !== '') $out .= '<li><a href="mailto:' . e($c['email']) . '">' . e($c['email']) . '</a></li>';
    $out .= '<li>' . e($c['location']) . '</li></ul></section></div>';
    return $out;
}

const SEO_HOME_STYLE = '<style>.pre{font-family:Manrope,system-ui,sans-serif;color:#eaeaea;background:#0a0a0a;padding:0 clamp(20px,6vw,80px) 64px;line-height:1.6}.pre-hero{min-height:100vh;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:14vh;max-width:760px}.pre-kicker{color:#c8a86a;font-size:.72rem;letter-spacing:.32em;text-transform:uppercase;margin:0 0 1rem}.pre h1{font-size:clamp(2.2rem,5vw,4.2rem);font-weight:300;line-height:1.05;margin:0 0 1.2rem;letter-spacing:-.01em}.pre h2{font-size:1.1rem;font-weight:600;margin:2.4rem 0 .8rem}.pre p{color:#a8a8a8;max-width:62ch;margin:0 0 .9rem}.pre ul{list-style:none;padding:0;margin:0;columns:2 320px;column-gap:40px}.pre li{padding:.28rem 0;break-inside:avoid}.pre li span{color:#666;font-size:.8em}.pre a{color:#eaeaea;text-decoration:none}.pre blockquote{margin:0 0 1rem;padding-inline-start:1rem;border-inline-start:1px solid rgba(200,168,106,.5)}.pre cite{color:#888;font-style:normal;font-size:.85em}</style>';

// Rewrites the built index.html: title, descriptions, alternates, structured data
// and the prerendered block. Returns the shell unchanged if anything is missing.
function seo_apply_home(string $html): string {
    $content = seo_content('en');
    if (!$content || empty($content['home']['title'])) return $html;
    $data = seo_data();
    $home = $content['home'];
    $title = e($home['title']);
    $desc = e($home['description']);

    $out = preg_replace_callback('/<title>.*?<\/title>/is', fn($m) => '<title>' . $title . '</title>', $html, 1);
    if ($out !== null) $html = $out;
    $swap = [
        '/(<meta\s+name=["\']description["\']\s+content=")[^"]*(")/i' => $desc,
        '/(<meta\s+property=["\']og:title["\']\s+content=")[^"]*(")/i' => $title,
        '/(<meta\s+property=["\']og:description["\']\s+content=")[^"]*(")/i' => $desc,
        '/(<meta\s+name=["\']twitter:title["\']\s+content=")[^"]*(")/i' => $title,
        '/(<meta\s+name=["\']twitter:description["\']\s+content=")[^"]*(")/i' => $desc,
    ];
    foreach ($swap as $pattern => $value) {
        $out = preg_replace_callback($pattern, fn($m) => $m[1] . $value . $m[2], $html, 1);
        if ($out !== null) $html = $out;
    }

    $head = '<link rel="alternate" hreflang="en" href="' . SEO_SITE . '/">';
    if (seo_content('ar')) $head .= '<link rel="alternate" hreflang="ar" href="' . SEO_SITE . '/ar/">';
    $head .= '<link rel="alternate" hreflang="x-default" href="' . SEO_SITE . '/">';
    $head .= seo_jsonld([
        seo_business_node($data, $home['description']),
        seo_person_node($data),
        ['@type' => 'WebSite', '@id' => SEO_SITE . '/#website', 'url' => SEO_SITE . '/', 'name' => 'Mahmoud Adel | Freelance Videographer in Dubai', 'inLanguage' => ['en', 'ar'], 'publisher' => ['@id' => SEO_SITE . '/#business']],
    ]);
    $head .= SEO_HOME_STYLE;

    $pos = stripos($html, '</head>');
    if ($pos !== false) $html = substr($html, 0, $pos) . $head . substr($html, $pos);
    $root = '<div id="root"></div>';
    $pos = strpos($html, $root);
    if ($pos !== false) $html = substr($html, 0, $pos) . '<div id="root">' . seo_home_block($content, $data) . '</div>' . substr($html, $pos + strlen($root));
    return $html;
}
