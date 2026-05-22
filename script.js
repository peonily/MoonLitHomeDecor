(() => {
  const isBlogPage = document.body && document.body.classList.contains("blog-page");

  const sharedHeader = `
    <header class="site-header">
      <a class="site-brand" href="/" aria-label="Moonlit Home Decor home">
        <span class="brand-mark" aria-hidden="true">MH</span>
        <span class="brand-text">Moonlit Home Decor</span>
      </a>

      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">
        Menu
      </button>

      <nav class="site-nav" id="primary-nav" aria-label="Primary">
        <a class="site-nav__link site-nav__link--active" href="/">Home</a>
        <a class="site-nav__link" href="/blog">Blog</a>
        <a class="site-nav__link" href="/about">About Us</a>
        <a class="site-nav__link" href="/categories">Categories</a>
      </nav>
    </header>
  `.trim();
  const sharedFooter = `
    <footer class="site-footer">
      <div>
        <strong>Moonlit Home Decor</strong><br />
        <span>Curated home finds for calm, modern spaces.</span><br />
        <span class="footer-disclosure">This website is a participant in the Amazon Services LLC Associates Program. As an Amazon Associate, we earn from qualifying purchases at no additional cost to you.</span>
      </div>
                        <div class="footer-links">
        <a href="/">Home</a>
        <a href="/blog">Blog</a>
        <a href="/about">About Us</a>
        <a href="/categories">Categories</a>
        <a href="/contact">Contact Us</a>
        <a href="/privacy-policy">Privacy Policy</a>
        <a href="/affiliate-disclosure">Affiliate Disclosure</a>
      </div>
      <div>&copy; <span data-year></span> Moonlit Home Decor</div>
</footer>
  `.trim();

  const headerMount =
    document.querySelector("[data-shared-header]") ||
    document.querySelector("header.site-header");
  if (headerMount) {
    headerMount.outerHTML = sharedHeader;
  }

  const footerMount =
    document.querySelector("[data-shared-footer]") ||
    document.querySelector("footer.site-footer");
  if (footerMount) {
    footerMount.outerHTML = sharedFooter;
  }

  const menuToggle = document.querySelector(".menu-toggle");
  const siteNav = document.getElementById("primary-nav");
  const siteHeader = document.querySelector(".site-header");
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = (urlParams.get("q") || "").trim();
  let headerSearchInput = null;

  if (siteHeader && !siteHeader.querySelector(".site-search")) {
    const searchForm = document.createElement("form");
    searchForm.className = "site-search";
    searchForm.setAttribute("role", "search");
    searchForm.setAttribute("action", "categories.html");
    searchForm.setAttribute("method", "get");

    const inputId = "site-search-input";
    searchForm.innerHTML = `
      <label class="sr-only" for="${inputId}">Search</label>
      <svg class="site-search__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 21l-4.35-4.35m1.1-4.65a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <input
        class="site-search__input"
        id="${inputId}"
        type="search"
        name="q"
        placeholder="Search"
        autocomplete="off"
      />
      <button class="site-search__submit" type="submit">Go</button>
    `;

    const insertBeforeTarget = menuToggle || siteNav;
    if (insertBeforeTarget && insertBeforeTarget.parentElement === siteHeader) {
      siteHeader.insertBefore(searchForm, insertBeforeTarget);
    } else if (siteNav && siteNav.parentElement === siteHeader) {
      siteHeader.insertBefore(searchForm, siteNav);
    } else {
      siteHeader.append(searchForm);
    }

    headerSearchInput = searchForm.querySelector(".site-search__input");
  } else if (siteHeader) {
    headerSearchInput = siteHeader.querySelector(".site-search__input");
  }

  if (headerSearchInput && initialQuery) {
    headerSearchInput.value = initialQuery;
  }

  if (menuToggle && siteNav) {
    const closeMenu = () => {
      siteNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    };

    menuToggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", (event) => {
      if (!siteNav.classList.contains("is-open")) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!siteNav.contains(target) && !menuToggle.contains(target)) {
        closeMenu();
      }
    });

    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) {
        closeMenu();
      }
    });
  }

  if (!isBlogPage) {
    const revealTargets = Array.from(document.querySelectorAll("[data-reveal]"));

    if (revealTargets.length > 0) {
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
          (entries, currentObserver) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("is-visible");
              currentObserver.unobserve(entry.target);
            });
          },
          { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
        );

        revealTargets.forEach((item) => observer.observe(item));
      } else {
        revealTargets.forEach((item) => item.classList.add("is-visible"));
      }
    }
  }

  const catalogRoot = document.querySelector("[data-catalog-root]");
  if (catalogRoot) {
    const items = Array.from(catalogRoot.querySelectorAll("[data-catalog-item]"));
    const departmentButtons = Array.from(
      catalogRoot.querySelectorAll("[data-filter-kind='department']")
    );
    const roomButtons = Array.from(catalogRoot.querySelectorAll("[data-filter-kind='room']"));
    const statusNode = catalogRoot.querySelector("[data-catalog-status]");
    const emptyNode = catalogRoot.querySelector("[data-catalog-empty]");
    const currentDepartmentNode = catalogRoot.querySelector("[data-current-department]");
    const currentRoomNode = catalogRoot.querySelector("[data-current-room]");

    let activeDepartment = "all";
    let activeRoom = "all";
    let activeQueryLabel = initialQuery;
    let activeQuery = activeQueryLabel.toLowerCase();
    const departmentValues = new Set(
      departmentButtons.map((button) => button.dataset.filterValue || "all")
    );
    const roomValues = new Set(roomButtons.map((button) => button.dataset.filterValue || "all"));
    const roomAliases = {
      "kitchen-room": "kitchen",
      livingroom: "living-room",
    };
    const itemSearchText = new Map(
      items.map((item) => [
        item,
        (item.textContent || "").toLowerCase().replace(/\s+/g, " ").trim(),
      ])
    );

    const getActiveLabel = (buttons, value, fallback) => {
      const activeButton = buttons.find((button) => button.dataset.filterValue === value);
      if (!activeButton) {
        return fallback;
      }
      return (activeButton.textContent || "").trim();
    };

    const setActiveButton = (buttons, activeValue) => {
      buttons.forEach((button) => {
        const isActive = button.dataset.filterValue === activeValue;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    };

    const applyFilters = () => {
      let visibleCount = 0;

      items.forEach((item) => {
        const departments = (item.dataset.department || "").split(/\s+/).filter(Boolean);
        const rooms = (item.dataset.rooms || "").split(/\s+/).filter(Boolean);
        const departmentMatch =
          activeDepartment === "all" || departments.includes(activeDepartment);
        const roomMatch = activeRoom === "all" || rooms.includes(activeRoom);
        const queryMatch =
          !activeQuery || (itemSearchText.get(item) || "").includes(activeQuery);
        const visible = departmentMatch && roomMatch && queryMatch;

        item.hidden = !visible;
        if (visible) {
          visibleCount += 1;
        }
      });

      const departmentLabel = getActiveLabel(
        departmentButtons,
        activeDepartment,
        "All Departments"
      );
      const roomLabel = getActiveLabel(roomButtons, activeRoom, "All Rooms");

      if (currentDepartmentNode) {
        currentDepartmentNode.textContent = departmentLabel;
      }
      if (currentRoomNode) {
        currentRoomNode.textContent = roomLabel;
      }
      if (statusNode) {
        const baseText = `Showing ${visibleCount} product${
          visibleCount === 1 ? "" : "s"
        }`;
        statusNode.textContent = activeQueryLabel
          ? `${baseText} for "${activeQueryLabel}"`
          : baseText;
      }
      if (emptyNode) {
        emptyNode.hidden = visibleCount !== 0;
      }
    };

    const syncHashWithState = () => {
      const nextHash =
        activeRoom !== "all"
          ? activeRoom
          : activeDepartment !== "all"
            ? activeDepartment
            : "";
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = nextHash ? `#${nextHash}` : "";
      window.history.replaceState(null, "", nextUrl.toString());
    };

    const applyHashFilter = () => {
      const rawHash = window.location.hash.replace(/^#/, "").trim().toLowerCase();
      if (!rawHash) {
        return;
      }

      const mappedRoom = roomAliases[rawHash] || rawHash;
      if (roomValues.has(mappedRoom)) {
        activeRoom = mappedRoom;
      } else if (departmentValues.has(rawHash)) {
        activeDepartment = rawHash;
      }
    };

    departmentButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeDepartment = button.dataset.filterValue || "all";
        setActiveButton(departmentButtons, activeDepartment);
        applyFilters();
        syncHashWithState();
      });
    });

    roomButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeRoom = button.dataset.filterValue || "all";
        setActiveButton(roomButtons, activeRoom);
        applyFilters();
        syncHashWithState();
      });
    });

    applyHashFilter();
    setActiveButton(departmentButtons, activeDepartment);
    setActiveButton(roomButtons, activeRoom);
    applyFilters();

    if (headerSearchInput) {
      headerSearchInput.addEventListener("input", () => {
        activeQueryLabel = headerSearchInput.value.trim();
        activeQuery = activeQueryLabel.toLowerCase();
        applyFilters();
      });
    }

    window.addEventListener("hashchange", () => {
      activeDepartment = "all";
      activeRoom = "all";
      applyHashFilter();
      setActiveButton(departmentButtons, activeDepartment);
      setActiveButton(roomButtons, activeRoom);
      applyFilters();
    });
  }

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
})();
