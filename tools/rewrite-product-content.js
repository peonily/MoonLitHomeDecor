const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const productFiles = fs.readdirSync(cwd).filter((file) => /^product-.*\.html$/i.test(file));

const titleMap = [];

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

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function matchCase(replacement, match) {
  if (match.toUpperCase() === match) {
    return replacement.toUpperCase();
  }
  if (match[0] && match[0].toUpperCase() === match[0]) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const phraseReplacements = [
  { re: /\bperfect for\b/gi, variants: ['ideal for', 'great for', 'well-suited to'] },
  { re: /\bideal for\b/gi, variants: ['well-suited to', 'great for', 'a good fit for'] },
  { re: /\bdesigned for\b/gi, variants: ['made for', 'built for', 'created for'] },
  { re: /\bdesigned to\b/gi, variants: ['made to', 'built to'] },
  { re: /\ballows you to\b/gi, variants: ['lets you', 'makes it easy to'] },
  { re: /\ballows for\b/gi, variants: ['lets you', 'makes it easy to'] },
  { re: /\bprovides\b/gi, variants: ['offers', 'delivers', 'gives'] },
  { re: /\bfeatures\b/gi, variants: ['includes', 'offers', 'brings'] },
  { re: /\bdurable\b/gi, variants: ['sturdy', 'long-lasting'] },
  { re: /\bsturdy\b/gi, variants: ['solid', 'durable'] },
  { re: /\bhigh[- ]quality\b/gi, variants: ['quality-made', 'well-made'] },
  { re: /\beasy to clean\b/gi, variants: ['simple to wipe clean', 'easy to wipe down'] },
  { re: /\beasy to assemble\b/gi, variants: ['simple to put together', 'quick to assemble'] },
  { re: /\beasy to install\b/gi, variants: ['simple to install', 'quick to install'] },
  { re: /\bbreathable\b/gi, variants: ['airy', 'breathable'] },
  { re: /\bmachine washable\b/gi, variants: ['machine-washable', 'easy to machine wash'] },
  { re: /\bnon[- ]slip\b/gi, variants: ['slip-resistant', 'non-slip'] },
  { re: /\bhandmade\b/gi, variants: ['handcrafted', 'handmade'] },
  { re: /\bmade of\b/gi, variants: ['crafted from', 'made from'] },
  { re: /\bmade from\b/gi, variants: ['crafted from', 'made from'] },
  { re: /\bmodern\b/gi, variants: ['modern', 'contemporary'] },
  { re: /\bvintage\b/gi, variants: ['vintage', 'retro-inspired'] },
  { re: /\bfarmhouse\b/gi, variants: ['farmhouse', 'country'] },
  { re: /\bminimalist\b/gi, variants: ['minimal', 'clean-lined'] },
  { re: /\bclassic\b/gi, variants: ['timeless', 'classic'] },
  { re: /\bversatile\b/gi, variants: ['flexible', 'versatile'] },
  { re: /\bmulti[- ]functional\b/gi, variants: ['multi-purpose', 'multi-functional'] },
  { re: /\bmulti purpose\b/gi, variants: ['multi-purpose', 'multi-functional'] },
  { re: /\bset of (\d+)\b/gi, variants: ['{n}-piece set'] },
  { re: /\bpack of (\d+)\b/gi, variants: ['{n}-pack'] },
];

function applyReplacements(text, seed) {
  let out = text;
  phraseReplacements.forEach((rule, idx) => {
    out = out.replace(rule.re, (match, num) => {
      const variants = rule.variants;
      const choiceRaw = variants[(seed + idx) % variants.length];
      const choice = num ? choiceRaw.replace('{n}', num) : choiceRaw;
      return matchCase(choice, match);
    });
  });
  return out;
}

function fixAcronyms(text) {
  let out = text;
  const map = {
    usb: 'USB',
    led: 'LED',
    rgb: 'RGB',
    aaa: 'AAA',
    aa: 'AA',
    ac: 'AC',
    dc: 'DC',
    hd: 'HD',
    tv: 'TV',
    pc: 'PC',
    xl: 'XL',
    xxl: 'XXL',
    db: 'dB',
    '3d': '3D',
    '4k': '4K',
    '5g': '5G',
    usbc: 'USB-C',
  };
  out = out.replace(/\b([a-z0-9]{2,4})\b/gi, (word) => {
    const key = word.toLowerCase();
    return map[key] || word;
  });
  out = out.replace(/\busb-c\b/gi, 'USB-C');
  return out;
}

function sentenceCaseHeading(label) {
  let result = label.toLowerCase();
  result = fixAcronyms(result);
  result = result.charAt(0).toUpperCase() + result.slice(1);
  return result;
}

function rewriteBullet(bullet, seed) {
  let text = normalizeSpaces(decodeHtml(bullet));
  const capsMatch = text.match(/^([A-Z0-9][A-Z0-9 &/.,'"-]+):\s*(.+)$/);
  if (capsMatch) {
    const heading = sentenceCaseHeading(capsMatch[1]);
    text = `${heading}. ${capsMatch[2]}`;
  }

  text = applyReplacements(text, seed);
  text = fixAcronyms(text);
  text = normalizeSpaces(text);

  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (!/[.!?]$/.test(text)) {
    text += '.';
  }
  return encodeHtml(text);
}

function applyTitleReplacements(text) {
  let out = text;
  out = out.replace(/\bSet of (\d+)\b/gi, (match, num) => `${num}-piece set`);
  out = out.replace(/\bSet of Two\b/gi, '2-piece set');
  out = out.replace(/\bSet of Three\b/gi, '3-piece set');
  out = out.replace(/\bSet of Four\b/gi, '4-piece set');
  out = out.replace(/\bSet of Five\b/gi, '5-piece set');
  out = out.replace(/\bSet of Six\b/gi, '6-piece set');
  out = out.replace(/\bPack of (\d+)\b/gi, (match, num) => `${num}-pack`);
  out = out.replace(/\bBattery[- ]Operated\b/gi, 'Cordless');
  out = out.replace(/\bDecorative\b/gi, 'Accent');
  out = out.replace(/\bVintage\b/gi, 'Vintage-style');
  out = out.replace(/\bQueen Size\b/gi, 'Queen-size');
  out = out.replace(/\bKing Size\b/gi, 'King-size');
  out = out.replace(/\bFull Size\b/gi, 'Full-size');
  out = out.replace(/\bTwin Size\b/gi, 'Twin-size');
  out = out.replace(/\bw\//gi, 'with');
  return normalizeSpaces(out);
}

function shortenTitle(text) {
  let out = text;
  if (out.length > 110) {
    const split = out.split(/\s[-–—]\s|:\s/);
    if (split[0] && split[0].length >= 20) {
      out = split[0].trim();
    }
  }
  const words = out.split(/\s+/);
  if (words.length > 14) {
    out = words.slice(0, 14).join(' ');
  }
  return out;
}

function rewriteTitle(oldTitleDec, brandDec, seed) {
  const title = normalizeSpaces(oldTitleDec);
  const brand = normalizeSpaces(brandDec || '');
  let remainder = title;
  if (brand && title.toLowerCase().startsWith(brand.toLowerCase())) {
    remainder = title.slice(brand.length).trim();
    remainder = remainder.replace(/^[-–:]+/, '').trim();
  }
  remainder = applyTitleReplacements(remainder);
  remainder = shortenTitle(remainder);
  if (brand && remainder) {
    return `${remainder} by ${brand}`;
  }
  return remainder || title;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let updatedProductCount = 0;
let updatedFeatureCount = 0;

productFiles.forEach((file) => {
  let html = fs.readFileSync(path.join(cwd, file), 'utf8');

  const h1Match = html.match(/<h1>([\s\S]*?)<\/h1>/i);
  if (!h1Match) {
    return;
  }

  const oldTitleEnc = h1Match[1].trim();
  const oldTitleDec = decodeHtml(oldTitleEnc);

  let brandEnc = '';
  const brandMeta = html.match(/<meta\s+property="product:brand"\s+content="([^"]+)"/i);
  if (brandMeta) {
    brandEnc = brandMeta[1];
  } else {
    const brandJson = html.match(/"brand"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]+)"/i);
    if (brandJson) {
      brandEnc = brandJson[1];
    }
  }
  const brandDec = decodeHtml(brandEnc);

  const seed = hashString(oldTitleDec);
  const newTitleDec = rewriteTitle(oldTitleDec, brandDec, seed);
  const newTitleEnc = encodeHtml(newTitleDec);

  if (newTitleDec === oldTitleDec) {
    return;
  }

  const oldTitleEncEscaped = escapeRegExp(oldTitleEnc);
  const oldTitleDecEscaped = escapeRegExp(oldTitleDec);

  html = html.replace(/<title>([\s\S]*?)<\/title>/i, (match, inner) => {
    return `<title>${inner.replace(oldTitleEnc, newTitleEnc)}</title>`;
  });

  html = html.replace(/(<meta[^>]*property="og:title"[^>]*content=")([^"]*)(")/i, (match, pre, content, post) => {
    if (content.includes(oldTitleEnc)) {
      return `${pre}${content.replace(oldTitleEnc, newTitleEnc)}${post}`;
    }
    return match;
  });

  html = html.replace(/(<meta[^>]*name="twitter:title"[^>]*content=")([^"]*)(")/i, (match, pre, content, post) => {
    if (content.includes(oldTitleEnc)) {
      return `${pre}${content.replace(oldTitleEnc, newTitleEnc)}${post}`;
    }
    return match;
  });

  const nameRegex = new RegExp(`("name"\\s*:\\s*")${oldTitleDecEscaped}(\")`);
  html = html.replace(nameRegex, `$1${newTitleDec}$2`);

  html = html.replace(/<h1>([\s\S]*?)<\/h1>/i, `<h1>${newTitleEnc}</h1>`);

  const crumbRegex = new RegExp(`<span>${oldTitleEncEscaped}<\\/span>`);
  html = html.replace(crumbRegex, `<span>${newTitleEnc}</span>`);

  html = html.replace(/(<meta[^>]*property="og:image:alt"[^>]*content=")([^"]*)(")/gi, (match, pre, content, post) => {
    if (content.includes(oldTitleEnc)) {
      return `${pre}${content.replace(oldTitleEnc, newTitleEnc)}${post}`;
    }
    return match;
  });

  html = html.replace(/(<img[^>]*alt=")([^"]*)(")/gi, (match, pre, content, post) => {
    if (content.includes(oldTitleEnc)) {
      return `${pre}${content.replace(oldTitleEnc, newTitleEnc)}${post}`;
    }
    return match;
  });

  const listMatch = html.match(/(^[ \t]*)<ul class="feature-list">([\s\S]*?)^\1<\/ul>/m);
  if (listMatch) {
    const indent = listMatch[1];
    const listInner = listMatch[2];
    const items = Array.from(listInner.matchAll(/<li>([\s\S]*?)<\/li>/g));
    if (items.length > 0) {
      const rewritten = items.map((item, idx) => rewriteBullet(item[1], seed + idx));
      updatedFeatureCount += rewritten.length;
      const itemIndent = `${indent}  `;
      const newList = [
        `${indent}<ul class="feature-list">`,
        ...rewritten.map((text) => `${itemIndent}<li>${text}</li>`),
        `${indent}</ul>`,
      ].join('\n');
      html = html.replace(/(^[ \t]*)<ul class="feature-list">[\s\S]*?^\1<\/ul>/m, newList);
    }
  }

  fs.writeFileSync(path.join(cwd, file), html, 'utf8');
  titleMap.push({ oldEnc: oldTitleEnc, newEnc: newTitleEnc, oldDec: oldTitleDec, newDec: newTitleDec });
  updatedProductCount += 1;
});

const allHtmlFiles = fs
  .readdirSync(cwd)
  .filter((file) => file.endsWith('.html') && !/^product-.*\.html$/i.test(file));

let updatedOtherCount = 0;

allHtmlFiles.forEach((file) => {
  let html = fs.readFileSync(path.join(cwd, file), 'utf8');
  let changed = false;

  titleMap.forEach(({ oldEnc, newEnc, oldDec }) => {
    if (html.includes(oldEnc)) {
      html = html.split(oldEnc).join(newEnc);
      changed = true;
    }
    if (oldDec && html.includes(oldDec)) {
      html = html.split(oldDec).join(newEnc);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(path.join(cwd, file), html, 'utf8');
    updatedOtherCount += 1;
  }
});

console.log(`Updated product pages: ${updatedProductCount}`);
console.log(`Rewritten feature bullets: ${updatedFeatureCount}`);
console.log(`Updated non-product pages: ${updatedOtherCount}`);
