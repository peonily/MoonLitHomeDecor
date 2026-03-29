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

function matchCase(replacement, match) {
  if (match.toUpperCase() === match) {
    return replacement.toUpperCase();
  }
  if (match[0] && match[0].toUpperCase() === match[0]) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const replacements = [
  { re: /\bperfect for\b/gi, replace: 'ideal for' },
  { re: /\bideal for\b/gi, replace: 'well-suited to' },
  { re: /\bdesigned for\b/gi, replace: 'made for' },
  { re: /\bdesigned to\b/gi, replace: 'built to' },
  { re: /\ballows you to\b/gi, replace: 'lets you' },
  { re: /\ballows for\b/gi, replace: 'supports' },
  { re: /\bprovides\b/gi, replace: 'offers' },
  { re: /\bfeatures\b/gi, replace: 'includes' },
  { re: /\bdurable\b/gi, replace: 'sturdy' },
  { re: /\bsturdy\b/gi, replace: 'solid' },
  { re: /\bhigh[- ]quality\b/gi, replace: 'quality-made' },
  { re: /\beasy to clean\b/gi, replace: 'easy to wipe down' },
  { re: /\beasy to assemble\b/gi, replace: 'simple to assemble' },
  { re: /\beasy to install\b/gi, replace: 'simple to install' },
  { re: /\bbreathable\b/gi, replace: 'airy' },
  { re: /\bmachine washable\b/gi, replace: 'machine-washable' },
  { re: /\bnon[- ]slip\b/gi, replace: 'slip-resistant' },
  { re: /\bhandmade\b/gi, replace: 'handcrafted' },
  { re: /\bmade of\b/gi, replace: 'crafted from' },
  { re: /\bmade from\b/gi, replace: 'crafted from' },
  { re: /\bset of (\d+)\b/gi, replace: '{n}-piece set' },
  { re: /\bpack of (\d+)\b/gi, replace: '{n}-pack' },
];

function applyReplacements(text) {
  let out = text;
  replacements.forEach((rule) => {
    out = out.replace(rule.re, (match, num) => {
      const replacement = num ? rule.replace.replace('{n}', num) : rule.replace;
      return matchCase(replacement, match);
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
  out = out.replace(/\bd\s*b\b/gi, 'dB');
  return out;
}

function sentenceCaseHeading(label) {
  let result = label.toLowerCase();
  result = fixAcronyms(result);
  result = result.charAt(0).toUpperCase() + result.slice(1);
  return result;
}

let updatedCount = 0;
let updatedItems = 0;

productFiles.forEach((file) => {
  let html = fs.readFileSync(path.join(cwd, file), 'utf8');
  const listMatch = html.match(/(^[ \t]*)<ul class="feature-list">([\s\S]*?)^\1<\/ul>/m);
  if (!listMatch) {
    return;
  }

  const indent = listMatch[1];
  const listInner = listMatch[2];
  const items = Array.from(listInner.matchAll(/<li>([\s\S]*?)<\/li>/g));
  if (items.length === 0) {
    return;
  }

  const rewritten = items.map((item) => {
    let text = normalizeSpaces(decodeHtml(item[1]));

    text = text.replace(/^([A-Z]{3,})([A-Z][a-z])/g, '$1 $2');
    text = text.replace(/\b([A-Za-z])([0-9])(?=[A-Z])/g, '$1 $2');

    const headingMatch = text.match(/^([A-Z0-9][A-Z0-9 &/.,'"()\-]+?)(?=\s+[A-Z][a-z]|\s+[a-z])/);
    if (headingMatch) {
      let heading = headingMatch[1].trim();
      heading = heading.replace(/[-:]+$/, '').trim();
      heading = heading.replace(/\b\d+\b/g, '').trim();
      const rest = text.slice(headingMatch[0].length).replace(/^[-:\s]+/, '').trim();
      if (heading.length >= 3 && !/[a-z]/.test(heading)) {
        const formattedHeading = sentenceCaseHeading(heading);
        text = `${formattedHeading}. ${rest}`;
      }
    }

    text = text.replace(/(^|[.;])\s*\d+\s+(?=[A-Z][a-z])/g, '$1 ');

    text = text.replace(/\blets you placement\b/gi, 'lets you place it');
    text = text.replace(/\blets you easy conversion\b/gi, 'makes it easy to convert');

    text = applyReplacements(text);
    text = fixAcronyms(text);
    text = normalizeSpaces(text);

    if (!/[.!?]$/.test(text)) {
      text += '.';
    }

    return encodeHtml(text);
  });

  updatedItems += rewritten.length;
  const itemIndent = `${indent}  `;
  const newList = [
    `${indent}<ul class="feature-list">`,
    ...rewritten.map((text) => `${itemIndent}<li>${text}</li>`),
    `${indent}</ul>`,
  ].join('\n');

  html = html.replace(/(^[ \t]*)<ul class="feature-list">[\s\S]*?^\1<\/ul>/m, newList);
  fs.writeFileSync(path.join(cwd, file), html, 'utf8');
  updatedCount += 1;
});

console.log(`Updated ${updatedCount} product pages.`);
console.log(`Rewrote ${updatedItems} feature bullets.`);
