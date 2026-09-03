/**
 * KARMED RADIOLOGIYA & NAVBAT TIZIMI
 * Barcha oynalar uchun Kunduzgi (Light) va Tungi (Dark) rejim boshqaruvi (shared/theme.js)
 */

(function() {
  function getPreferredTheme() {
    let saved = localStorage.getItem("app_theme");
    if (!saved && window.parent && window.parent.localStorage) {
      try { saved = window.parent.localStorage.getItem("app_theme"); } catch(e) {}
    }
    if (saved === "light" || saved === "dark") return saved;
    return "dark"; // Birlamchi holat: Tungi (Dark)
  }

  function applyTheme(theme) {
    const isLight = (theme === "light");
    
    // HTML va Body elementlariga o'rnatish
    if (document.documentElement) {
      document.documentElement.setAttribute("data-theme", theme);
    }
    if (document.body) {
      if (isLight) {
        document.body.classList.remove("dark-theme");
        document.body.classList.add("light-theme");
      } else {
        document.body.classList.remove("light-theme");
        document.body.classList.add("dark-theme");
      }
    }

    // Tugma indikatorlarini yangilash
    const icon = document.getElementById("themeIcon");
    const label = document.getElementById("themeLabel");
    if (icon) {
      icon.className = isLight ? "fa-solid fa-moon" : "fa-solid fa-sun";
      icon.style.color = isLight ? "#6366f1" : "#fbbf24";
    }
    if (label) {
      label.innerText = isLight ? "Tungi" : "Kunduzgi";
    }

    // Ichki framelarga uzatish (agar mavjud bo'lsa)
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach(iframe => {
      try {
        if (iframe.contentDocument) {
          iframe.contentDocument.documentElement.setAttribute("data-theme", theme);
          if (iframe.contentDocument.body) {
            if (isLight) {
              iframe.contentDocument.body.classList.remove("dark-theme");
              iframe.contentDocument.body.classList.add("light-theme");
            } else {
              iframe.contentDocument.body.classList.remove("light-theme");
              iframe.contentDocument.body.classList.add("dark-theme");
            }
          }
          const fIcon = iframe.contentDocument.getElementById("themeIcon");
          const fLabel = iframe.contentDocument.getElementById("themeLabel");
          if (fIcon) {
            fIcon.className = isLight ? "fa-solid fa-moon" : "fa-solid fa-sun";
            fIcon.style.color = isLight ? "#6366f1" : "#fbbf24";
          }
          if (fLabel) fLabel.innerText = isLight ? "Tungi" : "Kunduzgi";
        }
      } catch(e) {}
    });

    // Parent darchaga uzatish (agar iframe ichida bo'lsa)
    if (window.parent && window.parent !== window) {
      try {
        window.parent.document.documentElement.setAttribute("data-theme", theme);
        if (window.parent.document.body) {
          if (isLight) {
            window.parent.document.body.classList.remove("dark-theme");
            window.parent.document.body.classList.add("light-theme");
          } else {
            window.parent.document.body.classList.remove("light-theme");
            window.parent.document.body.classList.add("dark-theme");
          }
        }
        const pIcon = window.parent.document.getElementById("themeIcon");
        const pLabel = window.parent.document.getElementById("themeLabel");
        if (pIcon) {
          pIcon.className = isLight ? "fa-solid fa-moon" : "fa-solid fa-sun";
          pIcon.style.color = isLight ? "#6366f1" : "#fbbf24";
        }
        if (pLabel) pLabel.innerText = isLight ? "Tungi" : "Kunduzgi";
      } catch(e) {}
    }
  }

  window.toggleAppTheme = function() {
    const current = getPreferredTheme();
    const nextTheme = current === "light" ? "dark" : "light";
    localStorage.setItem("app_theme", nextTheme);
    if (window.parent && window.parent.localStorage) {
      try { window.parent.localStorage.setItem("app_theme", nextTheme); } catch(e) {}
    }
    applyTheme(nextTheme);
  };

  window.setAppTheme = function(theme) {
    if (theme === "light" || theme === "dark") {
      localStorage.setItem("app_theme", theme);
      applyTheme(theme);
    }
  };

  // Dastlabki yuklash
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // DOM to'liq yuklanganda indikatorlarni to'g'rilash
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyTheme(getPreferredTheme());
    });
  } else {
    setTimeout(() => applyTheme(getPreferredTheme()), 50);
  }

  // Boshqa oyna yoki tabdan rejim o'zgarganda darhol qabul qilish
  window.addEventListener("storage", (e) => {
    if (e.key === "app_theme") {
      applyTheme(e.newValue || "dark");
    }
  });
})();
