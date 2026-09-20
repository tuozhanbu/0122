const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);
const defaultResolveRequest = config.resolver.resolveRequest;
const { transformer, resolver } = config;

config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};

config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...resolver.sourceExts, 'svg'],
    resolveRequest(context, moduleName, platform) {
        let targetModuleName = moduleName;

        if (moduleName.startsWith('@/assets/')) {
            targetModuleName = path.resolve(projectRoot, moduleName.slice(2));
        } else if (moduleName.startsWith('@/')) {
            targetModuleName = path.resolve(projectRoot, 'src', moduleName.slice(2));
        }

        if (defaultResolveRequest) {
            return defaultResolveRequest(context, targetModuleName, platform);
        }

        return context.resolveRequest(context, targetModuleName, platform);
    },
};

module.exports = config;
