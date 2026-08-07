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

const ACRA_VERSION = '5.13.1';
const ANDROID_ACRA_MARKER = 'LocalCrashReportSenderFactory::class.java';
const ANDROID_NATIVE_MODULE_NAME = 'AppNativeCrashReports';
const ANDROID_NATIVE_MODULE_FILE = `${ANDROID_NATIVE_MODULE_NAME}Module.kt`;
const ANDROID_NATIVE_PACKAGE_FILE = `${ANDROID_NATIVE_MODULE_NAME}Package.kt`;
const IOS_NATIVE_MODULE_FILE = `${ANDROID_NATIVE_MODULE_NAME}.m`;
const ANDROID_ACRA_INIT_CALL = `ACRA.init(
      this,
      CoreConfiguration(
        buildConfigClass = BuildConfig::class.java,
        reportFormat = StringFormat.JSON,
        alsoReportToAndroidFramework = true,
        pluginLoader = SimplePluginLoader(LocalCrashReportSenderFactory::class.java),
        reportContent = listOf(
          ReportField.REPORT_ID,
          ReportField.APP_VERSION_CODE,
          ReportField.APP_VERSION_NAME,
          ReportField.PACKAGE_NAME,
          ReportField.PHONE_MODEL,
          ReportField.ANDROID_VERSION,
          ReportField.BUILD,
          ReportField.BRAND,
          ReportField.PRODUCT,
          ReportField.STACK_TRACE,
          ReportField.STACK_TRACE_HASH,
          ReportField.LOGCAT,
          ReportField.USER_APP_START_DATE,
          ReportField.USER_CRASH_DATE,
          ReportField.THREAD_DETAILS,
          ReportField.DISPLAY,
          ReportField.TOTAL_MEM_SIZE,
          ReportField.AVAILABLE_MEM_SIZE
        )
      ),
      true
    )`;
const ANDROID_ACRA_SOURCE = `

class LocalCrashReportSenderFactory : ReportSenderFactory {
  override fun create(context: Context, config: CoreConfiguration): ReportSender {
    return LocalCrashReportSender()
  }
}

private class LocalCrashReportSender : ReportSender {
  override fun send(context: Context, errorContent: CrashReportData) {
    NativeCrashReportFile.append(context, errorContent)
  }
}

private object NativeCrashReportFile {
  private const val directoryPath = "app-logs/native-crashes"
  private const val pendingFileName = "pending.jsonl"

  fun append(context: Context, crashReportData: CrashReportData) {
    try {
      val directory = File(context.filesDir, directoryPath)
      if (!directory.exists() && !directory.mkdirs()) {
        throw IOException("Cannot create native crash directory: " + directory.absolutePath)
      }

      val stack = crashReportData.getString(ReportField.STACK_TRACE).orEmpty()
      val report = JSONObject()
      report.put("reportId", crashReportData.getString(ReportField.REPORT_ID))
      report.put("occurredAt", crashReportData.getString(ReportField.USER_CRASH_DATE))
      report.put("platform", "android")
      report.put("source", "android_acra")
      report.put("errorName", "AndroidCrash")
      report.put("message", stack.lineSequence().firstOrNull().orEmpty())
      report.put("stack", stack)
      report.put("thread", crashReportData.getString(ReportField.THREAD_DETAILS))
      report.put("appVersion", crashReportData.getString(ReportField.APP_VERSION_NAME))
      report.put("nativeBuildVersion", crashReportData.getString(ReportField.APP_VERSION_CODE))
      report.put("systemVersion", crashReportData.getString(ReportField.ANDROID_VERSION))
      report.put("deviceModel", crashReportData.getString(ReportField.PHONE_MODEL))
      report.put("raw", JSONObject(crashReportData.toJSON()))
      File(directory, pendingFileName).appendText(report.toString() + "\\n")
    } catch (error: Throwable) {
      throw ReportSenderException("Cannot persist native crash report", error)
    }
  }
}
`;

const ANDROID_NATIVE_MODULE_SOURCE = `package __PACKAGE_NAME__

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Date

class AppNativeCrashReportsModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "AppNativeCrashReports"

  @ReactMethod
  fun flushPendingNativeCrashReports(promise: Promise) {
    promise.resolve(null)
  }

  @ReactMethod
  fun clearPendingNativeCrashReports(promise: Promise) {
    promise.resolve(null)
  }

  @ReactMethod
  fun triggerNativeCrash() {
    throw RuntimeException("Debug test Android native crash: " + Date().toString())
  }
}
`;

const ANDROID_NATIVE_PACKAGE_SOURCE = `package __PACKAGE_NAME__

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AppNativeCrashReportsPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(AppNativeCrashReportsModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

const IOS_KSCRASH_IMPORT = 'import KSCrash';
const IOS_KSCRASH_INSTALL = 'NativeCrashReports.installKSCrash()';
const IOS_KSCRASH_SOURCE = `

private enum NativeCrashReports {
  static func installKSCrash() {
    let config = KSCrashConfiguration()
    config.monitors = [.machException, .signal]
    try? KSCrash.shared.install(with: config)
  }
}
`;

const IOS_NATIVE_MODULE_SOURCE = `#import <Foundation/Foundation.h>
#import <stdlib.h>
#import <UIKit/UIKit.h>
#import <React/RCTBridgeModule.h>
#import <KSCrash/KSCrash.h>
#import <KSCrash/KSCrashReport.h>
#import <KSCrash/KSCrashReportFilter.h>
#import <KSCrash/KSCrashReportStore.h>

static NSString *const AppNativeCrashReportDirectoryPath = @"app-logs/native-crashes";
static NSString *const AppNativeCrashReportPendingFileName = @"pending.jsonl";

static id AppNativeCrashJsonValue(id value) {
  if ([value isKindOfClass:[NSDictionary class]]) {
    NSMutableDictionary *dictionary = [NSMutableDictionary dictionary];
    [(NSDictionary *)value enumerateKeysAndObjectsUsingBlock:^(id key, id obj, BOOL *stop) {
      if ([key isKindOfClass:[NSString class]]) {
        dictionary[key] = AppNativeCrashJsonValue(obj);
      }
    }];
    return dictionary;
  }

  if ([value isKindOfClass:[NSArray class]]) {
    NSMutableArray *array = [NSMutableArray array];
    for (id item in (NSArray *)value) {
      [array addObject:AppNativeCrashJsonValue(item)];
    }
    return array;
  }

  if ([value isKindOfClass:[NSString class]] || [value isKindOfClass:[NSNumber class]] || value == [NSNull null]) {
    return value;
  }

  if ([value isKindOfClass:[NSDate class]]) {
    static NSISO8601DateFormatter *formatter;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
      formatter = [NSISO8601DateFormatter new];
    });
    return [formatter stringFromDate:(NSDate *)value];
  }

  return [value description] ?: @"";
}

static id AppNativeCrashNestedValue(NSDictionary *dictionary, NSArray<NSString *> *path) {
  id current = dictionary;
  for (NSString *key in path) {
    if (![current isKindOfClass:[NSDictionary class]]) {
      return nil;
    }
    current = [(NSDictionary *)current objectForKey:key];
  }
  return current;
}

static NSString *AppNativeCrashStringAtPath(NSDictionary *dictionary, NSArray<NSString *> *path) {
  id value = AppNativeCrashNestedValue(dictionary, path);
  if ([value isKindOfClass:[NSString class]]) {
    return value;
  }
  if ([value isKindOfClass:[NSNumber class]]) {
    return [(NSNumber *)value stringValue];
  }
  return @"";
}

static NSDictionary *AppNativeCrashCrashedThread(NSDictionary *rawReport) {
  NSArray *threads = AppNativeCrashNestedValue(rawReport, @[ @"crash", @"threads" ]);
  if (![threads isKindOfClass:[NSArray class]]) {
    return @{};
  }

  for (id thread in threads) {
    if ([thread isKindOfClass:[NSDictionary class]] && [[thread objectForKey:@"crashed"] boolValue]) {
      return thread;
    }
  }

  NSDictionary *firstThread = threads.firstObject;
  return [firstThread isKindOfClass:[NSDictionary class]] ? firstThread : @{};
}

static NSString *AppNativeCrashStackString(NSDictionary *thread) {
  NSArray *frames = AppNativeCrashNestedValue(thread, @[ @"backtrace", @"contents" ]);
  if (![frames isKindOfClass:[NSArray class]]) {
    return @"";
  }

  NSMutableArray<NSString *> *lines = [NSMutableArray array];
  for (id frame in frames) {
    if (![frame isKindOfClass:[NSDictionary class]]) {
      continue;
    }

    NSString *objectName = AppNativeCrashStringAtPath(frame, @[ @"object_name" ]);
    NSString *symbolName = AppNativeCrashStringAtPath(frame, @[ @"symbol_name" ]);
    NSString *instructionAddress = AppNativeCrashStringAtPath(frame, @[ @"instruction_addr" ]);
    NSString *line = [NSString stringWithFormat:@"%@ %@ %@", objectName, symbolName, instructionAddress];
    [lines addObject:[line stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]]];
  }
  return [lines componentsJoinedByString:@"\\n"];
}

static NSDictionary *AppNativeCrashNormalizeReport(NSDictionary *rawReport) {
  NSDictionary *error = AppNativeCrashNestedValue(rawReport, @[ @"crash", @"error" ]);
  if (![error isKindOfClass:[NSDictionary class]]) {
    error = @{};
  }

  NSDictionary *system = AppNativeCrashNestedValue(rawReport, @[ @"system" ]);
  if (![system isKindOfClass:[NSDictionary class]]) {
    system = @{};
  }

  NSDictionary *thread = AppNativeCrashCrashedThread(rawReport);
  NSString *errorName = AppNativeCrashStringAtPath(error, @[ @"type" ]);
  if (errorName.length == 0) {
    errorName = AppNativeCrashStringAtPath(error, @[ @"mach", @"exception_name" ]);
  }
  if (errorName.length == 0) {
    errorName = @"iOSCrash";
  }

  NSString *message = AppNativeCrashStringAtPath(error, @[ @"reason" ]);
  if (message.length == 0) {
    message = AppNativeCrashStringAtPath(error, @[ @"signal", @"name" ]);
  }

  NSString *appVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"";
  NSString *buildVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"] ?: @"";
  NSString *systemName = AppNativeCrashStringAtPath(system, @[ @"system_name" ]);
  NSString *systemVersion = AppNativeCrashStringAtPath(system, @[ @"system_version" ]);
  NSString *deviceModel = AppNativeCrashStringAtPath(system, @[ @"machine" ]);

  return @{
    @"reportId": AppNativeCrashStringAtPath(rawReport, @[ @"report", @"id" ]).length > 0 ? AppNativeCrashStringAtPath(rawReport, @[ @"report", @"id" ]) : [[NSUUID UUID] UUIDString],
    @"occurredAt": AppNativeCrashStringAtPath(rawReport, @[ @"report", @"timestamp" ]).length > 0 ? AppNativeCrashStringAtPath(rawReport, @[ @"report", @"timestamp" ]) : [[NSDate date] description],
    @"platform": @"ios",
    @"source": @"ios_kscrash",
    @"errorName": errorName,
    @"message": message,
    @"stack": AppNativeCrashStackString(thread),
    @"thread": AppNativeCrashStringAtPath(thread, @[ @"name" ]),
    @"appVersion": appVersion,
    @"nativeBuildVersion": buildVersion,
    @"systemVersion": [NSString stringWithFormat:@"%@ %@", systemName, systemVersion],
    @"deviceModel": deviceModel.length > 0 ? deviceModel : [[UIDevice currentDevice] model],
    @"raw": AppNativeCrashJsonValue(rawReport)
  };
}

@interface AppNativeCrashReportFileSink : NSObject <KSCrashReportFilter>
@end

@implementation AppNativeCrashReportFileSink

- (NSURL *)pendingReportFileURLWithError:(NSError **)error {
  NSFileManager *fileManager = [NSFileManager defaultManager];
  NSURL *documentsURL = [fileManager URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask].firstObject;
  if (documentsURL == nil) {
    if (error != nil) {
      *error = [NSError errorWithDomain:@"AppNativeCrashReports" code:1 userInfo:@{ NSLocalizedDescriptionKey: @"Documents directory not found" }];
    }
    return nil;
  }

  NSURL *directoryURL = [documentsURL URLByAppendingPathComponent:AppNativeCrashReportDirectoryPath isDirectory:YES];
  [fileManager createDirectoryAtURL:directoryURL withIntermediateDirectories:YES attributes:nil error:error];
  if (error != nil && *error != nil) {
    return nil;
  }
  return [directoryURL URLByAppendingPathComponent:AppNativeCrashReportPendingFileName];
}

- (BOOL)appendReport:(NSDictionary *)report toFile:(NSURL *)fileURL error:(NSError **)error {
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:report options:0 error:error];
  if (jsonData == nil) {
    return NO;
  }

  NSMutableData *lineData = [NSMutableData dataWithData:jsonData];
  [lineData appendData:[@"\\n" dataUsingEncoding:NSUTF8StringEncoding]];

  if (![[NSFileManager defaultManager] fileExistsAtPath:fileURL.path]) {
    return [lineData writeToURL:fileURL options:NSDataWritingAtomic error:error];
  }

  NSFileHandle *fileHandle = [NSFileHandle fileHandleForWritingToURL:fileURL error:error];
  if (fileHandle == nil) {
    return NO;
  }

  @try {
    [fileHandle seekToEndOfFile];
    [fileHandle writeData:lineData];
    if (@available(iOS 13.0, *)) {
      [fileHandle closeAndReturnError:error];
    } else {
      [fileHandle closeFile];
    }
    return error == nil || *error == nil;
  } @catch (NSException *exception) {
    if (error != nil) {
      *error = [NSError errorWithDomain:@"AppNativeCrashReports" code:2 userInfo:@{ NSLocalizedDescriptionKey: exception.reason ?: @"Cannot append native crash report" }];
    }
    return NO;
  }
}

- (void)filterReports:(NSArray<id<KSCrashReport>> *)reports onCompletion:(KSCrashReportFilterCompletion)onCompletion {
  NSError *writeError = nil;
  NSURL *fileURL = [self pendingReportFileURLWithError:&writeError];
  if (fileURL == nil) {
    kscrash_callCompletion(onCompletion, nil, writeError);
    return;
  }

  for (id<KSCrashReport> report in reports) {
    id rawValue = report.untypedValue;
    if (![rawValue isKindOfClass:[NSDictionary class]]) {
      continue;
    }

    NSDictionary *normalizedReport = AppNativeCrashNormalizeReport((NSDictionary *)rawValue);
    if (![self appendReport:normalizedReport toFile:fileURL error:&writeError]) {
      kscrash_callCompletion(onCompletion, nil, writeError);
      return;
    }
  }

  kscrash_callCompletion(onCompletion, reports, nil);
}

@end

@interface AppNativeCrashReports : NSObject <RCTBridgeModule>
@end

@implementation AppNativeCrashReports

RCT_EXPORT_MODULE(AppNativeCrashReports)

RCT_EXPORT_METHOD(flushPendingNativeCrashReports:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  KSCrashReportStore *reportStore = [KSCrash sharedInstance].reportStore;
  if (reportStore == nil || reportStore.reportCount == 0) {
    resolve(@{ @"exported": @0 });
    return;
  }

  reportStore.sink = [AppNativeCrashReportFileSink new];
  reportStore.reportCleanupPolicy = KSCrashReportCleanupPolicyOnSuccess;
  [reportStore sendAllReportsWithCompletion:^(NSArray<id<KSCrashReport>> *filteredReports, NSError *error) {
    if (error != nil) {
      reject(@"native_crash_flush_failed", error.localizedDescription, error);
      return;
    }
    resolve(@{ @"exported": @(filteredReports.count) });
  }];
}

RCT_EXPORT_METHOD(clearPendingNativeCrashReports:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  KSCrashReportStore *reportStore = [KSCrash sharedInstance].reportStore;
  [reportStore deleteAllReports];
  resolve(nil);
}

RCT_EXPORT_METHOD(triggerNativeCrash) {
  abort();
}

@end
`;

const addKotlinImport = (source, importLine) => {
    if (source.includes(importLine)) {
        return source;
    }

    return source.replace(/(package [^\n]+\n)/, `$1${importLine}\n`);
};

const addAndroidImports = (source) => {
    return [
        'import android.content.Context',
        'import java.io.IOException',
        'import java.io.File',
        'import org.json.JSONObject',
        'import org.acra.ACRA',
        'import org.acra.ReportField',
        'import org.acra.config.CoreConfiguration',
        'import org.acra.data.CrashReportData',
        'import org.acra.data.StringFormat',
        'import org.acra.plugins.SimplePluginLoader',
        'import org.acra.sender.ReportSender',
        'import org.acra.sender.ReportSenderException',
        'import org.acra.sender.ReportSenderFactory',
    ].reduce(addKotlinImport, source);
};

const addAndroidAcraReporter = (source) => {
    if (source.includes('class LocalCrashReportSenderFactory')) {
        return source;
    }

    const classIndex = source.indexOf('\nclass MainApplication');
    if (classIndex === -1) {
        throw new Error('[NativeCrashReportsPlugin] MainApplication.kt class declaration not found');
    }

    return `${source.slice(0, classIndex)}${ANDROID_ACRA_SOURCE}${source.slice(classIndex)}`;
};

const addAndroidAttachBaseContext = (source) => {
    if (source.includes(ANDROID_ACRA_MARKER)) {
        return source;
    }

    const attachPattern = /(\s*override fun attachBaseContext\(\s*base\s*:\s*Context\s*\)\s*\{\n\s*super\.attachBaseContext\(base\)\n)/;
    if (attachPattern.test(source)) {
        return source.replace(attachPattern, `$1    ${ANDROID_ACRA_INIT_CALL}\n`);
    }

    const onCreateIndex = source.indexOf('\n  override fun onCreate()');
    if (onCreateIndex !== -1) {
        const methodSource = `
  override fun attachBaseContext(base: Context) {
    super.attachBaseContext(base)
    ${ANDROID_ACRA_INIT_CALL}
  }
`;
        return `${source.slice(0, onCreateIndex)}${methodSource}${source.slice(onCreateIndex)}`;
    }

    const classEndIndex = source.lastIndexOf('\n}');
    if (classEndIndex === -1) {
        throw new Error('[NativeCrashReportsPlugin] MainApplication.kt class end not found');
    }

    return `${source.slice(0, classEndIndex)}
  override fun attachBaseContext(base: Context) {
    super.attachBaseContext(base)
    ${ANDROID_ACRA_INIT_CALL}
  }
${source.slice(classEndIndex)}`;
};

const addAndroidNativeCrashPackage = (source) => {
    if (source.includes('AppNativeCrashReportsPackage()')) {
        return source;
    }

    const packageListApplyPattern = /^([ \t]*)PackageList\(this\)\.packages\.apply\s*\{\n/m;
    if (packageListApplyPattern.test(source)) {
        return source.replace(packageListApplyPattern, (match, indent) => (
            `${match}${indent}  add(AppNativeCrashReportsPackage())\n`
        ));
    }

    const packageListPattern = /(val packages = PackageList\(this\)\.packages\n)/;
    if (packageListPattern.test(source)) {
        return source.replace(packageListPattern, `$1      packages.add(AppNativeCrashReportsPackage())\n`);
    }

    const directReturnPattern = /return PackageList\(this\)\.packages/;
    if (directReturnPattern.test(source)) {
        return source.replace(directReturnPattern, 'return PackageList(this).packages + AppNativeCrashReportsPackage()');
    }

    throw new Error('[NativeCrashReportsPlugin] MainApplication.kt package list shape is unsupported');
};

const applyAndroidPatch = (source) => {
    return addAndroidNativeCrashPackage(addAndroidAttachBaseContext(addAndroidAcraReporter(addAndroidImports(source))));
};

const addAndroidAcraDependency = (source, language) => {
    if (source.includes('ch.acra:acra-core')) {
        return source;
    }

    const dependencyLine = language === 'kt'
        ? `    implementation("ch.acra:acra-core:${ACRA_VERSION}")`
        : `    implementation 'ch.acra:acra-core:${ACRA_VERSION}'`;
    const dependenciesPattern = /dependencies\s*\{/;
    if (!dependenciesPattern.test(source)) {
        throw new Error('[NativeCrashReportsPlugin] app build.gradle dependencies block not found');
    }

    return source.replace(dependenciesPattern, (match) => `${match}\n${dependencyLine}`);
};

const addKSCrashPod = (source) => {
    if (source.includes("pod 'KSCrash'")) {
        return source;
    }

    const useExpoModulesLine = /(\s*use_expo_modules!\s*\n)/;
    if (!useExpoModulesLine.test(source)) {
        throw new Error('[NativeCrashReportsPlugin] Podfile use_expo_modules! not found');
    }

    return source.replace(useExpoModulesLine, `$1  pod 'KSCrash', '~> 2.5'\n`);
};

const addSwiftImport = (source, importLine) => {
    if (source.includes(importLine)) {
        return source;
    }

    const lastImportMatch = [...source.matchAll(/^import .+$/gm)].pop();
    if (!lastImportMatch) {
        return `${importLine}\n${source}`;
    }

    const insertIndex = lastImportMatch.index + lastImportMatch[0].length;
    return `${source.slice(0, insertIndex)}\n${importLine}${source.slice(insertIndex)}`;
};

const addIosKSCrashInstaller = (source) => {
    const withoutInstaller = source.replace(
        /\n\nprivate enum NativeCrashReports \{\n\s*static func installKSCrash\(\) \{\n[\s\S]*?\n\s*\}\n\}\n?/,
        '',
    );

    const mainIndex = withoutInstaller.indexOf('\n@main');
    if (mainIndex !== -1) {
        return `${withoutInstaller.slice(0, mainIndex)}${IOS_KSCRASH_SOURCE}${withoutInstaller.slice(mainIndex)}`;
    }

    const classIndex = withoutInstaller.indexOf('\nclass AppDelegate');
    if (classIndex === -1) {
        throw new Error('[NativeCrashReportsPlugin] AppDelegate.swift class declaration not found');
    }

    return `${withoutInstaller.slice(0, classIndex)}${IOS_KSCRASH_SOURCE}${withoutInstaller.slice(classIndex)}`;
};

const normalizeIosInstallCallIndent = (source) => {
    return source.replace(/^[ \t]*NativeCrashReports\.installKSCrash\(\)$/m, `    ${IOS_KSCRASH_INSTALL}`);
};

const addIosInstallCall = (source) => {
    if (source.includes(IOS_KSCRASH_INSTALL)) {
        return normalizeIosInstallCallIndent(source);
    }

    const launchPattern = /(?:^|\n)([ \t]*)(?:public\s+)?override\s+func\s+application\s*\(/g;
    let launchMatch = launchPattern.exec(source);
    while (launchMatch) {
        const bodyStartIndex = source.indexOf('{', launchMatch.index);
        if (bodyStartIndex === -1) {
            throw new Error('[NativeCrashReportsPlugin] AppDelegate.swift didFinishLaunching body is unsupported');
        }

        const methodHeader = source.slice(launchMatch.index, bodyStartIndex);
        if (methodHeader.includes('didFinishLaunchingWithOptions')) {
            const bodyIndent = `${launchMatch[1]}  `;
            return `${source.slice(0, bodyStartIndex + 1)}\n${bodyIndent}${IOS_KSCRASH_INSTALL}${source.slice(bodyStartIndex + 1)}`;
        }

        launchMatch = launchPattern.exec(source);
    }

    throw new Error('[NativeCrashReportsPlugin] AppDelegate.swift didFinishLaunching shape is unsupported');
};

const applyIosPatch = (source) => {
    return addIosInstallCall(addIosKSCrashInstaller(addSwiftImport(source, IOS_KSCRASH_IMPORT)));
};

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
                path.join(packageDirectory, ANDROID_NATIVE_MODULE_FILE),
                ANDROID_NATIVE_MODULE_SOURCE.replace('__PACKAGE_NAME__', packageName),
            );
            writeGeneratedFile(
                path.join(packageDirectory, ANDROID_NATIVE_PACKAGE_FILE),
                ANDROID_NATIVE_PACKAGE_SOURCE.replace('__PACKAGE_NAME__', packageName),
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
            writeGeneratedFile(path.join(sourceRoot, IOS_NATIVE_MODULE_FILE), IOS_NATIVE_MODULE_SOURCE);
            return cfg;
        },
    ]);
};

const withIosNativeCrashXcodeSource = (config) => {
    return withXcodeProject(config, (cfg) => {
        const projectName = cfg.modRequest.projectName;
        const sourceFilePath = path.join(projectName, IOS_NATIVE_MODULE_FILE);
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
        cfg.modResults.contents = applyAndroidPatch(cfg.modResults.contents);
        return cfg;
    });
};

const withAndroidAcraDependency = (config) => {
    return withAppBuildGradle(config, (cfg) => {
        cfg.modResults.contents = addAndroidAcraDependency(
            cfg.modResults.contents,
            cfg.modResults.language,
        );
        return cfg;
    });
};

const withIosKSCrashPod = (config) => {
    return withPodfile(config, (cfg) => {
        cfg.modResults.contents = addKSCrashPod(cfg.modResults.contents);
        return cfg;
    });
};

const withIosKSCrashAppDelegate = (config) => {
    return withAppDelegate(config, (cfg) => {
        if (cfg.modResults.language !== 'swift') {
            throw new Error(`[NativeCrashReportsPlugin] AppDelegate language is unsupported: ${cfg.modResults.language}`);
        }

        cfg.modResults.contents = applyIosPatch(cfg.modResults.contents);
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
    addAndroidAcraDependency,
    addKSCrashPod,
    applyAndroidPatch,
    applyIosPatch,
    ANDROID_NATIVE_MODULE_SOURCE,
    ANDROID_NATIVE_PACKAGE_SOURCE,
    IOS_NATIVE_MODULE_SOURCE,
};
