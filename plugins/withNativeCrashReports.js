const fs = require('fs');
const path = require('path');
const {
    IOSConfig,
    withDangerousMod,
    withAppBuildGradle,
    withAppDelegate,
    withXcodeProject,
    withMainApplication,
    withPodfile,
} = require('@expo/config-plugins');
const android = require('./nativeCrashReports/android');
const ios = require('./nativeCrashReports/ios');

const getAndroidPackageName = (config) => {
    const packageName = config.android?.package;
    if (!packageName) {
        throw new Error('[NativeCrashReportsPlugin] android.package is required');
    }
    return packageName;
};

const getAndroidPackageDirectory = (projectRoot, packageName) => {
    return path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', ...packageName.split('.'));
};

const writeGeneratedFile = (filePath, source) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, source);
};

const withAndroidNativeCrashModuleFiles = (config) => {
    return withDangerousMod(config, [
        'android',
        async (cfg) => {
            const packageName = getAndroidPackageName(cfg);
            const packageDirectory = getAndroidPackageDirectory(cfg.modRequest.projectRoot, packageName);
            writeGeneratedFile(
                path.join(packageDirectory, android.ANDROID_NATIVE_MODULE_FILE),
                android.ANDROID_NATIVE_MODULE_SOURCE.replace('__PACKAGE_NAME__', packageName),
            );
            writeGeneratedFile(
                path.join(packageDirectory, android.ANDROID_NATIVE_PACKAGE_FILE),
                android.ANDROID_NATIVE_PACKAGE_SOURCE.replace('__PACKAGE_NAME__', packageName),
            );
            return cfg;
        },
    ]);
};

const withIosNativeCrashModuleFile = (config) => {
    return withDangerousMod(config, [
        'ios',
        async (cfg) => {
            const sourceRoot = IOSConfig.Paths.getSourceRoot(cfg.modRequest.projectRoot);
            const legacyModulePath = path.join(sourceRoot, ios.IOS_LEGACY_NATIVE_MODULE_FILE);
            if (fs.existsSync(legacyModulePath)) {
                fs.unlinkSync(legacyModulePath);
            }
            writeGeneratedFile(path.join(sourceRoot, ios.IOS_NATIVE_MODULE_FILE), ios.IOS_NATIVE_MODULE_SOURCE);
            return cfg;
        },
    ]);
};

const withIosNativeCrashXcodeSource = (config) => {
    return withXcodeProject(config, (cfg) => {
        const projectName = cfg.modRequest.projectName;
        const legacySourceFilePath = path.join(projectName, ios.IOS_LEGACY_NATIVE_MODULE_FILE);
        if (cfg.modResults.hasFile(legacySourceFilePath)) {
            cfg.modResults.removeSourceFile(legacySourceFilePath, {}, projectName);
        }
        const sourceFilePath = path.join(projectName, ios.IOS_NATIVE_MODULE_FILE);
        if (!cfg.modResults.hasFile(sourceFilePath)) {
            IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
                filepath: sourceFilePath,
                groupName: projectName,
                project: cfg.modResults,
            });
        }
        return cfg;
    });
};

const withAndroidNativeCrashReports = (config) => {
    return withMainApplication(config, (cfg) => {
        cfg.modResults.contents = android.applyAndroidPatch(cfg.modResults.contents);
        return cfg;
    });
};

const withAndroidAcraDependency = (config) => {
    return withAppBuildGradle(config, (cfg) => {
        cfg.modResults.contents = android.addAndroidAcraDependency(
            cfg.modResults.contents,
            cfg.modResults.language,
        );
        return cfg;
    });
};

const withIosKSCrashPod = (config) => {
    return withPodfile(config, (cfg) => {
        cfg.modResults.contents = ios.addKSCrashPod(cfg.modResults.contents);
        return cfg;
    });
};

const withIosKSCrashAppDelegate = (config) => {
    return withAppDelegate(config, (cfg) => {
        if (cfg.modResults.language !== 'swift') {
            throw new Error(`[NativeCrashReportsPlugin] AppDelegate language is unsupported: ${cfg.modResults.language}`);
        }

        cfg.modResults.contents = ios.applyIosPatch(cfg.modResults.contents);
        return cfg;
    });
};

module.exports = function withNativeCrashReports(config) {
    let nextConfig = config;
    nextConfig = withAndroidNativeCrashReports(nextConfig);
    nextConfig = withAndroidAcraDependency(nextConfig);
    nextConfig = withAndroidNativeCrashModuleFiles(nextConfig);
    nextConfig = withIosKSCrashAppDelegate(nextConfig);
    nextConfig = withIosKSCrashPod(nextConfig);
    nextConfig = withIosNativeCrashModuleFile(nextConfig);
    nextConfig = withIosNativeCrashXcodeSource(nextConfig);
    return nextConfig;
};

module.exports._internal = {
    addAndroidAcraDependency: android.addAndroidAcraDependency,
    addKSCrashPod: ios.addKSCrashPod,
    applyAndroidPatch: android.applyAndroidPatch,
    applyIosPatch: ios.applyIosPatch,
    ANDROID_ACRA_SOURCE: android.ANDROID_ACRA_SOURCE,
    ANDROID_NATIVE_MODULE_SOURCE: android.ANDROID_NATIVE_MODULE_SOURCE,
    ANDROID_NATIVE_PACKAGE_SOURCE: android.ANDROID_NATIVE_PACKAGE_SOURCE,
    IOS_LEGACY_NATIVE_MODULE_FILE: ios.IOS_LEGACY_NATIVE_MODULE_FILE,
    IOS_NATIVE_MODULE_FILE: ios.IOS_NATIVE_MODULE_FILE,
    IOS_NATIVE_MODULE_SOURCE: ios.IOS_NATIVE_MODULE_SOURCE,
};
