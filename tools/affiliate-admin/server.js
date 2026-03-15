const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const PUBLIC_DIR = path.join(__dirname, "public");
const CATEGORIES_PATH = path.join(ROOT_DIR, "categories.html");
const SITE_URL = "https://moonlithomedecor.com";
const PORT = Number(process.env.PORT || 4311);

const AMAZON_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
};

const DEPARTMENTS = [
  { id: "decor", label: "Decor" },
  { id: "decor-pillows", label: "Decor & Pillows" },
  { id: "furniture", label: "Furniture" },
  { id: "kitchen", label: "Kitchen" },
  { id: "lighting", label: "Lighting" },
  { id: "outdoor", label: "Outdoor" },
  { id: "rugs", label: "Rugs" },
  { id: "bedding-bath", label: "Bedding & Bath" },
];

const ROOMS = [
  { id: "living-room", label: "Living Room" },
  { id: "bedroom", label: "Bedroom" },
  { id: "kitchen", label: "Kitchen" },
  { id: "small-spaces", label: "Small Spaces" },
  { id: "garden", label: "Garden" },
  { id: "bathroom", label: "Bathroom" },
];

const FILTERABLE_DEPARTMENTS = new Set(["furniture", "kitchen", "outdoor"]);
const FILTERABLE_ROOMS = new Set(["living-room", "bedroom", "kitchen", "small-spaces", "garden"]);

const DEPARTMENT_FALLBACKS = [
  { id: "lighting", keywords: ["lamp", "lighting", "light", "lantern", "sconce", "chandelier", "pendant"] },
  { id: "rugs", keywords: ["rug", "runner"] },
  { id: "outdoor", keywords: ["outdoor", "patio", "garden", "porch", "bistro", "swing", "rocking chair"] },
  { id: "kitchen", keywords: ["bar stool", "stool", "dining", "kitchen", "tea cup", "saucer", "tablecloth"] },
  { id: "bedding-bath", keywords: ["quilt", "comforter", "bedding", "bath", "bathroom", "shower"] },
  { id: "decor-pillows", keywords: ["pillow", "cushion"] },
  {
    id: "decor",
    keywords: ["mirror", "vase", "flowers", "tray", "wall art", "book box", "decor", "basket", "jewelry"],
  },
  {
    id: "furniture",
    keywords: ["table", "dresser", "nightstand", "bed", "bookshelf", "chair", "sofa", "cabinet", "vanity", "desk"],
  },
];

const ROOM_FALLBACKS = [
  { id: "garden", keywords: ["outdoor", "patio", "garden", "porch", "swing", "bistro"] },
  { id: "kitchen", keywords: ["kitchen", "dining", "bar stool", "tea cup", "saucer", "tablecloth", "buffet"] },
  { id: "bathroom", keywords: ["bathroom", "bath", "toilet"] },
  { id: "small-spaces", keywords: ["small space", "compact", "narrow", "apartment", "entryway", "corner"] },
  { id: "bedroom", keywords: ["bedroom", "nightstand", "dresser", "bed", "headboard", "vanity", "quilt"] },
  { id: "living-room", keywords: ["living room", "sofa", "sectional", "coffee table", "tv stand", "lamp", "bookshelf"] },
];

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeJson(value) {
  return JSON.stringify(value, null, 8).replace(/<\/script/gi, "<\\/script");
}

function toAsciiText(value) {
  return String(value ?? "")
    .replace(/[â€™â€˜]/g, "'")
    .replace(/[â€œâ€]/g, '"')
    .replace(/[â€“â€”]/g, "-")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function decodeHtml(value) {
  if (!value) return "";
  const named = {
    amp: "&",
    quot: '"',
    apos: "'",
    nbsp: " ",
    lt: "<",
    gt: ">",
    mdash: "-",
    ndash: "-",
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    trade: "TM",
    reg: "(R)",
    copy: "(C)",
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, token) => {
    if (token[0] === "#") {
      const isHex = token[1]?.toLowerCase() === "x";
      const codePoint = parseInt(token.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    }
    return Object.prototype.hasOwnProperty.call(named, token) ? named[token] : _;
  });
}

function stripTags(value) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
}

function cleanText(value) {
  return toAsciiText(decodeHtml(stripTags(value || "")))
    .replace(/[\u3010\u3011]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function toSentenceCase(value) {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function normalizeInchCopy(value) {
  return value
    .replace(/(\d+)\s*Inch\b/gi, "$1-inch")
    .replace(/(\d+)\s*Inches\b/gi, "$1-inch")
    .replace(/\bTV\b/g, "TV");
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) return value;
  const short = value.slice(0, maxLength - 1);
  const lastSpace = short.lastIndexOf(" ");
  return `${short.slice(0, Math.max(lastSpace, 0))}...`;
}

function titleFromAmazonTitle(fullTitle, brand) {
  const primary = cleanText(fullTitle).split(",")[0] || cleanText(fullTitle);
  const normalized = normalizeInchCopy(primary).replace(/\s+/g, " ").trim();
  if (!brand) return normalized;
  const brandPattern = new RegExp(`^${escapeRegExp(brand)}\\s+`, "i");
  const withoutBrand = normalized.replace(brandPattern, "").trim();
  return withoutBrand ? `${brand} ${withoutBrand}` : normalized;
}

function normalizeBrand(rawBrand, fullTitle) {
  const cleaned = cleanText(rawBrand)
    .replace(/^Visit the\s+/i, "")
    .replace(/\s+Store$/i, "")
    .replace(/^Brand:\s*/i, "")
    .trim();
  return cleaned || cleanText(fullTitle).split(/\s+/).slice(0, 2).join(" ");
}

function normalizeBulletCopy(value) {
  const text = cleanText(value).replace(/^\[[^\]]+\]\s*/g, "").trim();
  const hardStarts = ["This", "More than", "Constructed", "Built", "Use", "With its", "Designed", "Made"];
  for (const start of hardStarts) {
    const normalized = text.replace(new RegExp(`^[^.!?]{0,48}\\b(${escapeRegExp(start)})\\b`, "i"), "$1");
    if (normalized !== text) return toSentenceCase(normalized.trim());
  }
  return text;
}

function chooseBestBullets(bullets) {
  return bullets
    .map((bullet) => normalizeBulletCopy(bullet))
    .filter(Boolean)
    .filter((bullet) => bullet.length > 35)
    .filter((bullet) => !/^\d/.test(bullet))
    .slice(0, 4);
}

function deriveSummary(bullets, shortTitle) {
  if (bullets[0]) return truncate(toSentenceCase(bullets[0]), 170);
  return `${shortTitle} with Pinterest-ready product details and practical buying context.`;
}

function deriveCardCopy(bullets, shortTitle) {
  const candidate = bullets.find((bullet) => !/^\d/.test(bullet)) || bullets[0];
  if (candidate) return truncate(toSentenceCase(candidate), 165);
  return `A practical ${shortTitle.toLowerCase()} pick for polished rooms and everyday use.`;
}

function deriveMetaDescription(shortTitle, cardCopy) {
  return truncate(`Affiliate pick: ${shortTitle}. ${cardCopy}`, 158);
}

function normalizeMoneyValue(value) {
  const match = String(value ?? "").match(/([0-9][0-9,]*)(?:\.([0-9]{1,2}))?/);
  if (!match) return "";
  const dollars = match[1].replace(/,/g, "");
  const cents = (match[2] || "00").padEnd(2, "0").slice(0, 2);
  return `${dollars}.${cents}`;
}

function extractMoney(html) {
  const scopedAnchors = [
    'id="corePriceDisplay_desktop_feature_div"',
    'id="corePrice_feature_div"',
    'id="apex_desktop"',
    'id="desktop_buybox"',
    'id="corePrice_mobile_feature_div"',
  ];

  const scopedPatterns = [
    /class="[^"]*\b(?:priceToPay|apex-price-to-pay-value|apex-pricetopay-value)\b[^"]*"[\s\S]*?<span class="a-offscreen">\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /class="[^"]*\b(?:priceToPay|apex-price-to-pay-value|apex-pricetopay-value)\b[^"]*"[\s\S]*?<span class="a-price-whole">([0-9][0-9,]*)<span class="a-price-decimal">\.<\/span><\/span>\s*<span class="a-price-fraction">([0-9]{2})/i,
    /<span id="apex-pricetopay-accessibility-label"[^>]*>\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /<span class="a-offscreen">\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
  ];

  for (const anchor of scopedAnchors) {
    const index = html.indexOf(anchor);
    if (index < 0) continue;
    const slice = html.slice(index, index + 20000);
    for (const pattern of scopedPatterns) {
      const match = slice.match(pattern);
      if (!match) continue;
      const value = match[2] ? `${match[1]}.${match[2]}` : match[1];
      const normalized = normalizeMoneyValue(value);
      if (normalized) return normalized;
    }
  }

  const fallbackPatterns = [
    /class="[^"]*\b(?:priceToPay|apex-price-to-pay-value|apex-pricetopay-value)\b[^"]*"[\s\S]*?<span class="a-offscreen">\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /class="[^"]*\b(?:priceToPay|apex-price-to-pay-value|apex-pricetopay-value)\b[^"]*"[\s\S]*?<span class="a-price-whole">([0-9][0-9,]*)<span class="a-price-decimal">\.<\/span><\/span>\s*<span class="a-price-fraction">([0-9]{2})/i,
    /<span id="apex-pricetopay-accessibility-label"[^>]*>\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /id="priceblock_(?:our|deal|sale|pospromoprice)"[^>]*>\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /"priceAmount"\s*:\s*"?([0-9][0-9,]*(?:\.[0-9]{1,2})?)"?/i,
    /"displayPrice"\s*:\s*"\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)"/i,
    /"buyingPrice"\s*:\s*"\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)"/i,
  ];

  for (const pattern of fallbackPatterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const value = match[2] ? `${match[1]}.${match[2]}` : match[1];
    const normalized = normalizeMoneyValue(value);
    if (normalized) return normalized;
  }

  return "";
}

function extractAvailability(html) {
  const match =
    html.match(/<div id="availability"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i) ||
    html.match(/<div id="availabilityInsideBuyBox_feature_div"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
  const text = cleanText(match?.[1] || "").toLowerCase();
  return text.includes("currently unavailable") || text.includes("out of stock") ? "OutOfStock" : "InStock";
}

function extractImageSize(url) {
  const square = url.match(/_SL(\d+)_/i);
  return square ? { width: square[1], height: square[1] } : { width: "", height: "" };
}

function normalizeImageUrls(input) {
  const values = Array.isArray(input) ? input : [input];
  const cleaned = [];
  for (const value of values) {
    for (const part of String(value ?? "").split(/\r?\n/)) {
      const url = part.trim();
      if (!url || cleaned.includes(url)) continue;
      cleaned.push(url);
    }
  }
  return cleaned;
}

function extractAmazonPathInfo(urlString) {
  const url = new URL(urlString);
  const parts = url.pathname.split("/").filter(Boolean);
  const dpIndex = parts.findIndex((part) => part.toLowerCase() === "dp");
  const gpIndex = parts.findIndex((part) => part.toLowerCase() === "product");
  const asin = dpIndex >= 0 ? parts[dpIndex + 1] : gpIndex >= 1 ? parts[gpIndex + 1] : "";
  const slugParts = dpIndex > 0 ? parts.slice(0, dpIndex) : [];
  return {
    asin: cleanText(asin).toUpperCase(),
    slugHint: slugParts.join(" "),
    canonicalUrl: `https://${url.hostname}/dp/${cleanText(asin).toUpperCase()}`,
  };
}

function optionLabelMap(options) {
  return new Map(options.map((option) => [option.id, option.label]));
}

function normalizeSelectedIds(selected, options) {
  const validIds = new Set(options.map((option) => option.id));
  const unique = [];
  for (const value of Array.isArray(selected) ? selected : []) {
    const cleaned = String(value || "").trim();
    if (!cleaned || !validIds.has(cleaned) || unique.includes(cleaned)) continue;
    unique.push(cleaned);
  }
  return unique;
}

function inferSingleId(haystack, fallbacks, fallbackId) {
  const normalized = haystack.toLowerCase();
  for (const fallback of fallbacks) {
    if (fallback.keywords.some((keyword) => normalized.includes(keyword))) return fallback.id;
  }
  return fallbackId;
}

function browseTarget(roomIds, departmentIds) {
  const departmentLabels = optionLabelMap(DEPARTMENTS);
  const roomLabels = optionLabelMap(ROOMS);
  for (const roomId of roomIds) {
    if (FILTERABLE_ROOMS.has(roomId)) return { href: `categories.html#${roomId}`, label: roomLabels.get(roomId) || "Categories" };
  }
  for (const departmentId of departmentIds) {
    if (FILTERABLE_DEPARTMENTS.has(departmentId)) {
      return { href: `categories.html#${departmentId}`, label: departmentLabels.get(departmentId) || "Categories" };
    }
  }
  return { href: "categories.html", label: "Categories" };
}

async function resolveAffiliateUrl(affiliateUrl) {
  const response = await fetch(affiliateUrl, { method: "GET", redirect: "manual", headers: AMAZON_HEADERS });
  const location = response.headers.get("location") || response.url || affiliateUrl;
  return new URL(location, affiliateUrl).toString();
}

async function fetchAmazonHtml(canonicalUrl) {
  const response = await fetch(canonicalUrl, { headers: AMAZON_HEADERS });
  if (!response.ok) throw new Error(`Amazon returned ${response.status} for ${canonicalUrl}`);
  return response.text();
}

function extractMatch(html, regex) {
  const match = html.match(regex);
  return match ? cleanText(match[1]) : "";
}

function extractBullets(html) {
  const sectionMatch = html.match(/<div id="feature-bullets"[\s\S]*?<ul[\s\S]*?<\/ul>/i);
  if (!sectionMatch) return [];
  return chooseBestBullets(
    Array.from(sectionMatch[0].matchAll(/<li[^>]*>\s*<span class="a-list-item">([\s\S]*?)<\/span>\s*<\/li>/gi)).map(
      (match) => match[1],
    ),
  );
}

function createAnalysis(input, amazonData) {
  const imageUrls = normalizeImageUrls(input.imageUrls?.length ? input.imageUrls : input.imageUrl);
  if (!imageUrls.length) throw new Error("At least one image URL is required.");

  const shortTitle = input.shortTitle?.trim() || titleFromAmazonTitle(amazonData.fullTitle, amazonData.brand);
  const cardCopy = input.cardCopy?.trim() || deriveCardCopy(amazonData.bullets, shortTitle);
  const pageSummary = input.pageSummary?.trim() || deriveSummary(amazonData.bullets, shortTitle);
  const departmentIds = normalizeSelectedIds(input.departments, DEPARTMENTS);
  const roomIds = normalizeSelectedIds(input.rooms, ROOMS);
  const productText = `${shortTitle} ${amazonData.slugHint} ${amazonData.bullets.join(" ")}`;
  const finalDepartments = departmentIds.length ? departmentIds : [inferSingleId(productText, DEPARTMENT_FALLBACKS, "furniture")];
  const finalRooms = roomIds.length ? roomIds : [inferSingleId(productText, ROOM_FALLBACKS, "living-room")];
  const departmentLabels = finalDepartments.map((id) => optionLabelMap(DEPARTMENTS).get(id) || id);
  const roomLabels = finalRooms.map((id) => optionLabelMap(ROOMS).get(id) || id);
  const browse = browseTarget(finalRooms, finalDepartments);
  const pageSlug = slugify(shortTitle) || slugify(amazonData.slugHint) || amazonData.asin.toLowerCase();
  const pageFile = `product-${pageSlug}.html`;
  const imageSize = extractImageSize(imageUrls[0]);

  return {
    affiliateUrl: input.affiliateUrl,
    imageUrl: imageUrls[0],
    imageUrls,
    departments: finalDepartments,
    departmentLabels,
    rooms: finalRooms,
    roomLabels,
    browseHref: browse.href,
    browseLabel: browse.label,
    asin: amazonData.asin,
    brand: amazonData.brand,
    fullTitle: amazonData.fullTitle,
    shortTitle,
    cardCopy,
    pageSummary,
    bullets: amazonData.bullets.length ? amazonData.bullets : [cardCopy],
    price: amazonData.price,
    priceLabel: "Check the latest price on Amazon",
    catalogPriceLabel: "Check current price on Amazon",
    availability: amazonData.availability,
    pageFile,
    productUrl: `${SITE_URL}/${pageFile}`,
    metaDescription: deriveMetaDescription(shortTitle, cardCopy),
    ogTitle: `${shortTitle} | Moonlit Home Decor`,
    ogDescription: pageSummary,
    twitterDescription: pageSummary,
    altText: input.altText?.trim() || `${shortTitle} product photo`,
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
  };
}

async function findExistingProductFile({ asin, affiliateUrl, pageFile }) {
  const entries = await fs.readdir(ROOT_DIR);
  const productFiles = entries.filter((entry) => /^product-.*\.html$/i.test(entry));
  for (const file of productFiles) {
    const content = await fs.readFile(path.join(ROOT_DIR, file), "utf8");
    if (content.includes(asin) || content.includes(affiliateUrl) || file === pageFile) return file;
  }
  return pageFile;
}

function renderOgImageTags(data) {
  const tags = [];
  data.imageUrls.forEach((imageUrl, index) => {
    tags.push(`    <meta property="og:image" content="${escapeHtml(imageUrl)}" />`);
    if (index === 0) {
      tags.push(`    <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`);
      tags.push(`    <meta property="og:image:alt" content="${escapeHtml(data.altText)}" />`);
      if (data.imageWidth && data.imageHeight) {
        tags.push(`    <meta property="og:image:width" content="${escapeHtml(data.imageWidth)}" />`);
        tags.push(`    <meta property="og:image:height" content="${escapeHtml(data.imageHeight)}" />`);
      }
    }
  });
  return tags.join("\n");
}

function renderGallery(data) {
  const thumbs = data.imageUrls
    .map(
      (imageUrl, index) => `            <button class="product-gallery__thumb${index === 0 ? " is-active" : ""}" type="button" data-gallery-thumb data-image="${escapeHtml(imageUrl)}" aria-label="Show product image ${index + 1}" aria-pressed="${index === 0 ? "true" : "false"}">
              <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${data.shortTitle} image ${index + 1}`)}" loading="lazy" decoding="async" />
            </button>`,
    )
    .join("\n");

  const markup = `        <div class="product-spotlight__media">
          <img class="product-spotlight__img--contain product-gallery__main" src="${escapeHtml(data.imageUrl)}" alt="${escapeHtml(data.altText)}" data-gallery-main />${data.imageUrls.length > 1 ? `
          <div class="product-gallery__thumbs" aria-label="More product images">
${thumbs}
          </div>` : ""}
        </div>`;

  const script = data.imageUrls.length > 1
    ? `
    <script>
      document.addEventListener("DOMContentLoaded", function () {
        var mainImage = document.querySelector("[data-gallery-main]");
        var thumbs = Array.prototype.slice.call(document.querySelectorAll("[data-gallery-thumb]"));
        if (!mainImage || !thumbs.length) return;
        thumbs.forEach(function (thumb) {
          thumb.addEventListener("click", function () {
            var imageUrl = thumb.getAttribute("data-image");
            if (!imageUrl) return;
            mainImage.src = imageUrl;
            thumbs.forEach(function (item) {
              item.classList.remove("is-active");
              item.setAttribute("aria-pressed", "false");
            });
            thumb.classList.add("is-active");
            thumb.setAttribute("aria-pressed", "true");
          });
        });
      });
    </script>`
    : "";

  return { markup, script };
}

function renderProductPage(data) {
  const gallery = renderGallery(data);
  const productMetaTags = data.price
    ? `
    <meta property="product:price:amount" content="${escapeHtml(data.price)}" />
    <meta property="product:price:currency" content="USD" />`
    : "";

  const productJson = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: data.fullTitle,
    image: data.imageUrls,
    description: data.metaDescription,
    sku: data.asin,
    brand: { "@type": "Brand", name: data.brand },
    offers: {
      "@type": "Offer",
      url: data.affiliateUrl,
      itemCondition: "https://schema.org/NewCondition",
      availability: `https://schema.org/${data.availability}`,
    },
    url: data.productUrl,
  };

  if (data.price) {
    productJson.offers.priceCurrency = "USD";
    productJson.offers.price = data.price;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="p:domain_verify" content="578821701055a4d83b23eb2fd7377eb7" />
    <title>${escapeHtml(data.shortTitle)} | Moonlit Home Decor</title>
    <meta name="description" content="${escapeHtml(data.metaDescription)}" />
    <link rel="canonical" href="${escapeHtml(data.productUrl)}" />

    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Moonlit Home Decor" />
    <meta property="og:title" content="${escapeHtml(data.ogTitle)}" />
    <meta property="og:url" content="${escapeHtml(data.productUrl)}" />
    <meta property="og:description" content="${escapeHtml(data.ogDescription)}" />
${renderOgImageTags(data)}
    <meta property="product:retailer_item_id" content="${escapeHtml(data.asin)}" />
    <meta property="product:brand" content="${escapeHtml(data.brand)}" />
    <meta property="product:condition" content="new" />
    <meta property="product:availability" content="${data.availability === "InStock" ? "instock" : "oos"}" />${productMetaTags}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(data.ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(data.twitterDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(data.imageUrl)}" />

    <script type="application/ld+json">${safeJson(productJson)}</script>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Display&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="styles.css" />
    <script defer src="script.js"></script>
  </head>
  <body>
    <div class="ambient-shape ambient-shape--one" aria-hidden="true"></div>
    <div class="ambient-shape ambient-shape--two" aria-hidden="true"></div>

    <header class="site-header">
      <a class="site-brand" href="index.html" aria-label="Moonlit Home Decor home">
        <span class="brand-mark" aria-hidden="true">MH</span>
        <span class="brand-text">Moonlit Home Decor</span>
      </a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button>
      <nav class="site-nav" id="primary-nav" aria-label="Primary">
        <a class="site-nav__link" href="index.html">Home</a>
        <a class="site-nav__link" href="blog.html">Blog</a>
        <a class="site-nav__link" href="about.html">About Us</a>
        <a class="site-nav__link site-nav__link--active" href="categories.html">Categories</a>
      </nav>
    </header>

    <main class="page-wrap page-wrap--product">
      <nav class="crumb" aria-label="Breadcrumb">
        <a href="index.html">Home</a> / <a href="${escapeHtml(data.browseHref)}">${escapeHtml(data.browseLabel)}</a> /
        <span>${escapeHtml(data.shortTitle)}</span>
      </nav>

      <section class="product-spotlight" data-reveal>
${gallery.markup}
        <div class="product-spotlight__content">
          <p class="kicker">Featured Product</p>
          <h1>${escapeHtml(data.shortTitle)}</h1>
          <p class="muted">${escapeHtml(data.pageSummary)}</p>
          <p class="product-price">${escapeHtml(data.priceLabel)}</p>
          <ul class="feature-list">
${data.bullets.map((bullet) => `            <li>${escapeHtml(toSentenceCase(bullet))}</li>`).join("\n")}
          </ul>
          <div class="notice-box">Disclosure: We may earn a commission from links on this page.</div>
          <div class="hero__actions">
            <a class="btn btn--primary" href="${escapeHtml(data.affiliateUrl)}" target="_blank" rel="noopener noreferrer nofollow sponsored">${escapeHtml(data.priceLabel)}</a>
            <a class="btn btn--soft" href="${escapeHtml(data.browseHref)}">Browse ${escapeHtml(data.browseLabel)} Picks</a>
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div>
        <strong>Moonlit Home Decor</strong><br />
        <span>Curated home finds for calm, modern spaces.</span><br />
        <span class="footer-disclosure">Some links may earn us a commission.</span>
      </div>
      <div class="footer-links">
        <a href="index.html">Home</a>
        <a href="blog.html">Blog</a>
        <a href="about.html">About Us</a>
        <a href="categories.html">Categories</a>
      </div>
      <div>&copy; <span data-year></span> Moonlit Home Decor</div>
    </footer>${gallery.script}
  </body>
</html>
`;
}

function renderCatalogCard(data, pageFile) {
  return `        <article class="product-card catalog-item" data-catalog-item data-department="${escapeHtml(data.departments.join(" "))}" data-rooms="${escapeHtml(data.rooms.join(" "))}" data-reveal>
          <a class="product-card__media" href="${escapeHtml(pageFile)}">
            <img src="${escapeHtml(data.imageUrl)}" alt="${escapeHtml(data.altText)}" loading="lazy" decoding="async" />
          </a>
          <div class="product-card__body">
            <div class="catalog-badges">
              <span class="catalog-badge">${escapeHtml(data.departmentLabels.join(", "))}</span>
              <span class="catalog-badge">Room: ${escapeHtml(data.roomLabels.join(", "))}</span>
            </div>
            <p class="product-card__label">Featured Amazon Pick</p>
            <h3>${escapeHtml(data.shortTitle)}</h3>
            <p>${escapeHtml(data.cardCopy)}</p>
            <div class="product-card__actions">
              <a class="btn btn--soft" href="${escapeHtml(pageFile)}">View product details</a>
              <a class="btn btn--primary" href="${escapeHtml(data.affiliateUrl)}" target="_blank" rel="noopener noreferrer nofollow sponsored">${escapeHtml(data.catalogPriceLabel)}</a>
            </div>
          </div>
        </article>`;
}

function replaceOrInsertCard(categoriesHtml, cardHtml, pageFile, affiliateUrl) {
  const withoutExistingCard = categoriesHtml.replace(/<article class="product-card catalog-item"[\s\S]*?<\/article>\s*/gi, (block) => {
    return block.includes(`href="${pageFile}"`) || block.includes(`href="${affiliateUrl}"`) ? "" : block;
  });
  const gridMarker = '<div class="catalog-grid">';
  const gridIndex = withoutExistingCard.indexOf(gridMarker);
  if (gridIndex < 0) throw new Error("Could not find the catalog grid inside categories.html");
  const insertIndex = gridIndex + gridMarker.length;
  return `${withoutExistingCard.slice(0, insertIndex)}\n${cardHtml}${withoutExistingCard.slice(insertIndex)}`;
}

async function writeProductFiles(data) {
  await fs.writeFile(path.join(ROOT_DIR, data.pageFile), renderProductPage(data), "utf8");
  const categoriesHtml = await fs.readFile(CATEGORIES_PATH, "utf8");
  const updatedCategoriesHtml = replaceOrInsertCard(
    categoriesHtml,
    renderCatalogCard(data, data.pageFile),
    data.pageFile,
    data.affiliateUrl,
  );
  await fs.writeFile(CATEGORIES_PATH, updatedCategoriesHtml, "utf8");
  return data.pageFile;
}

async function analyzeAffiliateInput(input) {
  if (!input?.affiliateUrl || !normalizeImageUrls(input.imageUrls?.length ? input.imageUrls : input.imageUrl).length) {
    throw new Error("Affiliate URL and at least one image URL are required.");
  }

  const resolvedUrl = await resolveAffiliateUrl(input.affiliateUrl);
  const pathInfo = extractAmazonPathInfo(resolvedUrl);
  if (!pathInfo.asin) throw new Error("Could not extract an ASIN from the affiliate link.");

  const html = await fetchAmazonHtml(pathInfo.canonicalUrl);
  const fullTitle = extractMatch(html, /<span id="productTitle"[^>]*>([\s\S]*?)<\/span>/i);
  const rawBrand = extractMatch(html, /<a id="bylineInfo"[^>]*>([\s\S]*?)<\/a>/i);
  if (!fullTitle) throw new Error("Could not read the Amazon product title.");

  const analysis = createAnalysis(input, {
    asin: pathInfo.asin,
    slugHint: pathInfo.slugHint,
    fullTitle,
    brand: normalizeBrand(rawBrand, fullTitle),
    bullets: extractBullets(html),
    price: extractMoney(html),
    availability: extractAvailability(html),
  });

  const pageFile = await findExistingProductFile(analysis);
  return { ...analysis, pageFile, productUrl: `${SITE_URL}/${pageFile}` };
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".js"
          ? "text/javascript; charset=utf-8"
          : ext === ".css"
            ? "text/css; charset=utf-8"
            : "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === "GET" && requestUrl.pathname === "/api/options") {
        json(res, 200, { departments: DEPARTMENTS, rooms: ROOMS });
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/api/analyze") {
        json(res, 200, { analysis: await analyzeAffiliateInput(await readRequestBody(req)) });
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/api/publish") {
        const analysis = await analyzeAffiliateInput(await readRequestBody(req));
        if (!analysis.price) {
          throw new Error("Could not extract a live Amazon price. Pinterest product tags need price metadata, so publishing was blocked.");
        }
        const pageFile = await writeProductFiles(analysis);
        json(res, 200, {
          ok: true,
          pageFile,
          pagePath: path.join(ROOT_DIR, pageFile),
          categoriesPath: CATEGORIES_PATH,
          analysis: { ...analysis, pageFile, productUrl: `${SITE_URL}/${pageFile}` },
        });
        return;
      }
      await serveStatic(req, res);
    } catch (error) {
      json(res, 500, { error: error.message || "Unexpected error" });
    }
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`Affiliate admin app running at http://localhost:${PORT}`);
  });
}

module.exports = {
  PORT,
  SITE_URL,
  analyzeAffiliateInput,
  createServer,
  renderProductPage,
  writeProductFiles,
};
