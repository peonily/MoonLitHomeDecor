const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const CATEGORIES_PATH = path.join(ROOT, "categories.html");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyRoom(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildBullets(description, title) {
  const bullets = [];
  const cleaned = decodeHtml(description);
  if (cleaned) {
    bullets.push(cleaned.replace(/\s*\.{3,}\s*$/, "").replace(/\s*\.$/, "") + ".");
  }

  const sizeMatch = String(title || "").match(/\b(\d{1,2}\s*x\s*\d{1,2})\b/i);
  if (sizeMatch) {
    const size = sizeMatch[1].replace(/\s*/g, "").toLowerCase();
    bullets.push(`Sized for ${size}-inch inserts to style sofas, beds, or chairs.`);
  } else if (/\b\d{1,2}-inch\b/i.test(title || "")) {
    const inchMatch = String(title || "").match(/\b(\d{1,2}-inch)\b/i);
    if (inchMatch) {
      bullets.push(`Sized for ${inchMatch[1]} inserts to style sofas, beds, or chairs.`);
    }
  }

  if (bullets.length < 3) {
    bullets.push("An easy way to add softness and texture to everyday seating.");
  }

  return bullets.slice(0, 3);
}

function extractFirstRoom(cardHtml) {
  const roomMatch = cardHtml.match(/Room:\s*([^<]+)<\/span>/i);
  if (!roomMatch) return "";
  const roomLabel = decodeHtml(roomMatch[1]).split(",")[0].trim();
  return roomLabel;
}

function extractTitle(cardHtml) {
  const match = cardHtml.match(/<h3>([^<]+)<\/h3>/i);
  return match ? decodeHtml(match[1]) : "Featured Product";
}

function extractDescription(cardHtml) {
  const match = cardHtml.match(/<h3>[\s\S]*?<p>([^<]+)<\/p>/i);
  return match ? decodeHtml(match[1]) : "";
}

function extractImage(cardHtml) {
  const match = cardHtml.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/i);
  return {
    url: match ? match[1] : "",
    alt: match ? decodeHtml(match[2]) : "",
  };
}

function extractAffiliate(cardHtml) {
  const match = cardHtml.match(/href="(https?:\/\/[^\"]+)"[^>]*>Check current price on Amazon/i);
  if (match) return match[1];
  const fallback = cardHtml.match(/href="(https?:\/\/[^\"]+amazon\.com[^\"]+)"/i);
  return fallback ? fallback[1] : "";
}

function extractAsin(affiliateUrl) {
  const match = String(affiliateUrl || "").match(/\/dp\/([A-Z0-9]{10})/i) ||
    String(affiliateUrl || "").match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : "";
}

function buildProductHtml(data) {
  const productUrl = `https://moonlithomedecor.com/${data.pageFile}`;
  const metaDescription = data.description
    ? `Affiliate pick: ${data.title}. ${data.description}`
    : `Affiliate pick: ${data.title}.`;

  const bulletsHtml = data.bullets
    .map((bullet) => `            <li>${escapeHtml(bullet)}</li>`)
    .join("\n");

  const brandMeta = data.brand ? `\n    <meta property="product:brand" content="${escapeHtml(data.brand)}" />` : "";
  const asinMeta = data.asin ? `\n    <meta property="product:retailer_item_id" content="${escapeHtml(data.asin)}" />` : "";

  const productJson = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: data.title,
    image: data.imageUrl ? [data.imageUrl] : [],
    description: metaDescription,
    brand: data.brand ? { "@type": "Brand", name: data.brand } : undefined,
    sku: data.asin || undefined,
    offers: {
      "@type": "Offer",
      url: data.affiliateUrl || productUrl,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    url: productUrl,
  };

  if (!data.brand) delete productJson.brand;
  if (!data.asin) delete productJson.sku;
  if (!data.imageUrl) delete productJson.image;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="assets/favicon.png" type="image/png" />
    <meta name="color-scheme" content="light" />
    <meta name="p:domain_verify" content="578821701055a4d83b23eb2fd7377eb7" />
    <title>${escapeHtml(data.title)} | Moonlit Home Decor</title>
    <meta name="description" content="${escapeHtml(metaDescription)}" />
    <link rel="canonical" href="${escapeHtml(productUrl)}" />

    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Moonlit Home Decor" />
    <meta property="og:title" content="${escapeHtml(data.title)} | Moonlit Home Decor" />
    <meta property="og:url" content="${escapeHtml(productUrl)}" />
    <meta property="og:description" content="${escapeHtml(metaDescription)}" />
    ${data.imageUrl ? `<meta property="og:image" content="${escapeHtml(data.imageUrl)}" />` : ""}
    ${data.imageUrl ? `<meta property="og:image:secure_url" content="${escapeHtml(data.imageUrl)}" />` : ""}
    ${data.altText ? `<meta property="og:image:alt" content="${escapeHtml(data.altText)}" />` : ""}${asinMeta}${brandMeta}
    <meta property="product:condition" content="new" />
    <meta property="product:availability" content="instock" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(data.title)} | Moonlit Home Decor" />
    <meta name="twitter:description" content="${escapeHtml(metaDescription)}" />
    ${data.imageUrl ? `<meta name="twitter:image" content="${escapeHtml(data.imageUrl)}" />` : ""}

    <script type="application/ld+json">${JSON.stringify(productJson, null, 8).replace(/<\//g, "<\\/")}</script>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Display&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="styles.css" />
    <script defer src="script.js"></script>
  </head>
  <body>
    <div class="ambient-shape ambient-shape--one" aria-hidden="true"></div>
    <div class="ambient-shape ambient-shape--two" aria-hidden="true"></div>

    <div data-shared-header></div>

    <main class="page-wrap page-wrap--product">
      <nav class="crumb" aria-label="Breadcrumb">
        <a href="index.html">Home</a> / <a href="${escapeHtml(data.browseHref)}">${escapeHtml(data.browseLabel)}</a> /
        <span>${escapeHtml(data.title)}</span>
      </nav>

      <section class="product-spotlight" data-reveal>
        <div class="product-spotlight__media">
          ${data.imageUrl ? `<img class="product-spotlight__img--contain product-gallery__main" src="${escapeHtml(data.imageUrl)}" alt="${escapeHtml(data.altText || data.title)}" data-gallery-main />` : ""}
        </div>
        <div class="product-spotlight__content">
          <p class="kicker">Featured Product</p>
          <h1>${escapeHtml(data.title)}</h1>
          <p class="muted">${escapeHtml(data.description || metaDescription)}</p>
          <p class="product-price">Check the latest price on Amazon</p>
          <ul class="feature-list">
${bulletsHtml}
          </ul>
          <div class="notice-box">Disclosure: We may earn a commission from links on this page.</div>
          <div class="hero__actions">
            <a class="btn btn--primary" href="${escapeHtml(data.affiliateUrl || "#")}" target="_blank" rel="noopener noreferrer nofollow sponsored">Check the latest price on Amazon</a>
            <a class="btn btn--soft" href="${escapeHtml(data.browseHref)}">Browse ${escapeHtml(data.browseLabel)} Picks</a>
          </div>
        </div>
      </section>
    </main>

    <div data-shared-footer></div>
  </body>
</html>
`;
}

const categoriesHtml = fs.readFileSync(CATEGORIES_PATH, "utf8");
const cardRegex = /<article class="product-card catalog-item"[\s\S]*?<\/article>/gi;
const cards = categoriesHtml.match(cardRegex) || [];

const created = [];

cards.forEach((card) => {
  const hrefMatch = card.match(/href="(product-[^"]+)"/i);
  if (!hrefMatch) return;
  const pageFile = hrefMatch[1];
  const pagePath = path.join(ROOT, pageFile);
  if (fs.existsSync(pagePath)) return;

  const title = extractTitle(card);
  const description = extractDescription(card);
  const { url: imageUrl, alt: altText } = extractImage(card);
  const affiliateUrl = extractAffiliate(card);
  const roomLabel = extractFirstRoom(card);
  const roomSlug = slugifyRoom(roomLabel);
  const browseHref = roomSlug ? `categories.html#${roomSlug}` : "categories.html";
  const browseLabel = roomLabel || "Categories";
  const brand = title.split(" ")[0];
  const asin = extractAsin(affiliateUrl);
  const bullets = buildBullets(description, title);

  const html = buildProductHtml({
    pageFile,
    title,
    description,
    imageUrl,
    altText,
    affiliateUrl,
    browseHref,
    browseLabel,
    brand,
    asin,
    bullets,
  });

  fs.writeFileSync(pagePath, html, "utf8");
  created.push(pageFile);
});

if (created.length) {
  console.log(`Generated ${created.length} missing product page(s).`);
  created.forEach((file) => console.log(`- ${file}`));
} else {
  console.log("No missing product pages found.");
}
