const ACRA_VERSION = '5.13.1';
const ANDROID_ACRA_MARKER = 'LocalCrashReportSenderFactory::class.java';
const ANDROID_NATIVE_MODULE_NAME = 'AppNativeCrashReports';
const ANDROID_NATIVE_MODULE_FILE = `${ANDROID_NATIVE_MODULE_NAME}Module.kt`;
const ANDROID_NATIVE_PACKAGE_FILE = `${ANDROID_NATIVE_MODULE_NAME}Package.kt`;
const ANDROID_CRASH_CONTEXT_PREFERENCES_NAME = 'app-native-crash-context';
const ANDROID_CRASH_CONTEXT_PREFERENCES_KEY = 'current-context';
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
          ReportField.STACK_TRACE,
          ReportField.STACK_TRACE_HASH,
          ReportField.USER_APP_START_DATE,
          ReportField.USER_CRASH_DATE,
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
  private const val stackTraceCharacterLimit = 12000
  private const val crashContextPreferencesName = "${ANDROID_CRASH_CONTEXT_PREFERENCES_NAME}"
  private const val crashContextPreferencesKey = "${ANDROID_CRASH_CONTEXT_PREFERENCES_KEY}"

  private fun readCrashContext(context: Context): JSONObject? {
    val serializedContext = context
      .getSharedPreferences(crashContextPreferencesName, Context.MODE_PRIVATE)
      .getString(crashContextPreferencesKey, null)
      ?: return null

    return try {
      JSONObject(serializedContext)
    } catch (_: JSONException) {
      null
    }
  }

  fun append(context: Context, crashReportData: CrashReportData) {
    try {
      val directory = File(context.filesDir, directoryPath)
      if (!directory.exists() && !directory.mkdirs()) {
        throw IOException("Cannot create native crash directory: " + directory.absolutePath)
      }

      val stack = crashReportData.getString(ReportField.STACK_TRACE).orEmpty().take(stackTraceCharacterLimit)
      val report = JSONObject()
      report.put("reportId", crashReportData.getString(ReportField.REPORT_ID))
      report.put("occurredAt", crashReportData.getString(ReportField.USER_CRASH_DATE))
      report.put("platform", "android")
      report.put("source", "android_acra")
      val exceptionLine = stack.lineSequence().firstOrNull().orEmpty()
      val errorName = exceptionLine.substringBefore(':').trim().ifEmpty { "AndroidCrash" }
      report.put("errorName", errorName)
      report.put("message", exceptionLine.take(2048))
      report.put("stack", stack)
      report.put("appVersion", crashReportData.getString(ReportField.APP_VERSION_NAME))
      report.put("nativeBuildVersion", crashReportData.getString(ReportField.APP_VERSION_CODE))
      report.put("systemVersion", crashReportData.getString(ReportField.ANDROID_VERSION))
      report.put("deviceModel", crashReportData.getString(ReportField.PHONE_MODEL))
      val diagnostic = JSONObject()
      diagnostic.put("stackTraceHash", crashReportData.getString(ReportField.STACK_TRACE_HASH))
      diagnostic.put("androidBuild", crashReportData.getString(ReportField.BUILD))
      diagnostic.put("appStartedAt", crashReportData.getString(ReportField.USER_APP_START_DATE))
      diagnostic.put("totalMemoryBytes", crashReportData.getString(ReportField.TOTAL_MEM_SIZE))
      diagnostic.put("availableMemoryBytes", crashReportData.getString(ReportField.AVAILABLE_MEM_SIZE))
      report.put("diagnostic", diagnostic)
      readCrashContext(context)?.let { report.put("context", it) }
      File(directory, pendingFileName).appendText(report.toString() + "\\n")
    } catch (error: Throwable) {
      throw ReportSenderException("Cannot persist native crash report", error)
    }
  }
}
`;

const ANDROID_NATIVE_MODULE_SOURCE = `package __PACKAGE_NAME__

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import org.json.JSONObject
import java.util.Date

class AppNativeCrashReportsModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val crashContextPreferencesName = "${ANDROID_CRASH_CONTEXT_PREFERENCES_NAME}"
  private val crashContextPreferencesKey = "${ANDROID_CRASH_CONTEXT_PREFERENCES_KEY}"

  override fun getName(): String = "AppNativeCrashReports"

  @ReactMethod
  fun setCrashContext(crashContext: ReadableMap, promise: Promise) {
    try {
      val serializedContext = JSONObject(crashContext.toHashMap()).toString()
      reactApplicationContext
        .getSharedPreferences(crashContextPreferencesName, Context.MODE_PRIVATE)
        .edit()
        .putString(crashContextPreferencesKey, serializedContext)
        .apply()
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("native_crash_context_invalid", "Cannot serialize crash context", error)
    }
  }

  @ReactMethod
  fun flushPendingNativeCrashReports(promise: Promise) {
    promise.resolve(null)
  }

  @ReactMethod
  fun clearPendingNativeCrashReports(promise: Promise) {
    promise.resolve(null)
  }

  @ReactMethod
  fun triggerNativeFatalCrash() {
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
        'import org.json.JSONException',
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

module.exports = {
    ANDROID_ACRA_SOURCE,
    ANDROID_NATIVE_MODULE_FILE,
    ANDROID_NATIVE_MODULE_SOURCE,
    ANDROID_NATIVE_PACKAGE_FILE,
    ANDROID_NATIVE_PACKAGE_SOURCE,
    addAndroidAcraDependency,
    applyAndroidPatch,
};
