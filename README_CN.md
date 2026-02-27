# Visited Link Highlighter

一个 Chrome 扩展，用于在网页上高亮显示已访问过的链接，支持自定义颜色和 URL 参数忽略规则。

## 功能特性

- **已访问链接高亮** — 自动为网页上你曾经访问过的链接着色
- **自定义颜色** — 通过取色器或直接输入十六进制色值选择任意文字颜色（默认：`#C58AF9`）
- **URL 参数忽略规则** — 可配置需要忽略的查询参数（如 `utm_source`、`frompage`），使带追踪参数的 URL 也能正确匹配
- **全局开关** — 一键开启/关闭高亮功能
- **页面统计** — 弹窗中以环形图展示当前页面已访问链接数量和占比
- **SPA 支持** — 通过 MutationObserver 监听动态加载的链接并自动高亮
- **实时配置同步** — 设置变更立即应用到所有已打开的标签页
- **手动刷新** — 可手动重新扫描当前页面并刷新高亮状态

## 安装方法

1. 克隆或下载本仓库
2. 在 Chrome 中打开 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择项目文件夹

## 项目结构

```
visited-link/
├── manifest.json              # 扩展元数据与配置
├── background/
│   └── service-worker.js      # 历史记录查询、URL 匹配、消息路由
├── content/
│   ├── content.js             # 页面链接扫描与高亮应用
│   └── content.css            # 已访问链接样式
├── popup/
│   ├── popup.html             # 设置面板 UI
│   ├── popup.js               # 弹窗逻辑与事件处理
│   └── popup.css              # 弹窗样式
├── utils/
│   └── url-normalizer.js      # 共享的 URL 标准化工具
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## 工作原理

1. **内容脚本** 扫描页面上所有 `<a>` 链接，将 URL 发送给后台 Service Worker
2. **Service Worker** 按域名分组，并行查询 `chrome.history`，对 URL 进行标准化处理（移除忽略的参数、排序剩余参数），返回匹配的已访问 URL
3. **内容脚本** 为已访问的链接元素添加 `vlh-visited` CSS 类，应用配置的文字颜色
4. **弹窗** 提供设置界面，包括开关、颜色配置、参数忽略规则和页面统计

## 权限说明

| 权限 | 用途 |
|---|---|
| `history` | 查询浏览历史以识别已访问的 URL |
| `storage` | 通过 `chrome.storage.sync` 持久化用户设置 |
| `activeTab` | 访问当前活动标签页以获取统计信息 |
| `tabs` | 向所有已打开的标签页广播配置变更 |

## 许可证

MIT
