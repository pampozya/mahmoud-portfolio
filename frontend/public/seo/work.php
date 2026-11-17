<?php
declare(strict_types=1);

// One page per film: /work/<id>-<slug>/  (routed from .htaccess as work.php?id=<id>)

require __DIR__ . '/lib.php';

$id = (int) ($_GET['id'] ?? 0);
$data = seo_data();
$content = seo_content('en');
$item = $data['items'][$id] ?? null;
if (!$content || !$item) seo_not_found();
$ui = $content['ui'];

// One address per film: anything else redirects to it.
$path = seo_work_path($item);
$requested = strtok((string) ($_SERVER['REQUEST_URI'] ?? ''), '?');
if ($requested !== false && $requested !== '' && $requested !== $path && strpos($requested, '/work/') === 0) {
    header('Location: ' . $path, true, 301);
    exit;
}

$title = seo_clean($item['title'], 110);
$category = seo_category_name($data, $item['category_id'], 'en');
$body = trim((string) ($item['description'] ?? ''));
$metaDesc = seo_clean($item['seo_description'] ?? '', 160);
if ($metaDesc === '') $metaDesc = seo_clean($body, 160);
if ($metaDesc === '') $metaDesc = seo_clean($title . '. ' . $category . ' film by Mahmoud Adel, videographer in Dubai.', 160);
$metaTitle = seo_clean($item['seo_title'] ?? '');
if ($metaTitle === '' || mb_strlen($metaTitle) > 65) $metaTitle = seo_clean($title, 46) . ' | Mahmoud Adel';

$thumb = seo_abs($item['thumbnail_url'] ?? '');
$videoUrl = trim((string) ($item['video_url'] ?? ''));
$isDirect = ($item['video_type'] ?? '') === 'direct' && preg_match('#^https?://#i', $videoUrl);
$vertical = ($item['aspect_ratio'] ?? '') === '9:16';
$published = substr((string) ($item['created_at'] ?? ''), 0, 10);

$credits = [];
$rawCredits = $item['collaborators'] ?? null;
if (is_string($rawCredits) && $rawCredits !== '') {
    $decoded = json_decode($rawCredits, true);
    if (is_array($decoded)) $rawCredits = $decoded;
    else $credits[] = ['handle' => $rawCredits, 'role' => '', 'url' => ''];
}
if (is_array($rawCredits)) {
    foreach ($rawCredits as $c) {
        if (!is_array($c) || trim((string) ($c['handle'] ?? '')) === '') continue;
        $credits[] = ['handle' => trim((string) $c['handle']), 'role' => trim((string) ($c['role'] ?? '')), 'url' => trim((string) ($c['url'] ?? ''))];
    }
}

$video = [
    '@type' => 'VideoObject',
    '@id' => SEO_SITE . $path . '#video',
    'name' => $title,
    'description' => $metaDesc,
    'url' => SEO_SITE . $path,
    'creator' => ['@id' => SEO_SITE . '/#person'],
    'publisher' => ['@id' => SEO_SITE . '/#business'],
];
if ($thumb !== '') $video['thumbnailUrl'] = [$thumb];
if (!empty($item['created_at'])) $video['uploadDate'] = (string) $item['created_at'];
if ($isDirect) $video['contentUrl'] = $videoUrl;
if ($category !== '') $video['genre'] = $category;

seo_head([
    'lang' => 'en',
    'title' => $metaTitle,
    'description' => $metaDesc,
    'path' => $path,
    'image' => $thumb,
    'type' => 'video.other',
    'jsonld' => [
        $video,
        seo_person_node($data),
        seo_business_node($data, $content['home']['description'] ?? ''),
        seo_breadcrumb(['Mahmoud Adel' => '/', $ui['all_work_h1'] ?? 'All work' => '/work/', $title => $path]),
    ],
], $content);

echo '<article class="wrap film' . ($vertical ? ' film-v' : '') . '"><div class="film-media">';
if ($isDirect) {
    echo '<video controls playsinline preload="none"' . ($thumb !== '' ? ' poster="' . e($thumb) . '"' : '') . '><source src="' . e($videoUrl) . '" type="video/mp4"></video>';
} elseif ($thumb !== '') {
    echo '<a href="/?item=' . $item['id'] . '"><img src="' . e($thumb) . '" alt="' . e($title) . '"></a>';
}
echo '</div><div class="film-info"><p class="kicker">' . e($category) . '</p><h1 dir="auto">' . e($title) . '</h1>';
if ($body !== '') echo '<div class="film-desc" dir="auto">' . nl2br(e($body)) . '</div>';
echo '<dl class="meta">';
if ($category !== '') echo '<div><dt>' . e($ui['category_label'] ?? 'Category') . '</dt><dd>' . e($category) . '</dd></div>';
if ($published !== '') echo '<div><dt>' . e($ui['published_label'] ?? 'Published') . '</dt><dd><time datetime="' . e($published) . '">' . e($published) . '</time></dd></div>';
if (!empty($item['aspect_ratio'])) echo '<div><dt>' . e($ui['format_label'] ?? 'Format') . '</dt><dd>' . e((string) $item['aspect_ratio']) . '</dd></div>';
if ($credits) {
    echo '<div><dt>' . e($ui['credits_label'] ?? 'Credits') . '</dt><dd>';
    $parts = [];
    foreach ($credits as $c) {
        $name = preg_match('#^https?://#i', $c['url']) ? '<a href="' . e($c['url']) . '" target="_blank" rel="noopener nofollow">' . e($c['handle']) . '</a>' : e($c['handle']);
        $parts[] = $name . ($c['role'] !== '' ? ' <span>' . e($c['role']) . '</span>' : '');
    }
    echo implode(', ', $parts) . '</dd></div>';
}
echo '</dl><p class="actions">';
$contact = seo_contact($data);
if ($wa = seo_wa_link($contact, 'I want to book a project like "' . $title . '"')) {
    echo '<a class="btn btn-wa" href="' . e($wa) . '" target="_blank" rel="noopener">' . e($ui['cta_whatsapp'] ?? 'WhatsApp') . '</a>';
}
echo '<a class="btn" href="/?item=' . $item['id'] . '">' . e($ui['watch_in_portfolio'] ?? 'Open in the portfolio') . '</a></p></div></article>';

$related = array_filter($data['items'], fn($other) => $other['category_id'] === $item['category_id'] && $other['id'] !== $item['id']);
if ($related) {
    echo '<section class="wrap group"><h2>' . e($ui['related_heading'] ?? 'Related') . '</h2>' . seo_cards($related, $data, 'en', 6) . '</section>';
}
echo '<div class="wrap">' . seo_contact_block($content, $data, 'en', 'I want to book a project like "' . $title . '"') . '</div>';
seo_foot($content, $data, 'en');
