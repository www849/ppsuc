/**
 * 警校考研助手 — 模块③ 每日学习打卡
 * 日历面板 + 五大打卡分类 + 连续天数 + 月度统计
 */
var Checkin = (function () {
  'use strict';

  var today        = new Date();
  var currentYear  = today.getFullYear();
  var currentMonth = today.getMonth();     // 0-based
  var selectedDate = null;                  // 'YYYY-MM-DD'
  var checkinCache = {};                    // { 'YYYY-MM-DD': { politics, english, ... } }
  var statsData    = { streak: 0, monthlyHours: 0 };

  /* ---- 打卡分类定义 ---- */
  var CHECKIN_ITEMS = [
    { key: 'politics',    label: '政治',     icon: '📖' },
    { key: 'english',     label: '英语',     icon: '🌐' },
    { key: 'math',        label: '数学',     icon: '📐' },
    { key: 'specialized', label: '专业课',   icon: '📚' },
    { key: 'physical',    label: '体能训练', icon: '💪' }
  ];

  var DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

  /* ---- DOM 引用 ---- */
  var calendarEl, checkinItemsEl, statsEl;

  function cacheDOM() {
    calendarEl     = document.getElementById('calendar-container');
    checkinItemsEl = document.getElementById('checkin-items');
    statsEl        = document.getElementById('checkin-stats');
  }

  /* ==================== 日历渲染 ==================== */

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfWeek(year, month) {
    // 0=Sun → 转换为 0=Mon
    var jsDay = new Date(year, month, 1).getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  }

  function dateKey(year, month, day) {
    return year + '-' +
      String(month + 1).padStart(2, '0') + '-' +
      String(day).padStart(2, '0');
  }

  function todayKey() {
    return dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  }

  /**
   * 获取某天的打卡完成度（0-5）
   */
  function getCompletionCount(dateKey) {
    var record = checkinCache[dateKey];
    if (!record) return 0;
    var count = 0;
    CHECKIN_ITEMS.forEach(function (item) {
      if (record[item.key]) count++;
    });
    return count;
  }

  function isAllChecked(dateKey) {
    return getCompletionCount(dateKey) === CHECKIN_ITEMS.length;
  }

  function renderCalendar() {
    if (!calendarEl) cacheDOM();
    if (!calendarEl) return;

    var daysInMonth   = getDaysInMonth(currentYear, currentMonth);
    var firstDayOfWeek = getFirstDayOfWeek(currentYear, currentMonth);
    var totalCells    = firstDayOfWeek + daysInMonth;
    var rows          = Math.ceil(totalCells / 7);
    var tk            = todayKey();
    var sd            = selectedDate || tk;

    var monthNames = ['1月', '2月', '3月', '4月', '5月', '6月',
                      '7月', '8月', '9月', '10月', '11月', '12月'];

    var html = '';

    // 月份导航
    html += '<div class="cal-header">';
    html += '<button class="cal-nav" data-dir="prev">◀</button>';
    html += '<span class="cal-month-title">' + currentYear + '年 ' + monthNames[currentMonth] + '</span>';
    html += '<button class="cal-nav" data-dir="next">▶</button>';
    html += '</div>';

    // 星期标题
    html += '<div class="cal-weekdays">';
    DAY_LABELS.forEach(function (d) {
      html += '<span class="cal-weekday">' + d + '</span>';
    });
    html += '</div>';

    // 日期网格
    html += '<div class="cal-grid">';
    var cellCount = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < 7; c++) {
        if (cellCount < firstDayOfWeek || cellCount >= totalCells) {
          html += '<div class="cal-cell empty"></div>';
        } else {
          var day = cellCount - firstDayOfWeek + 1;
          var key = dateKey(currentYear, currentMonth, day);
          var isToday    = (key === tk);
          var isSelected = (key === sd);
          var completed  = getCompletionCount(key);
          var allDone    = (completed === CHECKIN_ITEMS.length);
          var hasCheckin = (completed > 0);

          var cls = 'cal-cell';
          if (isToday)    cls += ' today';
          if (isSelected) cls += ' selected';
          if (allDone)    cls += ' all-done';
          else if (hasCheckin) cls += ' partial';

          html += '<div class="' + cls + '" data-date="' + key + '">' +
                    '<span class="cal-day-num">' + day + '</span>' +
                    (allDone ? '<span class="cal-check-mark">✓</span>' : '') +
                  '</div>';
        }
        cellCount++;
      }
    }
    html += '</div>';

    calendarEl.innerHTML = html;

    // 绑定事件
    bindCalendarEvents();
  }

  function bindCalendarEvents() {
    // 月份导航
    calendarEl.querySelectorAll('.cal-nav').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.dir === 'prev') {
          if (currentMonth === 0) { currentYear--; currentMonth = 11; }
          else { currentMonth--; }
        } else {
          if (currentMonth === 11) { currentYear++; currentMonth = 0; }
          else { currentMonth++; }
        }
        renderCalendar();
      });
    });

    // 日期点击
    calendarEl.querySelectorAll('.cal-cell[data-date]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        selectedDate = cell.dataset.date;
        renderCalendar();
        renderCheckinItems();
      });
    });
  }

  /* ==================== 打卡项 ==================== */

  function renderCheckinItems() {
    if (!checkinItemsEl) cacheDOM();
    if (!checkinItemsEl) return;

    var sd = selectedDate || todayKey();
    var record = checkinCache[sd] || {};

    var html = '';
    CHECKIN_ITEMS.forEach(function (item) {
      var checked = !!record[item.key];
      html +=
        '<div class="checkin-item' + (checked ? ' checked' : '') + '" data-key="' + item.key + '">' +
          '<span class="checkin-icon">' + item.icon + '</span>' +
          '<span class="checkin-label">' + item.label + '</span>' +
          '<span class="checkin-toggle">' + (checked ? '✓' : '○') + '</span>' +
        '</div>';
    });

    checkinItemsEl.innerHTML = html;

    // 绑定点击切换
    checkinItemsEl.querySelectorAll('.checkin-item').forEach(function (el) {
      el.addEventListener('click', function () {
        toggleCheckin(sd, el.dataset.key);
      });
    });
  }

  function toggleCheckin(dateKey, itemKey) {
    // 只允许修改今天及以前的日期
    if (dateKey > todayKey()) {
      // 温和提示
      var hintEl = document.getElementById('checkin-muted-hint');
      if (hintEl) {
        hintEl.style.display = 'block';
        setTimeout(function () { hintEl.style.display = 'none'; }, 3000);
      }
      return;
    }

    if (!checkinCache[dateKey]) {
      checkinCache[dateKey] = {};
    }

    var record = checkinCache[dateKey];
    record[itemKey] = !record[itemKey];

    // 保存到数据库
    saveCheckin(dateKey, record);

    // 刷新
    renderCheckinItems();
    renderCalendar();
    updateStats();
  }

  /* ==================== 数据持久化 ==================== */

  function saveCheckin(dateKey, record) {
    // 查找是否已有该日期的记录
    DB.getByIndex('checkins', 'date', dateKey).then(function (results) {
      if (results && results.length > 0) {
        // 更新已有记录
        var existing = results[0];
        CHECKIN_ITEMS.forEach(function (item) {
          existing[item.key] = record[item.key] || false;
        });
        // 自动计算学习时长（每项算 1 小时）
        var count = 0;
        CHECKIN_ITEMS.forEach(function (item) {
          if (existing[item.key]) count++;
        });
        existing.studyMinutes = count * 60;
        return DB.put('checkins', existing);
      } else {
        // 新建记录
        var data = { date: dateKey, createdAt: new Date().toISOString() };
        CHECKIN_ITEMS.forEach(function (item) {
          data[item.key] = record[item.key] || false;
        });
        var count = 0;
        CHECKIN_ITEMS.forEach(function (item) {
          if (data[item.key]) count++;
        });
        data.studyMinutes = count * 60;
        return DB.add('checkins', data);
      }
    }).catch(function (err) {
      console.error('[Checkin] 保存打卡失败:', err);
    });
  }

  function loadCheckins() {
    return DB.getAll('checkins').then(function (records) {
      checkinCache = {};
      records.forEach(function (r) {
        checkinCache[r.date] = r;
      });
      return checkinCache;
    });
  }

  /* ==================== 统计 ==================== */

  function calcStreak() {
    var tk = todayKey();
    var t  = new Date(today);

    var streak = 0;
    // 从今天往回检查
    while (true) {
      var key = dateKey(t.getFullYear(), t.getMonth(), t.getDate());
      var record = checkinCache[key];
      if (!record) break;

      var hasAny = CHECKIN_ITEMS.some(function (item) { return record[item.key]; });
      if (!hasAny) break;

      streak++;
      t.setDate(t.getDate() - 1);
    }

    return streak;
  }

  function calcMonthlyHours() {
    var totalMinutes = 0;
    Object.keys(checkinCache).forEach(function (key) {
      var parts = key.split('-');
      var year  = parseInt(parts[0]);
      var month = parseInt(parts[1]) - 1;
      if (year === today.getFullYear() && month === today.getMonth()) {
        totalMinutes += (checkinCache[key].studyMinutes || 0);
      }
    });
    return (totalMinutes / 60).toFixed(1);
  }

  function updateStats() {
    var streak       = calcStreak();
    var monthlyHours = calcMonthlyHours();

    if (!statsEl) cacheDOM();
    if (!statsEl) return;

    statsEl.style.display = 'grid';
    statsEl.innerHTML =
      '<div class="stat-card">' +
        '<span class="stat-number">' + streak + '</span>' +
        '<span class="stat-label">连续打卡 / 天</span>' +
      '</div>' +
      '<div class="stat-card">' +
        '<span class="stat-number">' + monthlyHours + '</span>' +
        '<span class="stat-label">本月学习 / 小时</span>' +
      '</div>';

    if (streak === 0) {
      var yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      var yKey = dateKey(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      if (!checkinCache[yKey] || getCompletionCount(yKey) === 0) {
        // 温和断卡提示在日历区域显示
      }
    }
  }

  /* ==================== 初始化 ==================== */

  function renderAll() {
    renderCalendar();
    renderCheckinItems();
    updateStats();
  }

  function init() {
    cacheDOM();
    selectedDate = todayKey();
    loadCheckins().then(function () {
      renderAll();
    });
  }

  function refresh() {
    return loadCheckins().then(function () {
      renderAll();
    });
  }

  return {
    init: init,
    refresh: refresh
  };
})();
