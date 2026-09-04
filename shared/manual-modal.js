/**
 * Universal O'quv Qo'llanma (Department User Manual & SOP) System
 * Supports view mode, step tabs, admin live in-place editing, and multi-portal syncing!
 */
(function() {
  window.ManualModal = {
    currentKey: null,
    currentData: null,
    isEditMode: false,
    activeTab: 'duties',

    // Check if current user is admin
    canEdit: function() {
      try {
        const u = window.currentUser || (window.parent && window.parent.currentUser) || (function() {
          const raw = localStorage.getItem('auth_user') || (window.parent && window.parent.localStorage ? window.parent.localStorage.getItem('auth_user') : null);
          return raw ? JSON.parse(raw) : null;
        })();
        if (!u) return true; // Default allow in local network if unauthenticated
        const role = String(u.role || '').toLowerCase();
        return ['admin', 'super_admin', 'server_nazoratchisi', 'bosh_vrach'].includes(role);
      } catch (e) {
        return true;
      }
    },

    // Open manual by department key
    open: async function(key) {
      this.currentKey = key || 'laborant';
      this.isEditMode = false;
      this.activeTab = 'duties';

      // Load data
      let manual = null;
      try {
        const res = await fetch('/api/manuals/' + encodeURIComponent(this.currentKey));
        const json = await res.json();
        if (json.success && json.manual) {
          manual = json.manual;
        }
      } catch (e) {
        console.error('Manual load error:', e);
      }

      if (!manual) {
        manual = {
          key: this.currentKey,
          title: "Bo'lim Qo'llanmasi",
          roleName: "Xodim",
          icon: "fa-book-open",
          description: "Ushbu bo'lim uchun qo'llanma hali kiritilmagan.",
          duties: ["Xizmat vazifalarini bajarish."],
          responsibilities: ["Tizim qoidalariga rioya qilish."],
          usageGuide: ["Tizimdan foydalanish bo'yicha ko'rsatma."],
          notes: ["Muhim eslatmalar."]
        };
      }

      this.currentData = JSON.parse(JSON.stringify(manual));
      this.renderModal();
    },

    // Close modal
    close: function() {
      const el = document.getElementById('universalManualModal');
      if (el) el.remove();
    },

    // Switch tab
    switchTab: function(tab) {
      this.activeTab = tab;
      const tabs = document.querySelectorAll('.manual-tab-btn');
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      const panels = document.querySelectorAll('.manual-tab-panel');
      panels.forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
    },

    // Toggle edit mode
    toggleEditMode: function() {
      this.isEditMode = !this.isEditMode;
      this.renderModal();
    },

    // Render modal HTML
    renderModal: function() {
      let el = document.getElementById('universalManualModal');
      if (!el) {
        el = document.createElement('div');
        el.id = 'universalManualModal';
        el.className = 'manual-modal-backdrop';
        el.onclick = (e) => {
          if (e.target === el) window.ManualModal.close();
        };
        document.body.appendChild(el);
      }

      const m = this.currentData || {};
      const canEdit = this.canEdit();
      const roleText = m.roleName || "Mas'ul xodim";
      const editModeLabel = this.isEditMode ? "Ko'rish rejimi" : "Tahrirlash";

      let updatedTimeText = "Boshlang'ich";
      if (m.updatedAt) {
        try {
          const d = new Date(m.updatedAt);
          updatedTimeText = d.toLocaleDateString('uz-UZ') + ' ' + d.toLocaleTimeString('uz-UZ').substring(0, 5);
        } catch (e) {}
      }

      el.innerHTML = `
        <div class="manual-modal-card" onclick="event.stopPropagation()">
          <!-- Header -->
          <div class="manual-modal-header">
            <div class="manual-modal-title-group">
              <div class="manual-modal-icon-badge">
                <i class="fa-solid ${m.icon || 'fa-book-open'}"></i>
              </div>
              <div>
                ${this.isEditMode ? `
                  <input type="text" id="editManualTitle" class="manual-edit-input" style="font-size:16px; font-weight:800; width:100%; margin-bottom:4px;" value="${this.escapeAttr(m.title || '')}">
                  <div style="display:flex; gap:8px;">
                    <input type="text" id="editManualRole" class="manual-edit-input" style="font-size:12px; padding:4px 8px;" placeholder="Rol nomi" value="${this.escapeAttr(m.roleName || '')}">
                    <input type="text" id="editManualIcon" class="manual-edit-input" style="font-size:12px; padding:4px 8px; width:140px;" placeholder="FontAwesome fa-..." value="${this.escapeAttr(m.icon || 'fa-book-open')}">
                  </div>
                ` : `
                  <h2 class="manual-modal-title">${this.escapeHtml(m.title || "Bo'lim Qo'llanmasi")}</h2>
                  <div class="manual-modal-subtitle">
                    <span class="manual-role-tag"><i class="fa-solid fa-user-shield"></i> ${this.escapeHtml(roleText)}</span>
                    <select class="manual-dept-select" onchange="ManualModal.open(this.value)" style="background:#1e293b; color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:6px; font-size:11.5px; font-weight:700; padding:2px 6px; cursor:pointer;">
                      <option value="navbat_yozish" ${this.currentKey === 'navbat_yozish' ? 'selected' : ''}>🎫 Navbatga Yozish (Qabulxona)</option>
                      <option value="laborant" ${this.currentKey === 'laborant' ? 'selected' : ''}>🧲 Laborant Portali (MRT/MSKT)</option>
                      <option value="registratura" ${this.currentKey === 'registratura' ? 'selected' : ''}>🏥 Registratura</option>
                      <option value="vrach" ${this.currentKey === 'vrach' ? 'selected' : ''}>👨‍⚕️ Shifokor-Radiolog (Vrach)</option>
                      <option value="admin" ${this.currentKey === 'admin' ? 'selected' : ''}>🛡️ Administrator</option>
                      <option value="server_dashboard" ${this.currentKey === 'server_dashboard' ? 'selected' : ''}>🖥️ Server Nazorati</option>
                      <option value="tv_tablo" ${this.currentKey === 'tv_tablo' ? 'selected' : ''}>📺 TV Tablo</option>
                      <option value="hisobchi" ${this.currentKey === 'hisobchi' ? 'selected' : ''}>📊 Buxgalteriya & Kassa</option>
                    </select>
                  </div>
                `}
              </div>
            </div>
            <div class="manual-modal-actions">
              ${canEdit ? `
                <button class="btn-manual-edit-toggle" onclick="ManualModal.toggleEditMode()">
                  <i class="fa-solid ${this.isEditMode ? 'fa-eye' : 'fa-pen-to-square'}"></i>
                  ${editModeLabel}
                </button>
              ` : ''}
              <button class="btn-manual-close" onclick="ManualModal.close()" title="Yopish">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <!-- Tabs Bar -->
          <div class="manual-tabs-bar">
            <button class="manual-tab-btn ${this.activeTab === 'duties' ? 'active' : ''}" data-tab="duties" onclick="ManualModal.switchTab('duties')">
              <i class="fa-solid fa-list-check icon-duty"></i> 📋 Asosiy Vazifalar (${(m.duties || []).length})
            </button>
            <button class="manual-tab-btn ${this.activeTab === 'responsibilities' ? 'active' : ''}" data-tab="responsibilities" onclick="ManualModal.switchTab('responsibilities')">
              <i class="fa-solid fa-shield-halved icon-resp"></i> ⚖️ Majburiyat va Qoidalar (${(m.responsibilities || []).length})
            </button>
            <button class="manual-tab-btn ${this.activeTab === 'usageGuide' ? 'active' : ''}" data-tab="usageGuide" onclick="ManualModal.switchTab('usageGuide')">
              <i class="fa-solid fa-play icon-guide"></i> 🚀 Qanday Foydalaniladi (${(m.usageGuide || []).length})
            </button>
            <button class="manual-tab-btn ${this.activeTab === 'notes' ? 'active' : ''}" data-tab="notes" onclick="ManualModal.switchTab('notes')">
              <i class="fa-solid fa-lightbulb icon-note"></i> 💡 Muhim Maslahatlar (${(m.notes || []).length})
            </button>
          </div>

          <!-- Modal Body -->
          <div class="manual-modal-body">
            ${this.isEditMode ? `
              <div style="margin-bottom:16px;">
                <label style="font-size:12px; font-weight:700; color:#94a3b8; margin-bottom:4px; display:block;">Bo'lim tavsifi:</label>
                <textarea id="editManualDesc" class="manual-edit-input" style="width:100%; height:60px;">${this.escapeHtml(m.description || '')}</textarea>
              </div>
            ` : `
              <div class="manual-desc-box">
                <i class="fa-solid fa-circle-info" style="color:#38bdf8; margin-right:6px;"></i>
                ${this.escapeHtml(m.description || '')}
              </div>
            `}

            <!-- Panel 1: Duties -->
            <div class="manual-tab-panel ${this.activeTab === 'duties' ? 'active' : ''}" data-tab="duties">
              ${this.renderListSection('duties', m.duties || [], 'fa-circle-check icon-duty', "Vazifa mazmunini kiriting...")}
            </div>

            <!-- Panel 2: Responsibilities -->
            <div class="manual-tab-panel ${this.activeTab === 'responsibilities' ? 'active' : ''}" data-tab="responsibilities">
              ${this.renderListSection('responsibilities', m.responsibilities || [], 'fa-triangle-exclamation icon-resp', "Majburiyat yoki xavfsizlik talabini kiriting...")}
            </div>

            <!-- Panel 3: Usage Guide -->
            <div class="manual-tab-panel ${this.activeTab === 'usageGuide' ? 'active' : ''}" data-tab="usageGuide">
              ${this.renderListSection('usageGuide', m.usageGuide || [], 'fa-chevron-right icon-guide', "Bosqich yo'riqnomasini kiriting (masalan: 1-qadam...)")}
            </div>

            <!-- Panel 4: Notes -->
            <div class="manual-tab-panel ${this.activeTab === 'notes' ? 'active' : ''}" data-tab="notes">
              ${this.renderListSection('notes', m.notes || [], 'fa-lightbulb icon-note', "Klinik yoki texnik maslahatni kiriting...")}
            </div>
          </div>

          <!-- Footer -->
          <div class="manual-modal-footer">
            <div class="manual-meta-info">
              <i class="fa-regular fa-clock"></i> Oxirgi tahrir: ${updatedTimeText} 
              ${m.updatedBy ? `(${this.escapeHtml(m.updatedBy)})` : ''}
            </div>
            <div class="manual-footer-actions">
              ${this.isEditMode ? `
                <button class="btn-manual-cancel" onclick="ManualModal.toggleEditMode()">Bekor qilish</button>
                <button class="btn-manual-save" onclick="ManualModal.saveChanges()">
                  <i class="fa-solid fa-floppy-disk"></i> Saqlash
                </button>
              ` : `
                <button class="btn-manual-cancel" onclick="ManualModal.close()">Tushundim</button>
              `}
            </div>
          </div>
        </div>
      `;
    },

    // Render list section (view mode vs edit mode)
    renderListSection: function(key, items, iconClass, placeholder) {
      if (!this.isEditMode) {
        if (!items || items.length === 0) {
          return '<div style="color:#64748b; font-size:13px; text-align:center; padding:20px;">Ma\'lumot mavjud emas</div>';
        }
        return `
          <ul class="manual-items-list">
            ${items.map((item, idx) => `
              <li class="manual-item-card">
                <span class="manual-item-num">${idx + 1}</span>
                <div style="flex:1;">${this.escapeHtml(item)}</div>
                <i class="fa-solid ${iconClass} manual-item-icon"></i>
              </li>
            `).join('')}
          </ul>
        `;
      }

      // Edit Mode
      return `
        <div class="manual-edit-container" data-field="${key}">
          <div class="manual-edit-items-list">
            ${items.map((item, idx) => `
              <div class="manual-edit-row">
                <span class="manual-item-num">${idx + 1}</span>
                <textarea class="manual-edit-input manual-item-field" rows="2" placeholder="${this.escapeAttr(placeholder)}">${this.escapeHtml(item)}</textarea>
                <button class="btn-manual-remove-item" onclick="ManualModal.removeItem('${key}', ${idx})" title="O'chirish">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            `).join('')}
          </div>
          <button class="btn-manual-add-item" onclick="ManualModal.addItem('${key}')">
            <i class="fa-solid fa-plus-circle"></i> Yangi band qo'shish
          </button>
        </div>
      `;
    },

    // Add item in edit mode
    addItem: function(key) {
      this.collectCurrentEditValues();
      if (!this.currentData[key]) this.currentData[key] = [];
      this.currentData[key].push("");
      this.renderModal();
    },

    // Remove item in edit mode
    removeItem: function(key, idx) {
      this.collectCurrentEditValues();
      if (this.currentData[key]) {
        this.currentData[key].splice(idx, 1);
      }
      this.renderModal();
    },

    // Collect values from edit inputs into currentData
    collectCurrentEditValues: function() {
      const titleEl = document.getElementById('editManualTitle');
      if (titleEl) this.currentData.title = titleEl.value;

      const roleEl = document.getElementById('editManualRole');
      if (roleEl) this.currentData.roleName = roleEl.value;

      const iconEl = document.getElementById('editManualIcon');
      if (iconEl) this.currentData.icon = iconEl.value;

      const descEl = document.getElementById('editManualDesc');
      if (descEl) this.currentData.description = descEl.value;

      ['duties', 'responsibilities', 'usageGuide', 'notes'].forEach(key => {
        const container = document.querySelector(`.manual-edit-container[data-field="${key}"]`);
        if (container) {
          const inputs = container.querySelectorAll('.manual-item-field');
          this.currentData[key] = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);
        }
      });
    },

    // Save changes to backend
    saveChanges: async function() {
      this.collectCurrentEditValues();
      const payload = {
        key: this.currentKey,
        title: this.currentData.title,
        roleName: this.currentData.roleName,
        icon: this.currentData.icon,
        description: this.currentData.description,
        duties: this.currentData.duties,
        responsibilities: this.currentData.responsibilities,
        usageGuide: this.currentData.usageGuide,
        notes: this.currentData.notes
      };

      try {
        let token = localStorage.getItem('auth_token') || '';
        if (!token && window.parent && window.parent.localStorage) {
          try { token = window.parent.localStorage.getItem('auth_token') || ''; } catch(e) {}
        }
        const res = await fetch('/api/manuals/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? 'Bearer ' + token : ''
          },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          this.currentData = json.manual;
          this.isEditMode = false;
          this.renderModal();
          alert("✅ O'quv qo'llanmasi muvaffaqiyatli saqlandi!");
        } else {
          alert("❌ Saqlashda xatolik: " + (json.error || "Noma'lum xato"));
        }
      } catch (err) {
        alert("❌ Tarmoq xatosi: " + err.message);
      }
    },

    escapeHtml: function(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    escapeAttr: function(str) {
      if (!str) return '';
      return String(str).replace(/"/g, '&quot;');
    }
  };

  // Helper shortcut on window - delegates to parent if inside iframe
  window.openDepartmentManual = function(key) {
    try {
      if (window.parent && window.parent !== window && window.parent.ManualModal && typeof window.parent.ManualModal.open === 'function') {
        window.parent.ManualModal.open(key);
        return;
      }
    } catch (e) {}

    if (window.ManualModal && typeof window.ManualModal.open === 'function') {
      window.ManualModal.open(key);
    } else {
      console.warn("ManualModal is not initialized yet");
    }
  };
})();
