/**
 * 警校考研助手 — 通知提醒调度
 * 请求通知权限，每 60 秒检查到期计划并弹出系统通知
 */
var Notifications = (function () {
  'use strict';

  var checkIntervalId = null;
  var lastNotifyDate  = {};  // 记录每个计划上次通知日期，避免同一天重复通知

  /**
   * 请求通知权限
   */
  function requestPermission() {
    if (!('Notification' in window)) {
      console.log('[Notify] 浏览器不支持 Notification API');
      return;
    }

    if (Notification.permission === 'granted') {
      console.log('[Notify] 通知权限已授权');
      return;
    }

    if (Notification.permission === 'denied') {
      console.log('[Notify] 通知权限已被拒绝');
      return;
    }

    // 请求权限（需要在用户手势后调用）
    Notification.requestPermission().then(function (permission) {
      console.log('[Notify] 通知权限: ' + permission);
    });
  }

  /**
   * 弹出系统通知
   */
  function showNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      var n = new Notification(title, {
        body: body,
        icon: 'assets/icon-192.png',
        tag: 'study-reminder',
        badge: 'assets/icon-192.png',
        requireInteraction: true,
        vibrate: [200, 100, 200]
      });

      // 5 秒后自动关闭
      setTimeout(function () { n.close(); }, 8000);

      n.onclick = function () {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.error('[Notify] 通知弹出失败:', e);
    }
  }

  /**
   * 今天是否已经通知过此计划
   */
  function alreadyNotifiedToday(planId) {
    var today = new Date().toDateString();
    return lastNotifyDate[planId] === today;
  }

  /**
   * 标记此计划今天已通知
   */
  function markNotified(planId) {
    lastNotifyDate[planId] = new Date().toDateString();
  }

  /**
   * 检查到期计划
   */
  function checkDuePlans() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // 如果 Plans 模块未加载，跳过
    if (typeof Plans === 'undefined' || !Plans.getTodayActivePlans) return;

    var activePlans = Plans.getTodayActivePlans();
    if (!activePlans || activePlans.length === 0) return;

    var now = new Date();
    var currentTime =
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');

    activePlans.forEach(function (plan) {
      if (!plan.scheduledTime) return;
      if (plan.scheduledTime !== currentTime) return;
      if (alreadyNotifiedToday(plan.id)) return;

      var subjectNames = {
        'politics': '政治', 'english': '英语',
        'math': '数学', 'specialized': '专业课'
      };
      var subjectName = subjectNames[plan.subject] || plan.subject;

      showNotification(
        '📚 该学习啦！— ' + subjectName,
        plan.title + (plan.description ? ' — ' + plan.description : '')
      );

      markNotified(plan.id);
    });
  }

  /**
   * 启动定时检查
   */
  function startChecking() {
    if (checkIntervalId) return;

    // 首次立即检查一次
    checkDuePlans();

    // 每 60 秒检查一次
    checkIntervalId = setInterval(checkDuePlans, 60000);

    console.log('[Notify] 定时检查已启动（每 60 秒）');
  }

  /**
   * 在用户首次点击时请求通知权限（避免页面加载时弹权限请求）
   */
  function bindPermissionTrigger() {
    document.addEventListener('click', function once() {
      requestPermission();
      startChecking();
    }, { once: true });
  }

  /**
   * 为添加计划按钮单独绑定（更合理的权限请求时机）
   */
  function init() {
    var btnAdd = document.getElementById('btn-add-plan');
    if (btnAdd) {
      btnAdd.addEventListener('click', function () {
        requestPermission();
        if (!checkIntervalId) startChecking();
      });
    }

    // 同时也绑定全局首次点击
    bindPermissionTrigger();

    // 如果已授权，直接启动检查
    if ('Notification' in window && Notification.permission === 'granted') {
      startChecking();
    }

    console.log('[Notify] 通知模块初始化完成');
  }

  return {
    init: init,
    requestPermission: requestPermission,
    checkDuePlans: checkDuePlans
  };
})();
