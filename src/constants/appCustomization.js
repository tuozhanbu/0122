/**
 * 下游应用定制配置。
 *
 * 基础框架默认进入示例页，默认不启用示例 AB Test 模块。
 * 下游项目在这里配置业务入口、可选模块和启动页配色。
 */
export const DEFAULT_ENTRY_ROUTE = '/home';
export const HAS_AB_TEST_MODULE = false;
export const AB_TEST_ENTRY_ROUTE = '/dexa';

export const BOOTSTRAP_APPEARANCE = {
    indicatorColor: '#08C8FF',
    backgroundColor: '#140628',
    statusBarStyle: 'light',
};
