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
