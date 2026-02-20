(() => {
  const menuToggle = document.querySelector(".menu-toggle");
  const siteNav = document.getElementById("primary-nav");

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

  const revealTargets = Array.from(document.querySelectorAll("[data-reveal]"));
  if (revealTargets.length > 0) {
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries, currentObserver) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }
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
    const departmentValues = new Set(
      departmentButtons.map((button) => button.dataset.filterValue || "all")
    );
    const roomValues = new Set(roomButtons.map((button) => button.dataset.filterValue || "all"));
    const roomAliases = {
      "kitchen-room": "kitchen",
    };

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
        const visible = departmentMatch && roomMatch;

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
        statusNode.textContent = `Showing ${visibleCount} product${visibleCount === 1 ? "" : "s"}`;
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
