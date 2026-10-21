/**
 * 警校考研助手 — 模块⑥ 解锁学习提醒
 * 离开屏幕 ≥5 分钟再回到 App 时，全屏弹出学习提醒（响铃+振动）
 * 系统限制说明：任何 App 都无法在锁屏上强制弹出；
 * 把 App 留在前台锁屏，解锁后回到它即触发。
 */
var UnlockReminder = (function () {
  'use strict';

  var HIDDEN_THRESHOLD = 5 * 60 * 1000;  // 离开屏幕 ≥5 分钟才提醒
  var COOLDOWN         = 10 * 60 * 1000; // 两次提醒至少间隔 10 分钟

  /* ---- 警句库 ---- */
  var QUOTES = [
    '今天多学一小时，考场多拿十分',
    '你不逼自己一把，永远不知道自己多优秀',
    '既然选择了远方，便只顾风雨兼程',
    '警徽在前，使命在肩；今日苦读，明日担当',
    '一天不练，自己知道；三天不练，对手知道',
    '最怕一生碌碌无为，还安慰自己平凡可贵',
    '成功的路上并不拥挤，因为坚持的人不多'
  ];

  /* ---- 状态 ---- */
  var enabled = true;
  var mutedToday = null;   // 'YYYY-MM-DD' 今天不再提醒
  var lastHiddenAt = null;
  var lastShownAt = 0;
  var audioCtx = null;
  var lastQuoteIdx = -1;

  /* ---- DOM ---- */
  var toggleEl, statusEl;

  function cacheDOM() {
    toggleEl = document.getElementById('unlock-toggle');
    statusEl = document.getElementById('unlock-status');
  }

  /* ---- 声音 ---- */

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  /** 播放两短声蜂鸣 + 振动（比闹钟柔和，是提醒不是警报） */
  function playBeep() {
    try {
      var ctx = getAudioContext();
      var now = ctx.currentTime;

      function beep(start, duration) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      }

      beep(now, 0.2);
      beep(now + 0.3, 0.2);

      if (navigator.vibrate) {
        navigator.vibrate([150, 100, 150]);
      }
    } catch (e) {
      console.warn('[UnlockReminder] 音频播放失败:', e);
    }
  }

  /* ---- 提醒弹窗 ---- */

  function calcExamDays() {
    return DB.getSetting('examDate').then(function (date) {
      if (!date) return null;
      var parts = date.split('-');
      var target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }).catch(function () { return null; });
  }

  function getTodayCheckin() {
    var tk = dateKey();
    return DB.getByIndex('checkins', 'date', tk).then(function (results) {
      var record = (results && results.length > 0) ? results[0] : null;
      var KEYS = ['politics', 'english', 'math', 'specialized', 'physical'];
      var done = 0;
      KEYS.forEach(function (k) { if (record && record[k]) done++; });
      return done + '/' + KEYS.length;
    }).catch(function () { return null; });
  }

  function pickQuote() {
    var idx;
    do {
      idx = Math.floor(Math.random() * QUOTES.length);
    } while (idx === lastQuoteIdx && QUOTES.length > 1);
    lastQuoteIdx = idx;
    return QUOTES[idx];
  }

  function dismiss() {
    var overlay = document.getElementById('unlock-modal-overlay');
    if (overlay) overlay.parentNode.removeChild(overlay);
  }

  function showReminder() {
    lastShownAt = Date.now();

    // 已有弹窗时不再叠加
    if (document.getElementById('unlock-modal-overlay')) return;
    // 与作息闹钟弹窗互斥
    if (document.getElementById('alarm-modal-overlay')) return;

    playBeep();

    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');

    var overlay = document.createElement('div');
    overlay.id = 'unlock-modal-overlay';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:rgba(0,0,0,0.85);z-index:9998;' +
      'display:flex;align-items:center;justify-content:center;';

    var modal = document.createElement('div');
    modal.style.cssText =
      'background:#0A2442;border:2px solid #C5A55A;border-radius:12px;' +
      'padding:28px 22px;text-align:center;max-width:300px;width:90%;';

    modal.innerHTML =
      '<div style="font-size:44px;margin-bottom:10px;">📖</div>' +
      '<div style="font-size:13px;color:#C5A55A;margin-bottom:6px;">「' + pickQuote() + '」</div>' +
      '<div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:2px;">该学习了！</div>' +
      '<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:14px;">' + hh + ':' + mm + ' · 解锁提醒</div>' +
      '<div id="unlock-extra" style="font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:18px;"></div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
        '<button id="unlock-go-checkin" style="flex:1;background:#C5A55A;color:#0A2442;border:none;' +
          'padding:11px 0;border-radius:6px;font-size:15px;font-weight:700;cursor:pointer;">✅ 去打卡</button>' +
        '<button id="unlock-go-log" style="flex:1;background:rgba(197,165,90,0.2);color:#C5A55A;border:1px solid #C5A55A;' +
          'padding:11px 0;border-radius:6px;font-size:15px;font-weight:700;cursor:pointer;">✍️ 写日志</button>' +
      '</div>' +
      '<button id="unlock-dismiss" style="width:100%;background:transparent;color:rgba(255,255,255,0.5);border:none;' +
        'padding:8px 0;font-size:14px;cursor:pointer;">知道了，继续学习</button>' +
      '<div style="margin-top:10px;"><button id="unlock-mute-today" style="background:transparent;color:rgba(255,255,255,0.3);' +
        'border:none;font-size:11px;text-decoration:underline;cursor:pointer;">今天不再提醒</button></div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 填充距考研天数 + 今日打卡进度
    Promise.all([calcExamDays(), getTodayCheckin()]).then(function (results) {
      var extra = document.getElementById('unlock-extra');
      if (!extra) return;
      var parts = [];
      if (results[0] !== null) parts.push('距离考研还有 <b style="color:#C5A55A;">' + results[0] + '</b> 天');
      if (results[1] !== null) parts.push('今日打卡 ' + results[1]);
      extra.innerHTML = parts.join(' · ') || '';
    });

    document.getElementById('unlock-go-checkin').addEventListener('click', function () {
      dismiss();
      if (typeof App !== 'undefined' && App.switchTab) App.switchTab('checkin');
    });
    document.getElementById('unlock-go-log').addEventListener('click', function () {
      dismiss();
      if (typeof App !== 'undefined' && App.switchTab) App.switchTab('prep');
    });
    document.getElementById('unlock-dismiss').addEventListener('click', dismiss);
    document.getElementById('unlock-mute-today').addEventListener('click', function () {
      mutedToday = dateKey();
      DB.setSetting('unlock_reminder_muted', mutedToday).catch(function () {});
      dismiss();
      renderToggle();
    });
  }

  /* ---- 可见性检测 ---- */

  function onVisibilityChange() {
    if (document.hidden) {
      // 离开屏幕：记录时间
      lastHiddenAt = Date.now();
      return;
    }

    // 回到屏幕
    var elapsed = lastHiddenAt ? (Date.now() - lastHiddenAt) : Infinity;
    lastHiddenAt = null;

    if (!enabled) return;
    if (mutedToday === dateKey()) return;
    if (elapsed < HIDDEN_THRESHOLD) return;
    if (Date.now() - lastShownAt < COOLDOWN) return;

    showReminder();
  }

  /* ---- 开关 ---- */

  function renderToggle() {
    if (!toggleEl || !statusEl) cacheDOM();
    if (!toggleEl) return;

    var muted = (mutedToday === dateKey());
    toggleEl.textContent = enabled ? '🟢' : '⚪';
    toggleEl.title = enabled ? '点击关闭' : '点击开启';

    if (!enabled) {
      statusEl.textContent = '已关闭，点击右侧按钮开启';
    } else if (muted) {
      statusEl.textContent = '今天已静音，明天自动恢复提醒';
    } else {
      statusEl.textContent = '离开屏幕 5 分钟后回来会响铃提醒学习';
    }
  }

  function toggleEnabled() {
    enabled = !enabled;
    DB.setSetting('unlock_reminder_enabled', enabled).catch(function () {});
    renderToggle();
  }

  function loadSettings() {
    return DB.get('settings', 'unlock_reminder_enabled').then(function (record) {
      if (record !== undefined && record !== null) {
        enabled = record.value === true || record.value === 'true';
      }
    }).catch(function () {})
    .then(function () {
      return DB.get('settings', 'unlock_reminder_muted').then(function (record) {
        if (record !== undefined && record !== null) {
          mutedToday = record.value;
        }
      }).catch(function () {});
    });
  }

  /* ---- 工具 ---- */
  function dateKey() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* ---- 初始化 ---- */
  function init() {
    cacheDOM();
    loadSettings().then(renderToggle);

    document.addEventListener('visibilitychange', onVisibilityChange);

    // 用户首次触摸时唤醒音频上下文（浏览器要求手势后才能发声）
    document.addEventListener('pointerdown', function () {
      try { getAudioContext(); } catch (e) {}
    });

    if (toggleEl) {
      toggleEl.addEventListener('click', toggleEnabled);
    }

    console.log('[UnlockReminder] 解锁学习提醒已就绪（离开≥5分钟回来即提醒）');
  }

  function refresh() {
    renderToggle();
  }

  return {
    init: init,
    refresh: refresh
  };
})();
