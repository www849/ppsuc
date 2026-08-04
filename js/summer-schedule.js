/**
 * 暑假作息闹钟 — 强制提醒（响铃+振动）
 * 仅在学习时段、起床、睡觉触发
 * 有效期至 2026-08-26
 */
var SummerSchedule = (function () {
  'use strict';

  /* ---- 作息表 ---- */
  var SCHEDULE = [
    { time: '06:00', label: '起床',        icon: '🌅', type: 'wake',     alarm: true },
    { time: '06:10', label: '骑行训练',     icon: '🚴', type: 'exercise', alarm: false },
    { time: '07:30', label: '拉伸+早餐',   icon: '🥣', type: 'routine',  alarm: false },
    { time: '08:00', label: '上午学习',     icon: '📖', type: 'study',    alarm: true },
    { time: '11:30', label: '午餐+休息',   icon: '🍚', type: 'routine',  alarm: false },
    { time: '12:30', label: '午间小憩',     icon: '😴', type: 'routine',  alarm: false },
    { time: '13:30', label: '下午学习',     icon: '📖', type: 'study',    alarm: true },
    { time: '16:30', label: '学习结束',     icon: '✅', type: 'routine',  alarm: false },
    { time: '17:00', label: '力量/腹肌',   icon: '💪', type: 'exercise', alarm: false },
    { time: '18:00', label: '晚餐',        icon: '🍜', type: 'routine',  alarm: false },
    { time: '19:00', label: '晚间学习',     icon: '📖', type: 'study',    alarm: true },
    { time: '22:30', label: '准备睡觉',     icon: '🌙', type: 'sleep',    alarm: true }
  ];

  var END_DATE = '2026-08-26';

  /* ---- 状态 ---- */
  var enabled = true;
  var audioCtx = null;
  var alarmInterval = null;
  var lastTriggered = {};  // { '08:00': '2026-08-04' } 防止同分钟重复触发

  /* ---- DOM ---- */
  var containerEl;

  /* ---- 检查是否在有效期内 ---- */
  function isActive() {
    var today = dateKey();
    return enabled && today <= END_DATE;
  }

  /* ---- 渲染作息表 ---- */
  function render() {
    if (!containerEl) return;

    var now = new Date();
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    var todayStr = dateKey();

    // 获取今天的星期
    var weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    var weekDay = weekDays[now.getDay()];

    var expired = todayStr > END_DATE;

    var html = '';

    // 状态栏
    if (expired) {
      html += '<div style="text-align:center;padding:8px;margin-bottom:8px;border-radius:4px;background:rgba(197,165,90,0.12);color:#C5A55A;font-size:12px;">';
      html += '📅 暑假作息已于 8月26日 结束，新学期加油！';
      html += '</div>';
    } else {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
      html += '<span style="font-size:12px;color:var(--text-tertiary);">📅 ' + todayStr + ' 星期' + weekDay + '</span>';
      html += '<span style="font-size:12px;color:rgba(197,165,90,0.7);">至 8月26日</span>';
      html += '</div>';

      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
      html += '<span style="font-size:11px;color:var(--text-tertiary);">🔔 闹钟：仅学习/起床/睡觉</span>';
      html += '<button class="summer-toggle" id="summer-toggle" style="font-size:11px;padding:3px 10px;border-radius:3px;border:1px solid ' +
        (enabled ? '#C5A55A' : 'rgba(255,255,255,0.2)') + ';background:' +
        (enabled ? 'rgba(197,165,90,0.2)' : 'transparent') + ';color:' +
        (enabled ? '#C5A55A' : 'rgba(255,255,255,0.4)') + ';cursor:pointer;">' +
        (enabled ? '🟢 已开启' : '⚪ 已关闭') + '</button>';
      html += '</div>';
    }

    // 时间线
    html += '<div class="summer-timeline">';
    SCHEDULE.forEach(function (item) {
      var parts = item.time.split(':');
      var itemMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);

      // 判断是否已过
      var isPast = nowMinutes > itemMinutes;
      var isCurrent = Math.abs(nowMinutes - itemMinutes) <= 1; // 当前分钟

      var rowStyle = '';
      if (isCurrent && isActive() && !expired) {
        rowStyle = 'background:rgba(197,165,90,0.15);border-left:2px solid #C5A55A;';
      } else if (isPast) {
        rowStyle = 'opacity:0.5;';
      }

      html += '<div class="summer-row" style="display:flex;align-items:center;gap:8px;padding:5px 6px;margin:2px 0;border-radius:3px;' + rowStyle + '">';
      html += '<span style="font-size:16px;flex-shrink:0;">' + item.icon + '</span>';
      html += '<span style="font-size:13px;font-weight:600;color:var(--text-primary);min-width:36px;">' + item.time + '</span>';
      html += '<span style="font-size:12px;color:var(--text-secondary);flex:1;">' + item.label + '</span>';
      if (item.alarm) {
        html += '<span style="font-size:10px;color:#C5A55A;">🔔</span>';
      }
      html += '</div>';
    });
    html += '</div>';

    containerEl.innerHTML = html;

    // 绑定开关
    var toggleBtn = document.getElementById('summer-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        enabled = !enabled;
        saveEnabled();
        render();
        if (!enabled) {
          stopAlarm();
        }
      });
    }
  }

  /* ---- 闹钟 ---- */

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  /**
   * 播放蜂鸣声（Web Audio 合成，无需音频文件）
   * pattern: 'triple' = 三短声, 'single' = 单长声
   */
  function playBeep(callback) {
    try {
      var ctx = getAudioContext();
      var now = ctx.currentTime;

      // 振荡器：880Hz 正弦波
      function beep(start, duration) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      }

      // 三短声：200ms 响，100ms 停
      beep(now, 0.2);
      beep(now + 0.3, 0.2);
      beep(now + 0.6, 0.2);

      // 振动
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }

      if (callback) setTimeout(callback, 1000);
    } catch (e) {
      console.warn('[SummerSchedule] 音频播放失败:', e);
      if (callback) callback();
    }
  }

  function showAlarmModal(item) {
    // 移除已有弹窗
    var existing = document.getElementById('alarm-modal-overlay');
    if (existing) existing.parentNode.removeChild(existing);

    var overlay = document.createElement('div');
    overlay.id = 'alarm-modal-overlay';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:rgba(0,0,0,0.85);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;';

    var modal = document.createElement('div');
    modal.style.cssText =
      'background:#0A2442;border:2px solid #C5A55A;border-radius:12px;' +
      'padding:32px 24px;text-align:center;max-width:300px;width:90%;';

    modal.innerHTML =
      '<div style="font-size:48px;margin-bottom:12px;">' + item.icon + '</div>' +
      '<div style="font-size:32px;font-weight:700;color:#C5A55A;margin-bottom:4px;">' + item.time + '</div>' +
      '<div style="font-size:18px;color:#fff;margin-bottom:20px;">' + item.label + '</div>' +
      '<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:20px;">时间到了，行动起来！</div>' +
      '<button id="alarm-dismiss" style="' +
        'background:#C5A55A;color:#0A2442;border:none;' +
        'padding:12px 48px;border-radius:6px;font-size:16px;font-weight:700;' +
        'cursor:pointer;width:100%;">我知道了</button>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('alarm-dismiss').addEventListener('click', function () {
      document.body.removeChild(overlay);
      stopAlarm();
    });
  }

  function triggerAlarm(item) {
    // 检查是否已在本分钟触发过
    var today = dateKey();
    if (lastTriggered[item.time] === today) return;
    lastTriggered[item.time] = today;

    // 播放蜂鸣+振动
    playBeep(function () {
      showAlarmModal(item);
    });

    // 每 8 秒重复蜂鸣，直到用户关闭弹窗
    alarmInterval = setInterval(function () {
      if (!document.getElementById('alarm-modal-overlay')) {
        stopAlarm();
        return;
      }
      playBeep();
    }, 8000);
  }

  function stopAlarm() {
    if (alarmInterval) {
      clearInterval(alarmInterval);
      alarmInterval = null;
    }
    var overlay = document.getElementById('alarm-modal-overlay');
    if (overlay) overlay.parentNode.removeChild(overlay);
  }

  /* ---- 轮询检查 ---- */
  var checkInterval = null;

  function check() {
    if (!isActive()) return;

    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    var currentTime = h + ':' + m;

    SCHEDULE.forEach(function (item) {
      if (item.alarm && item.time === currentTime) {
        triggerAlarm(item);
      }
    });
  }

  /* ---- 持久化 ---- */
  function loadEnabled() {
    return DB.get('settings', 'summer_schedule_enabled').then(function (record) {
      if (record !== undefined && record !== null) {
        enabled = record.value === true || record.value === 'true';
      }
    }).catch(function () {
      enabled = true;
    });
  }

  function saveEnabled() {
    DB.put('settings', { key: 'summer_schedule_enabled', value: enabled }).catch(function () {});
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
    containerEl = document.getElementById('summer-schedule');

    loadEnabled().then(function () {
      render();

      // 每 15 秒轮询（分钟级精度足够）
      checkInterval = setInterval(function () {
        check();
        // 每到新一分钟时刷新时间线高亮
        var s = new Date().getSeconds();
        if (s < 15) render();
      }, 15000);

      // 初始化后立即检查一次
      setTimeout(check, 1000);

      console.log('[SummerSchedule] 暑假作息闹钟已就绪 (至 ' + END_DATE + ')');
    });
  }

  function refresh() {
    render();
  }

  return {
    init: init,
    refresh: refresh
  };
})();
