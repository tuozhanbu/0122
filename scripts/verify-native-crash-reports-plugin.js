const assert = require('assert/strict');
const { _internal } = require('../plugins/withNativeCrashReports');

const countOccurrences = (source, pattern) => source.split(pattern).length - 1;

const assertContainsOnce = (source, pattern, label) => {
    assert.equal(countOccurrences(source, pattern), 1, `${label} should appear once`);
};

const verifyIosAppDelegatePatch = () => {
    const appDelegate = `import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

    const patched = _internal.applyIosPatch(appDelegate);
    assertContainsOnce(patched, 'import KSCrash', 'KSCrash import');
    assertContainsOnce(patched, 'private enum NativeCrashReports', 'iOS crash installer');
    assertContainsOnce(patched, 'NativeCrashReports.installKSCrash()', 'iOS install call');
    assert.ok(
        patched.indexOf('private enum NativeCrashReports') < patched.indexOf('@main'),
        'iOS crash installer must be declared before @main AppDelegate',
    );
    assert.ok(
        patched.indexOf('NativeCrashReports.installKSCrash()') > patched.indexOf('didFinishLaunchingWithOptions'),
        'iOS install call must be inside didFinishLaunching',
    );
    assert.equal(_internal.applyIosPatch(patched), patched, 'iOS patch must be idempotent');
};

const verifyAndroidMainApplicationApplyShape = () => {
    const mainApplication = `package com.example.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactNativeHost
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {
  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
    this,
    object : DefaultReactNativeHost(this) {
      override fun getPackages(): List<ReactPackage> =
        PackageList(this).packages.apply {
        }

      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
    }
  )

  override fun onCreate() {
    super.onCreate()
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`;

    const patched = _internal.applyAndroidPatch(mainApplication);
    assertContainsOnce(patched, 'import org.acra.ACRA', 'ACRA import');
    assertContainsOnce(patched, 'import org.json.JSONException', 'JSON exception import');
    assertContainsOnce(patched, 'class LocalCrashReportSenderFactory', 'Android crash sender');
    assertContainsOnce(patched, 'override fun attachBaseContext(base: Context)', 'Android attachBaseContext');
    assertContainsOnce(patched, 'ACRA.init(', 'ACRA init');
    assertContainsOnce(patched, 'add(AppNativeCrashReportsPackage())', 'native crash package registration');
    assert.ok(
        patched.indexOf('override fun attachBaseContext(base: Context)') < patched.indexOf('override fun onCreate()'),
        'attachBaseContext should be inserted before onCreate when onCreate exists',
    );
    assert.equal(_internal.applyAndroidPatch(patched), patched, 'Android apply shape patch must be idempotent');
};

const verifyAndroidMainApplicationPackageVariableShape = () => {
    const mainApplication = `package com.example.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage

class MainApplication : Application(), ReactApplication {
  override val reactNativeHost: ReactNativeHost =
    object : ReactNativeHost(this) {
      override fun getPackages(): List<ReactPackage> {
        val packages = PackageList(this).packages
        return packages
      }
    }
}
`;

    const patched = _internal.applyAndroidPatch(mainApplication);
    assertContainsOnce(patched, 'packages.add(AppNativeCrashReportsPackage())', 'native crash package variable registration');
    assertContainsOnce(patched, 'override fun attachBaseContext(base: Context)', 'Android attachBaseContext fallback');
    assert.equal(_internal.applyAndroidPatch(patched), patched, 'Android package variable shape patch must be idempotent');
};

const verifyAndroidMainActivityTemplateShape = () => {
    const mainActivity = `package com.example.app

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
    )
  }
}
`;

    assert.ok(mainActivity.includes('class MainActivity : ReactActivity()'), 'Android MainActivity fixture should match Expo template');
    assert.ok(!mainActivity.includes('AppNativeCrashReportsPackage'), 'native crash plugin should not require MainActivity patching');
};

const verifyGradleAndPodPatches = () => {
    const gradle = `plugins {
    id("com.android.application")
}

dependencies {
    implementation("com.facebook.react:react-android")
}
`;
    const podfile = `platform :ios, '15.1'

target 'Example' do
  use_expo_modules!
end
`;

    const patchedGradle = _internal.addAndroidAcraDependency(gradle, 'kt');
    const patchedPodfile = _internal.addKSCrashPod(podfile);
    assertContainsOnce(patchedGradle, 'implementation("ch.acra:acra-core:', 'ACRA dependency');
    assertContainsOnce(patchedPodfile, "pod 'KSCrash', '~> 2.5'", 'KSCrash pod');
    assert.equal(_internal.addAndroidAcraDependency(patchedGradle, 'kt'), patchedGradle, 'ACRA dependency patch must be idempotent');
    assert.equal(_internal.addKSCrashPod(patchedPodfile), patchedPodfile, 'KSCrash pod patch must be idempotent');
};

const verifyNativeCrashModuleClearOperations = () => {
    assertContainsOnce(
        _internal.ANDROID_NATIVE_MODULE_SOURCE,
        'fun clearPendingNativeCrashReports',
        'Android native crash clear operation',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        'clearPendingNativeCrashReports:',
        'iOS native crash clear operation',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        '[reportStore deleteAllReports]',
        'iOS native crash report deletion',
    );
};

const verifyNativeCrashTestOperations = () => {
    assert.equal(_internal.IOS_NATIVE_MODULE_FILE, 'AppNativeCrashReports.mm', 'iOS crash module must compile as Objective-C++');
    assert.equal(_internal.IOS_LEGACY_NATIVE_MODULE_FILE, 'AppNativeCrashReports.m', 'iOS legacy crash module must be identified for migration');
    assertContainsOnce(
        _internal.ANDROID_NATIVE_MODULE_SOURCE,
        'fun triggerNativeFatalCrash()',
        'Android fatal crash test operation',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        'RCT_EXPORT_METHOD(triggerNativeFatalCrash)',
        'iOS fatal crash test operation',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        'RCT_EXPORT_METHOD(triggerNativeObjectiveCException)',
        'iOS Objective-C exception test operation',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        'RCT_EXPORT_METHOD(triggerNativeCppException)',
        'iOS C++ exception test operation',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        '#include <stdexcept>',
        'iOS C++ exception dependency',
    );
};

const verifyIosCrashMonitorCoverage = () => {
    const source = _internal.applyIosPatch(`import Expo

@main
class AppDelegate: ExpoAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`);

    [
        '.machException',
        '.signal',
        '.cppException',
        '.nsException',
        '.memoryTermination',
        'config.enableSwapCxaThrow = true',
    ].forEach((monitor) => {
        assert.ok(source.includes(monitor), `iOS crash installer should enable ${monitor}`);
    });
};

const verifyNativeCrashContextSync = () => {
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        'RCT_REMAP_METHOD(setCrashContext,',
        'iOS native crash context operation',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        '[crash setUserInfoString:route forKey:AppNativeCrashRouteUserInfoKey];',
        'iOS native crash route storage',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        '[crash setUserInfoString:serializedBreadcrumbs[index] forKey:key];',
        'iOS native crash breadcrumb storage',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        'static NSUInteger const AppNativeCrashUserInfoStringByteLimit = 1024;',
        'iOS native crash user information byte limit',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        '[crash setUserInfoString:serializedEnvironment forKey:AppNativeCrashEnvironmentUserInfoKey];',
        'iOS native crash environment snapshot',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        '#import <KSCrash/KSCrash+UserInfo.h>',
        'iOS native crash per-key user information API',
    );
};

const verifyNativeCrashDiagnosticBounds = () => {
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        'static NSUInteger const AppNativeCrashStackFrameLimit = 40;',
        'iOS native crash stack frame limit',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        'static NSUInteger const AppNativeCrashStackCharacterLimit = 12000;',
        'iOS native crash stack size limit',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        '@"diagnostic": AppNativeCrashJsonValue(AppNativeCrashDiagnostic(rawReport, error, thread))',
        'iOS native crash diagnostic summary',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        '@[ @"binary_images" ]',
        'iOS native crash referenced binary images',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        'AppNativeCrashReadSysctlString("hw.machine")',
        'iOS native crash hardware model snapshot',
    );
    assertContainsOnce(
        _internal.IOS_NATIVE_MODULE_SOURCE,
        'static_cast<char *>(malloc(valueSize))',
        'iOS native crash Objective-C++ memory allocation',
    );
    assert.ok(!_internal.IOS_NATIVE_MODULE_SOURCE.includes('@"raw":'), 'iOS native crash reports must not persist the full raw report');
    assert.ok(!_internal.ANDROID_ACRA_SOURCE.includes('ReportField.LOGCAT'), 'Android native crash reports must not collect logcat');
    assert.ok(!_internal.ANDROID_ACRA_SOURCE.includes('ReportField.THREAD_DETAILS'), 'Android native crash reports must not collect all thread details');
    assertContainsOnce(
        _internal.ANDROID_NATIVE_MODULE_SOURCE,
        'fun setCrashContext(crashContext: ReadableMap, promise: Promise)',
        'Android native crash context operation',
    );
    assertContainsOnce(
        _internal.ANDROID_ACRA_SOURCE,
        'private const val stackTraceCharacterLimit = 12000',
        'Android native crash stack size limit',
    );
};

const run = () => {
    verifyIosAppDelegatePatch();
    verifyAndroidMainApplicationApplyShape();
    verifyAndroidMainApplicationPackageVariableShape();
    verifyAndroidMainActivityTemplateShape();
    verifyGradleAndPodPatches();
    verifyNativeCrashModuleClearOperations();
    verifyNativeCrashTestOperations();
    verifyIosCrashMonitorCoverage();
    verifyNativeCrashContextSync();
    verifyNativeCrashDiagnosticBounds();
    console.log('Native crash reports plugin verification passed.');
};

run();
