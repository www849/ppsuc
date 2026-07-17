/**
 * 警校考研助手 — 应用主控
 * 负责：Tab 导航切换、应用初始化、模块协调
 */
var App = (function () {
  'use strict';

  /* ---- 元素引用 ---- */
  var navItems  = document.querySelectorAll('.nav-item');
  var tabPanels = document.querySelectorAll('.tab-panel');

  /**
   * 切换到指定 Tab
   */
  function switchTab(tabName) {
    navItems.forEach(function (item) {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });
    tabPanels.forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'panel-' + tabName);
    });
  }

  /**
   * 绑定导航点击事件
   */
  function bindNavigation() {
    navItems.forEach(function (item) {
      item.addEventListener('click', function () {
        switchTab(item.dataset.tab);
      });
    });
  }

  /**
   * 刷新首页内容（由其他模块调用）
   */
  function refreshHome() {
    // 刷新收藏院校列表
    var favContainer = document.getElementById('home-favorites');
    if (favContainer) {
      DB.getAll('schools').then(function (schools) {
        var favorites = schools.filter(function (s) { return s.isFavorite; });

        if (favorites.length === 0) {
          favContainer.innerHTML = '<p class="card-hint">暂未收藏院校，去「目标院校」看看吧</p>';
          return;
        }

        var html = '';
        favorites.forEach(function (s) {
          html +=
            '<div class="fav-school-item">' +
              '<span class="fav-school-name">' + escapeHTML(s.name) + '</span>' +
              '<span class="fav-school-date">' + (s.examDate || '日期未设') + '</span>' +
            '</div>';
        });
        favContainer.innerHTML = html;
      }).catch(function (err) {
        console.error('[App] 刷新首页收藏失败:', err);
      });
    }

    // 刷新今日打卡状态
    var checkinStatusEl = document.getElementById('home-checkin-status');
    if (checkinStatusEl) {
      var tk = dateKey();
      DB.getByIndex('checkins', 'date', tk).then(function (results) {
        var record = (results && results.length > 0) ? results[0] : null;
        var CHECKIN_KEYS = ['politics', 'english', 'math', 'specialized', 'physical'];
        var CHECKIN_NAMES = { politics: '政治', english: '英语', math: '数学', specialized: '专业课', physical: '体能训练' };

        var total = CHECKIN_KEYS.length;
        var done = 0;
        CHECKIN_KEYS.forEach(function (k) { if (record && record[k]) done++; });

        var html = '<div style="display:flex;align-items:center;gap:12px;">';
        html += '<span style="font-size:28px;font-weight:700;color:var(--color-gold);">' + done + '/' + total + '</span>';
        html += '<span style="font-size:12px;color:var(--text-tertiary);">项已完成</span>';
        html += '</div>';

        // 单项状态
        html += '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;">';
        CHECKIN_KEYS.forEach(function (k) {
          var checked = (record && record[k]);
          html += '<span style="font-size:11px;padding:2px 6px;border-radius:3px;' +
            (checked ? 'color:#C5A55A;border:1px solid rgba(197,165,90,0.3);background:rgba(197,165,90,0.12);' : 'color:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.1);') +
            '">' + CHECKIN_NAMES[k] + (checked ? ' ✓' : '') + '</span>';
        });
        html += '</div>';

        checkinStatusEl.innerHTML = html;
      }).catch(function () {
        checkinStatusEl.innerHTML = '<p class="card-hint">加载失败</p>';
      });
    }

    // 刷新今日计划预览
    var plansContainer = document.getElementById('home-plans');
    if (plansContainer) {
      DB.getAll('studyPlans').then(function (plans) {
        var active = plans.filter(function (p) { return p.isActive; });
        // 按时间排序
        active.sort(function (a, b) { return (a.scheduledTime || '').localeCompare(b.scheduledTime || ''); });

        if (active.length === 0) {
          plansContainer.innerHTML = '<p class="card-hint">暂无学习计划，去「学习计划」添加吧</p>';
          return;
        }

        var subjectNames = {
          'politics': '政治', 'english': '英语',
          'math': '数学', 'specialized': '专业课'
        };

        var html = '';
        active.slice(0, 5).forEach(function (p) {
          html +=
            '<div class="home-plan-item">' +
              '<span class="home-plan-time">' + (p.scheduledTime || '--:--') + '</span>' +
              '<span class="home-plan-subject">' + (subjectNames[p.subject] || p.subject) + '</span>' +
              '<span class="home-plan-title">' + escapeHTML(p.title) + '</span>' +
            '</div>';
        });
        if (active.length > 5) {
          html += '<p class="card-hint" style="margin-top:8px;">…还有 ' + (active.length - 5) + ' 项计划</p>';
        }
        plansContainer.innerHTML = html;
      }).catch(function (err) {
        console.error('[App] 刷新首页计划失败:', err);
      });
    }
  }

  /**
   * 初始化所有模块
   */
  function initModules() {
    if (typeof Schools !== 'undefined' && Schools.init) {
      Schools.init();
    }
    if (typeof Countdown !== 'undefined' && Countdown.init) {
      Countdown.init();
    }
    if (typeof Plans !== 'undefined' && Plans.init) {
      Plans.init();
    }
    if (typeof Notifications !== 'undefined' && Notifications.init) {
      Notifications.init();
    }
    if (typeof Checkin !== 'undefined' && Checkin.init) {
      Checkin.init();
    }
    if (typeof Photos !== 'undefined' && Photos.init) {
      Photos.init();
    }
    // 初始加载首页数据
    refreshHome();

    // 每次切换到首页时刷新
    document.querySelector('.nav-item[data-tab="home"]').addEventListener('click', refreshHome);
  }

  /**
   * 注册 Service Worker
   */
  function registerSW() {
    if (!('serviceWorker' in navigator)) {
      console.log('[App] 浏览器不支持 Service Worker');
      return;
    }

    navigator.serviceWorker.register('/sw.js')
      .then(function (reg) {
        console.log('[App] Service Worker 已注册: ' + reg.scope);

        // 检测更新
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[App] 新版本可用，刷新页面以更新');
            }
          });
        });
      })
      .catch(function (err) {
        console.error('[App] Service Worker 注册失败:', err);
      });
  }

  /**
   * 应用入口
   */
  function init() {
    bindNavigation();

    DB.init()
      .then(function () {
        console.log('[App] 数据库就绪');
        return DB.getAll('schools');
      })
      .then(function (schools) {
        console.log('[App] 已加载 ' + schools.length + ' 所院校');
        initModules();
      })
      .catch(function (err) {
        console.error('[App] 数据库初始化失败:', err);
      });

    // 注册 Service Worker（非阻塞）
    registerSW();

    console.log('[App] 应用初始化完成');
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ---- 工具函数 ---- */
  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function dateKey() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* ---- 公开 API ---- */
  return {
    switchTab: switchTab,
    refreshHome: refreshHome
  };
})();
