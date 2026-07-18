/**
 * 警校考研助手 — 应用主控
 * 负责：Tab 导航切换、应用初始化、模块协调、PWA 安装
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
   * 刷新首页内容
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
          html += '<p class="card-hint" style="margin-top:8px;">...还有 ' + (active.length - 5) + ' 项计划</p>';
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
   * PWA 安装提示 + 诊断
   */
  var deferredPrompt = null;

  function initPWAInstall() {
    var banner     = document.getElementById('install-banner');
    var btnInstall = document.getElementById('btn-install');
    var btnClose   = document.getElementById('btn-install-close');
    var debugEl    = document.getElementById('pwa-debug');

    // 诊断日志
    var diag = [];
    function updateDebug() {
      if (debugEl) debugEl.innerHTML = diag.map(function (s) { return '<div style="margin:2px 0;font-size:12px;">' + s + '</div>'; }).join('');
    }
    function dlog(icon, msg) { diag.push(icon + ' ' + msg); updateDebug(); }

    // 1. HTTPS
    if (location.protocol === 'https:') {
      dlog('✅', 'HTTPS 正常');
    } else {
      dlog('❌', '不是 HTTPS，无法安装 PWA');
    }

    // 2. display-mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      dlog('📱', '已在独立 App 模式');
      if (banner) banner.style.display = 'none';
      if (debugEl) debugEl.parentElement.style.display = 'none';
      return;
    }
    dlog('ℹ️', '浏览器模式 (非 App)');

    // 3. Manifest
    var manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      var mHref = manifestLink.href;
      dlog('📄', 'Manifest 路径: ' + mHref);
      fetch(mHref).then(function (r) {
        if (r.ok) {
          dlog('✅', 'Manifest 加载成功');
        } else {
          dlog('❌', 'Manifest 加载失败 HTTP ' + r.status);
        }
      }).catch(function () {
        dlog('❌', 'Manifest 请求网络错误');
      });
    } else {
      dlog('❌', '缺少 manifest 标签');
    }

    // 4. Service Worker
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

    // 5. beforeinstallprompt
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      dlog('🎉', 'Chrome 触发安装事件！点击安装');
      if (banner) banner.style.display = 'flex';
    });

    window.addEventListener('appinstalled', function () {
      dlog('✅', '安装成功！');
    });

    // 安装按钮
    if (btnInstall) {
      btnInstall.addEventListener('click', function () {
        if (!deferredPrompt) {
          dlog('ℹ️', 'deferredPrompt 未触发');
          alert('暂未满足自动安装条件。\n\n请尝试:\n1. 清除浏览器缓存\n2. 等几分钟刷新\n3. Chrome 菜单→添加到主屏幕');
          return;
        }
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (result) {
          dlog('📝', '用户选择: ' + result.outcome);
          if (result.outcome === 'accepted') {
            if (banner) banner.style.display = 'none';
          }
          deferredPrompt = null;
        });
      });
    }

    // 关闭按钮
    if (btnClose && banner) {
      btnClose.addEventListener('click', function () {
        banner.style.display = 'none';
      });
    }

    // iOS
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !navigator.standalone && banner) {
      dlog('🍎', 'iOS 设备');
      banner.style.display = 'flex';
      if (btnInstall) {
        btnInstall.textContent = '如何安装';
        btnInstall.addEventListener('click', function () {
          alert('1. 点底部 Safari 分享按钮\n2. 滑动找到「添加到主屏幕」\n3. 点右上角「添加」');
        });
      }
    }

    // 3 秒后如果还没触发 beforeinstallprompt
    setTimeout(function () {
      dlog('⏳', '3秒检测完毕。如无 🎉 则未触发安装事件');
      if (!deferredPrompt && banner && banner.style.display === 'none' &&
          !window.matchMedia('(display-mode: standalone)').matches) {
        banner.style.display = 'flex';
        if (btnInstall) {
          btnInstall.textContent = '安装';
          btnInstall.onclick = function () {
            alert('请通过浏览器菜单安装:\n\nChrome: 点右上 ⋮ → 添加到主屏幕\n华为浏览器: 点底部中间 ≡ → 添加至桌面');
          };
        }
      }
    }, 3000);
  }

  /**
   * 注册 Service Worker
   */
  function registerSW() {
    if (!('serviceWorker' in navigator)) {
      console.log('[App] 浏览器不支持 Service Worker');
      return;
    }

    navigator.serviceWorker.register('./sw.js')
      .then(function (reg) {
        console.log('[App] Service Worker 已注册: ' + reg.scope);

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

    registerSW();
    initPWAInstall();

    console.log('[App] 应用初始化完成');
  }

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
