# WebView 原生展示配置 Bridge

## 用途

`/webview` URL 中的 `X*` 参数只决定首次进入时的原生展示状态。H5 可通过 `applyWebViewPresentation` 更新当前 WebView 会话的完整展示配置。

Bridge 配置不会回写 URL；重新进入 WebView 时，仍以 URL 参数为准。

## URL 初始参数

| URL 参数 | 默认值 | 含义 |
|---|---:|---|
| `XFullScreen` | `1` | 值为 `1` 时以全屏展示，隐藏原生顶部栏。 |
| `XShowFloatButton` | `0` | 值为 `1` 时，全屏状态显示原生“退出全屏”悬浮按钮；点击后仅恢复原生顶部栏，不会关闭 H5 或返回上一页。 |
| `XSafeTop` | `1` | 全屏时是否为顶部安全区预留空间。值为 `1` 时状态栏不透明；值为 `0` 时状态栏透明并叠加在 H5 内容上。 |
| `XSafeBottom` | `0` | 值为 `1` 时为底部安全区预留空间。 |
| `XBackgroundColor` | `0xFF000000` | 原生容器、状态栏、顶部栏和 WebView 的 ARGB 背景色。 |
| `XStatusBarStyle` | `auto` | 状态栏图标颜色：`auto` 按背景亮度自动选择，`dark` 为深色图标，`light` 为白色图标。 |
| `XScreenOrientation` | `auto` | 初始设备方向策略：`auto` 解除应用方向锁定，`portrait` 锁定竖屏，`landscape` 锁定横屏。 |
| `XSafeTopStatus` | `0` | 值为 `1` 时，在首次加载的 H5 URL 追加 `safeTop` 参数。 |
| `XSafeBottomStatus` | `0` | 值为 `1` 时，在首次加载的 H5 URL 追加 `safeBottom` 参数。 |

## 发送完整展示配置

Bridge 采用完整替换，不支持只修改单个字段。每次 `params` 必须且只能包含下列全部七个字段；字段缺失、类型错误或包含额外字段时，整条消息会被忽略。

此动作不返回成功或失败事件；无效配置或原生方向切换失败时，当前展示状态保持不变。

下例与 URL 默认配置一致，发送后会将当前展示状态恢复为默认值：

```js
const presentation = {
    fullScreen: true,
    showFloatButton: false,
    topSafeAreaEnabled: true,
    bottomSafeAreaEnabled: false,
    backgroundColor: '0xFF000000',
    statusBarStyle: 'auto',
    screenOrientation: 'auto',
};

const message = {
    action: 'applyWebViewPresentation',
    params: presentation,
};
```

字段契约：

| 字段 | 类型 | 说明 |
|---|---|---|
| `fullScreen` | `boolean` | `true` 隐藏原生顶部栏，`false` 显示原生顶部栏。 |
| `showFloatButton` | `boolean` | 仅在 `fullScreen` 为 `true` 时生效。`true` 显示原生“退出全屏”悬浮按钮；该按钮只恢复顶部栏，不关闭 H5。 |
| `topSafeAreaEnabled` | `boolean` | 全屏时是否为顶部安全区预留空间；同时决定状态栏是否透明叠加。 |
| `bottomSafeAreaEnabled` | `boolean` | 是否为底部安全区预留空间。 |
| `backgroundColor` | `0xAARRGGBB` 字符串 | 8 位十六进制 ARGB 色值，例如 `0xFF000000`。 |
| `statusBarStyle` | `auto` / `dark` / `light` | 状态栏图标颜色：`auto` 按背景亮度选择，`dark` 为深色图标，`light` 为白色图标。 |
| `screenOrientation` | `auto` / `portrait` / `landscape` | `auto` 解除应用方向锁定并交由系统决定，`portrait` 锁定竖屏，`landscape` 锁定横屏。 |

推荐使用原生注入的 `vpNativeBridge` 发送对象：

```js
window.webkit.messageHandlers.vpNativeBridge.postMessage(message);
```

也可使用 `ReactNativeWebView` 兼容通道；该通道只接收 JSON 字符串：

```js
window.ReactNativeWebView.postMessage(JSON.stringify(message));
```

## 获取安全区

`XSafeTopStatus`、`XSafeBottomStatus` 只在首次加载时向 H5 URL 追加安全区高度。运行期间（包括设备方向变化后）应通过已有 Bridge 获取最新安全区：

```js
window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'getSafeArea' }));

window.addEventListener('nativeSafeArea', function(event) {
    const { safeTop, safeBottom } = event.detail;
    console.log({ safeTop, safeBottom });
});
```

设备方向变化后，原生会再次派发 `nativeSafeArea` 事件。
