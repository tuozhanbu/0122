# Native Crash Reporting

本项目的异常上报仍使用自建 API：`/system/clientError`。

## 当前实现

- JS / React / Promise / Bootstrap 异常由 `src/services/logging/clientErrors/` 记录到 `app-logs/client-errors/`。
- Android 原生崩溃由 ACRA 采集，Expo config plugin 会注入 ACRA 初始化和本地 `ReportSender`，写入：

```text
app-logs/native-crashes/pending.jsonl
```

- iOS 原生崩溃由 KSCrash 采集，Expo config plugin 会生成 `AppNativeCrashReports` 原生模块。App 下次启动时，JS 会先调用原生模块把 KSCrash outstanding reports 导出到同一个 `native-crashes/pending.jsonl`。
- 原生导出完成后，JS 会读取 `client-errors` 和 `native-crashes` 两类 pending report，合并后提交 `/system/clientError`。
- 单条 report 在提交前按 UTF-8 序列化后的实际字节数限制为 32 KiB；这是客户端的单条保护，不代表接口的总请求体限制。服务端应明确约定单次最大 report 数、最大请求体，并按 `reportId` 去重，避免网络重试产生重复记录。
- 上报成功后清理 JS pending 和 native pending。
- Debug `Logs -> Errors` 会把 native pending 合并展示，`Pending Uploads` 也包含 native pending 数量。

## Android

`plugins/withNativeCrashReports.js` 会在 prebuild 后向 Android 工程添加：

- Gradle 依赖：`ch.acra:acra-core:5.13.1`
- `MainApplication.attachBaseContext()` 中的 `ACRA.init(...)`
- 自定义 `ReportSender`，把 ACRA report 转成 JSONL 本地队列
- `AppNativeCrashReports` React Native module，用于 Debug Tools 触发 Android native crash 测试
- `alsoReportToAndroidFramework = true`，保留 Android 系统崩溃链路，避免影响 Google Play Android Vitals

Android report 会转换成统一字段和诊断摘要：

```json
{
  "platform": "android",
  "source": "android_acra",
  "errorName": "...",
  "message": "...",
  "stack": "...",
  "diagnostic": { "stackTraceHash": "..." },
  "context": { "route": "...", "breadcrumbs": [] }
}
```

ACRA 只采集版本、设备、崩溃栈、栈哈希、启动时间和内存余量。不会采集 logcat、所有线程、显示信息、SharedPreferences、Settings 或用户 IP；本地队列也不会保存完整 ACRA report。

## iOS

`plugins/withNativeCrashReports.js` 会添加 CocoaPods 依赖：

```ruby
pod 'KSCrash', '~> 2.5'
```

并在 `AppDelegate.swift` 安装 KSCrash：

```swift
let config = KSCrashConfiguration()
config.monitors = [.machException, .signal, .cppException, .nsException, .memoryTermination]
config.enableSwapCxaThrow = true
do {
  try KSCrash.shared.install(with: config)
} catch {
  NSLog("[NativeCrashReports] KSCrash installation failed: %@", error.localizedDescription)
}
```

同时生成 `AppNativeCrashReports.mm` 并加入 Xcode Sources。该模块提供：

- `flushPendingNativeCrashReports()`：读取 KSCrash report store，把 outstanding reports 转成统一 schema，写入 `app-logs/native-crashes/pending.jsonl`，成功后由 KSCrash 按 `OnSuccess` 策略清理原始 report。
- `triggerNativeFatalCrash()`：Debug Tools 的 fatal crash 测试入口，会调用 `abort()` 触发 `SIGABRT` 并终止 App。
- `triggerNativeObjectiveCException()`：仅 Debug Tools 的 iOS 受控测试，抛出未捕获的 `NSException`，验证异常名称与 reason 采集。
- `triggerNativeCppException()`：仅 Debug Tools 的 iOS 受控测试，抛出未捕获的 `std::runtime_error`，验证 C++ 异常类型与 reason 采集。

当前版本不手写 iOS signal/Mach handler，也不在 crash handler 中做 IO；所有文件写入发生在下次启动的正常运行阶段。

导出时只写入诊断摘要，而非完整 KSCrash report：异常类型和原因、崩溃线程的最多 40 帧（最多 12,000 字符）、关联镜像 UUID、当前构建 UUID、必要的进程/内存状态，以及最近 12 条已脱敏 breadcrumbs。路由和每条 breadcrumb 分别写入 KSCrash 的 per-key 存储，避免单个 1 KiB 值截断导致上下文整体丢失。不会导出寄存器、其他线程栈、内存窥探结果、僵尸对象或完整 binary image 列表。

部分 C++ exception report 不包含 KSCrash 的 `system` 区段。原生上下文同步时会额外快照崩溃时的 App/Build、系统版本、硬件机型和 OS build；导出时仅在原始 report 缺失这些字段时使用该快照，不使用下次启动时的设备状态补写。

## 边界

- Expo Go 不能验证 native crash 注入；需要 dev client 或 release 包。
- Debug Tools 的 native crash tests 只能在包含 config plugin 生成原生代码的 dev client / release 包中运行；Objective-C 与 C++ exception tests 仅出现在 iOS。
- Android ACRA 覆盖 Java/Kotlin 未捕获异常和 Android runtime 层崩溃信息；如果后续引入大量 C/C++/NDK 代码，需要再评估 Breakpad/Crashpad 这类 minidump 方案。
- iOS 监控 Mach exception、fatal signal、C++ exception、Objective-C exception 和内存终止；不启用主线程死锁、僵尸对象或内存窥探，避免引入误报、性能成本和不必要的敏感信息。
