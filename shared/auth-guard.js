/**
 * Tibbiyot / MRT - Barcha Darchalar Uchun Umumiy Auth Guard (shared/auth-guard.js)
 * Tizimga ruxsatsiz kirishni to'sib, login sahifasiga yo'naltiradi.
 */

(function() {
  // Ochiq sahifalar (Kutish zali TV Tablosi ochiq qoladi)
  const pathname = window.location.pathname;
  if (pathname.includes('/mrt-tv/') || pathname.includes('login.html')) {
    return;
  }

  const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");

  if (!token) {
    redirectToLogin();
    return;
  }

  // Tokenni serverdan tekshirish
  fetch("/api/auth/me", {
    headers: { "Authorization": `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(data => {
    if (!data.success || !data.user) {
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_token");
      redirectToLogin();
    } else {
      window.currentUser = data.user;
      injectUserHeader(data.user);
    }
  })
  .catch(() => {
    // Server vaqtincha javob bermasa keshdagi sessiya bilan davom ettirish
    const cachedUser = localStorage.getItem("auth_user");
    if (cachedUser) {
      window.currentUser = JSON.parse(cachedUser);
      injectUserHeader(window.currentUser);
    } else {
      redirectToLogin();
    }
  });

  function redirectToLogin() {
    const current = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?redirect=${current}`;
  }

  function injectUserHeader(user) {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.getElementById("globalAuthUserBadge")) return;

      const badge = document.createElement("div");
      badge.id = "globalAuthUserBadge";
      badge.style.cssText = `
        position: fixed;
        bottom: 14px;
        left: 14px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 24px;
        padding: 6px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 12px;
        color: #e2e8f0;
        z-index: 999999;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
      `;

      badge.innerHTML = `
        <span style="color:#10b981;"><i class="fa-solid fa-circle" style="font-size:8px;"></i></span>
        <span><b>${user.name || user.login}</b> (${user.role})</span>
        <button id="btnGlobalLogout" style="
          background: #374151;
          border: none;
          color: #f87171;
          padding: 3px 8px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        "><i class="fa-solid fa-arrow-right-from-bracket"></i> Chiqish</button>
      `;

      document.body.appendChild(badge);

      document.getElementById("btnGlobalLogout").addEventListener("click", () => {
        if (confirm("Haqiqatan ham tizimdan chiqmoqchimisiz?")) {
          const t = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
          fetch("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: t })
          }).finally(() => {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            sessionStorage.removeItem("auth_token");
            window.location.href = "/login.html";
          });
        }
      });
    });
  }
})();
