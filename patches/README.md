# iOS Xcode 26.2 / 26.3 patches

两份 patch 解决同一件事：SDK 57 官方要 Xcode 26.4+（Swift 6.3），本仓库当时是 **macOS 15 + Xcode 26.3**（Swift 6.2），原生 iOS 编不过。Xcode 26.4 需要 macOS 26.2+。

| 文件 | 包 |
|---|---|
| `expo-modules-jsi+57.1.0.patch` | `expo-modules-jsi@57.1.0` |
| `expo-modules-core+57.0.18.patch` | `expo-modules-core@57.0.18` |

## 什么时候会打

`package.json` 的 `postinstall` 是 `node scripts/apply-xcode-patches.js`，**不是**无条件 `patch-package`。门控通过时两份一起打。

| 环境 | 是否打 |
|---|---|
| Xcode 26.0–<26.4（Swift 6.2） | 打 |
| Xcode ≥ 26.4 | 跳过 |
| 没有 `xcodebuild`，且 macOS 15 | 打（装不了 Xcode 26.4） |
| 其它 | 跳过 |

```bash
xcodebuild -version
sw_vers -productVersion
node scripts/apply-xcode-patches.js
```

跳过时日志是 `[apply-xcode-patches] skip (...)`。不要用裸的 `npx patch-package` 当 postinstall 行为，那会绕过 Xcode 限制。

`patch-package` 文件名仍绑 npm 版本。包升级后即使 Xcode 仍是 26.3，旧 diff 也可能打不上，需要按新版本重做。门控通过时脚本会先核对 `.patch` 文件名与 `node_modules` 里的版本，对不上直接失败，避免静默跳过。重做 jsi patch 时不要把 `apple/.DerivedData` 打进去。

升到 Xcode 26.4 后重新 `npm ci` **不会再打**。`node_modules` 里已经打过的改动要重装依赖才清掉。这不是可以立刻删 `patches/` 的条件。

## expo-modules-jsi@57.1.0

iOS 打包在 `[CP-User] Build ExpoModulesJSI xcframework` 失败。`57.1.0` 有两处：

```text
'RuntimeScheduler' cannot be annotated with either SWIFT_RETURNS_RETAINED or SWIFT_RETURNS_UNRETAINED
because it is not returning a SWIFT_SHARED_REFERENCE type

sending 'resultPtr' risks causing data races
sending 'thisPtr' risks causing data races
sending 'argumentsPtr' risks causing data races
```

`57.0.5` 起给 `RuntimeScheduler` 两个构造函数加了 `SWIFT_RETURNS_RETAINED`（[expo/expo#49120](https://github.com/expo/expo/pull/49120)）。该注解不能标在构造函数上。`57.1.0` 仍保留这个注解。

`57.1.0` 的 host object / host function 回调把 JSI 指针送进 `@JavaScriptActor`。Swift 6.2.3 把 `nonisolated(unsafe) let` 仍当成 sending。同文件其它地方已经用 `NonisolatedUnsafeVar` 绕过这个编译器问题。

- Xcode 26.2 / 26.3：当成 **error**
- Xcode 26.4+：`SWIFT_RETURNS_RETAINED` 降成 warning；sending 检查在 26.3 上仍会失败

改动：
- `RuntimeScheduler.h`：去掉两个构造函数上的注解
- `JavaScriptRuntime.swift`：三处指针捕获改成 `NonisolatedUnsafeVar`（与同文件 Swift 6.2.3 workaround 一致）

上游：[expo/expo#49214](https://github.com/expo/expo/issues/49214)、[expo/expo#49426](https://github.com/expo/expo/issues/49426)（已关）。官方结论是升 Xcode 26.4+，`57.1.0` 仍未在代码里去掉该注解，也未修 sending。

验证（不必打整包 IPA）：

```bash
npx patch-package --reverse --error-on-fail
PODS_ROOT="$PWD/ios/Pods" PLATFORM_NAME=iphoneos \
  ./node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh
```

通过：`Built xcframework successfully`，且没有上面那些 error。

失败且 Xcode < 26.4：

```bash
node scripts/apply-xcode-patches.js
```

Xcode 27 上若出现 `cannot infer ownership of foreign reference value returned by 'init()'`，不要删这份 patch。那是 #49120 加注解要压的 warning。

上游是否已修：看 **未打 patch 的原版** 构造函数上有没有 `SWIFT_RETURNS_RETAINED RuntimeScheduler`。本地注释里出现该宏是正常的。

- npm：https://www.npmjs.com/package/expo-modules-jsi
- 头文件：https://github.com/expo/expo/blob/main/packages/expo-modules-jsi/apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h

## expo-modules-core@57.0.18

JSI 过了之后，`ExpoModulesCore` 在 Swift 6.2 上继续失败，主要是：

```text
class 'AppContextLost' must restate inherited '@unchecked Sendable' conformance
sending 'emitter' risks causing data races
```

基类 `Exception` 已是 `@unchecked Sendable`，Swift 6.2 要求子类再写一遍。`EventEmitter` 把 weak emitter 送进 `@JavaScriptActor` 时，6.2 的 sending 检查会报错。`57.0.18` 的 iOS 源码与 `57.0.17` 相同，官方同样要求升 Xcode 26.4+（[expo/expo#47539](https://github.com/expo/expo/issues/47539)）。

改动（11 个 Swift 文件）：

- 28 个 `Exception` 子类补 `@unchecked Sendable`
- `PersistentFileLog` 的 filter/completion 标 `@Sendable`，类标 `@unchecked Sendable`
- `EventEmitter` 用 `@unchecked Sendable` 弱引用盒子，避免 sending

验证：

```bash
npx patch-package --reverse --error-on-fail
xcodebuild -workspace ios/baseApp.xcworkspace -scheme ExpoModulesCore \
  -configuration Debug -sdk iphoneos -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO build
```

通过：`BUILD SUCCEEDED`。失败且 Xcode < 26.4 则 `node scripts/apply-xcode-patches.js` 打回去。

## 什么时候可以移除

两份可以分开判断，但门控是一起的。先看 `xcodebuild -version`，不要直接删。

| 情况 | 动作 |
|---|---|
| Xcode 仍是 26.0–<26.4 | **两份都保留** |
| Xcode ≥ 26.4，且对应验证通过 | **可以删对应那份** |
| npm 包版本已变，旧 patch 打不上 | 必须处理（重做或删除） |
| 上游原版已不再触发该 error | **删除对应那份** |
| 只升了 Xcode、没重装依赖、没做验证 | **不准删** |

## 怎么删

对应验证通过后再删。

1. 删对应的 `.patch`（`expo-modules-jsi+57.1.0.patch` 和/或 `expo-modules-core+57.0.18.patch`）
2. `patches/` 没有其它 `*.patch` 时：删本说明，去掉 `package.json` 的 `postinstall`、`scripts/apply-xcode-patches.js`、`devDependencies.patch-package`，并更新 lockfile（`npm uninstall patch-package`）
3. 还剩另一份 patch 时：保留本说明、`postinstall` 和门控脚本
