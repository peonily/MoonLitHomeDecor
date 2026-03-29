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
  const h1Match = html.match(/<h1>([\s\S]*?)<\/h1>/i);
  if (!h1Match) {
    return;
  }
  const titleDec = decodeHtml(h1Match[1].trim());
  const titleJson = escapeJsonString(titleDec);

  const before = html;
  html = html.replace(/("@type"\s*:\s*"Product"[\s\S]*?"name"\s*:\s*")([^"]*)(")/i, `$1${titleJson}$3`);

  if (html !== before) {
    fs.writeFileSync(path.join(cwd, file), html, 'utf8');
    updated += 1;
  }
});

console.log(`Updated JSON-LD product names in ${updated} pages.`);
