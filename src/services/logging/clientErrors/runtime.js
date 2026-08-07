const CLIENT_ERROR_RUNTIME_STATE_KEY = '__APP_CLIENT_ERROR_REPORTER__';

const runtimeState = (() => {
    if (!globalThis[CLIENT_ERROR_RUNTIME_STATE_KEY]) {
        globalThis[CLIENT_ERROR_RUNTIME_STATE_KEY] = {
            installed: false,
            currentRoute: '',
        };
    }

    return globalThis[CLIENT_ERROR_RUNTIME_STATE_KEY];
})();

export const claimClientErrorReporterInstall = () => {
    if (runtimeState.installed) {
        return false;
    }

    runtimeState.installed = true;
    return true;
};

export const setClientErrorCurrentRoute = (route) => {
    runtimeState.currentRoute = String(route ?? '');
};

export const readClientErrorCurrentRoute = () => {
    return runtimeState.currentRoute;
};

export const clearClientErrorRuntimeContext = () => {
    runtimeState.currentRoute = '';
};
