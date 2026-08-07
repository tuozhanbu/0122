# 状态与存储规划

本文记录内存 store、持久化 storage、清理数据操作的职责边界。

## 内存 Store

| Store | 职责 | 持久化数据 | 清理策略 |
| --- | --- | --- | --- |
| `useAppStore` | 启动页到业务页的临时配置交接 | 无 | 临时状态。`bootstrapBase` 由启动页写入，由 `useBootstrapTranslations` 消费后清理。 |
| `useUserStore` | 用户登录态和用户信息 | `APP_STORAGE_KEYS.userSession.token`、`APP_STORAGE_KEYS.userSession.userInfo` | 登出时清理；持久化数据被清空后，通过重新执行 `initUser()` 恢复为空态。 |
| `useLangStore` | 当前语言、翻译表和语言版本 | `APP_STORAGE_KEYS.language.*` | 通过 `resetLang()` 清理；持久化数据被清空后，通过重新执行 `initLang()` 恢复默认语言态。开发期 Fast Refresh 缓存只用于开发体验，不属于持久化数据。 |
| `useWebViewAuthStore` | WebView 第三方登录回调临时结果 | 无 | 临时状态。WebView 消费结果后清理。 |
| App Debug runtime store | Debug 允许状态、开启状态、面板状态、session、悬浮按钮状态，并读取 `installId` 用于诊断 | Debug enabled/session、悬浮按钮位置 | Debug 状态只能通过 Debug 生命周期或后端关闭 Debug 变更；`installId` 不由 Debug 拥有。 |

## 安装实例 ID

- `APP_STORAGE_KEYS.identity.installId` 表示当前 App 安装实例。
- `installId` 由启动链路中的 `ensureInstallId()` 显式创建或确认。
- `installId` 不是物理设备 ID，也不是用户 ID。
- API 请求通过 `X-App-Client` 携带 `installId`；Debug 可以复用该请求头，但 Debug 不拥有它的生命周期。

## 清理数据策略

Debug 页面里的清理操作是诊断工具，不是普通登出流程。

`Clear Data` 清理持久化数据时需要保留：

- 当前已开启的 Debug enabled 标记。
- 当前已开启的 Debug session。
- Debug 悬浮按钮位置。

`Clear Data` 会清空安装身份、OpenUrl、归因、用户、语言等业务状态，并同步清空其运行态快照；Debug 日志和客户端异常记录按诊断用途保留。

`Clear All Data` 会清空全部 AsyncStorage、运行态快照、App 私有日志文件和 iOS KSCrash 未导出报告，不保留 Debug 状态、`installId`、悬浮按钮位置、Debug 日志或客户端异常记录。

Debug 日志和客户端异常记录写入 App 私有文件目录，不属于 AsyncStorage。`Clear Data` 不隐式清理这些文件；Debug 的 `Logs` 页面也提供单独清理入口，便于只清日志。

清理完成后必须重新执行启动链路，让内存 store 从新的持久化状态恢复。持久化 storage 被清空后，代码不能继续依赖清理前的 Zustand 内存状态。

## 兜底规则

缺失的必需状态必须保持可见。不要在无关操作中静默生成、替换或修复缺失值；创建、修复和迁移只能发生在对应状态 owner 的显式生命周期操作中。
