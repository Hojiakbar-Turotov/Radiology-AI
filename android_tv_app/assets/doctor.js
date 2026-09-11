/**
 * UTT VRACH QABULXONA VA CHAQIRUV PORTALI — DOCTOR.JS (v4.0.0)
 */

(function () {
  // DOM Elements
  const loginOverlay = document.getElementById('loginOverlay');
  const doctorLoginForm = document.getElementById('doctorLoginForm');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const loginErrorMsg = document.getElementById('loginErrorMsg');

  const doctorAppContainer = document.getElementById('doctorAppContainer');
  const activeDocTitleText = document.getElementById('activeDocTitleText');
  const docLiveDate = document.getElementById('docLiveDate');
  const docLiveTime = document.getElementById('docLiveTime');
  const btnLogout = document.getElementById('btnLogout');
  const btnOpenChangePwd = document.getElementById('btnOpenChangePwd');

  // Hero Call Box
  const heroCallIdle = document.getElementById('heroCallIdle');
  const heroCallActive = document.getElementById('heroCallActive');
  const activeCallQueueNo = document.getElementById('activeCallQueueNo');
  const activeCallFullName = document.getElementById('activeCallFullName');
  const activeCallPatientId = document.getElementById('activeCallPatientId');
  const activeCallRegTime = document.getElementById('activeCallRegTime');
  const activeCallRoomTitle = document.getElementById('activeCallRoomTitle');
  const callElapsedTimer = document.getElementById('callElapsedTimer');
  const btnRepeatCall = document.getElementById('btnRepeatCall');
  const btnFinishCall = document.getElementById('btnFinishCall');

  // Table
  const docQueueCountBadge = document.getElementById('docQueueCountBadge');
  const docPatientSearch = document.getElementById('docPatientSearch');
  const btnRefreshQueue = document.getElementById('btnRefreshQueue');
  const docTableBody = document.getElementById('docTableBody');

  // Change Password Modal
  const changePwdModal = document.getElementById('changePwdModal');
  const btnCloseChangePwd = document.getElementById('btnCloseChangePwd');
  const btnCancelChangePwd = document.getElementById('btnCancelChangePwd');
  const changePwdForm = document.getElementById('changePwdForm');
  const oldPassword = document.getElementById('oldPassword');
  const newPassword = document.getElementById('newPassword');
  const confirmNewPassword = document.getElementById('confirmNewPassword');
  const changePwdMsg = document.getElementById('changePwdMsg');

  // Sound Selection Modal (25 xil chaqiruv signali)
  const btnOpenSoundModal = document.getElementById('btnOpenSoundModal');
  const soundModal = document.getElementById('soundModal');
  const btnCloseSoundModal = document.getElementById('btnCloseSoundModal');
  const btnCancelSoundModal = document.getElementById('btnCancelSoundModal');
  const btnSaveSoundModal = document.getElementById('btnSaveSoundModal');
  const btnTestSound = document.getElementById('btnTestSound');
  const chimeSoundSelect = document.getElementById('chimeSoundSelect');
  const soundModalMsg = document.getElementById('soundModalMsg');

  // State
  let currentDoctor = null; // { username, token, doctorName, roomId, roomTitle, roomNum, soundId }
  let currentPatients = [];
  let currentActiveCall = null;
  let callTimerInterval = null;
  let sseSource = null;

  // 1. LIVE CLOCK
  function updateLiveClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    docLiveDate.textContent = `📅 ${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
    docLiveTime.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  // 2. CHIME SOUND (25 XIL SIGNAL BO'YICHA ENGINE)
  function populateSoundPresets() {
    if (!chimeSoundSelect || !window.ChimeEngine) return;
    chimeSoundSelect.innerHTML = '';
    window.ChimeEngine.PRESETS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      chimeSoundSelect.appendChild(opt);
    });
  }
  populateSoundPresets();

  function playDingDong(soundId) {
    const sId = soundId || (currentDoctor ? currentDoctor.soundId : 1) || 1;
    if (window.ChimeEngine && typeof window.ChimeEngine.play === 'function') {
      window.ChimeEngine.play(sId);
    }
  }

  // 3. AUTHENTICATION (LOGIN / LOGOUT)
  function checkSavedAuth() {
    try {
      const saved = localStorage.getItem('utt_doctor_auth');
      if (saved) {
        const doc = JSON.parse(saved);
        if (doc && doc.token && doc.username) {
          applyDoctorLoggedIn(doc);
          return;
        }
      }
    } catch (e) {}
    showLoginScreen();
  }

  function showLoginScreen() {
    loginOverlay.style.display = 'flex';
    doctorAppContainer.style.display = 'none';
  }

  function applyDoctorLoggedIn(doc) {
    currentDoctor = doc;
    localStorage.setItem('utt_doctor_auth', JSON.stringify(doc));

    activeDocTitleText.textContent = `${doc.roomTitle || doc.roomId} • Dr. ${doc.doctorName}`;
    loginOverlay.style.display = 'none';
    doctorAppContainer.style.display = 'flex';

    fetchDoctorQueue();
    initSseStream();
  }

  doctorLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorMsg.style.display = 'none';

    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();

    try {
      const res = await fetch('/api/doctor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        loginPassword.value = '';
        applyDoctorLoggedIn(data.doctor);
      } else {
        loginErrorMsg.textContent = data.message || 'Noto\'g\'ri login yoki parol!';
        loginErrorMsg.style.display = 'block';
      }
    } catch (err) {
      loginErrorMsg.textContent = 'Server bilan aloqa o\'rnatilmadi: ' + err.message;
      loginErrorMsg.style.display = 'block';
    }
  });

  btnLogout.addEventListener('click', () => {
    if (confirm('Rostdan ham profilingizdan chiqmoqchimisiz?')) {
      localStorage.removeItem('utt_doctor_auth');
      currentDoctor = null;
      if (sseSource) sseSource.close();
      showLoginScreen();
    }
  });

  // 4. FETCH DOCTOR QUEUE & ACTIVE CALL
  async function fetchDoctorQueue() {
    if (!currentDoctor) return;
    try {
      const res = await fetch(`/api/doctor/my-queue?username=${encodeURIComponent(currentDoctor.username)}&token=${encodeURIComponent(currentDoctor.token)}`);
      if (res.ok) {
        const data = await res.json();
        currentPatients = data.patients || [];
        currentActiveCall = data.activeCall || null;
        renderActiveCall();
        renderQueueTable();
      }
    } catch (e) {}
  }

  btnRefreshQueue.addEventListener('click', fetchDoctorQueue);
  docPatientSearch.addEventListener('input', renderQueueTable);

  // 5. RENDER ACTIVE CALL (HERO SECTION)
  function renderActiveCall() {
    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
    }

    if (!currentActiveCall || currentActiveCall.status !== 'calling') {
      heroCallIdle.style.display = 'flex';
      heroCallActive.style.display = 'none';
      return;
    }

    heroCallIdle.style.display = 'none';
    heroCallActive.style.display = 'block';

    activeCallQueueNo.textContent = currentActiveCall.queueNo || '1';
    activeCallFullName.textContent = currentActiveCall.fullName || '-';
    activeCallPatientId.textContent = currentActiveCall.patientId || '-';
    activeCallRegTime.textContent = currentActiveCall.registrationTime || '-';
    activeCallRoomTitle.textContent = currentDoctor.roomTitle || currentDoctor.roomId;

    function updateElapsed() {
      if (!currentActiveCall || !currentActiveCall.calledAt) return;
      const elapsedSec = Math.floor((Date.now() - new Date(currentActiveCall.calledAt).getTime()) / 1000);
      if (elapsedSec < 60) {
        callElapsedTimer.textContent = `Chaqirildi: ${elapsedSec} soniya oldin`;
      } else {
        const min = Math.floor(elapsedSec / 60);
        callElapsedTimer.textContent = `Chaqirildi: ${min} daqiqa oldin`;
      }
    }

    updateElapsed();
    callTimerInterval = setInterval(updateElapsed, 2000);
  }

  // 6. RENDER QUEUE TABLE
  function renderQueueTable() {
    const q = (docPatientSearch.value || '').toLowerCase().trim();
    let filtered = currentPatients;

    if (q) {
      filtered = filtered.filter(p =>
        (p.patientId && p.patientId.toLowerCase().includes(q)) ||
        (p.fullName && p.fullName.toLowerCase().includes(q)) ||
        (p.referringDoctor && p.referringDoctor.toLowerCase().includes(q))
      );
    }

    docQueueCountBadge.textContent = `${filtered.length} ta bemor`;

    if (filtered.length === 0) {
      docTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="doc-empty-state">
            Hozirda sizning xonangizga navbatda turgan bemorlar mavjud emas.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    filtered.forEach(p => {
      const isBeingCalled = currentActiveCall && currentActiveCall.patientId === p.patientId && currentActiveCall.status === 'calling';

      html += `
        <tr class="${isBeingCalled ? 'row-calling' : ''}">
          <td style="text-align: center;"><span class="q-badge">№ ${p.queueNo}</span></td>
          <td><span class="pat-id">${escapeHtml(p.patientId || '-')}</span></td>
          <td><span class="pat-name">${escapeHtml(p.fullName || '-')}</span></td>
          <td><b>${escapeHtml(p.registrationTime || '-')}</b></td>
          <td>${escapeHtml(p.referringDoctor || '-')}</td>
          <td style="text-align: center;">
            ${isBeingCalled ? `
              <button type="button" class="btn-call-patient calling" disabled>
                🟢 Qabulda
              </button>
            ` : `
              <button type="button" class="btn-call-patient" onclick="callPatient('${escapeHtml(p.patientId)}')">
                📢 Chaqirish
              </button>
            `}
          </td>
        </tr>
      `;
    });

    docTableBody.innerHTML = html;
  }

  // 7. CALL PATIENT
  window.callPatient = async function (patientId) {
    if (!currentDoctor) return;
    const pat = currentPatients.find(p => p.patientId === patientId);
    if (!pat) return;

    try {
      const res = await fetch('/api/doctor/call-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentDoctor.username,
          token: currentDoctor.token,
          patientId: pat.patientId,
          fullName: pat.fullName,
          queueNo: pat.queueNo,
          registrationTime: pat.registrationTime,
          soundId: currentDoctor.soundId || 1
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        currentActiveCall = data.activeCall;
        renderActiveCall();
        renderQueueTable();
        playDingDong(currentDoctor.soundId || 1);
      } else {
        alert(data.message || 'Chaqirishda xatolik yuz berdi');
      }
    } catch (e) {
      alert('Aloqa xatosi: ' + e.message);
    }
  };

  btnRepeatCall.addEventListener('click', () => {
    if (currentActiveCall && currentActiveCall.patientId) {
      window.callPatient(currentActiveCall.patientId);
    }
  });

  // 8. FINISH CALL
  btnFinishCall.addEventListener('click', async () => {
    if (!currentDoctor || !currentActiveCall) return;

    try {
      const res = await fetch('/api/doctor/finish-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentDoctor.username,
          token: currentDoctor.token,
          patientId: currentActiveCall.patientId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        currentActiveCall = null;
        renderActiveCall();
        renderQueueTable();
      } else {
        alert(data.message || 'Qabulni yakunlashda xatolik yuz berdi');
      }
    } catch (e) {
      alert('Aloqa xatosi: ' + e.message);
    }
  });

  // 8.5. CHAQIRUV SIGNALINI TANLASH MODALI (25 XIL SIGNAL)
  if (btnOpenSoundModal) {
    btnOpenSoundModal.addEventListener('click', () => {
      if (soundModalMsg) soundModalMsg.style.display = 'none';
      if (currentDoctor && currentDoctor.soundId && chimeSoundSelect) {
        chimeSoundSelect.value = currentDoctor.soundId;
      }
      if (soundModal) soundModal.style.display = 'flex';
    });
  }

  if (btnCloseSoundModal) {
    btnCloseSoundModal.addEventListener('click', () => {
      if (soundModal) soundModal.style.display = 'none';
    });
  }

  if (btnCancelSoundModal) {
    btnCancelSoundModal.addEventListener('click', () => {
      if (soundModal) soundModal.style.display = 'none';
    });
  }

  if (btnTestSound) {
    btnTestSound.addEventListener('click', () => {
      const sId = parseInt(chimeSoundSelect ? chimeSoundSelect.value : 1, 10) || 1;
      playDingDong(sId);
    });
  }

  if (btnSaveSoundModal) {
    btnSaveSoundModal.addEventListener('click', async () => {
      if (!currentDoctor) return;
      const sId = parseInt(chimeSoundSelect ? chimeSoundSelect.value : 1, 10) || 1;

      try {
        const res = await fetch('/api/doctor/update-sound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentDoctor.username,
            token: currentDoctor.token,
            soundId: sId
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          currentDoctor.soundId = sId;
          localStorage.setItem('utt_doctor_auth', JSON.stringify(currentDoctor));
          if (soundModalMsg) {
            soundModalMsg.className = 'modal-msg success';
            soundModalMsg.textContent = "Chaqiruv signali muvaffaqiyatli saqlandi!";
            soundModalMsg.style.display = 'block';
          }
          playDingDong(sId);
          setTimeout(() => {
            if (soundModal) soundModal.style.display = 'none';
          }, 1100);
        } else {
          if (soundModalMsg) {
            soundModalMsg.className = 'modal-msg error';
            soundModalMsg.textContent = data.message || "Saqlashda xatolik";
            soundModalMsg.style.display = 'block';
          }
        }
      } catch (err) {
        if (soundModalMsg) {
          soundModalMsg.className = 'modal-msg error';
          soundModalMsg.textContent = "Aloqa xatosi: " + err.message;
          soundModalMsg.style.display = 'block';
        }
      }
    });
  }

  // 9. CHANGE PASSWORD MODAL
  btnOpenChangePwd.addEventListener('click', () => {
    changePwdMsg.style.display = 'none';
    oldPassword.value = '';
    newPassword.value = '';
    confirmNewPassword.value = '';
    changePwdModal.style.display = 'flex';
  });

  btnCloseChangePwd.addEventListener('click', () => { changePwdModal.style.display = 'none'; });
  btnCancelChangePwd.addEventListener('click', () => { changePwdModal.style.display = 'none'; });

  changePwdForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    changePwdMsg.style.display = 'none';

    const oldP = oldPassword.value.trim();
    const newP = newPassword.value.trim();
    const confP = confirmNewPassword.value.trim();

    if (newP !== confP) {
      changePwdMsg.className = 'modal-msg error';
      changePwdMsg.textContent = 'Yangi parollar bir-biriga mos kelmadi!';
      changePwdMsg.style.display = 'block';
      return;
    }

    try {
      const res = await fetch('/api/doctor/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentDoctor.username,
          token: currentDoctor.token,
          oldPassword: oldP,
          newPassword: newP
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        changePwdMsg.className = 'modal-msg success';
        changePwdMsg.textContent = 'Parol muvaffaqiyatli o\'zgartirildi!';
        changePwdMsg.style.display = 'block';
        setTimeout(() => { changePwdModal.style.display = 'none'; }, 1500);
      } else {
        changePwdMsg.className = 'modal-msg error';
        changePwdMsg.textContent = data.message || 'Parolni o\'zgartirishda xatolik yuz berdi';
        changePwdMsg.style.display = 'block';
      }
    } catch (err) {
      changePwdMsg.className = 'modal-msg error';
      changePwdMsg.textContent = 'Aloqa xatosi: ' + err.message;
      changePwdMsg.style.display = 'block';
    }
  });

  // 10. REAL-TIME SSE STREAM
  function initSseStream() {
    if (sseSource) sseSource.close();
    if (!window.EventSource) {
      setInterval(fetchDoctorQueue, 4000);
      return;
    }

    sseSource = new EventSource('/api/events');
    sseSource.onmessage = function (e) {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'CALL_UPDATE' || data.type === 'QUEUE_SYNC' || data.summary) {
          fetchDoctorQueue();
        }
      } catch (err) {}
    };

    sseSource.onerror = function () {
      setTimeout(fetchDoctorQueue, 3000);
    };
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

  // Init
  checkSavedAuth();
})();
