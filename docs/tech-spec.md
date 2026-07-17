# 技术方案文档

## 总体架构

- **应用类型**: PWA（Progressive Web App 渐进式网页应用）
- **部署方式**: GitHub Pages（免费 HTTPS 托管）
- **技术栈**: 纯 HTML5 + CSS3 + JavaScript ES6（零框架、零依赖）
- **存储方案**: IndexedDB（通过 idb 简化封装或原生 API）
- **离线策略**: Service Worker 缓存优先（Cache-First）
- **通知**: Web Notification API

## 文件结构

```
ppsuc/
├── index.html              # SPA 主入口，单页应用全部内容
├── manifest.json           # PWA 清单
├── sw.js                   # Service Worker 离线缓存
├── css/
│   └── style.css           # 全局样式，CSS 变量主题
├── js/
│   ├── app.js              # 应用主控：初始化、导航路由
│   ├── db.js               # IndexedDB 数据库封装
│   ├── schools.js          # 模块① 目标警校规划
│   ├── countdown.js        # 模块② 备考倒计时
│   ├── plans.js            # 模块③ 学习计划
│   ├── checkin.js          # 模块④ 每日学习打卡
│   └── notifications.js    # 通知提醒调度
├── assets/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── badge-pattern.svg   # 警徽暗纹底纹
├── docs/                   # 项目文档
└── dev-logs/               # 开发日志
```

## IndexedDB 数据库设计

数据库名: `ppsuc_db`, 版本: 1

### store: `schools`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | autoIncrement | 主键 |
| name | string | 院校名称 |
| majors | string | 招录专业 |
| scoreLines | string | 历年分数线 |
| subjects | string | 考研科目 |
| examDate | string | 考试日期 (YYYY-MM-DD) |
| isFavorite | boolean | 是否收藏 |
| createdAt | string | 创建时间 ISO |

### store: `studyPlans`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | autoIncrement | 主键 |
| subject | string | 科目 (politics/english/math/specialized) |
| title | string | 计划标题 |
| description | string | 计划描述 |
| scheduledTime | string | 提醒时间 HH:MM |
| repeatType | string | 重复类型 (none/daily/weekly) |
| isActive | boolean | 是否启用 |
| createdAt | string | 创建时间 ISO |

### store: `checkins`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | autoIncrement | 主键 |
| date | string | 打卡日期 YYYY-MM-DD (unique) |
| politics | boolean | 政治打卡 |
| english | boolean | 英语打卡 |
| math | boolean | 数学打卡 |
| specialized | boolean | 专业课打卡 |
| physical | boolean | 体能训练打卡 |
| studyMinutes | number | 当日学习时长(分钟) |
| createdAt | string | 创建时间 ISO |

### store: `settings`
| 字段 | 类型 | 说明 |
|------|------|------|
| key | string | 设置键 (主键) |
| value | any | 设置值 |

## 浏览器兼容性

- 目标：鸿蒙系统内置浏览器（基于 Chromium）
- 依赖特性：Service Worker, IndexedDB, Notification API, CSS backdrop-filter
- 全部在鸿蒙浏览器中受支持
