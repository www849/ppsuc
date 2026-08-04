/**
 * 警校考研助手 — 模块④ 备考倒计时
 * 首页顶部鎏金倒计时，与目标院校考试日期联动
 */
var Countdown = (function () {
  'use strict';

  var examDate = null;   // 'YYYY-MM-DD'
  var timerId  = null;

  /* ---- DOM 引用 ---- */
  var numberEl, unitEl, hintEl;

  function cacheDOM() {
    numberEl = document.querySelector('.countdown-number');
    unitEl   = document.querySelector('.countdown-unit');
    hintEl   = document.querySelector('.countdown-card .card-hint');
  }

  /**
   * 计算距考试日期的剩余天数
   * @param {string} dateStr - 'YYYY-MM-DD'
   * @returns {number}
   */
  function calcDays(dateStr) {
    var parts = dateStr.split('-');
    var target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var today  = new Date();
    // 重置时分秒，只比较日期
    today.setHours(0, 0, 0, 0);
    var diff = target.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * 格式化日期为中文
   */
  function formatDateCN(dateStr) {
    if (!dateStr) return '未设置';
    var parts = dateStr.split('-');
    return parts[0] + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
  }

  /**
   * 渲染倒计时数字
   */
  function render() {
    if (!numberEl) cacheDOM();
    if (!numberEl) return;

    if (!examDate) {
      numberEl.textContent = '--';
      unitEl.textContent   = '天';
      if (hintEl) hintEl.textContent = '请先在「目标院校」中设置目标院校及考试日期';
      return;
    }

    var days = calcDays(examDate);

    if (days > 0) {
      numberEl.textContent = days;
      unitEl.textContent   = '天';
      if (hintEl) hintEl.textContent = '考试日期：' + formatDateCN(examDate);
    } else if (days === 0) {
      numberEl.textContent = '今';
      unitEl.textContent   = '天';
      if (hintEl) hintEl.textContent = '考试就在今天，祝你成功！';
    } else {
      numberEl.textContent = '已';
      unitEl.textContent   = '结束';
      if (hintEl) hintEl.textContent = '考试已于 ' + formatDateCN(examDate) + ' 结束';
    }
  }

  /**
   * 设置考试日期
   */
  function setDate(dateStr) {
    examDate = dateStr;
    DB.setSetting('examDate', dateStr)
      .then(function () {
        render();
      })
      .catch(function (err) {
        console.error('[Countdown] 保存日期失败:', err);
      });
  }

  /**
   * 点击倒计时卡片 → 手动修改日期
   */
  function showDatePicker() {
    var current = examDate || '';
    var input = prompt('请输入考试日期（格式：2025-12-20）', current);

    if (!input) return;

    // 简单校验格式
    var match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      alert('日期格式不正确，请输入如：2025-12-20');
      return;
    }

    setDate(input);
  }

  /**
   * 每日刷新（过午夜自动更新天数）
   */
  function scheduleDailyRefresh() {
    if (timerId) clearTimeout(timerId);

    // 计算到明天凌晨的毫秒数
    var now = new Date();
    var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var msUntilMidnight = tomorrow.getTime() - now.getTime();

    timerId = setTimeout(function () {
      render();
      scheduleDailyRefresh(); // 递归设置下一天
    }, msUntilMidnight + 1000); // +1s 确保跨过午夜
  }

  /* ---- 加载 ---- */

  function load() {
    return DB.getSetting('examDate').then(function (date) {
      if (date) {
        examDate = date;
      } else {
        // 默认大三备考 → 2027年12月底考研
        examDate = '2027-12-27';
        DB.setSetting('examDate', examDate).catch(function () {});
      }
      render();
      scheduleDailyRefresh();
    });
  }

  /* ---- 公开 API ---- */

  function refresh() {
    return load();
  }

  function init() {
    cacheDOM();
    load();

    // 点击倒计时卡片弹出日期选择
    var card = document.querySelector('.countdown-card');
    if (card) {
      card.addEventListener('click', showDatePicker);
      card.style.cursor = 'pointer';
    }
  }

  return {
    init: init,
    refresh: refresh,
    setDate: setDate,
    render: render
  };
})();
