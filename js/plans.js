/**
 * 警校考研助手 — 模块② 学习计划
 * 四大科目计划的增删改查、筛选、提醒时间管理
 */
var Plans = (function () {
  'use strict';

  var allPlans = [];
  var currentFilter = 'all'; // all | politics | english | math | specialized

  /* ---- DOM 引用 ---- */
  var listEl, chipsEl, formOverlay, formEl, btnAdd;

  var SUBJECT_MAP = {
    'politics':    '政治',
    'english':     '英语',
    'math':        '数学',
    'specialized': '专业课'
  };

  var REPEAT_MAP = {
    'none':   '单次',
    'daily':  '每日',
    'weekly': '每周'
  };

  function cacheDOM() {
    listEl     = document.getElementById('plans-list');
    chipsEl    = document.querySelector('.subject-filters');
    formOverlay = document.getElementById('plan-form-overlay');
    formEl     = document.getElementById('plan-form');
    btnAdd     = document.getElementById('btn-add-plan');
  }

  /* ---- 渲染 ---- */

  function getSubjectLabel(key) {
    return SUBJECT_MAP[key] || key;
  }

  function getRepeatLabel(key) {
    return REPEAT_MAP[key] || key;
  }

  function renderCard(plan) {
    var card = document.createElement('div');
    card.className = 'plan-card' + (plan.isActive ? '' : ' inactive');

    card.innerHTML =
      '<div class="plan-card-top">' +
        '<span class="plan-subject-badge subject-' + plan.subject + '">' + getSubjectLabel(plan.subject) + '</span>' +
        '<span class="plan-time">⏰ ' + (plan.scheduledTime || '--:--') + '</span>' +
        '<span class="plan-repeat">' + getRepeatLabel(plan.repeatType) + '</span>' +
      '</div>' +
      '<h3 class="plan-title">' + escapeHTML(plan.title) + '</h3>' +
      (plan.description ? '<p class="plan-desc">' + escapeHTML(plan.description) + '</p>' : '') +
      '<div class="plan-card-actions">' +
        '<button class="plan-btn-toggle" data-id="' + plan.id + '">' + (plan.isActive ? '暂停' : '启用') + '</button>' +
        '<button class="plan-btn-edit" data-id="' + plan.id + '">编辑</button>' +
        '<button class="plan-btn-delete" data-id="' + plan.id + '">删除</button>' +
      '</div>';

    // 绑定事件
    card.querySelector('.plan-btn-toggle').addEventListener('click', function () {
      toggleActive(plan.id);
    });
    card.querySelector('.plan-btn-edit').addEventListener('click', function () {
      openEditor(plan);
    });
    card.querySelector('.plan-btn-delete').addEventListener('click', function () {
      deletePlan(plan.id);
    });

    return card;
  }

  function render() {
    if (!listEl) cacheDOM();
    if (!listEl) return;

    // 筛选
    var filtered = allPlans;
    if (currentFilter !== 'all') {
      filtered = allPlans.filter(function (p) { return p.subject === currentFilter; });
    }

    // 排序：启用的在前，按时间排序
    filtered.sort(function (a, b) {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="card-hint" style="text-align:center;padding:40px 0;">暂无学习计划，点击右上角 + 添加</p>';
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(function (plan) {
      listEl.appendChild(renderCard(plan));
    });
  }

  /* ---- 过滤 ---- */

  function setFilter(subject) {
    currentFilter = subject;

    // 更新 chip 状态
    if (chipsEl) {
      chipsEl.querySelectorAll('.subject-chip').forEach(function (chip) {
        chip.classList.toggle('active', chip.dataset.subject === subject);
      });
    }

    render();
  }

  /* ---- 表单 ---- */

  function openEditor(plan) {
    if (!formOverlay || !formEl) cacheDOM();
    if (!formOverlay) return;

    // 填充表单
    formEl['plan-id'].value        = plan ? plan.id : '';
    formEl['plan-subject'].value   = plan ? plan.subject : 'politics';
    formEl['plan-title'].value     = plan ? plan.title : '';
    formEl['plan-desc'].value      = plan ? (plan.description || '') : '';
    formEl['plan-time'].value      = plan ? (plan.scheduledTime || '09:00') : '09:00';
    formEl['plan-repeat'].value    = plan ? plan.repeatType : 'daily';

    formEl.querySelector('.form-title').textContent = plan ? '编辑学习计划' : '添加学习计划';
    formOverlay.classList.add('show');
  }

  function closeEditor() {
    if (!formOverlay) cacheDOM();
    if (formOverlay) formOverlay.classList.remove('show');
  }

  function handleFormSubmit(e) {
    e.preventDefault();

    if (!formEl) cacheDOM();

    var id      = formEl['plan-id'].value;
    var data = {
      subject:       formEl['plan-subject'].value,
      title:         formEl['plan-title'].value.trim(),
      description:   formEl['plan-desc'].value.trim(),
      scheduledTime: formEl['plan-time'].value,
      repeatType:    formEl['plan-repeat'].value,
      isActive:      true
    };

    if (!data.title) {
      alert('请输入计划标题');
      return;
    }

    var promise;
    if (id) {
      // 更新
      data.id = parseInt(id);
      promise = DB.put('studyPlans', data);
    } else {
      // 新增
      data.createdAt = new Date().toISOString();
      promise = DB.add('studyPlans', data);
    }

    promise
      .then(function () {
        closeEditor();
        load();
      })
      .catch(function (err) {
        console.error('[Plans] 保存失败:', err);
        alert('保存失败，请重试');
      });
  }

  /* ---- 操作 ---- */

  function toggleActive(id) {
    var plan = allPlans.find(function (p) { return p.id === id; });
    if (!plan) return;

    plan.isActive = !plan.isActive;

    DB.put('studyPlans', plan)
      .then(function () { render(); })
      .catch(function (err) {
        console.error('[Plans] 切换状态失败:', err);
        plan.isActive = !plan.isActive;
      });
  }

  function deletePlan(id) {
    if (!confirm('确认删除此学习计划？')) return;

    DB.delete('studyPlans', id)
      .then(function () { load(); })
      .catch(function (err) {
        console.error('[Plans] 删除失败:', err);
        alert('删除失败，请重试');
      });
  }

  /* ---- 加载 ---- */

  function load() {
    return DB.getAll('studyPlans').then(function (plans) {
      allPlans = plans;
      render();
      return plans;
    });
  }

  /**
   * 获取今日活跃计划（供首页和通知模块使用）
   */
  function getTodayActivePlans() {
    return allPlans.filter(function (p) {
      return p.isActive === true;
    });
  }

  /* ---- 事件绑定 ---- */

  function bindEvents() {
    // 添加按钮
    if (btnAdd) {
      btnAdd.addEventListener('click', function () { openEditor(null); });
    }

    // 表单提交
    if (formEl) {
      formEl.addEventListener('submit', handleFormSubmit);
    }

    // 关闭弹窗
    if (formOverlay) {
      formOverlay.addEventListener('click', function (e) {
        if (e.target === formOverlay) closeEditor();
      });

      var btnCancel = formOverlay.querySelector('.form-btn-cancel');
      if (btnCancel) {
        btnCancel.addEventListener('click', closeEditor);
      }
    }

    // 科目筛选
    if (chipsEl) {
      chipsEl.addEventListener('click', function (e) {
        var chip = e.target.closest('.subject-chip');
        if (chip) setFilter(chip.dataset.subject);
      });
    }
  }

  /* ---- 公开 API ---- */

  function refresh() {
    return load();
  }

  function init() {
    cacheDOM();
    bindEvents();
    load();
  }

  return {
    init: init,
    refresh: refresh,
    load: load,
    getTodayActivePlans: getTodayActivePlans
  };

  /* ---- 工具 ---- */

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
