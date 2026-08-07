# App Debug 配置说明

`/system/init` 的 `data.debug` 用于控制生产包里的本机调试能力。后台没开启 debug 时，不要返回 `debug` 字段；只要返回了 `debug` 字段，即使值是 `null`，App 也允许通过连续点击开启本机 debug。

后台如果是输入框编辑 JSON 字符串，建议直接按下面示例填写 `debug` 对象内容。

## 开关语义

不允许 debug：

```json
{
  "data": {
    "base": {},
    "attribution": {}
  }
}
```

允许 debug，全部使用 App 默认值：

```json
{
  "data": {
    "debug": null
  }
}
```

允许 debug，并配置点击区、WebView 调试面板：

```json
{
  "data": {
    "debug": {
      "requestHeaders": {
        "X-App-Debug": 1
      },
      "tapArea": {
        "width": 30,
        "height": 30,
        "top": 0,
        "left": 0
      },
      "webViewDebugPanel": {
        "type": "eruda",
        "scriptUrl": "https://cdn.jsdelivr.net/npm/eruda@3.4.3/eruda.min.js"
      }
    }
  }
}
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `debug` | `object \| null` | 无字段 | 字段存在表示后端允许本机 debug；无字段表示不允许，并清理本地 debug 状态。 |
| `debug.requestHeaders` | `object` | `{ "X-App-Debug": 0 }` | 本机 Debug 开启时附加的自定义请求头。键为请求头名称，值支持字符串或数字。 |
| `debug.tapArea` | `object` | 见下方默认值 | 全局连续点击 10 次的透明区域。 |
| `debug.webViewDebugPanel` | `object` | 见下方默认值 | WebView/H5 调试面板配置。 |
| `debug.webViewDebugPanel.type` | `string` | `"eruda"` | 支持 `"eruda"`、`"vconsole"`；其他值按 `"eruda"` 处理。 |
| `debug.webViewDebugPanel.scriptUrl` | `string` | 对应类型的固定版本 CDN 地址 | 可选外部脚本地址，生产只接受 `https`，开发模式接受 `http`/`https`；为空时使用对应类型的默认 CDN 地址。 |

`tapArea` 默认值：

```json
{
  "width": 30,
  "height": 30,
  "top": 0,
  "right": null,
  "bottom": null,
  "left": 0,
  "backgroundColor": "transparent"
}
```

`webViewDebugPanel` 默认值：

```json
{
  "type": "eruda",
  "scriptUrl": "https://cdn.jsdelivr.net/npm/eruda@3.4.3/eruda.min.js"
}
```

默认 CDN 地址固定到以下版本：

- eruda：`https://cdn.jsdelivr.net/npm/eruda@3.4.3/eruda.min.js`
- vConsole：`https://cdn.jsdelivr.net/npm/vconsole@3.15.1/dist/vconsole.min.js`

远程脚本地址无效、请求失败或被页面安全策略拦截时，不显示 WebView 调试面板。

## App 行为

- 后端返回 `debug` 字段后，App 全局透明点击区生效。
- 连续点击 10 次开启本机 debug，再次连续点击 10 次关闭；关闭前会二次确认。
- 开启或关闭后，App 会回到 `/` 重新执行启动链路。
- 本机 debug 开启后，App 会显示可拖动的 Debug 悬浮入口，悬浮位置会持久化，重启 App 后保持不变。
- 点击悬浮按钮只切换全局 Debug 面板显示状态，不走路由，不重载当前业务页面。
- Debug 面板常驻挂载在根布局里，内部 tabbar 当前包含 `Info`、`Logs` 和 `Tools`；这里不使用 Expo Router 的 `(tabs)` 或动态路由。
- `Info` 会展示 App、设备、Build / Runtime、Debug 状态、服务器 `debug` 配置和请求头；后端新增字段会自动显示在 `Server Debug Config` 区域，`token` / `password` / `secret` / `key` 等敏感字段会脱敏。
- `Logs` 会展示本机 Debug 日志和客户端异常记录，支持刷新、复制、清理；Debug 日志只在本机 Debug 开启时写入，并按每次 App 启动单独保存文件，页面使用启动列表/详情结构，可删除单个启动日志文件；客户端异常记录不依赖 Debug 开关，页面使用异常列表/详情结构，详情展示 summary、stack、breadcrumbs 和 extra。
- `Tools` 提供复制脱敏 Debug 快照、重置悬浮按钮位置、重新初始化、清除本地数据、清除全部本地数据、关闭 Debug 和异常链路测试；清除本地数据会二次确认，其中 `Clear Data` 会保留 Debug 状态、session、悬浮按钮位置和日志文件，`Clear All Data` 会清空全部 AsyncStorage、运行态快照、App 私有日志文件和未导出原生崩溃报告。
- Debug 面板文案固定使用英文，不接入 App 语言包。

## Crash Tests

`Tools` 里的 `Crash Tests` 用于验证客户端异常记录链路：

- `JS Fatal Error`：在 React render 之外抛出 JS 异常，验证全局 JS fatal 捕获；开发环境通常显示错误页，release 包可能关闭或重启当前 App。
- `Report Fatal Error`：调用 `ErrorUtils.reportFatalError`，验证 React Native fatal report 链路；Expo Go 通常显示 fatal 错误页，不保证杀掉宿主 App 进程。
- `Unhandled Promise`：触发未处理 Promise rejection，验证 React Native promise rejection tracking；记录可能有短暂延迟。
- `Render Error`：在 React render 阶段抛错，验证 `ClientErrorBoundary`。
- `Manual Error Report`：不闪退，直接写入一条客户端异常记录，用于验证本地文件、`Logs -> Errors` 和后续上报链路。
- `Native Crash`：通过原生模块触发 Android RuntimeException / iOS fatal signal，验证 ACRA / KSCrash 到自建 API 的链路。

Expo Go / 纯 JS 侧不能可靠模拟 native 进程崩溃。需要验证真实 native crash 时，应使用包含 `withNativeCrashReports` config plugin 的 dev client 或正式包。

## Logs 与 Breadcrumbs

- Debug Logs 是开发调试输出，来源是 `createLogger()` / `createDebugLogger()`，只在本机 Debug 开启时写入本地文件。
- dev 模式下 `createLogger()` / `createDebugLogger()` 仍直接输出到 Metro / Expo 控制台，不要求开启本机 Debug；本机 Debug 只控制是否额外写入 Debug Logs 文件。
- `createDebugLogger(tag)` 在 dev 下写控制台，在 release 下不写控制台；本机 Debug 开启后仍会写入 Debug Logs 文件，用于排查正式包启动链路、归因、域名探测等问题。
- Error Breadcrumbs 是异常分析轨迹，来源是显式的 `recordBreadcrumb()`，不依赖 Debug 开关。
- `Errors` 详情里的 breadcrumbs 不显示控制台调试输出，只记录启动链路、路由、AppState、API 状态、Debug 开关和原生崩溃导出等低敏关键事件。
- API breadcrumbs 只记录 method、path、status、duration 和错误摘要，不记录请求体、响应体、token、完整 query 或解密后的业务数据。

## Debug 面板扩展约定

- Debug 面板是根布局上的内部调试工作台，不使用 Expo Router 页面、动态路由或额外 route group。
- `AppDebugPanel` 只负责面板壳、顶部标题、底部 tabbar 和各 tab 的常驻挂载；具体功能状态由各 tab 自己持有。
- 新增功能优先作为独立 tab 或 tab 内部页面实现。tab 内部如果有列表/详情，应使用内部页面状态切换，固定操作区和滚动内容分开，避免刷新、复制、删除、返回按钮随长内容滚走。
- 业务主模块不应依赖 Debug 面板状态；悬浮按钮只切换面板可见性，不退出当前业务页面。
- 需要重新执行启动链路的操作必须显式调用对应工具动作，例如 `Restart Bootstrap`、关闭 Debug 或清理本地数据。

## Debug 请求头

- 原生 API 请求会始终携带当前安装实例：

```http
X-App-Client: <installId uuid-v4>
```

本机 Debug 开启后，原生 API 请求会额外增加：

```http
X-App-Debug: 1
X-App-Debug-Session: dbg_xxx
```

`X-App-Debug-Session` 表示本轮 Debug 开启周期；关闭 Debug 会清除 session，下次开启重新生成。`X-App-Debug` 从 `debug.requestHeaders` 读取；字段缺失时默认传 `0`。

`debug.requestHeaders` 中的其他字段也会作为请求头传递。`X-App-Debug-Session` 始终使用当前本机 Debug 会话，配置中的同名字段不会生效。

`X-App-Client` 使用当前 App 安装实例的 `installId`，格式为 UUID v4；`installId` 在 App 启动链路中确认，可复用于后续崩溃日志、问题排查等场景，不表示物理设备 ID。

## 后台配置示例

使用默认 CDN 地址加载 eruda：

```json
{
  "requestHeaders": {
    "X-App-Debug": 1,
    "X-Debug-Feature": "example"
  },
  "tapArea": {
    "width": 30,
    "height": 30,
    "top": 0,
    "left": 0
  },
  "webViewDebugPanel": {
    "type": "eruda"
  }
}
```

使用默认 CDN 地址加载 vConsole：

```json
{
  "webViewDebugPanel": {
    "type": "vconsole"
  }
}
```

使用自定义调试面板脚本地址：

```json
{
  "webViewDebugPanel": {
    "type": "eruda",
    "scriptUrl": "https://example.com/eruda.min.js"
  }
}
```

## 注意事项

- 本次只处理 App 原生侧 axios 请求头，不处理 WebView 内 H5 自己发出的 `fetch` / `XMLHttpRequest`。
- 如果后台关闭 debug，应直接不返回 `debug` 字段；不要返回空对象来表示关闭。
- 生产环境只应给测试设备、测试账号或灰度条件返回 `debug` 字段；普通正式用户不应收到该字段，否则左上角默认透明点击区会占用一小块触摸区域。
