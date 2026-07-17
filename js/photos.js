/**
 * 警校考研助手 — 学习历程相册
 * 本地照片上传、网格展示、删除、点击放大
 */
var Photos = (function () {
  'use strict';

  var allPhotos = [];
  var currentPage = 0;
  var pageSize = 20;

  /* ---- DOM 引用 ---- */
  var gridEl, uploadBtn, fileInput, viewerEl;

  function cacheDOM() {
    gridEl     = document.getElementById('photos-grid');
    uploadBtn  = document.getElementById('btn-upload-photo');
    fileInput  = document.getElementById('photo-file-input');
    viewerEl   = document.getElementById('photo-viewer');
  }

  /* ---- 渲染 ---- */

  function formatTime(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    var now = new Date();
    var diff = now - d;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';

    return d.getFullYear() + '/' +
      String(d.getMonth() + 1).padStart(2, '0') + '/' +
      String(d.getDate()).padStart(2, '0');
  }

  function renderGrid(photos) {
    if (!gridEl) cacheDOM();
    if (!gridEl) return;

    if (!photos || photos.length === 0) {
      gridEl.innerHTML =
        '<div class="photos-empty">' +
          '<span class="photos-empty-icon">📸</span>' +
          '<p>还没有记录照片</p>' +
          '<p class="card-hint">点击下方按钮上传第一张备考记录吧</p>' +
        '</div>';
      return;
    }

    var html = '';
    photos.forEach(function (photo) {
      html +=
        '<div class="photo-card" data-id="' + photo.id + '">' +
          '<img class="photo-thumb" src="' + photo.data + '" alt="" loading="lazy">' +
          '<div class="photo-info">' +
            '<span class="photo-time">' + formatTime(photo.createdAt) + '</span>' +
            '<button class="photo-btn-del" data-id="' + photo.id + '" title="删除">×</button>' +
          '</div>' +
          (photo.note ? '<p class="photo-note">' + escapeHTML(photo.note) + '</p>' : '') +
        '</div>';
    });

    gridEl.innerHTML = html;

    // 绑定点击放大
    gridEl.querySelectorAll('.photo-thumb').forEach(function (img) {
      img.addEventListener('click', function () {
        openViewer(img.src);
      });
    });

    // 绑定删除
    gridEl.querySelectorAll('.photo-btn-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        deletePhoto(parseInt(btn.dataset.id));
      });
    });
  }

  /* ---- 图片查看器 ---- */

  function openViewer(src) {
    if (!viewerEl) cacheDOM();
    if (!viewerEl) return;

    viewerEl.querySelector('.viewer-image').src = src;
    viewerEl.classList.add('show');
  }

  function closeViewer() {
    if (!viewerEl) cacheDOM();
    if (viewerEl) viewerEl.classList.remove('show');
  }

  /* ---- 上传 ---- */

  function triggerUpload() {
    if (!fileInput) cacheDOM();
    if (fileInput) fileInput.click();
  }

  function handleFileSelected(e) {
    var file = e.target.files[0];
    if (!file) return;

    // 限制 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('图片大小不能超过 10MB');
      fileInput.value = '';
      return;
    }

    // 只允许图片
    if (!file.type.match(/^image\//)) {
      alert('请选择图片文件');
      fileInput.value = '';
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      var note = prompt('为这张照片添加备注（可选）', '');
      savePhoto(reader.result, note || '');
    };
    reader.onerror = function () {
      alert('读取图片失败，请重试');
    };
    reader.readAsDataURL(file);

    // 重置 input，允许重复选同一文件
    fileInput.value = '';
  }

  function savePhoto(dataUrl, note) {
    var record = {
      data: dataUrl,
      note: note,
      createdAt: new Date().toISOString()
    };

    DB.add('photos', record)
      .then(function () {
        load();
      })
      .catch(function (err) {
        console.error('[Photos] 保存失败:', err);
        // 可能是存储空间不足
        if (err.name === 'QuotaExceededError' || err.message.indexOf('quota') !== -1) {
          alert('存储空间不足，请删除一些旧照片后再试');
        } else {
          alert('保存失败，请重试');
        }
      });
  }

  function deletePhoto(id) {
    if (!confirm('确认删除这张照片？')) return;

    DB.delete('photos', id)
      .then(function () {
        allPhotos = allPhotos.filter(function (p) { return p.id !== id; });
        renderGrid(allPhotos);
      })
      .catch(function (err) {
        console.error('[Photos] 删除失败:', err);
        alert('删除失败');
      });
  }

  /* ---- 加载 ---- */

  function load() {
    return DB.getAll('photos').then(function (photos) {
      // 按时间降序
      photos.sort(function (a, b) {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      allPhotos = photos;
      renderGrid(photos);
      return photos;
    });
  }

  /* ---- 事件绑定 ---- */

  function bindEvents() {
    if (!uploadBtn) cacheDOM();
    if (uploadBtn) {
      uploadBtn.addEventListener('click', triggerUpload);
    }
    if (fileInput) {
      fileInput.addEventListener('change', handleFileSelected);
    }
    if (viewerEl) {
      viewerEl.addEventListener('click', function (e) {
        if (e.target === viewerEl || e.target.classList.contains('viewer-close')) {
          closeViewer();
        }
      });
    }
  }

  /* ---- 初始化 ---- */

  function init() {
    cacheDOM();
    bindEvents();
    load();
  }

  function refresh() {
    return load();
  }

  return {
    init: init,
    refresh: refresh
  };

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
