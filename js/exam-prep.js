/**
 * 警校考研助手 — 模块⑤ 备考日历 + 学习日志
 * 重要日程倒计时（四级/数学建模）、内置复习计划、随时记录学习过程
 */
var ExamPrep = (function () {
  'use strict';

  /* ---- 重要日程（固定数据） ---- */
  var MILESTONES = [
    { key: 'cet4-signup',  title: '四级报名',      date: '2026-09-18', time: '报名开始',        icon: '📝', note: '登录全国大学英语四六级考试报名网' },
    { key: 'math-modeling', title: '数学建模大赛',  date: '2026-11-14', time: '9:00-11:30',      icon: '🧮', note: '周六上午，提前半小时入场' },
    { key: 'cet4-oral',    title: '四级口语',      date: '2026-11-21', time: 'CET-SET4',        icon: '🎤', note: '报名成功后记得打印口语准考证' },
    { key: 'cet4-written', title: '四级笔试',      date: '2026-12-12', time: 'CET-4',           icon: '📖', note: '听力+阅读+写作+翻译' }
  ];

  /* ---- 内置复习计划 ---- */
  var PLAN_GROUPS = [
    {
      title: '英语四级',
      icon: '🇬🇧',
      stages: [
        { name: '阶段一 · 9月',   detail: '词汇听力筑基：每天背 50 个高频词，精听 1 段短文并跟读' },
        { name: '阶段二 · 10月',  detail: '真题精练：每周 2 套真题限时完成，逐题分析错因；每天跟读口语 20 分钟' },
        { name: '阶段三 · 11月-12月', detail: '冲刺：口语 11/21 前每天模拟对话；笔试前每周 1 次全真模拟，背熟作文模板' }
      ]
    },
    {
      title: '数学建模',
      icon: '🧮',
      stages: [
        { name: '阶段一 · 9月',   detail: '模型储备：每周吃透 1 类经典模型（线性规划、图论、微分方程、统计回归）' },
        { name: '阶段二 · 10月',  detail: '实战演练：每两周完整做 1 道往年赛题，限时 2.5 小时，练出论文框架' },
        { name: '阶段三 · 11月上', detail: '赛前冲刺：整理常用模型模板和写作套路，11/14 上午 9:00 准时开赛' }
      ]
    }
  ];

  /* ---- 日志标签 ---- */
  var LOG_TAGS = [
    { key: 'cet4',     label: '四级' },
    { key: 'modeling', label: '建模' },
    { key: 'kaoyan',   label: '考研' },
    { key: 'other',    label: '其他' }
  ];

  var TAG_MAP = {};
  LOG_TAGS.forEach(function (t) { TAG_MAP[t.key] = t.label; });

  var currentTag = 'cet4';

  /* ---- DOM 引用 ---- */
  var milestonesEl, plansEl, tagRowEl, logInputEl, logListEl, btnSave;

  function cacheDOM() {
    milestonesEl = document.getElementById('prep-milestones');
    plansEl      = document.getElementById('prep-plans');
    tagRowEl     = document.getElementById('log-tag-row');
    logInputEl   = document.getElementById('log-content');
    logListEl    = document.getElementById('prep-log-list');
    btnSave      = document.getElementById('btn-log-save');
  }

  /* ---- 距今天数 ---- */
  function calcDays(dateStr) {
    var parts = dateStr.split('-');
    var target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var today  = new Date();
    today.setHours(0, 0, 0, 0);
    var diff = target.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /* ---- 渲染：日程里程碑 ---- */
  function renderMilestones() {
    if (!milestonesEl) return;

    var html = '';
    MILESTONES.forEach(function (m) {
      var days = calcDays(m.date);

      var statusHtml;
      if (days > 0) {
        statusHtml = '<span class="prep-days">' + days + '</span><span class="prep-days-unit">天</span>';
      } else if (days === 0) {
        statusHtml = '<span class="prep-days">今天</span>';
      } else {
        statusHtml = '<span class="prep-days past">已过</span>';
      }

      html +=
        '<div class="prep-milestone">' +
          '<span class="prep-milestone-icon">' + m.icon + '</span>' +
          '<div class="prep-milestone-info">' +
            '<div class="prep-milestone-title">' + m.title + '</div>' +
            '<div class="prep-milestone-sub">' + m.date.replace(/-/g, '.') + ' · ' + m.time + '</div>' +
            '<div class="prep-milestone-note">' + m.note + '</div>' +
          '</div>' +
          '<div class="prep-milestone-right">' + statusHtml + '</div>' +
        '</div>';
    });
    milestonesEl.innerHTML = html;
  }

  /* ---- 渲染：复习计划 ---- */
  function renderPlans() {
    if (!plansEl) return;

    var html = '';
    PLAN_GROUPS.forEach(function (group) {
      html += '<div class="prep-plan-group">' +
        '<div class="prep-plan-group-title">' + group.icon + ' ' + group.title + '</div>';

      group.stages.forEach(function (stage, i) {
        html +=
          '<div class="prep-stage">' +
            '<span class="prep-stage-no">' + (i + 1) + '</span>' +
            '<div class="prep-stage-body">' +
              '<div class="prep-stage-name">' + stage.name + '</div>' +
              '<div class="prep-stage-detail">' + stage.detail + '</div>' +
            '</div>' +
          '</div>';
      });

      html += '</div>';
    });
    plansEl.innerHTML = html;
  }

  /* ---- 渲染：日志列表 ---- */
  function renderLogs(logs) {
    if (!logListEl) return;

    if (!logs || logs.length === 0) {
      logListEl.innerHTML = '<p class="card-hint" style="text-align:center;padding:20px 0;">还没有日志，写下今天的第一条吧 ✍️</p>';
      return;
    }

    var html = '';
    logs.forEach(function (log) {
      var createdAt = log.createdAt || '';
      var dateLabel = createdAt.replace('T', ' ').substring(0, 16);

      html +=
        '<div class="log-entry">' +
          '<div class="log-entry-meta">' +
            '<span class="log-entry-tag tag-' + (log.tag || 'other') + '">' + (TAG_MAP[log.tag] || '其他') + '</span>' +
            '<span class="log-entry-time">' + dateLabel + '</span>' +
          '</div>' +
          '<div class="log-entry-content">' + escapeHTML(log.content) + '</div>' +
          '<button class="log-entry-del" data-id="' + log.id + '">删除</button>' +
        '</div>';
    });
    logListEl.innerHTML = html;

    // 绑定删除
    logListEl.querySelectorAll('.log-entry-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteLog(parseInt(btn.dataset.id));
      });
    });
  }

  /* ---- 日志操作 ---- */

  function loadLogs() {
    return DB.getAll('studyLogs').then(function (logs) {
      logs.sort(function (a, b) {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      renderLogs(logs);
      return logs;
    });
  }

  function saveLog() {
    if (!logInputEl) return;

    var content = logInputEl.value.trim();
    if (!content) {
      alert('先写点内容再保存吧');
      return;
    }

    var data = {
      tag: currentTag,
      content: content,
      createdAt: new Date().toISOString()
    };

    DB.add('studyLogs', data)
      .then(function () {
        logInputEl.value = '';
        loadLogs();
      })
      .catch(function (err) {
        console.error('[ExamPrep] 保存日志失败:', err);
        alert('保存失败，请重试');
      });
  }

  function deleteLog(id) {
    if (!confirm('删除这条日志？')) return;

    DB.delete('studyLogs', id)
      .then(loadLogs)
      .catch(function (err) {
        console.error('[ExamPrep] 删除日志失败:', err);
        alert('删除失败，请重试');
      });
  }

  function setTag(tag) {
    currentTag = tag;
    if (tagRowEl) {
      tagRowEl.querySelectorAll('.log-tag').forEach(function (chip) {
        chip.classList.toggle('active', chip.dataset.tag === tag);
      });
    }
  }

  /* ---- 事件绑定 ---- */

  function bindEvents() {
    if (tagRowEl) {
      tagRowEl.addEventListener('click', function (e) {
        var chip = e.target.closest('.log-tag');
        if (chip) setTag(chip.dataset.tag);
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', saveLog);
    }
  }

  /* ---- 公开 API ---- */

  function refresh() {
    renderMilestones();
    renderPlans();
    return loadLogs();
  }

  function init() {
    cacheDOM();
    bindEvents();
    refresh();
  }

  return {
    init: init,
    refresh: refresh
  };

  /* ---- 工具 ---- */

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
