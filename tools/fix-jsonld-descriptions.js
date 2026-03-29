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

function escapeJsonString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

let updated = 0;

productFiles.forEach((file) => {
  let html = fs.readFileSync(path.join(cwd, file), 'utf8');
  const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"\s*\/>/i);
  if (!metaMatch) {
    return;
  }
  const metaDec = decodeHtml(metaMatch[1]);
  const metaJson = escapeJsonString(metaDec);

  const before = html;
  html = html.replace(/("@type"\s*:\s*"Product"[\s\S]*?"description"\s*:\s*")([^"]*)(")/i, `$1${metaJson}$3`);

  if (html !== before) {
    fs.writeFileSync(path.join(cwd, file), html, 'utf8');
    updated += 1;
  }
});

console.log(`Fixed JSON-LD descriptions in ${updated} pages.`);
