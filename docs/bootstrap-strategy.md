# 启动策略维护说明

本文说明 App 启动链路的职责划分、当前前后端综合启动策略，以及后续新增归因来源或跳转执行方式时应该改哪里。

## 总体边界

启动页 `src/app/index.jsx` 只负责：

- 首屏 loading/error/retry UI。
- AppState 回前台后的启动重试。
- 调用启动服务获取 action。
- 执行 action 后记录启动结果。

启动页不直接处理 `/system/init`、`/system/getOpenUrl`、剪贴板、归因、静默计时、跳转缓存或具体路由规则。

启动服务统一放在 `src/services/bootstrap/`。

## AppsFlyer 启动等待配置

AppsFlyer 的事件上报与启动阶段的深链结果读取互不绑定。`/system/init` 可在
`data.attribution.config` 下配置 `openUrlDeepLinkWaitMs`：

```json
{
  "provider": "appsFlyer",
  "config": {
    "enabled": true,
    "devKey": "<AppsFlyer Dev Key>",
    "iosAppId": "<App Store ID>",
    "openUrlDeepLinkWaitMs": 0
  }
}
```

- 字段缺失时为 `5000`，作为深链/延迟深链识别等待窗口。
- 设为 `0` 时，不等待 AppsFlyer 深链回调，立即继续 `/system/getOpenUrl`；AppsFlyer SDK 仍会初始化、监听回调并上报事件。
- 仅接受非负整数毫秒值；字段缺失或值无效时统一使用 `5000`。

系统初始 URL 会先参与启动决策，并同时记录到归因快照。已确认恢复本地安装身份时，AppsFlyer 只要返回明确的未命中深链结果便结束等待；首次安装或本地身份状态无法确认时，仍保留安装归因回调等待流程。

启动 OpenUrl 的归因输入固定按以下顺序处理：先解析由 `Linking` 提供的 Scheme URI 或 Universal Link；没有有效 `deep_link_value` 时，再等待 AppsFlyer 回调；两者均不可用时，才按配置读取系统剪切板兜底。初始 URL 只使用本次进程收到的值，不复用历史归因快照。

`allowDeepLinkOverride=true` 时，启动会无条件执行一次 AF 深链读取，再用本次有效结果覆盖缓存。该启动决策只使用一个 `openUrlDeepLinkWaitMs` 等待窗口；读取无结果时保留旧缓存，后续 `/system/getOpenUrl` 直接复用本次结果或旧缓存，不再重复等待第二个窗口。

## 职责边界

这里的“启动策略”不是纯前端策略。后端负责业务策略判断，例如 IP、地区、后台配置、是否打开、跳转地址、跳转类型和 A/B 模块；前端不复刻这些规则。

前端只负责：

- 准备启动上下文。
- 收集客户端信号来源，例如剪贴板、归因 SDK、归因剪贴板兜底和静默计时复查。
- 请求 `/system/getOpenUrl`。
- 根据后端返回执行跳转或进入内部入口。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `actions.js` | 定义启动 action 类型和 action 创建函数。 |
| `context.js` | 准备启动上下文：恢复本地用户/语言/installId、域名选择、请求 `/system/init`、配置 Debug 和归因。 |
| `decision.js` | 启动策略排序入口。后续新增客户端信号来源优先接入这里。 |
| `openUrlRequest.js` | 为 `/system/getOpenUrl` 准备请求上下文，按优先级选择剪贴板或归因来源。 |
| `openUrlDecision.js` | 根据 `/system/getOpenUrl` 后端结果解析 openUrl 跳转或内部入口 action。 |
| `navigation.js` | 执行启动 action，负责内部入口、WebView 跳转和外部跳转后的内部入口回落。 |
| `installStat.js` | 首次安装统计上报，不阻断启动链路。 |
| `runBootstrap.js` | 串联 context 和 decision，返回最终 action。 |

## 当前启动策略

1. `prepareBootstrapContext()`
   恢复本地用户、语言和 `installId`，完成域名选择，请求 `/system/init`，配置 Debug、归因和 `bootstrapBase`。

2. `resolveDeferredJumpAction()`
   如果本地没有 `openUrl.jumped=1`，且存在 `openUrl.deferredJump`，说明已有静默计时任务，直接进入内部入口，不重复请求 `/system/getOpenUrl`。

3. `resolveNewDeferredJumpAction()`
   `checkTime > 0` 时，先采集启动深链（Scheme URI、Universal Link、AF direct deep link）；只要存在有效参数，无论普通剪贴板是否开启，都不读取也不使用剪贴板。只有启动深链不可用时，才按 init 返回的剪贴板开关和归因剪贴板兜底配置读取一次系统剪贴板。随后保存倒计时任务并进入内部入口，启动阶段不请求 `/system/getOpenUrl`。普通剪贴板开启时使用原始快照并忽略 AF 剪贴板兜底；AF 兜底只解析同一份原始快照，不会额外读取系统剪贴板。

4. `resolveOpenUrlAction()` / `resolveOpenUrlDecision()`
   根据后端 getOpenUrl 结果生成 action：

   - 已有 `openUrl.jumped=1`：请求优先复用已缓存的 AF 参数，否则使用剪贴板快照；只要 `targetUrl` 和 `linkType` 有效，直接跳转，不再判断 `isOpen`。
   - `checkTime <= 0`：只有 `isOpen=1`、`targetUrl` 有效、`linkType` 支持时才立即跳转。
   - 其他情况：进入内部入口。

5. 根布局静默任务执行
   到点后请求 `/system/getOpenUrl`；请求优先使用最新 AF deep link，其次使用静默任务中保存的 AF 快照。只有 AF 参数都不可用时，才读取并使用启动时缓存的剪贴板快照：若 init 开启普通剪贴板读取，则使用原始快照并忽略 AF 剪贴板兜底；否则可使用启动时解析出的 AF 剪贴板兜底参数。返回可跳转结果时优先跳转；返回不可跳转结果时再按响应 `abTest` 切换内部入口。正常返回但不跳转时清除倒计时任务、保留剪贴板快照；请求失败时同样保留任务和快照等待下次前台重试。

6. `executeBootstrapAction()`
   执行 action：

   - `internal_entry`：进入 `DEFAULT_ENTRY_ROUTE` 指定的默认入口，或 AB Test 模块入口。
   - `open_url_jump`：按 `linkType` 跳 WebView 或外部浏览器；外部浏览器打开后仍回到内部入口。

## Action 契约

启动策略节点不能直接调用 `router`，只能返回 action。

内部入口：

```js
createInternalEntryAction({
    abTest,
    reason: 'strategy_reason',
});
```

OpenUrl 跳转：

```js
createOpenUrlJumpAction({
    linkType,
    targetUrl,
    abTest,
    attributionDeepLinkParams,
});
```

`navigation.js` 只接受已知 action。未知 action 或不可执行跳转会抛错，由启动页进入错误态，避免静默回首页隐藏流程错误。

## 新增客户端信号来源

新增归因来源、剪贴板来源或启动复查流程时按这个顺序判断 owner：

1. 只需要已有启动上下文，新增 `resolveXxxAction()`，放在 `decision.js` 或独立策略文件。
2. 需要请求新接口，新增 `xxxRequest.js`，策略函数只消费整理后的结果。
3. 需要新增 `/system/init` 派生状态，放在 `context.js`，并返回给 `resolveBootstrapAction()`。
4. 需要新增跳转执行方式，先扩展 action 类型，再在 `navigation.js` 里实现执行。

策略函数格式：

```js
const resolveXxxAction = async (context) => {
    if (!matched) {
        return null;
    }

    return createInternalEntryAction({
        abTest,
        reason: 'xxx_matched',
    });
};
```

在 `resolveBootstrapAction()` 中按优先级插入：

```js
export const resolveBootstrapAction = async (context) => {
    const xxxAction = await resolveXxxAction(context);
    if (xxxAction) {
        return xxxAction;
    }

    const deferredJumpAction = await resolveDeferredJumpAction();
    if (deferredJumpAction) {
        return deferredJumpAction;
    }

    return resolveOpenUrlAction(context);
};
```

## 维护规则

- 不要把新启动信号来源写回 `src/app/index.jsx`。
- 不要让策略函数直接操作 `router`。
- 不要用布尔值表示“是否跳转”；返回明确 action。
- 不要在内部重复校验已由 context 边界保证的必需数据。
- 不要用 fallback 静默修复缺失的必需状态；缺失时应抛错、返回明确空结果，或让当前策略节点不命中。
- 日志和 breadcrumbs 只记录低敏摘要，不记录 token、完整 URL query、请求体、响应体或解密后的业务数据。

## 相关状态

- `openUrl.jumped`：已发生过 openUrl 跳转的本地标记。
- `openUrl.deferredJump`：静默计时任务。
- `openUrl.clipboardSnapshot`：未跳转时每次启动更新、已跳转后复用的剪贴板快照；其中显式区分“已读取但为空”和“未读取”。
- `openUrl.ruleConfigCache`：确定跳转后缓存的后端跳转规则配置快照；后续请求 `/system/getOpenUrl` 时会按后端协议字段 `clipboardConfig` 原样带回。
- `openUrl.attributionDeepLinkParamsCache`：确定跳转后缓存的归因 deep link 参数。

这些状态由 `src/services/openUrlJump.js` 统一维护，启动策略只通过该模块提供的操作读取或写入。
