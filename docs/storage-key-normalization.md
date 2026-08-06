# Storage Key 集中化规范

本文说明 `baseApp` 当前分支的持久化 key 规划，以及同步到旧项目时需要保留旧 key 字符串的兼容方案。

## 当前分支方案

所有 AsyncStorage 持久化 key 统一定义在 `src/constants/storageKeys.js`：

```js
export const APP_STORAGE_KEYS = {
    identity: {
        installId: 'app.identity.installId',
        installTime: 'app.identity.installTime',
    },
    userSession: {
        token: 'app.userSession.token',
        userInfo: 'app.userSession.userInfo',
    },
    language: {
        current: 'app.language.current',
        version: 'app.language.version',
        translations: 'app.language.translations',
        versionCache: 'app.language.versionCache',
        translationsCache: 'app.language.translationsCache',
    },
    attribution: {
        report: 'app.attribution.report',
    },
    appDebug: {
        enabled: 'app.debug.enabled',
        sessionId: 'app.debug.sessionId',
        floatingButtonPosition: 'app.debug.floatingButtonPosition',
    },
    clientError: {
        uploadState: 'app.clientError.uploadState',
    },
    openUrl: {
        jumped: 'app.openUrl.jumped',
        deferredJump: 'app.openUrl.deferredJump',
        clipboardSnapshot: 'app.openUrl.clipboardSnapshot',
        ruleConfigCache: 'app.openUrl.clipboardConfigCache',
        attributionDeepLinkParamsCache: 'app.openUrl.attributionDeepLinkParamsCache',
    },
    internalEntry: {
        stickyB: 'app.internalEntry.stickyB',
    },
    stat: {
        installed: 'app.stat.installed',
    },
};
```

命名规则：

- 第一层表示 owner 或业务域，例如 `identity`、`userSession`、`openUrl`。
- 第二层表示具体状态语义，例如 `installId`、`deferredJump`。
- 字符串值使用 `app.<domain>.<state>`，避免历史上的 `@app_`、`OPEN_URL_`、`app:` 混用。
- `globalThis` 上的 Fast Refresh runtime key 不属于持久化 key，不放入 `APP_STORAGE_KEYS`。

## 使用规则

- 新增持久化状态时，先在 `APP_STORAGE_KEYS` 中定义 key，再由状态 owner 读写。
- 页面层不要直接导入业务模块内部 key；优先调用 owner 暴露的完整操作，例如 `getJumpFlag()`。
- 不要为了兼容缺失状态静默创建新值。创建、修复和迁移只能发生在对应 owner 的显式生命周期中。
- 不要把旧 key 自动迁移混进普通读写路径。需要迁移时，单独实现可审计的迁移步骤。
- `openUrl.ruleConfigCache` 的字符串值保留 `clipboardConfigCache`，这是历史接口字段名带来的持久化 key；代码语义按后端跳转规则配置快照理解。

## 旧项目兼容方案

部分项目同步 `baseApp` 代码时，可能已经有线上用户使用旧 key。旧项目可以保留同样的分组结构，但字符串值继续使用旧值：

```js
export const APP_STORAGE_KEYS = {
    identity: {
        installId: '@app_install_id',
        installTime: '@app_install_time',
    },
    userSession: {
        token: '@app_token',
        userInfo: '@app_user_info',
    },
    language: {
        current: '@app_language',
        version: '@lang_ver',
        translations: '@lang_translations',
        versionCache: '@lang_ver_cache',
        translationsCache: '@lang_translations_cache',
    },
    attribution: {
        report: '@app_attribution_report',
    },
    appDebug: {
        enabled: 'app:debug-enabled',
        sessionId: 'app:debug-session-id',
        floatingButtonPosition: 'app:debug-floating-button-position',
    },
    clientError: {
        uploadState: 'app.clientError.uploadState',
    },
    openUrl: {
        jumped: 'OPEN_URL_JUMPED',
        deferredJump: 'OPEN_URL_DEFERRED_JUMP',
        clipboardSnapshot: 'OPEN_URL_CLIPBOARD_SNAPSHOT',
        ruleConfigCache: 'OPEN_URL_CLIPBOARD_CONFIG_CACHE',
        attributionDeepLinkParamsCache: 'OPEN_URL_ATTRIBUTION_DEEP_LINK_PARAMS_CACHE',
    },
    internalEntry: {
        stickyB: 'AB_TEST_STICKY_B',
    },
    stat: {
        installed: 'STAT_INSTALLED',
    },
};
```

旧项目同步策略：

- 代码结构按当前分支同步，key 字符串值按上面的兼容映射保留。
- `clientError.uploadState` 是当前异常上传调度状态，没有旧 key 映射，旧项目同步时使用当前字符串。
- 不保留旧的 flat `STORAGE_KEYS.TOKEN` 访问方式，新代码统一使用 `APP_STORAGE_KEYS.userSession.token`。
- 历史 `STORAGE_KEYS.SETTINGS` 在 `baseApp` 当前代码没有使用点；如果下游项目有自己的 settings 存储，应按实际 owner 增加分组 key。
- 如果某个旧项目决定切换到新字符串，必须先做明确的数据迁移方案，不能直接替换 key 值。
