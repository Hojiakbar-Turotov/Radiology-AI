document.addEventListener('DOMContentLoaded', async () => {
  let currentSessionId = '';
  let currentToken = '';

  // Backgrounddan kuki va sessiyani olish
  try {
    const resp = await chrome.runtime.sendMessage({ action: 'GET_KARMED_COOKIES' });
    if (resp && resp.sessionId) {
      currentSessionId = resp.sessionId;
      document.getElementById('pop-sess-id').innerText = resp.sessionId.slice(0, 16) + '...';
    }
  } catch (e) {}

  // Serverdan faol profil va tarixni olish
  try {
    const res = await fetch('http://localhost:9876/api/karmed-users-history');
    const data = await res.json();
    if (data && data.success && data.history && data.history.users) {
      const users = Object.values(data.history.users);
      if (users.length > 0) {
        const u = users[0];
        document.getElementById('pop-user-name').innerText = '👤 ' + (u.fullName || 'Xodim') + ' (' + u.username + ')';
        if (u.lastSessionId) {
          currentSessionId = u.lastSessionId;
          document.getElementById('pop-sess-id').innerText = u.lastSessionId.slice(0, 16) + '...';
        }
        if (u.lastLoginBilgi) {
          currentToken = u.lastLoginBilgi;
          document.getElementById('pop-token').innerText = u.lastLoginBilgi.slice(0, 16) + '...';
        }
      }
    }
  } catch (e) {}

  // Copy buttons
  document.getElementById('pop-copy-sess').addEventListener('click', function() {
    if (currentSessionId) {
      navigator.clipboard.writeText(currentSessionId);
      this.innerText = '✔️';
      setTimeout(() => this.innerText = '📋 Nusxa', 1500);
    }
  });

  document.getElementById('pop-copy-tok').addEventListener('click', function() {
    if (currentToken) {
      navigator.clipboard.writeText(currentToken);
      this.innerText = '✔️';
      setTimeout(() => this.innerText = '📋 Nusxa', 1500);
    }
  });

  // Sahifadagi panelni ochish
  document.getElementById('btn-open-panel').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const panel = document.getElementById('karmed-monitor-panel');
          if (panel) {
            panel.classList.add('km-open');
            const uTab = document.getElementById('km-tab-users-btn');
            if (uTab) uTab.click();
          }
        }
      });
    }
  });

  // JSON yuklab olish
  document.getElementById('btn-download').addEventListener('click', () => {
    window.open('http://localhost:9876/api/karmed-users-history/download', '_blank');
  });
});
