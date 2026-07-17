# CLAUDE.md — 中国警校考研辅助 PWA

## 项目简介

一款面向中国警校研究生备考学生的 PWA 应用，运行在华为 Mate 60 Pro（鸿蒙系统）上。包含目标警校规划、学习计划提醒、每日打卡、备考倒计时四大模块。UI 风格为公安政务极简规范：深警务藏青 `#0A2442` + 哑光鎏金 `#C5A55A`。

## 标准文档指引

| 文档 | 路径 | 说明 |
|------|------|------|
| 需求文档 | [docs/requirements.md](docs/requirements.md) | 完整功能需求与非功能需求 |
| 技术方案 | [docs/tech-spec.md](docs/tech-spec.md) | 架构、数据库设计、文件结构 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | 色彩、字体、布局、动效、卡片规范 |
| 执行步骤 | [docs/execution-plan.md](docs/execution-plan.md) | 分 8 个阶段逐步推进 |

## 工作约定

### 开发原则
1. **小步推进**：每次只完成一个阶段内的任务，不跨阶段混做
2. **先骨架后血肉**：HTML → CSS → JS → 数据持久化，严格按序
3. **零依赖**：不使用任何 npm 包、CDN 或第三方库，纯原生技术栈
4. **每阶段验证**：完成一个阶段后，必须验证通过再进入下一阶段
5. **保持简洁**：不引入不必要的抽象，代码直白可读

### 日常流程
1. 开始工作前，查看 [dev-logs/](dev-logs/) 中最新的开发日志，了解当前进度
2. 查看 [docs/execution-plan.md](docs/execution-plan.md) 确认当前阶段
3. 完成工作后，在 [dev-logs/](dev-logs/) 中更新当天的开发日志
4. 如果发现问题或需要变更设计，先更新对应的 docs 文档再改代码

### 颜色纪律（最重要）
- 主色：`#0A2442`（深警务藏青），绝不动摇
- 鎏金 `#C5A55A` 仅用于关键强调元素（标题、边框、对勾、倒计时数字），不用于大段正文
- 如有疑问，重新阅读 [docs/design-spec.md](docs/design-spec.md)

### Git
- 每个阶段完成后至少提交一次
- commit message 格式：`[阶段X] 简短描述`

## 项目结构速览

```
ppsuc/
├── index.html          ← SPA 主入口
├── manifest.json       ← PWA 配置
├── sw.js               ← Service Worker
├── css/style.css       ← 全局样式
├── js/
│   ├── app.js          ← 主控
│   ├── db.js           ← IndexedDB
│   ├── schools.js      ← 模块①
│   ├── countdown.js    ← 模块②
│   ├── plans.js        ← 模块③
│   ├── checkin.js      ← 模块④
│   └── notifications.js
├── assets/             ← 图标、底纹
├── docs/               ← 项目标准文档
└── dev-logs/           ← 开发日志
```
