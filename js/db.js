/**
 * 警校考研助手 — IndexedDB 数据库层
 * 数据库名: ppsuc_db, 版本: 1
 * 包含 4 个 Object Store: schools, studyPlans, checkins, settings
 */
const DB = (function () {
  'use strict';

  const DB_NAME    = 'ppsuc_db';
  const DB_VERSION = 1;

  let db = null;

  /**
   * 打开/创建数据库
   * @returns {Promise<IDBDatabase>}
   */
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (db) { return resolve(db); }

      var request = indexedDB.open(DB_NAME, DB_VERSION);

      // 首次创建或版本升级时触发
      request.onupgradeneeded = function (e) {
        var database = e.target.result;

        // --- schools store ---
        if (!database.objectStoreNames.contains('schools')) {
          var schoolsStore = database.createObjectStore('schools', {
            keyPath: 'id',
            autoIncrement: true
          });
          schoolsStore.createIndex('name', 'name', { unique: true });
          schoolsStore.createIndex('isFavorite', 'isFavorite', { unique: false });
        }

        // --- studyPlans store ---
        if (!database.objectStoreNames.contains('studyPlans')) {
          var plansStore = database.createObjectStore('studyPlans', {
            keyPath: 'id',
            autoIncrement: true
          });
          plansStore.createIndex('subject', 'subject', { unique: false });
          plansStore.createIndex('scheduledTime', 'scheduledTime', { unique: false });
        }

        // --- checkins store ---
        if (!database.objectStoreNames.contains('checkins')) {
          var checkinsStore = database.createObjectStore('checkins', {
            keyPath: 'id',
            autoIncrement: true
          });
          checkinsStore.createIndex('date', 'date', { unique: true });
        }

        // --- settings store ---
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = function (e) {
        db = e.target.result;
        resolve(db);
      };

      request.onerror = function (e) {
        reject(e.target.error);
      };
    });
  }

  /* ===== 通用 CRUD 操作 ===== */

  /**
   * 获取某个 store 的全部记录
   */
  function getAll(storeName) {
    return openDB().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var request = store.getAll();
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  /**
   * 根据主键获取单条记录
   */
  function get(storeName, id) {
    return openDB().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var request = store.get(id);
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  /**
   * 插入记录，返回新 id
   */
  function add(storeName, data) {
    return openDB().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var request = store.add(data);
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  /**
   * 更新记录（替换整条）
   */
  function put(storeName, data) {
    return openDB().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var request = store.put(data);
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  /**
   * 删除记录
   */
  function remove(storeName, id) {
    return openDB().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var request = store.delete(id);
        request.onsuccess = function () { resolve(); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  /**
   * 根据索引查询
   */
  function getByIndex(storeName, indexName, value) {
    return openDB().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var index = store.index(indexName);
        var request = index.getAll(value);
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  /**
   * 获取 settings 值
   */
  function getSetting(key) {
    return get('settings', key).then(function (row) {
      return row ? row.value : null;
    });
  }

  /**
   * 写入 settings 值
   */
  function setSetting(key, value) {
    return put('settings', { key: key, value: value });
  }

  /* ===== 预置数据 ===== */

  /**
   * 预置院校数据（仅在数据库为空时插入）
   */
  function seedSchools() {
    return getAll('schools').then(function (existing) {
      if (existing && existing.length > 0) {
        console.log('[DB] 院校数据已存在，跳过预置');
        return;
      }

      var schools = [
        {
          name: '中国人民公安大学',
          majors: '公安学、公安技术、法学、犯罪学、侦查学',
          scoreLines: '2024 复试线：340分 | 2023：335分 | 2022：330分',
          subjects: '政治、英语(一)、数学(二)、公安学基础理论',
          examDate: '2025-12-20',
          isFavorite: false
        },
        {
          name: '中国刑事警察学院',
          majors: '刑事科学技术、侦查学、禁毒学、经济犯罪侦查',
          scoreLines: '2024 复试线：325分 | 2023：320分 | 2022：315分',
          subjects: '政治、英语(一)、数学(二)、刑事侦查学',
          examDate: '2025-12-20',
          isFavorite: false
        },
        {
          name: '中国人民警察大学',
          majors: '公安管理学、治安学、边防管理、消防工程',
          scoreLines: '2024 复试线：330分 | 2023：325分 | 2022：318分',
          subjects: '政治、英语(一)、数学(二)、公安管理学',
          examDate: '2025-12-20',
          isFavorite: false
        },
        {
          name: '四川警察学院',
          majors: '警务硕士、治安学、交通管理工程',
          scoreLines: '2024 复试线：315分 | 2023：310分 | 2022：305分',
          subjects: '政治、英语(二)、数学(二)、警务专业综合',
          examDate: '2025-12-20',
          isFavorite: false
        },
        {
          name: '江苏警官学院',
          majors: '侦查学、治安学、刑事科学技术、网络安全与执法',
          scoreLines: '2024 复试线：320分 | 2023：318分 | 2022：312分',
          subjects: '政治、英语(一)、数学(二)、公安学综合',
          examDate: '2025-12-20',
          isFavorite: false
        },
        {
          name: '云南警官学院',
          majors: '禁毒学、治安学、刑事科学技术',
          scoreLines: '2024 复试线：310分 | 2023：308分 | 2022：300分',
          subjects: '政治、英语(二)、数学(二)、警务专业综合',
          examDate: '2025-12-20',
          isFavorite: false
        },
        {
          name: '广东警官学院',
          majors: '侦查学、经济犯罪侦查、网络安全与执法、治安学',
          scoreLines: '2024 复试线：322分 | 2023：318分 | 2022：310分',
          subjects: '政治、英语(一)、数学(二)、公安学综合',
          examDate: '2025-12-20',
          isFavorite: false
        }
      ];

      // 逐条插入
      var tx = db.transaction('schools', 'readwrite');
      var store = tx.objectStore('schools');
      schools.forEach(function (school) {
        school.createdAt = new Date().toISOString();
        store.add(school);
      });

      return new Promise(function (resolve, reject) {
        tx.oncomplete = function () {
          console.log('[DB] 预置 ' + schools.length + ' 所院校数据完成');
          resolve();
        };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  /* ===== 初始化 ===== */

  function init() {
    return openDB().then(seedSchools);
  }

  /* ===== 公开 API ===== */
  return {
    init: init,
    open: openDB,
    getAll: getAll,
    get: get,
    add: add,
    put: put,
    delete: remove,
    getByIndex: getByIndex,
    getSetting: getSetting,
    setSetting: setSetting
  };
})();
