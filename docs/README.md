# Docs 索引

`docs/` 保存当前有效的长期说明。临时方案、升级判断和历史排查记录放在 `temp/`。

## 调试与异常

- `app-debug-config.md`：`/system/init` 的 `data.debug` 配置、Debug 面板、请求头、日志页面和 Crash Tests 说明。
- `native-crash-reporting.md`：自建 API 异常上报、JS 异常、本地队列、Android ACRA、iOS KSCrash 和原生崩溃测试说明。

## 状态与存储

- `state-storage-policy.md`：内存 store、持久化 storage、`installId`、Debug 清理数据策略和兜底规则。
- `storage-key-normalization.md`：`APP_STORAGE_KEYS` 集中化规范，以及旧项目同步时保留旧 key 字符串的兼容方案。

## 启动链路

- `bootstrap-strategy.md`：启动页职责、bootstrap service 分层、当前前后端综合启动策略和后续新增客户端信号来源的接入规则。

## WebView

- `webview-presentation-bridge.md`：WebView URL 初始展示参数、完整展示配置 Bridge、设备方向和安全区对接说明。

## 新项目初始化

- `project-initialization.md`：从基础示例创建业务项目时，入口路由、启动 Loading 配色、语言文件、示例页面、可选 AB Test 模块、示例 API 和示例音频的替换与删除清单。

## 审核与 SDK

- `first-review-sdk-removal.md`：首版审核包移除 AppsFlyer SDK 的检查清单，包括依赖、Expo plugin、OneLink 配置和原生生成产物。
