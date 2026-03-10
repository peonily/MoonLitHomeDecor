const els = {
  form: document.querySelector("#productForm"),
  departments: document.querySelector("#departments"),
  rooms: document.querySelector("#rooms"),
  publishBtn: document.querySelector("#publishBtn"),
  status: document.querySelector("#status"),
  emptyState: document.querySelector("#emptyState"),
  preview: document.querySelector("#preview"),
  previewImage: document.querySelector("#previewImage"),
  previewTitle: document.querySelector("#previewTitle"),
  previewDepartments: document.querySelector("#previewDepartments"),
  previewRooms: document.querySelector("#previewRooms"),
  previewAsin: document.querySelector("#previewAsin"),
  previewPrice: document.querySelector("#previewPrice"),
  previewFile: document.querySelector("#previewFile"),
  previewUrl: document.querySelector("#previewUrl"),
  previewBrowseHref: document.querySelector("#previewBrowseHref"),
  previewImageCount: document.querySelector("#previewImageCount"),
  previewMetaDescription: document.querySelector("#previewMetaDescription"),
  previewOgTitle: document.querySelector("#previewOgTitle"),
  previewBullets: document.querySelector("#previewBullets"),
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

function renderChoiceGroup(root, name, options) {
  root.replaceChildren(
    ...options.map((option) => {
      const label = document.createElement("label");
      label.className = "choice";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = name;
      input.value = option.id;

      const text = document.createElement("span");
      text.textContent = option.label;

      label.append(input, text);
      return label;
    }),
  );
}

function selectedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function formPayload() {
  const data = new FormData(els.form);
  const imageUrls = String(data.get("imageUrls") || "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    affiliateUrl: data.get("affiliateUrl")?.trim(),
    imageUrl: imageUrls[0] || "",
    imageUrls,
    departments: selectedValues("departments"),
    rooms: selectedValues("rooms"),
    shortTitle: data.get("shortTitle")?.trim(),
    cardCopy: data.get("cardCopy")?.trim(),
    pageSummary: data.get("pageSummary")?.trim(),
    altText: data.get("altText")?.trim(),
  };
}

function setStatus(message, tone = "") {
  els.status.textContent = message;
  els.status.className = `status ${tone}`.trim();
}

function renderAnalysis(analysis) {
  els.emptyState.hidden = true;
  els.preview.hidden = false;

  els.previewImage.src = analysis.imageUrl;
  els.previewImage.alt = analysis.altText;
  els.previewTitle.textContent = analysis.shortTitle;
  els.previewDepartments.textContent = `Departments: ${analysis.departmentLabels.join(", ")}`;
  els.previewRooms.textContent = `Rooms: ${analysis.roomLabels.join(", ")}`;
  els.previewAsin.textContent = `ASIN: ${analysis.asin}`;
  els.previewPrice.textContent = analysis.price
    ? `Price found: $${analysis.price}`
    : "Price not found. Publish is blocked until a live Amazon price can be extracted.";
  els.previewFile.textContent = analysis.pageFile;
  els.previewUrl.textContent = analysis.productUrl;
  els.previewBrowseHref.textContent = analysis.browseHref;
  els.previewImageCount.textContent = `${analysis.imageUrls.length} image${analysis.imageUrls.length === 1 ? "" : "s"}`;
  els.previewMetaDescription.textContent = analysis.metaDescription;
  els.previewOgTitle.textContent = analysis.ogTitle;
  els.previewBullets.replaceChildren(
    ...analysis.bullets.map((bullet) => {
      const item = document.createElement("li");
      item.textContent = bullet;
      return item;
    }),
  );
}

async function loadOptions() {
  const { departments, rooms } = await requestJson("/api/options", { method: "GET", headers: {} });
  renderChoiceGroup(els.departments, "departments", departments);
  renderChoiceGroup(els.rooms, "rooms", rooms);
}

async function analyze() {
  setStatus("Analyzing Amazon product and building preview...");
  const { analysis } = await requestJson("/api/analyze", {
    method: "POST",
    body: JSON.stringify(formPayload()),
  });
  renderAnalysis(analysis);
  setStatus("Preview ready.", "status--ok");
}

async function publish() {
  setStatus("Writing product page and updating categories.html...");
  const { analysis, pagePath, categoriesPath } = await requestJson("/api/publish", {
    method: "POST",
    body: JSON.stringify(formPayload()),
  });
  renderAnalysis(analysis);
  setStatus(`Published ${analysis.pageFile}. Updated ${categoriesPath} and ${pagePath}.`, "status--ok");
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await analyze();
  } catch (error) {
    setStatus(error.message, "status--error");
  }
});

els.publishBtn.addEventListener("click", async () => {
  try {
    await publish();
  } catch (error) {
    setStatus(error.message, "status--error");
  }
});

loadOptions().catch((error) => {
  setStatus(error.message, "status--error");
});
