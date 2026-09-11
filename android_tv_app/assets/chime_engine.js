/**
 * UTT NAVBAT TIZIMI — CHIME ENGINE (v4.1.0)
 * 25 xil mustaqil chaqiruv signallari (Web Audio API orqali sintez qilingan)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ChimeEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // 25 TA CHAQIRUV SIGNALLARI RO'YXATI
  const SOUND_PRESETS = [
    { id: 1, name: "1. Ding-Dong Klassik (E5 -> C5)" },
    { id: 2, name: "2. Uchlik Qo'ng'iroq (C5 -> E5 -> G5)" },
    { id: 3, name: "3. Shifoxona Chime (F5 -> A5)" },
    { id: 4, name: "4. Oltin Melodiya (G5 -> E5 -> C5)" },
    { id: 5, name: "5. Aeroport Signali (F4 -> A4 -> C5 -> F5)" },
    { id: 6, name: "6. Mayin Lift (G4 -> C5)" },
    { id: 7, name: "7. Mayin Marimba (D5 -> F#5 -> A5)" },
    { id: 8, name: "8. Arfa Tovushi (C5 -> E5 -> G5 -> B5 -> C6)" },
    { id: 9, name: "9. Juft Qo'ng'iroq (A5 -> D5)" },
    { id: 10, name: "10. Zamonaviy Pulse (E5 -> B5 -> E6)" },
    { id: 11, name: "11. Echo Bell (G5 aks-sado)" },
    { id: 12, name: "12. Sharqona Zen (D5 -> A5 -> D6)" },
    { id: 13, name: "13. Iliq Chime (F5 -> Bb5 -> D6)" },
    { id: 14, name: "14. Baland Qo'ng'iroq (C6 -> G5)" },
    { id: 15, name: "15. Yoqimli Signal (A4 -> C#5 -> E5)" },
    { id: 16, name: "16. Qo'sh Ping (B5 -> E6)" },
    { id: 17, name: "17. Simfoniya (C5 -> F5 -> A5 -> C6)" },
    { id: 18, name: "18. Ksilofon (E5 -> G#5 -> B5)" },
    { id: 19, name: "19. Yorqin Qo'ng'iroq (D5 -> F#5 -> B5)" },
    { id: 20, name: "20. Mayin To'lqin (G4 -> D5 -> B5)" },
    { id: 21, name: "21. Musaffo Tong (C5 -> E5 -> A5)" },
    { id: 22, name: "22. Billur Ring (F#5 -> C#6)" },
    { id: 23, name: "23. Raqamli Ohang (A5 -> C6 -> E6)" },
    { id: 24, name: "24. Qahrabo Garmoniya (Bb4 -> F5 -> D6)" },
    { id: 25, name: "25. Qirollik Sadolari (C5 -> G5 -> C6 -> E6)" }
  ];

  function getAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!window._uttAudioCtx || window._uttAudioCtx.state === 'closed') {
      window._uttAudioCtx = new AudioCtx();
    }
    if (window._uttAudioCtx.state === 'suspended') {
      window._uttAudioCtx.resume();
    }
    return window._uttAudioCtx;
  }

  function playNotes(notesList) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      notesList.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = n.type || 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.start);

        const peakGain = n.gain || 0.28;
        gain.gain.setValueAtTime(0.0001, now + n.start);
        gain.gain.exponentialRampToValueAtTime(peakGain, now + n.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + n.start);
        osc.stop(now + n.start + n.duration + 0.05);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // 25 TA RETSEPT
  const RECIPES = {
    1: [ // 1. Ding-Dong Klassik
      { freq: 659.25, type: 'sine', start: 0, duration: 0.55, gain: 0.3 },
      { freq: 523.25, type: 'sine', start: 0.25, duration: 0.85, gain: 0.35 }
    ],
    2: [ // 2. Uchlik Qo'ng'iroq
      { freq: 523.25, type: 'sine', start: 0, duration: 0.4, gain: 0.25 },
      { freq: 659.25, type: 'sine', start: 0.18, duration: 0.4, gain: 0.28 },
      { freq: 783.99, type: 'sine', start: 0.36, duration: 0.8, gain: 0.32 }
    ],
    3: [ // 3. Shifoxona Chime
      { freq: 698.46, type: 'sine', start: 0, duration: 0.5, gain: 0.3 },
      { freq: 880.00, type: 'sine', start: 0.22, duration: 0.9, gain: 0.35 }
    ],
    4: [ // 4. Oltin Melodiya
      { freq: 783.99, type: 'sine', start: 0, duration: 0.35, gain: 0.28 },
      { freq: 659.25, type: 'sine', start: 0.18, duration: 0.35, gain: 0.28 },
      { freq: 523.25, type: 'sine', start: 0.36, duration: 0.85, gain: 0.35 }
    ],
    5: [ // 5. Aeroport Signali
      { freq: 349.23, type: 'sine', start: 0, duration: 0.45, gain: 0.3 },
      { freq: 440.00, type: 'sine', start: 0.18, duration: 0.45, gain: 0.3 },
      { freq: 523.25, type: 'sine', start: 0.36, duration: 0.45, gain: 0.32 },
      { freq: 698.46, type: 'sine', start: 0.54, duration: 0.9, gain: 0.35 }
    ],
    6: [ // 6. Mayin Lift
      { freq: 392.00, type: 'triangle', start: 0, duration: 0.45, gain: 0.28 },
      { freq: 523.25, type: 'sine', start: 0.2, duration: 0.85, gain: 0.32 }
    ],
    7: [ // 7. Mayin Marimba
      { freq: 587.33, type: 'triangle', start: 0, duration: 0.35, gain: 0.32 },
      { freq: 739.99, type: 'triangle', start: 0.15, duration: 0.35, gain: 0.32 },
      { freq: 880.00, type: 'triangle', start: 0.3, duration: 0.7, gain: 0.35 }
    ],
    8: [ // 8. Arfa Tovushi
      { freq: 523.25, type: 'sine', start: 0, duration: 0.5, gain: 0.25 },
      { freq: 659.25, type: 'sine', start: 0.08, duration: 0.5, gain: 0.25 },
      { freq: 783.99, type: 'sine', start: 0.16, duration: 0.5, gain: 0.25 },
      { freq: 987.77, type: 'sine', start: 0.24, duration: 0.5, gain: 0.28 },
      { freq: 1046.5, type: 'sine', start: 0.32, duration: 0.9, gain: 0.3 }
    ],
    9: [ // 9. Juft Qo'ng'iroq
      { freq: 880.00, type: 'sine', start: 0, duration: 0.45, gain: 0.3 },
      { freq: 587.33, type: 'sine', start: 0.22, duration: 0.85, gain: 0.35 }
    ],
    10: [ // 10. Zamonaviy Pulse
      { freq: 659.25, type: 'sine', start: 0, duration: 0.3, gain: 0.28 },
      { freq: 987.77, type: 'sine', start: 0.14, duration: 0.3, gain: 0.28 },
      { freq: 1318.5, type: 'sine', start: 0.28, duration: 0.85, gain: 0.32 }
    ],
    11: [ // 11. Echo Bell
      { freq: 783.99, type: 'sine', start: 0, duration: 0.9, gain: 0.35 },
      { freq: 1567.98, type: 'sine', start: 0.02, duration: 0.4, gain: 0.15 },
      { freq: 783.99, type: 'sine', start: 0.35, duration: 0.6, gain: 0.18 }
    ],
    12: [ // 12. Sharqona Zen
      { freq: 587.33, type: 'sine', start: 0, duration: 0.5, gain: 0.28 },
      { freq: 880.00, type: 'sine', start: 0.2, duration: 0.5, gain: 0.3 },
      { freq: 1174.66, type: 'sine', start: 0.4, duration: 0.95, gain: 0.32 }
    ],
    13: [ // 13. Iliq Chime
      { freq: 698.46, type: 'sine', start: 0, duration: 0.4, gain: 0.28 },
      { freq: 932.33, type: 'sine', start: 0.16, duration: 0.4, gain: 0.28 },
      { freq: 1174.66, type: 'sine', start: 0.32, duration: 0.9, gain: 0.32 }
    ],
    14: [ // 14. Baland Qo'ng'iroq
      { freq: 1046.50, type: 'sine', start: 0, duration: 0.4, gain: 0.3 },
      { freq: 783.99, type: 'sine', start: 0.2, duration: 0.85, gain: 0.35 }
    ],
    15: [ // 15. Yoqimli Signal
      { freq: 440.00, type: 'triangle', start: 0, duration: 0.35, gain: 0.25 },
      { freq: 554.37, type: 'triangle', start: 0.15, duration: 0.35, gain: 0.28 },
      { freq: 659.25, type: 'triangle', start: 0.3, duration: 0.8, gain: 0.32 }
    ],
    16: [ // 16. Qo'sh Ping
      { freq: 987.77, type: 'sine', start: 0, duration: 0.25, gain: 0.3 },
      { freq: 1318.51, type: 'sine', start: 0.15, duration: 0.75, gain: 0.35 }
    ],
    17: [ // 17. Simfoniya
      { freq: 523.25, type: 'sine', start: 0, duration: 0.35, gain: 0.25 },
      { freq: 698.46, type: 'sine', start: 0.14, duration: 0.35, gain: 0.28 },
      { freq: 880.00, type: 'sine', start: 0.28, duration: 0.35, gain: 0.3 },
      { freq: 1046.50, type: 'sine', start: 0.42, duration: 0.9, gain: 0.35 }
    ],
    18: [ // 18. Ksilofon
      { freq: 659.25, type: 'triangle', start: 0, duration: 0.25, gain: 0.3 },
      { freq: 830.61, type: 'triangle', start: 0.12, duration: 0.25, gain: 0.3 },
      { freq: 987.77, type: 'triangle', start: 0.24, duration: 0.65, gain: 0.35 }
    ],
    19: [ // 19. Yorqin Qo'ng'iroq
      { freq: 587.33, type: 'sine', start: 0, duration: 0.35, gain: 0.28 },
      { freq: 739.99, type: 'sine', start: 0.15, duration: 0.35, gain: 0.3 },
      { freq: 987.77, type: 'sine', start: 0.3, duration: 0.85, gain: 0.35 }
    ],
    20: [ // 20. Mayin To'lqin
      { freq: 392.00, type: 'sine', start: 0, duration: 0.45, gain: 0.25 },
      { freq: 587.33, type: 'sine', start: 0.18, duration: 0.45, gain: 0.28 },
      { freq: 987.77, type: 'sine', start: 0.36, duration: 0.9, gain: 0.32 }
    ],
    21: [ // 21. Musaffo Tong
      { freq: 523.25, type: 'sine', start: 0, duration: 0.35, gain: 0.28 },
      { freq: 659.25, type: 'sine', start: 0.15, duration: 0.35, gain: 0.28 },
      { freq: 880.00, type: 'sine', start: 0.3, duration: 0.85, gain: 0.35 }
    ],
    22: [ // 22. Billur Ring
      { freq: 739.99, type: 'sine', start: 0, duration: 0.3, gain: 0.3 },
      { freq: 1108.73, type: 'sine', start: 0.14, duration: 0.85, gain: 0.35 }
    ],
    23: [ // 23. Raqamli Ohang
      { freq: 880.00, type: 'sine', start: 0, duration: 0.22, gain: 0.28 },
      { freq: 1046.50, type: 'sine', start: 0.11, duration: 0.22, gain: 0.28 },
      { freq: 1318.51, type: 'sine', start: 0.22, duration: 0.75, gain: 0.32 }
    ],
    24: [ // 24. Qahrabo Garmoniya
      { freq: 466.16, type: 'sine', start: 0, duration: 0.45, gain: 0.28 },
      { freq: 698.46, type: 'sine', start: 0.18, duration: 0.45, gain: 0.3 },
      { freq: 1174.66, type: 'sine', start: 0.36, duration: 0.95, gain: 0.35 }
    ],
    25: [ // 25. Qirollik Sadolari
      { freq: 523.25, type: 'sine', start: 0, duration: 0.35, gain: 0.25 },
      { freq: 783.99, type: 'sine', start: 0.12, duration: 0.35, gain: 0.28 },
      { freq: 1046.50, type: 'sine', start: 0.24, duration: 0.35, gain: 0.3 },
      { freq: 1318.51, type: 'sine', start: 0.36, duration: 1.0, gain: 0.35 }
    ]
  };

  function play(soundId) {
    const id = parseInt(soundId, 10) || 1;
    const recipe = RECIPES[id] || RECIPES[1];
    playNotes(recipe);
  }

  return {
    PRESETS: SOUND_PRESETS,
    play: play
  };
}));
