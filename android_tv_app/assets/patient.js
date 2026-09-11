/**
 * UTT BEMORLAR NAVBAT PORTALI — PATIENT.JS (v4.0.0)
 */

(function () {
  const patientSearchInput = document.getElementById('patientSearchInput');
  const btnSearchPatient = document.getElementById('btnSearchPatient');
  const patLiveClock = document.getElementById('patLiveClock');

  const patResultSection = document.getElementById('patResultSection');
  const calledHeroBanner = document.getElementById('calledHeroBanner');
  const calledAlertSub = document.getElementById('calledAlertSub');
  const waitingHeroBanner = document.getElementById('waitingHeroBanner');
  const waitPositionText = document.getElementById('waitPositionText');

  const pmFullName = document.getElementById('pmFullName');
  const pmPatientId = document.getElementById('pmPatientId');
  const pmQueueNumber = document.getElementById('pmQueueNumber');
  const pmRoomTitle = document.getElementById('pmRoomTitle');
  const pmDoctorName = document.getElementById('pmDoctorName');
  const pmPatientsAheadCount = document.getElementById('pmPatientsAheadCount');
  const pmTotalRoomPatients = document.getElementById('pmTotalRoomPatients');
  const pmRegTime = document.getElementById('pmRegTime');

  const patNotFound = document.getElementById('patNotFound');
  const patMultiMatches = document.getElementById('patMultiMatches');
  const multiList = document.getElementById('multiList');

  let activePatient = null;
  let lastCallAlertId = '';
  let sseSource = null;

  // 1. JONLI SOAT
  function updateLiveClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    patLiveClock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  // 2. QO'NG'IROQ VA VIBRATSIYA
  function triggerCallAlert(roomTitle) {
    // Vibratsiya
    if (window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate([500, 250, 500, 250, 800]);
      } catch (e) {}
    }

    // Audio chime
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // 3 ta baland xushxabar ohangi
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);
        g.gain.setValueAtTime(0.3, now + idx * 0.18);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.45);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 0.45);
      });
    } catch (e) {}
  }

  // 3. QIDIRUV
  async function performSearch(query) {
    const q = (query || patientSearchInput.value || '').trim();
    if (!q) return;

    patNotFound.style.display = 'none';
    patMultiMatches.style.display = 'none';

    try {
      const res = await fetch(`/api/patient/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.matches && data.matches.length > 1) {
          showMultiMatches(data.matches);
        } else if (data.matches && data.matches.length === 1) {
          selectPatient(data.matches[0]);
        } else {
          patResultSection.style.display = 'none';
          patNotFound.style.display = 'block';
        }
      } else {
        patResultSection.style.display = 'none';
        patNotFound.style.display = 'block';
      }
    } catch (e) {
      patResultSection.style.display = 'none';
      patNotFound.style.display = 'block';
    }
  }

  btnSearchPatient.addEventListener('click', () => performSearch());
  patientSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  // Namunaviy linklar
  document.querySelectorAll('.ex-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      patientSearchInput.value = link.getAttribute('data-query');
      performSearch();
    });
  });

  // 4. BIR NECHTA MOS KELGAN BEMORLARNI KO'RSATISH
  function showMultiMatches(list) {
    patResultSection.style.display = 'none';
    multiList.innerHTML = '';

    list.forEach(p => {
      const item = document.createElement('div');
      item.className = 'multi-item';
      item.innerHTML = `
        <div>
          <div class="multi-name">${escapeHtml(p.fullName)}</div>
          <div class="multi-sub">ID: <b>${escapeHtml(p.patientId)}</b> • ${escapeHtml(p.roomTitle || p.room)}</div>
        </div>
        <span class="multi-badge">Navbat № ${p.queueNo}</span>
      `;
      item.addEventListener('click', () => {
        patMultiMatches.style.display = 'none';
        selectPatient(p);
      });
      multiList.appendChild(item);
    });

    patMultiMatches.style.display = 'block';
  }

  // 5. BEMOR KARTASINI KO'RSATISH
  function selectPatient(p) {
    activePatient = p;
    try {
      localStorage.setItem('utt_patient_saved_id', p.patientId);
    } catch (e) {}

    renderPatientCard(p);
  }

  function renderPatientCard(p) {
    patResultSection.style.display = 'flex';
    patNotFound.style.display = 'none';
    patMultiMatches.style.display = 'none';

    pmFullName.textContent = p.fullName || '-';
    pmPatientId.textContent = p.patientId || '-';
    pmQueueNumber.textContent = p.queueNo || '-';
    pmRoomTitle.textContent = p.roomTitle || p.room || 'UTT Xonasi';
    pmDoctorName.textContent = p.doctorName ? `Dr. ${p.doctorName}` : '';
    pmPatientsAheadCount.textContent = p.patientsAhead != null ? `${p.patientsAhead} ta` : '0 ta';
    pmTotalRoomPatients.textContent = p.totalInRoom != null ? `${p.totalInRoom} ta` : '1 ta';
    pmRegTime.textContent = p.registrationTime || '-';

    // Holat (Chaqirilmoqdami yoki yo'q)
    if (p.isBeingCalled) {
      calledHeroBanner.style.display = 'flex';
      waitingHeroBanner.style.display = 'none';
      calledAlertSub.textContent = `Iltimos, zudlik bilan ${p.roomTitle || p.room}ga kiring!`;

      // Agar yangi chaqiruv bo'lsa, signal beramiz
      const callKey = `${p.patientId}_${p.calledAt || ''}`;
      if (lastCallAlertId !== callKey) {
        lastCallAlertId = callKey;
        triggerCallAlert(p.roomTitle || p.room);
      }
    } else {
      calledHeroBanner.style.display = 'none';
      waitingHeroBanner.style.display = 'flex';
      if (p.patientsAhead === 0) {
        waitPositionText.textContent = "Siz navbatda 1-o'rindasiz! Shifokor chaqirishini kuting.";
      } else {
        waitPositionText.textContent = `Sizdan oldin ${p.patientsAhead} ta bemor navbatda turibdi. Xona oldida kutib turing.`;
      }
    }
  }

  // 6. AVTOMATIK YANGILANISH (REAL-TIME SSE)
  function initRealtime() {
    if (!window.EventSource) {
      setInterval(refreshActivePatient, 4000);
      return;
    }

    if (sseSource) sseSource.close();
    sseSource = new EventSource('/api/events');

    sseSource.onmessage = function (e) {
      try {
        refreshActivePatient();
      } catch (err) {}
    };

    sseSource.onerror = function () {
      setTimeout(refreshActivePatient, 3500);
    };
  }

  async function refreshActivePatient() {
    if (!activePatient || !activePatient.patientId) return;

    try {
      const res = await fetch(`/api/patient/search?q=${encodeURIComponent(activePatient.patientId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.matches && data.matches.length > 0) {
          const updated = data.matches.find(m => m.patientId === activePatient.patientId) || data.matches[0];
          activePatient = updated;
          renderPatientCard(updated);
        }
      }
    } catch (e) {}
  }

  // 7. SAQLANGAN BEMORNI TIKLASH
  function checkSavedPatient() {
    try {
      const savedId = localStorage.getItem('utt_patient_saved_id');
      if (savedId) {
        patientSearchInput.value = savedId;
        performSearch(savedId);
      }
    } catch (e) {}
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  initRealtime();
  checkSavedPatient();
})();
