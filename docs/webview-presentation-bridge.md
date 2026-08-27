# WebView 展示配置对接

通过 `window.ReactNativeWebView.postMessage` 调用，参数为 JSON 字符串。

## 设置展示配置

```js
window.ReactNativeWebView.postMessage(JSON.stringify({
    action: 'applyWebViewPresentation',
    params: {
        fullScreen: true,
        showFloatButton: false,
        topSafeAreaEnabled: true,
        bottomSafeAreaEnabled: false,
        backgroundColor: '0xFF000000',
        statusBarStyle: 'auto',
        screenOrientation: 'auto',
    },
}));
```

每次调用必须传入以下全部 7 个字段，不支持只传部分字段。

| 字段 | 类型与可选值 | 说明 |
|---|---|---|
| `fullScreen` | `boolean` | `true` 隐藏原生顶部栏；`false` 显示原生顶部栏。 |
| `showFloatButton` | `boolean` | 是否显示“退出全屏”悬浮按钮；仅在 `fullScreen` 为 `true` 时生效。点击按钮后显示原生顶部栏，不会关闭 H5。 |
| `topSafeAreaEnabled` | `boolean` | 是否为顶部安全区预留空间。`false` 时，状态栏叠加在 H5 内容上。 |
| `bottomSafeAreaEnabled` | `boolean` | 是否为底部安全区预留空间。 |
| `backgroundColor` | `0xAARRGGBB` 字符串 | 原生容器、顶部栏和 WebView 背景色，例如 `0xFF000000`。 |
| `statusBarStyle` | `auto` / `dark` / `light` | 状态栏图标颜色：`auto` 根据背景色自动选择；`dark` 为深色图标；`light` 为白色图标。 |
| `screenOrientation` | `auto` / `portrait` / `landscape` | `auto` 跟随系统方向；`portrait` 锁定竖屏；`landscape` 锁定横屏。 |

该动作不返回调用结果。

## 获取安全区

```js
window.ReactNativeWebView.postMessage(JSON.stringify({
    action: 'getSafeArea',
}));

window.addEventListener('nativeSafeArea', (event) => {
    const { safeTop, safeBottom } = event.detail;
    console.log(safeTop, safeBottom);
});
```

原生会通过 `nativeSafeArea` 事件返回 `{ safeTop, safeBottom }`；设备方向变化后也会再次派发该事件。
