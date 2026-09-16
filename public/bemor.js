/**
 * ==============================================================================
 * UTT BEMOR VA VRACHNI O'ZGARTIRISH PORTALI (bemor.js v8.2.0)
 * ==============================================================================
 */

(function () {
  'use strict';

  // DOM elementlar
  const liveClockEl = document.getElementById('liveClock');
  const searchForm = document.getElementById('searchForm');
  const patientQueryInput = document.getElementById('patientQueryInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const searchSubmitBtn = document.getElementById('searchSubmitBtn');
  const searchErrorAlert = document.getElementById('searchErrorAlert');

  const patientSection = document.getElementById('patientSection');
  const refreshPatientBtn = document.getElementById('refreshPatientBtn');
  const pFullName = document.getElementById('pFullName');
  const pStatusBadge = document.getElementById('pStatusBadge');
  const pId = document.getElementById('pId');
  const pDosya = document.getElementById('pDosya');
  const pRegTime = document.getElementById('pRegTime');
  const pCategory = document.getElementById('pCategory');
  const pQueueNo = document.getElementById('pQueueNo');
  const pPatientsAheadText = document.getElementById('pPatientsAheadText');
  const pRoomTitle = document.getElementById('pRoomTitle');
  const pDoctorName = document.getElementById('pDoctorName');
  const pRoomBadge = document.getElementById('pRoomBadge');
  const completedWarningAlert = document.getElementById('completedWarningAlert');

  const doctorsSection = document.getElementById('doctorsSection');
  const doctorsListContainer = document.getElementById('doctorsListContainer');

  const ticketSection = document.getElementById('ticketSection');
  const tQueueNum = document.getElementById('tQueueNum');
  const tPatientName = document.getElementById('tPatientName');
  const tPatientId = document.getElementById('tPatientId');
  const tRoomName = document.getElementById('tRoomName');
  const tDoctorName = document.getElementById('tDoctorName');
  const tDateTime = document.getElementById('tDateTime');
  const tNotice = document.getElementById('tNotice');
  const searchAnotherBtn = document.getElementById('searchAnotherBtn');

  // Modal elementlar
  const confirmModal = document.getElementById('confirmModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const confirmChangeBtn = document.getElementById('confirmChangeBtn');
  const modalTargetRoom = document.getElementById('modalTargetRoom');
  const modalTargetDoc = document.getElementById('modalTargetDoc');
  const modalTargetQueue = document.getElementById('modalTargetQueue');

  // Holat o'zgaruvchilari
  let currentPatientData = null;
  let currentDoctorsList = [];
  let selectedTargetDoc = null;
  let autoRefreshInterval = null;

  // 1. Jonli Soat
  function updateLiveClock() {
    if (liveClockEl) {
      const now = new Date();
      liveClockEl.textContent = now.toLocaleTimeString();
    }
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  // 2. Input tozalash tugmasi
  patientQueryInput.addEventListener('input', function () {
    clearSearchBtn.style.display = this.value.trim().length > 0 ? 'flex' : 'none';
    hideError();
  });

  clearSearchBtn.addEventListener('click', function () {
    patientQueryInput.value = '';
    clearSearchBtn.style.display = 'none';
    patientQueryInput.focus();
    hideError();
  });

  function showError(msg) {
    if (searchErrorAlert) {
      searchErrorAlert.textContent = msg;
      searchErrorAlert.style.display = 'block';
    }
  }

  function hideError() {
    if (searchErrorAlert) {
      searchErrorAlert.style.display = 'none';
    }
  }

  // 3. Qidiruvni Bajarish
  async function executeSearch(query) {
    const q = (query || patientQueryInput.value).trim();
    if (!q) {
      showError("Iltimos, bemor ID raqami yoki PINFL/JSHSHIR kodini kiriting!");
      patientQueryInput.focus();
      return;
    }

    hideError();
    setSearchLoading(true);

    try {
      const res = await fetch('/api/patient/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });

      if (!res.ok) throw new Error("Server bilan bog'lanishda xatolik yuz berdi");

      const data = await res.json();

      if (!data.success || !data.found || !data.patient) {
        showError("Bemor topilmadi! ID yoki PINFL raqamini to'g'ri kiritganingizga ishonch hosil qiling.");
        patientSection.style.display = 'none';
        doctorsSection.style.display = 'none';
        ticketSection.style.display = 'none';
        return;
      }

      currentPatientData = data.patient;
      currentDoctorsList = data.doctors || [];

      renderPatientInfo(currentPatientData);
      renderDoctorsList(currentDoctorsList, currentPatientData);

      // Ekranni silliq pastga aylantirish
      patientSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Avtomatik vrachlar navbatini yangilab turish
      startAutoRefresh();

    } catch (err) {
      showError("Xatolik: " + err.message);
    } finally {
      setSearchLoading(false);
    }
  }

  function setSearchLoading(isLoading) {
    const spinner = searchSubmitBtn.querySelector('.btn-spinner');
    const text = searchSubmitBtn.querySelector('.btn-text');
    if (spinner) spinner.style.display = isLoading ? 'inline-block' : 'none';
    if (text) text.style.display = isLoading ? 'none' : 'inline-block';
    searchSubmitBtn.disabled = isLoading;
  }

  searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    executeSearch();
  });

  if (refreshPatientBtn) {
    refreshPatientBtn.addEventListener('click', function () {
      if (currentPatientData && currentPatientData.patientId) {
        executeSearch(currentPatientData.patientId);
      }
    });
  }

  // 4. Bemor Ma'lumotlarini Ekranga Chiqarish
  function renderPatientInfo(p) {
    pFullName.textContent = p.fullName || '—';
    pId.textContent = p.patientId || '—';
    pDosya.textContent = p.dosyaNo || '—';
    pRegTime.textContent = (p.registrationDate ? p.registrationDate + ' ' : '') + (p.registrationTime || '—');
    pCategory.textContent = p.categoryTitle || p.kurumAdi || p.stayTitle || 'Standart';

    pQueueNo.textContent = p.globalQueueNo || p.queueNo || '—';
    pPatientsAheadText.textContent = `Oldingizda: ${p.patientsAhead || 0} nafar bemor`;

    pRoomTitle.textContent = p.currentRoomTitle || p.currentRoom || 'Umumiy navbat';
    pDoctorName.textContent = p.currentDoctor || 'Navbatchi shifokor';
    pRoomBadge.textContent = p.currentRoomNum ? `${p.currentRoomNum}-xona` : (p.currentRoom || 'UTT');

    // Holat badgesi
    pStatusBadge.className = 'status-badge';
    if (p.isCompleted) {
      pStatusBadge.classList.add('status-completed');
      pStatusBadge.textContent = "Tekshiruvdan o'tgan";
      completedWarningAlert.style.display = 'flex';
      doctorsSection.style.display = 'none';
    } else {
      pStatusBadge.classList.add('status-waiting');
      pStatusBadge.textContent = "Navbatda kutmoqda";
      completedWarningAlert.style.display = 'none';
      doctorsSection.style.display = 'block';
    }

    patientSection.style.display = 'block';
    ticketSection.style.display = 'none';
  }

  // 5. Vrachlar Ro'yxati va Jonli Navbatni Chiqarish
  function renderDoctorsList(doctors, patient) {
    doctorsListContainer.innerHTML = '';

    if (!Array.isArray(doctors) || doctors.length === 0) {
      doctorsListContainer.innerHTML = '<p class="text-muted">Hozirda faol vrachlar topilmadi.</p>';
      return;
    }

    doctors.forEach(doc => {
      const card = document.createElement('div');
      card.className = 'doc-card';
      if (doc.isCurrentDoctor) {
        card.classList.add('is-current');
      }

      // Navbat yuklamasi badgesi
      let loadClass = 'load-low';
      let loadText = `Kutmoqda: ${doc.waitingCount} ta`;
      if (doc.waitingCount >= 6) {
        loadClass = 'load-high';
      } else if (doc.waitingCount >= 3) {
        loadClass = 'load-mid';
      }

      card.innerHTML = `
        <div class="doc-header">
          <span class="doc-room-badge">${doc.roomNum}-XONA</span>
          <span class="doc-load-badge ${loadClass}">${loadText}</span>
        </div>
        <div class="doc-info">
          <h4>${doc.doctorName}</h4>
          <span class="doc-room-name">${doc.roomTitle}</span>
        </div>
        <div class="doc-actions">
          ${doc.isCurrentDoctor 
            ? '<button type="button" class="btn btn-secondary btn-switch" disabled>✓ Hozirgi vrachingiz</button>' 
            : `<button type="button" class="btn btn-primary btn-switch" data-kod="${doc.kod}" data-room="${doc.room}">Shu vrachga o'tish</button>`
          }
        </div>
      `;

      // Tugma hodisasi
      const btnSwitch = card.querySelector('button[data-kod]');
      if (btnSwitch) {
        btnSwitch.addEventListener('click', () => {
          openConfirmModal(doc);
        });
      }

      doctorsListContainer.appendChild(card);
    });
  }

  // 6. Tasdiqlash Modali
  function openConfirmModal(targetDoc) {
    selectedTargetDoc = targetDoc;
    modalTargetRoom.textContent = `${targetDoc.roomNum}-Xona (${targetDoc.roomTitle})`;
    modalTargetDoc.textContent = targetDoc.doctorName;
    modalTargetQueue.textContent = `Hozirda ushbu xonada kutayotgan bemorlar: ${targetDoc.waitingCount} nafar`;
    confirmModal.style.display = 'flex';
  }

  function closeConfirmModal() {
    confirmModal.style.display = 'none';
    selectedTargetDoc = null;
  }

  closeModalBtn.addEventListener('click', closeConfirmModal);
  cancelModalBtn.addEventListener('click', closeConfirmModal);

  confirmModal.addEventListener('click', function (e) {
    if (e.target === confirmModal) closeConfirmModal();
  });

  // 7. Vrachni O'zgartirish Buyrug'i
  confirmChangeBtn.addEventListener('click', async function () {
    if (!selectedTargetDoc || !currentPatientData) return;

    setModalLoading(true);

    try {
      const res = await fetch('/api/patient/change-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: currentPatientData.patientId,
          labDosyaId: currentPatientData.labDosyaId,
          targetKod: selectedTargetDoc.kod,
          targetRoom: selectedTargetDoc.room
        })
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Vrachni o'zgartirishda xatolik yuz berdi");
      }

      closeConfirmModal();

      // Yangi ma'lumotlarni saqlash
      currentPatientData = result.patient;
      if (result.doctors) currentDoctorsList = result.doctors;

      // Yangi Talonni Ko'rsatish
      renderTicket(result.ticket || {
        queueNo: currentPatientData.globalQueueNo || currentPatientData.queueNo,
        patientName: currentPatientData.fullName,
        patientId: currentPatientData.patientId,
        roomTitle: selectedTargetDoc.roomTitle,
        roomNum: selectedTargetDoc.roomNum,
        doctorName: selectedTargetDoc.doctorName,
        time: new Date().toLocaleTimeString().slice(0, 5),
        date: new Date().toLocaleDateString(),
        notice: `Iltimos, ${selectedTargetDoc.roomNum}-xona (${selectedTargetDoc.doctorName}) oldida kuting va hamshiraga ro'yxatga yozdiring.`
      });

      // Bemor kartasini va vrachlar ro'yxatini ham yangilash
      renderPatientInfo(currentPatientData);
      renderDoctorsList(currentDoctorsList, currentPatientData);

    } catch (err) {
      alert("Xatolik yuz berdi: " + err.message);
    } finally {
      setModalLoading(false);
    }
  });

  function setModalLoading(isLoading) {
    const spinner = confirmChangeBtn.querySelector('.btn-spinner');
    const text = confirmChangeBtn.querySelector('.btn-text');
    if (spinner) spinner.style.display = isLoading ? 'inline-block' : 'none';
    if (text) text.style.display = isLoading ? 'none' : 'inline-block';
    confirmChangeBtn.disabled = isLoading;
    cancelModalBtn.disabled = isLoading;
  }

  // 8. Yangi Talonni Ko'rsatish
  function renderTicket(ticket) {
    tQueueNum.textContent = ticket.queueNo || '—';
    tPatientName.textContent = ticket.patientName || '—';
    tPatientId.textContent = ticket.patientId || '—';
    tRoomName.textContent = ticket.roomTitle || `${ticket.roomNum}-xona`;
    tDoctorName.textContent = ticket.doctorName || '—';
    tDateTime.textContent = `${ticket.date || ''} ${ticket.time || ''}`.trim();
    if (ticket.notice) tNotice.textContent = ticket.notice;

    ticketSection.style.display = 'block';
    ticketSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (searchAnotherBtn) {
    searchAnotherBtn.addEventListener('click', function () {
      ticketSection.style.display = 'none';
      patientSection.style.display = 'none';
      doctorsSection.style.display = 'none';
      patientQueryInput.value = '';
      clearSearchBtn.style.display = 'none';
      patientQueryInput.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 9. Jonli Navbatni Avtomatik Yangilab Turish (Har 8 soniyada)
  function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(async () => {
      if (!currentPatientData || !currentPatientData.patientId) return;
      try {
        const res = await fetch('/api/doctors-queue-summary');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.doctors)) {
            currentDoctorsList = data.doctors;
            if (doctorsSection.style.display !== 'none') {
              renderDoctorsList(currentDoctorsList, currentPatientData);
            }
          }
        }
      } catch (e) {}
    }, 8000);
  }

  // 10. URL Query orqali to'g'ridan-to'g'ri qidiruv (masalan: ?id=57095 yoki ?pinfl=...)
  const urlParams = new URLSearchParams(window.location.search);
  const autoQuery = urlParams.get('id') || urlParams.get('q') || urlParams.get('query') || urlParams.get('pinfl');
  if (autoQuery) {
    patientQueryInput.value = autoQuery;
    clearSearchBtn.style.display = 'flex';
    executeSearch(autoQuery);
  } else {
    patientQueryInput.focus();
  }

})();
