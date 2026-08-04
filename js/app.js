/**
 * 警校考研助手 — 应用主控
 * 负责：Tab 导航切换、应用初始化、模块协调、PWA 安装
 */
var App = (function () {
  'use strict';

  /* ---- 元素引用 ---- */
  var navItems  = document.querySelectorAll('.nav-item');
  var tabPanels = document.querySelectorAll('.tab-panel');

  function switchTab(tabName) {
    navItems.forEach(function (item) {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });
    tabPanels.forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'panel-' + tabName);
    });
  }

  function bindNavigation() {
    navItems.forEach(function (item) {
      item.addEventListener('click', function () {
        switchTab(item.dataset.tab);
      });
    });
  }

  function refreshHome() {
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
        html += '<span style="font-size:12px;color:var(--text-tertiary);">项已完成</span></div>';
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

    var plansContainer = document.getElementById('home-plans');
    if (plansContainer) {
      DB.getAll('studyPlans').then(function (plans) {
        var active = plans.filter(function (p) { return p.isActive; });
        active.sort(function (a, b) { return (a.scheduledTime || '').localeCompare(b.scheduledTime || ''); });
        if (active.length === 0) {
          plansContainer.innerHTML = '<p class="card-hint">暂无学习计划，去「学习计划」添加吧</p>';
          return;
        }
        var subjectNames = { 'politics': '政治', 'english': '英语', 'math': '数学', 'specialized': '专业课' };
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
          html += '<p class="card-hint" style="margin-top:8px;">...还有 ' + (active.length - 5) + ' 项计划</p>';
        }
        plansContainer.innerHTML = html;
      }).catch(function (err) {
        console.error('[App] 刷新首页计划失败:', err);
      });
    }
  }

  function initModules() {
    if (typeof Schools !== 'undefined' && Schools.init) Schools.init();
    if (typeof Countdown !== 'undefined' && Countdown.init) Countdown.init();
    if (typeof Plans !== 'undefined' && Plans.init) Plans.init();
    if (typeof Notifications !== 'undefined' && Notifications.init) Notifications.init();
    if (typeof Checkin !== 'undefined' && Checkin.init) Checkin.init();
    if (typeof Photos !== 'undefined' && Photos.init) Photos.init();
    if (typeof SummerSchedule !== 'undefined' && SummerSchedule.init) SummerSchedule.init();
    refreshHome();
    document.querySelector('.nav-item[data-tab="home"]').addEventListener('click', function () {
      refreshHome();
      if (typeof SummerSchedule !== 'undefined' && SummerSchedule.refresh) SummerSchedule.refresh();
    });
  }

  /* ================================================================
   * PWA 安装逻辑
   * ================================================================ */
  var deferredPrompt = null;

  function initPWAInstall() {
    var banner     = document.getElementById('install-banner');
    var btnInstall = document.getElementById('btn-install');
    var btnClose   = document.getElementById('btn-install-close');
    var debugEl    = document.getElementById('pwa-debug');

    /* ---- 诊断 ---- */
    var diag = [];
    function updateDebug() {
      if (debugEl) debugEl.innerHTML = diag.map(function (s) { return '<div style="margin:2px 0;font-size:12px;">' + s + '</div>'; }).join('');
    }
    function dlog(icon, msg) { diag.push(icon + ' ' + msg); updateDebug(); }

    if (location.protocol === 'https:') {
      dlog('✅', 'HTTPS 正常');
    } else {
      dlog('❌', '不是 HTTPS，无法安装 PWA');
    }

    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
      dlog('📱', '已在独立 App 模式');
      if (banner) banner.style.display = 'none';
      if (debugEl) debugEl.parentElement.style.display = 'none';
      return;
    }
    dlog('ℹ️', '浏览器模式 (非 App)');

    var manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      var mHref = manifestLink.href;
      dlog('📄', 'Manifest: ' + mHref);
      fetch(mHref).then(function (r) {
        dlog(r.ok ? '✅' : '❌', r.ok ? 'Manifest 加载成功' : 'Manifest HTTP ' + r.status);
      }).catch(function () {
        dlog('❌', 'Manifest 请求失败');
      });
    } else {
      dlog('❌', '缺少 manifest 标签');
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        if (regs.length > 0) {
          dlog('✅', 'SW 已注册 scope=' + regs[0].scope);
        } else {
          dlog('⚠️', 'SW 未注册，尝试注册...');
          navigator.serviceWorker.register('./sw.js').then(function (reg) {
            dlog('✅', 'SW 注册成功 scope=' + reg.scope);
          }).catch(function (err) {
            dlog('❌', 'SW 注册失败: ' + err.message);
          });
        }
      });
    } else {
      dlog('❌', '浏览器不支持 SW');
    }

    /* ---- beforeinstallprompt ---- */
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      dlog('🎉', 'Chrome 安装事件触发！');
      if (banner) banner.style.display = 'flex';
      if (btnInstall) btnInstall.textContent = '安装到桌面';
    });

    window.addEventListener('appinstalled', function () {
      dlog('✅', 'PWA 安装成功！');
      if (banner) banner.style.display = 'none';
    });

    /* ---- 统一安装按钮 ---- */
    if (btnInstall) {
      btnInstall.addEventListener('click', function () {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function (result) {
            dlog('📝', '用户选择: ' + result.outcome);
            deferredPrompt = null;
          });
        } else {
          dlog('💡', '手动安装提示');
          alert('请点浏览器右上角 ⋮（三个点）\n→ 选择「安装应用」或「添加到主屏幕」');
        }
      });
    }

    /* ---- 关闭按钮 ---- */
    if (btnClose && banner) {
      btnClose.addEventListener('click', function () {
        banner.style.display = 'none';
      });
    }

    /* ---- iOS ---- */
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !navigator.standalone && banner) {
      dlog('🍎', 'iOS');
      banner.style.display = 'flex';
      if (btnInstall) btnInstall.textContent = '如何安装';
    }

    /* ---- 主动显示安装条 ---- */
    setTimeout(function () {
      dlog('⏳', '3秒结果: ' + (deferredPrompt ? '可安装!' : '未触发安装事件'));
      if (!deferredPrompt && banner && banner.style.display === 'none' &&
          !window.matchMedia('(display-mode: standalone)').matches) {
        banner.style.display = 'flex';
        if (btnInstall) btnInstall.textContent = '安装';
        dlog('💡', '尝试点 ⋮ → "安装应用"');
      }
    }, 3000);
  }

  /* ---- Service Worker ---- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js')
      .then(function (reg) {
        console.log('[App] SW 已注册: ' + reg.scope);
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[App] 新版本可用');
            }
          });
        });
      })
      .catch(function (err) {
        console.error('[App] SW 注册失败:', err);
      });
  }

  /* ---- 入口 ---- */
  function init() {
    bindNavigation();
    DB.init()
      .then(function () {
        console.log('[App] DB 就绪');
        return DB.getAll('schools');
      })
      .then(function (schools) {
        console.log('[App] ' + schools.length + ' 所院校');
        initModules();
      })
      .catch(function (err) {
        console.error('[App] DB 初始化失败:', err);
      });
    registerSW();
    initPWAInstall();
    console.log('[App] 初始化完成');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ---- 工具 ---- */
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

  return {
    switchTab: switchTab,
    refreshHome: refreshHome
  };
})();
