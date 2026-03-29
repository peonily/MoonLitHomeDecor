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
let updatedCrumbs = 0;

productFiles.forEach((file) => {
  let html = fs.readFileSync(path.join(cwd, file), 'utf8');
  let changed = false;

  const h1Match = html.match(/<h1>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const titleEnc = h1Match[1].trim();
    const crumbRegex = /(<nav class="crumb"[\s\S]*?<span>)([\s\S]*?)(<\/span>)/i;
    if (crumbRegex.test(html)) {
      html = html.replace(crumbRegex, `$1${titleEnc}$3`);
      updatedCrumbs += 1;
      changed = true;
    }
  }

  const listMatch = html.match(/(^[ \t]*)<ul class="feature-list">([\s\S]*?)^\1<\/ul>/m);
  if (listMatch) {
    const indent = listMatch[1];
    const listInner = listMatch[2];
    const items = Array.from(listInner.matchAll(/<li>([\s\S]*?)<\/li>/g));
    if (items.length > 0) {
      const rewritten = items.map((item) => {
        let text = normalizeSpaces(decodeHtml(item[1]));

        text = text.replace(/\blets you placement\b/gi, 'lets you place it');
        text = text.replace(/\blets you easy conversion\b/gi, 'makes it easy to convert');

        const capsMatch = text.match(/^([A-Z0-9][A-Z0-9 &/.,'"()\-]+):\s*(.+)$/);
        if (capsMatch) {
          const heading = sentenceCaseHeading(capsMatch[1]);
          text = `${heading}. ${capsMatch[2]}`;
        }

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
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(path.join(cwd, file), html, 'utf8');
    updatedCount += 1;
  }
});

console.log(`Updated ${updatedCount} product pages.`);
console.log(`Normalized ${updatedItems} feature bullets.`);
console.log(`Updated breadcrumbs in ${updatedCrumbs} pages.`);
