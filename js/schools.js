/**
 * 警校考研助手 — 模块① 目标警校规划
 * 院校卡片渲染、收藏、选中、一键生成备考清单
 */
var Schools = (function () {
  'use strict';

  var selectedSchoolId = null;   // 当前选中（高亮）的院校 id
  var allSchools = [];

  /* ---- DOM 引用 ---- */
  var listEl, actionsEl, btnGenerate, btnConfirm;

  function cacheDOM() {
    listEl        = document.getElementById('schools-list');
    actionsEl     = document.getElementById('schools-actions');
    btnGenerate   = document.getElementById('btn-generate-plan');
    btnConfirm    = document.getElementById('btn-confirm-school');
  }

  /* ---- 渲染 ---- */

  /**
   * 渲染单张院校卡片
   */
  function renderCard(school) {
    var isSelected = school.id === selectedSchoolId;

    var card = document.createElement('div');
    card.className = 'school-card';
    card.dataset.id = school.id;
    if (isSelected) {
      card.classList.add('selected');
    }

    // 卡片内容
    card.innerHTML =
      '<div class="school-card-header">' +
        '<h3 class="school-name">' + escapeHTML(school.name) + '</h3>' +
        '<button class="btn-favorite' + (school.isFavorite ? ' active' : '') + '" data-id="' + school.id + '" aria-label="' + (school.isFavorite ? '取消收藏' : '收藏') + '">★</button>' +
      '</div>' +
      '<div class="school-card-body">' +
        '<div class="school-info-row">' +
          '<span class="school-info-label">招录专业</span>' +
          '<span class="school-info-value">' + escapeHTML(school.majors) + '</span>' +
        '</div>' +
        '<div class="school-info-row">' +
          '<span class="school-info-label">历年分数线</span>' +
          '<span class="school-info-value">' + escapeHTML(school.scoreLines) + '</span>' +
        '</div>' +
        '<div class="school-info-row">' +
          '<span class="school-info-label">考研科目</span>' +
          '<span class="school-info-value">' + escapeHTML(school.subjects) + '</span>' +
        '</div>' +
      '</div>' +
      (isSelected ? '<span class="school-badge">★</span>' : '');

    // 点击卡片 → 选中
    card.addEventListener('click', function (e) {
      // 不拦截收藏按钮的点击
      if (e.target.closest('.btn-favorite')) return;
      selectSchool(school.id);
    });

    // 收藏按钮
    var favBtn = card.querySelector('.btn-favorite');
    favBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleFavorite(school.id);
    });

    return card;
  }

  /**
   * 渲染全部院校列表
   */
  function render() {
    if (!listEl) cacheDOM();
    if (!listEl) return;

    // 清空
    listEl.innerHTML = '';

    if (allSchools.length === 0) {
      listEl.innerHTML = '<p class="card-hint" style="text-align:center;padding:40px 0;">暂未加载院校数据</p>';
      actionsEl.style.display = 'none';
      return;
    }

    // 收藏的排前面
    var sorted = allSchools.slice().sort(function (a, b) {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });

    sorted.forEach(function (school) {
      listEl.appendChild(renderCard(school));
    });

    // 显示底部操作区
    actionsEl.style.display = 'block';
  }

  /* ---- 交互逻辑 ---- */

  /**
   * 选中/取消选中院校
   */
  function selectSchool(id) {
    if (selectedSchoolId === id) {
      // 取消选中
      selectedSchoolId = null;
    } else {
      selectedSchoolId = id;
    }
    render();
  }

  /**
   * 切换收藏状态
   */
  function toggleFavorite(id) {
    var school = allSchools.find(function (s) { return s.id === id; });
    if (!school) return;

    school.isFavorite = !school.isFavorite;

    DB.put('schools', school)
      .then(function () {
        render();
        // 同步更新首页收藏院校列表
        if (typeof App !== 'undefined' && App.refreshHome) {
          App.refreshHome();
        }
      })
      .catch(function (err) {
        console.error('[Schools] 收藏操作失败:', err);
        // 回滚
        school.isFavorite = !school.isFavorite;
      });
  }

  /**
   * 一键生成备考科目清单
   */
  function generateStudyPlan() {
    if (!selectedSchoolId) {
      alert('请先选择一所目标院校');
      return;
    }

    var school = allSchools.find(function (s) { return s.id === selectedSchoolId; });
    if (!school) return;

    // 从院校科目字段解析科目关键词
    var subjectsStr = school.subjects;
    var subjectMap = {
      '政治': { subject: 'politics', label: '政治' },
      '英语': { subject: 'english', label: '英语' },
      '数学': { subject: 'math', label: '数学' },
      '专业课': { subject: 'specialized', label: '专业课' }
    };

    var plansToAdd = [];
    if (subjectsStr.indexOf('政治') !== -1) plansToAdd.push(subjectMap['政治']);
    if (subjectsStr.indexOf('英语') !== -1) plansToAdd.push(subjectMap['英语']);
    if (subjectsStr.indexOf('数学') !== -1) plansToAdd.push(subjectMap['数学']);
    // 剩余科目归为专业课
    if (subjectsStr.indexOf('公安学') !== -1 || subjectsStr.indexOf('侦查') !== -1 ||
        subjectsStr.indexOf('警务') !== -1 || subjectsStr.indexOf('刑事') !== -1) {
      plansToAdd.push(subjectMap['专业课']);
    }

    if (plansToAdd.length === 0) {
      alert('未能从院校科目中解析出备考科目，请手动添加学习计划');
      return;
    }

    // 批量创建学习计划
    var promises = plansToAdd.map(function (item) {
      return DB.add('studyPlans', {
        subject: item.subject,
        title: '复习' + item.label + ' — ' + school.name,
        description: '根据目标院校 ' + school.name + ' 的考试要求，系统复习' + item.label,
        scheduledTime: '09:00',
        repeatType: 'daily',
        isActive: true,
        createdAt: new Date().toISOString()
      });
    });

    Promise.all(promises)
      .then(function () {
        alert('已生成 ' + plansToAdd.length + ' 项备考科目清单，请前往「学习计划」查看');
        // 如果 Plans 模块已加载，刷新列表
        if (typeof Plans !== 'undefined' && Plans.refresh) {
          Plans.refresh();
        }
      })
      .catch(function (err) {
        console.error('[Schools] 生成备考清单失败:', err);
        alert('生成失败，请重试');
      });
  }

  /**
   * 确认目标，同步倒计时
   */
  function confirmTarget() {
    if (!selectedSchoolId) {
      alert('请先选择一所目标院校');
      return;
    }

    var school = allSchools.find(function (s) { return s.id === selectedSchoolId; });
    if (!school) return;

    // 存储考试日期到 settings
    DB.setSetting('examDate', school.examDate)
      .then(function () {
        alert('已设定目标：' + school.name + '\n考试日期：' + school.examDate + '\n倒计时已同步至首页');
        // 刷新首页倒计时
        if (typeof Countdown !== 'undefined' && Countdown.refresh) {
          Countdown.refresh();
        }
        // 切换到首页
        document.querySelector('.nav-item[data-tab="home"]').click();
      })
      .catch(function (err) {
        console.error('[Schools] 同步倒计时失败:', err);
        alert('同步失败，请重试');
      });
  }

  /* ---- 加载数据 ---- */

  function load() {
    return DB.getAll('schools').then(function (schools) {
      allSchools = schools;
      render();
      return schools;
    });
  }

  /* ---- 公开 API ---- */
  function refresh() {
    return load();
  }

  function init() {
    cacheDOM();
    load();

    // 绑定按钮
    if (btnGenerate) {
      btnGenerate.addEventListener('click', generateStudyPlan);
    }
    if (btnConfirm) {
      btnConfirm.addEventListener('click', confirmTarget);
    }
  }

  return {
    init: init,
    refresh: refresh,
    load: load
  };

  /* ---- 工具函数 ---- */

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
