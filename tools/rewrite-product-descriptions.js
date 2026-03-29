const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const productFiles = fs.readdirSync(cwd).filter((file) => /^product-.*\.html$/i.test(file));

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function encodeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeSpaces(str) {
  return str.replace(/\s+/g, ' ').trim();
}

function firstSentence(text) {
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts[0] || text;
}

function truncateTo(text, maxLen) {
  if (text.length <= maxLen) {
    return text;
  }
  let trimmed = text.slice(0, maxLen - 3).replace(/\s+\S*$/, '').trim();
  trimmed = trimmed.replace(/[\s.,;:]+$/, '').trim();
  return (trimmed || text.slice(0, maxLen - 3)).trim() + '...';
}

function buildDescriptions(title, bullets) {
  const productName = normalizeSpaces(title.replace(/\s+by\s+.+$/i, ''));
  const sentences = bullets
    .map((b) => normalizeSpaces(decodeHtml(b)))
    .map((b) => firstSentence(b))
    .filter(Boolean);

  let meta = '';
  if (sentences.length >= 2) {
    meta = `${sentences[0]} ${sentences[1]}`;
    if (meta.length > 160) {
      meta = sentences[0];
    }
  } else if (sentences.length === 1) {
    meta = sentences[0];
  } else {
    meta = `${productName} curated for calm interiors with practical details and a refined look.`;
  }
  meta = normalizeSpaces(meta);
  if (!/[.!?]$/.test(meta)) {
    meta += '.';
  }
  meta = truncateTo(meta, 160);

  let muted = sentences[0] || `${productName} curated for calm interiors with practical details and a refined look.`;
  muted = normalizeSpaces(muted);
  if (!/[.!?]$/.test(muted)) {
    muted += '.';
  }
  if (muted.length < 70 && sentences.length > 1) {
    muted = normalizeSpaces(`${muted} ${sentences[1]}`);
    if (!/[.!?]$/.test(muted)) {
      muted += '.';
    }
  }
  muted = truncateTo(muted, 170);

  return { meta, muted };
}

let updated = 0;

productFiles.forEach((file) => {
  let html = fs.readFileSync(path.join(cwd, file), 'utf8');

  const h1Match = html.match(/<h1>([\s\S]*?)<\/h1>/i);
  if (!h1Match) {
    return;
  }
  const title = decodeHtml(h1Match[1].trim());

  const listMatch = html.match(/<ul class="feature-list">([\s\S]*?)<\/ul>/i);
  const bulletMatches = listMatch ? Array.from(listMatch[1].matchAll(/<li>([\s\S]*?)<\/li>/g)) : [];
  const bullets = bulletMatches.map((m) => m[1]);

  const { meta, muted } = buildDescriptions(title, bullets);
  const metaEnc = encodeHtml(meta);
  const mutedEnc = encodeHtml(muted);

  const before = html;

  html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/i, () => {
    return `<meta name="description" content="${metaEnc}" />`;
  });

  html = html.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/i, () => {
    return `<meta property="og:description" content="${metaEnc}" />`;
  });

  html = html.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/i, () => {
    return `<meta name="twitter:description" content="${metaEnc}" />`;
  });

  html = html.replace(/(<script type="application\/ld\+json">[\s\S]*?"@type"\s*:\s*"Product"[\s\S]*?"description"\s*:\s*")([^"]*)(")/i, (match, pre, desc, post) => {
    const metaJson = meta.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `${pre}${metaJson}${post}`;
  });

  html = html.replace(/<p class="muted">([\s\S]*?)<\/p>/i, `<p class="muted">${mutedEnc}</p>`);

  if (html !== before) {
    fs.writeFileSync(path.join(cwd, file), html, 'utf8');
    updated += 1;
  }
});

console.log(`Updated meta descriptions and muted intros in ${updated} product pages.`);
