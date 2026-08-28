const IOS_NATIVE_MODULE_FILE = 'AppNativeCrashReports.mm';
const IOS_LEGACY_NATIVE_MODULE_FILE = 'AppNativeCrashReports.m';
const IOS_KSCRASH_IMPORT = 'import KSCrash';
const IOS_KSCRASH_INSTALL = 'NativeCrashReports.installKSCrash()';
const IOS_KSCRASH_SOURCE = `

private enum NativeCrashReports {
  static func installKSCrash() {
    let config = KSCrashConfiguration()
    config.monitors = [.machException, .signal, .cppException, .nsException, .memoryTermination]
    config.enableSwapCxaThrow = true

    do {
      try KSCrash.shared.install(with: config)
    } catch {
      NSLog("[NativeCrashReports] KSCrash installation failed: %@", error.localizedDescription)
    }
  }
}
`;

const IOS_NATIVE_MODULE_SOURCE = `#import <Foundation/Foundation.h>
#import <stdlib.h>
#import <sys/sysctl.h>
#include <stdexcept>
#import <UIKit/UIKit.h>
#import <React/RCTBridgeModule.h>
#import <KSCrash/KSCrash.h>
#import <KSCrash/KSCrash+UserInfo.h>
#import <KSCrash/KSCrashReport.h>
#import <KSCrash/KSCrashReportFilter.h>
#import <KSCrash/KSCrashReportStore.h>

static NSString *const AppNativeCrashReportDirectoryPath = @"app-logs/native-crashes";
static NSString *const AppNativeCrashReportPendingFileName = @"pending.jsonl";
static NSString *const AppNativeCrashRouteUserInfoKey = @"app_route";
static NSString *const AppNativeCrashBreadcrumbUserInfoKeyPrefix = @"app_breadcrumb_";
static NSString *const AppNativeCrashLegacyContextUserInfoKey = @"app_context_json";
static NSString *const AppNativeCrashEnvironmentUserInfoKey = @"capture_environment_json";
static NSUInteger const AppNativeCrashStackFrameLimit = 40;
static NSUInteger const AppNativeCrashStackCharacterLimit = 12000;
static NSUInteger const AppNativeCrashReasonCharacterLimit = 2048;
static NSUInteger const AppNativeCrashBinaryImageLimit = 16;
static NSUInteger const AppNativeCrashBreadcrumbLimit = 12;
static NSUInteger const AppNativeCrashUserInfoStringByteLimit = 1024;

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

static NSDictionary *AppNativeCrashJsonDictionary(id value) {
  if ([value isKindOfClass:[NSDictionary class]]) {
    return value;
  }
  if (![value isKindOfClass:[NSString class]]) {
    return @{};
  }

  NSData *jsonData = [(NSString *)value dataUsingEncoding:NSUTF8StringEncoding];
  if (jsonData == nil) {
    return @{};
  }

  id jsonValue = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:nil];
  return [jsonValue isKindOfClass:[NSDictionary class]] ? jsonValue : @{};
}

static NSString *AppNativeCrashJsonString(NSDictionary *dictionary) {
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:dictionary options:0 error:nil];
  return jsonData == nil ? @"" : [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
}

static NSString *AppNativeCrashBreadcrumbUserInfoKey(NSUInteger index) {
  return [NSString stringWithFormat:@"%@%02lu", AppNativeCrashBreadcrumbUserInfoKeyPrefix, (unsigned long)index];
}

static NSString *AppNativeCrashBoundedBreadcrumbJson(NSDictionary *breadcrumb) {
  NSString *jsonString = AppNativeCrashJsonString(breadcrumb);
  if ([jsonString lengthOfBytesUsingEncoding:NSUTF8StringEncoding] <= AppNativeCrashUserInfoStringByteLimit) {
    return jsonString;
  }
  return AppNativeCrashJsonString(@{ @"truncated": @YES });
}

static NSArray<NSString *> *AppNativeCrashSerializedBreadcrumbs(NSArray *breadcrumbs) {
  NSMutableArray<NSString *> *serializedBreadcrumbs = [NSMutableArray array];
  NSUInteger breadcrumbCount = MIN(breadcrumbs.count, AppNativeCrashBreadcrumbLimit);
  for (NSUInteger index = 0; index < breadcrumbCount; index += 1) {
    id breadcrumb = breadcrumbs[index];
    if (![breadcrumb isKindOfClass:[NSDictionary class]]) {
      return nil;
    }
    [serializedBreadcrumbs addObject:AppNativeCrashBoundedBreadcrumbJson(breadcrumb)];
  }
  return serializedBreadcrumbs;
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

static NSString *AppNativeCrashTruncatedString(NSString *value, NSUInteger limit) {
  if (value.length <= limit) {
    return value;
  }
  return [[value substringToIndex:limit] stringByAppendingString:@"...[truncated]"];
}

static void AppNativeCrashSetValueIfPresent(NSMutableDictionary *dictionary, NSString *key, id value) {
  if ([value isKindOfClass:[NSString class]] || [value isKindOfClass:[NSNumber class]]) {
    dictionary[key] = value;
  }
}

static void AppNativeCrashSetStringIfPresent(NSMutableDictionary *dictionary, NSString *key, NSString *value) {
  if (value.length > 0) {
    dictionary[key] = value;
  }
}

static NSString *AppNativeCrashReadSysctlString(const char *key) {
  size_t valueSize = 0;
  if (sysctlbyname(key, NULL, &valueSize, NULL, 0) != 0 || valueSize == 0) {
    return @"";
  }

  char *value = static_cast<char *>(malloc(valueSize));
  if (value == NULL) {
    return @"";
  }

  NSString *stringValue = @"";
  if (sysctlbyname(key, value, &valueSize, NULL, 0) == 0) {
    stringValue = [NSString stringWithUTF8String:value] ?: @"";
  }
  free(value);
  return stringValue;
}

static NSDictionary *AppNativeCrashCaptureEnvironment() {
  UIDevice *device = [UIDevice currentDevice];
  NSString *appVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  NSString *buildVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];

  NSMutableDictionary *environment = [NSMutableDictionary dictionary];
  AppNativeCrashSetStringIfPresent(environment, @"appVersion", appVersion);
  AppNativeCrashSetStringIfPresent(environment, @"nativeBuildVersion", buildVersion);
  AppNativeCrashSetStringIfPresent(environment, @"systemVersion", [NSString stringWithFormat:@"%@ %@", device.systemName, device.systemVersion]);
  AppNativeCrashSetStringIfPresent(environment, @"deviceModel", AppNativeCrashReadSysctlString("hw.machine"));
  AppNativeCrashSetStringIfPresent(environment, @"osBuild", AppNativeCrashReadSysctlString("kern.osversion"));
  return environment;
}

static NSDictionary *AppNativeCrashCapturedEnvironmentFromReport(NSDictionary *rawReport) {
  return AppNativeCrashJsonDictionary(AppNativeCrashNestedValue(rawReport, @[ @"user", AppNativeCrashEnvironmentUserInfoKey ]));
}

static NSDictionary *AppNativeCrashContextFromReport(NSDictionary *rawReport) {
  NSMutableDictionary *context = [NSMutableDictionary dictionary];
  id routeValue = AppNativeCrashNestedValue(rawReport, @[ @"user", AppNativeCrashRouteUserInfoKey ]);
  NSString *route = [routeValue isKindOfClass:[NSString class]] ? routeValue : @"";
  if (route.length > 0) {
    context[@"route"] = route;
  }

  NSMutableArray<NSDictionary *> *breadcrumbs = [NSMutableArray array];
  for (NSUInteger index = 0; index < AppNativeCrashBreadcrumbLimit; index += 1) {
    NSDictionary *breadcrumb = AppNativeCrashJsonDictionary(AppNativeCrashNestedValue(rawReport, @[ @"user", AppNativeCrashBreadcrumbUserInfoKey(index) ]));
    if (breadcrumb.count > 0) {
      [breadcrumbs addObject:breadcrumb];
    }
  }
  if (breadcrumbs.count > 0) {
    context[@"breadcrumbs"] = breadcrumbs;
  }
  if (context.count > 0) {
    return context;
  }

  return AppNativeCrashJsonDictionary(AppNativeCrashNestedValue(rawReport, @[ @"user", AppNativeCrashLegacyContextUserInfoKey ]));
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

  return @{};
}

static NSString *AppNativeCrashStackString(NSDictionary *thread) {
  NSArray *frames = AppNativeCrashNestedValue(thread, @[ @"backtrace", @"contents" ]);
  if (![frames isKindOfClass:[NSArray class]]) {
    return @"";
  }

  NSMutableArray<NSString *> *lines = [NSMutableArray array];
  for (id frame in [frames subarrayWithRange:NSMakeRange(0, MIN(frames.count, AppNativeCrashStackFrameLimit))]) {
    if (![frame isKindOfClass:[NSDictionary class]]) {
      continue;
    }

    NSString *objectName = AppNativeCrashStringAtPath(frame, @[ @"object_name" ]).lastPathComponent;
    NSString *symbolName = AppNativeCrashStringAtPath(frame, @[ @"symbol_name" ]);
    NSString *instructionAddress = AppNativeCrashStringAtPath(frame, @[ @"instruction_addr" ]);
    NSString *symbolAddress = AppNativeCrashStringAtPath(frame, @[ @"symbol_addr" ]);
    NSString *objectAddress = AppNativeCrashStringAtPath(frame, @[ @"object_addr" ]);
    NSString *line = [NSString stringWithFormat:@"%@ %@ instruction=%@ symbol=%@ image=%@", objectName, symbolName, instructionAddress, symbolAddress, objectAddress];
    [lines addObject:[line stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]]];
  }
  return AppNativeCrashTruncatedString([lines componentsJoinedByString:@"\\n"], AppNativeCrashStackCharacterLimit);
}

static NSString *AppNativeCrashFirstStringAtPaths(NSDictionary *dictionary, NSArray<NSArray<NSString *> *> *paths) {
  for (NSArray<NSString *> *path in paths) {
    NSString *value = AppNativeCrashStringAtPath(dictionary, path);
    if (value.length > 0) {
      return value;
    }
  }
  return @"";
}

static NSString *AppNativeCrashThreadLabel(NSDictionary *thread) {
  NSString *name = AppNativeCrashStringAtPath(thread, @[ @"name" ]);
  if (name.length > 0) {
    return name;
  }

  NSString *queueName = AppNativeCrashStringAtPath(thread, @[ @"dispatch_queue" ]);
  if (queueName.length > 0) {
    return queueName;
  }

  return AppNativeCrashStringAtPath(thread, @[ @"index" ]);
}

static NSArray<NSDictionary *> *AppNativeCrashReferencedImages(NSDictionary *rawReport, NSDictionary *thread) {
  NSArray *images = AppNativeCrashNestedValue(rawReport, @[ @"binary_images" ]);
  NSArray *frames = AppNativeCrashNestedValue(thread, @[ @"backtrace", @"contents" ]);
  if (![images isKindOfClass:[NSArray class]] || ![frames isKindOfClass:[NSArray class]]) {
    return @[];
  }

  NSMutableSet<NSString *> *frameImageNames = [NSMutableSet set];
  for (id frame in frames) {
    if (![frame isKindOfClass:[NSDictionary class]]) {
      continue;
    }
    NSString *objectName = AppNativeCrashStringAtPath(frame, @[ @"object_name" ]);
    if (objectName.length > 0) {
      [frameImageNames addObject:objectName.lastPathComponent];
    }
  }

  NSMutableArray<NSDictionary *> *referencedImages = [NSMutableArray array];
  for (id image in images) {
    if (![image isKindOfClass:[NSDictionary class]]) {
      continue;
    }
    NSString *imageName = AppNativeCrashStringAtPath(image, @[ @"name" ]);
    if (imageName.length == 0 || ![frameImageNames containsObject:imageName.lastPathComponent]) {
      continue;
    }
    [referencedImages addObject:@{
      @"name": imageName.lastPathComponent,
      @"uuid": AppNativeCrashStringAtPath(image, @[ @"uuid" ]),
      @"imageAddr": AppNativeCrashStringAtPath(image, @[ @"image_addr" ]),
      @"imageVmAddr": AppNativeCrashStringAtPath(image, @[ @"image_vmaddr" ]),
    }];
    if (referencedImages.count >= AppNativeCrashBinaryImageLimit) {
      break;
    }
  }
  return referencedImages;
}

static NSString *AppNativeCrashApplicationBinaryUuid(NSDictionary *rawReport, NSArray<NSDictionary *> *binaryImages) {
  NSString *reportUuid = AppNativeCrashStringAtPath(rawReport, @[ @"system", @"app_uuid" ]);
  if (reportUuid.length > 0) {
    return reportUuid;
  }

  NSString *executableName = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleExecutable"];
  for (NSDictionary *binaryImage in binaryImages) {
    if ([AppNativeCrashStringAtPath(binaryImage, @[ @"name" ]) isEqualToString:executableName]) {
      return AppNativeCrashStringAtPath(binaryImage, @[ @"uuid" ]);
    }
  }
  return @"";
}

static NSDictionary *AppNativeCrashErrorDiagnostic(NSDictionary *error) {
  NSMutableDictionary *diagnostic = [NSMutableDictionary dictionary];
  AppNativeCrashSetStringIfPresent(diagnostic, @"type", AppNativeCrashStringAtPath(error, @[ @"type" ]));

  NSMutableDictionary *signal = [NSMutableDictionary dictionary];
  AppNativeCrashSetStringIfPresent(signal, @"name", AppNativeCrashStringAtPath(error, @[ @"signal", @"name" ]));
  AppNativeCrashSetValueIfPresent(signal, @"code", AppNativeCrashNestedValue(error, @[ @"signal", @"code" ]));
  if (signal.count > 0) {
    diagnostic[@"signal"] = signal;
  }

  NSMutableDictionary *mach = [NSMutableDictionary dictionary];
  AppNativeCrashSetStringIfPresent(mach, @"name", AppNativeCrashStringAtPath(error, @[ @"mach", @"exception_name" ]));
  AppNativeCrashSetValueIfPresent(mach, @"code", AppNativeCrashNestedValue(error, @[ @"mach", @"code" ]));
  AppNativeCrashSetValueIfPresent(mach, @"subcode", AppNativeCrashNestedValue(error, @[ @"mach", @"subcode" ]));
  if (mach.count > 0) {
    diagnostic[@"mach"] = mach;
  }

  NSMutableDictionary *exception = [NSMutableDictionary dictionary];
  AppNativeCrashSetStringIfPresent(exception, @"name", AppNativeCrashFirstStringAtPaths(error, @[
    @[ @"nsexception", @"name" ],
    @[ @"cpp_exception", @"name" ],
  ]));
  AppNativeCrashSetStringIfPresent(exception, @"reason", AppNativeCrashTruncatedString(AppNativeCrashFirstStringAtPaths(error, @[
    @[ @"nsexception", @"reason" ],
    @[ @"cpp_exception", @"reason" ],
    @[ @"reason" ],
  ]), AppNativeCrashReasonCharacterLimit));
  if (exception.count > 0) {
    diagnostic[@"exception"] = exception;
  }

  return diagnostic;
}

static NSDictionary *AppNativeCrashDiagnostic(NSDictionary *rawReport, NSDictionary *error, NSDictionary *thread) {
  NSDictionary *system = AppNativeCrashNestedValue(rawReport, @[ @"system" ]);
  if (![system isKindOfClass:[NSDictionary class]]) {
    system = @{};
  }
  NSDictionary *capturedEnvironment = AppNativeCrashCapturedEnvironmentFromReport(rawReport);
  NSDictionary *applicationStats = AppNativeCrashNestedValue(system, @[ @"application_stats" ]);
  if (![applicationStats isKindOfClass:[NSDictionary class]]) {
    applicationStats = @{};
  }
  NSDictionary *appMemory = AppNativeCrashNestedValue(system, @[ @"app_memory" ]);
  if (![appMemory isKindOfClass:[NSDictionary class]]) {
    appMemory = @{};
  }

  NSMutableDictionary *crashedThread = [NSMutableDictionary dictionary];
  AppNativeCrashSetStringIfPresent(crashedThread, @"index", AppNativeCrashStringAtPath(thread, @[ @"index" ]));
  AppNativeCrashSetStringIfPresent(crashedThread, @"name", AppNativeCrashThreadLabel(thread));

  NSMutableDictionary *process = [NSMutableDictionary dictionary];
  AppNativeCrashSetValueIfPresent(process, @"launchesSinceLastCrash", AppNativeCrashNestedValue(applicationStats, @[ @"launches_since_last_crash" ]));
  AppNativeCrashSetValueIfPresent(process, @"activeTimeSinceLaunch", AppNativeCrashNestedValue(applicationStats, @[ @"active_time_since_launch" ]));
  AppNativeCrashSetValueIfPresent(process, @"applicationInForeground", AppNativeCrashNestedValue(applicationStats, @[ @"application_in_foreground" ]));

  NSMutableDictionary *memory = [NSMutableDictionary dictionary];
  AppNativeCrashSetValueIfPresent(memory, @"footprint", AppNativeCrashNestedValue(appMemory, @[ @"memory_footprint" ]));
  AppNativeCrashSetValueIfPresent(memory, @"limit", AppNativeCrashNestedValue(appMemory, @[ @"memory_limit" ]));
  AppNativeCrashSetStringIfPresent(memory, @"pressure", AppNativeCrashStringAtPath(appMemory, @[ @"memory_pressure" ]));

  NSArray<NSDictionary *> *binaryImages = AppNativeCrashReferencedImages(rawReport, thread);
  NSMutableDictionary *diagnostic = [NSMutableDictionary dictionary];
  diagnostic[@"error"] = AppNativeCrashErrorDiagnostic(error);
  AppNativeCrashSetStringIfPresent(diagnostic, @"appBinaryUuid", AppNativeCrashApplicationBinaryUuid(rawReport, binaryImages));
  AppNativeCrashSetStringIfPresent(diagnostic, @"osBuild", AppNativeCrashStringAtPath(system, @[ @"os_version" ]));
  if (AppNativeCrashStringAtPath(diagnostic, @[ @"osBuild" ]).length == 0) {
    AppNativeCrashSetStringIfPresent(diagnostic, @"osBuild", AppNativeCrashStringAtPath(capturedEnvironment, @[ @"osBuild" ]));
  }
  if (crashedThread.count > 0) {
    diagnostic[@"crashedThread"] = crashedThread;
  }
  diagnostic[@"binaryImages"] = binaryImages;
  if (process.count > 0) {
    diagnostic[@"process"] = process;
  }
  if (memory.count > 0) {
    diagnostic[@"memory"] = memory;
  }
  return diagnostic;
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
  NSDictionary *capturedEnvironment = AppNativeCrashCapturedEnvironmentFromReport(rawReport);

  NSDictionary *thread = AppNativeCrashCrashedThread(rawReport);
  NSString *errorName = AppNativeCrashFirstStringAtPaths(error, @[
    @[ @"nsexception", @"name" ],
    @[ @"cpp_exception", @"name" ],
    @[ @"mach", @"exception_name" ],
    @[ @"type" ],
  ]);
  if (errorName.length == 0) {
    errorName = @"iOSCrash";
  }

  NSString *message = AppNativeCrashTruncatedString(AppNativeCrashFirstStringAtPaths(error, @[
    @[ @"reason" ],
    @[ @"nsexception", @"reason" ],
    @[ @"cpp_exception", @"reason" ],
    @[ @"signal", @"name" ],
  ]), AppNativeCrashReasonCharacterLimit);

  NSString *appVersion = AppNativeCrashStringAtPath(system, @[ @"CFBundleShortVersionString" ]);
  if (appVersion.length == 0) {
    appVersion = AppNativeCrashStringAtPath(capturedEnvironment, @[ @"appVersion" ]);
  }
  NSString *buildVersion = AppNativeCrashStringAtPath(system, @[ @"CFBundleVersion" ]);
  if (buildVersion.length == 0) {
    buildVersion = AppNativeCrashStringAtPath(capturedEnvironment, @[ @"nativeBuildVersion" ]);
  }
  NSString *systemName = AppNativeCrashStringAtPath(system, @[ @"system_name" ]);
  NSString *systemVersion = AppNativeCrashStringAtPath(system, @[ @"system_version" ]);
  NSString *deviceModel = AppNativeCrashStringAtPath(system, @[ @"machine" ]);
  NSString *reportedSystemVersion = systemName.length > 0 && systemVersion.length > 0
    ? [NSString stringWithFormat:@"%@ %@", systemName, systemVersion]
    : AppNativeCrashStringAtPath(capturedEnvironment, @[ @"systemVersion" ]);
  if (deviceModel.length == 0) {
    deviceModel = AppNativeCrashStringAtPath(capturedEnvironment, @[ @"deviceModel" ]);
  }

  return @{
    @"reportId": AppNativeCrashStringAtPath(rawReport, @[ @"report", @"id" ]).length > 0 ? AppNativeCrashStringAtPath(rawReport, @[ @"report", @"id" ]) : [[NSUUID UUID] UUIDString],
    @"occurredAt": AppNativeCrashStringAtPath(rawReport, @[ @"report", @"timestamp" ]).length > 0 ? AppNativeCrashStringAtPath(rawReport, @[ @"report", @"timestamp" ]) : [[NSDate date] description],
    @"platform": @"ios",
    @"source": @"ios_kscrash",
    @"errorName": AppNativeCrashTruncatedString(errorName, 512),
    @"message": message,
    @"stack": AppNativeCrashStackString(thread),
    @"thread": AppNativeCrashThreadLabel(thread),
    @"appVersion": appVersion,
    @"nativeBuildVersion": buildVersion,
    @"systemVersion": reportedSystemVersion,
    @"deviceModel": deviceModel,
    @"context": AppNativeCrashJsonValue(AppNativeCrashContextFromReport(rawReport)),
    @"diagnostic": AppNativeCrashJsonValue(AppNativeCrashDiagnostic(rawReport, error, thread))
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

RCT_REMAP_METHOD(setCrashContext,
                 setCrashContext:(NSDictionary *)context
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  if (![context isKindOfClass:[NSDictionary class]]) {
    reject(@"native_crash_context_invalid", @"Crash context must be an object", nil);
    return;
  }

  NSDictionary *jsonContext = AppNativeCrashJsonValue(context);
  if (![NSJSONSerialization isValidJSONObject:jsonContext]) {
    reject(@"native_crash_context_invalid", @"Crash context must contain JSON values", nil);
    return;
  }

  NSString *route = AppNativeCrashStringAtPath(jsonContext, @[ @"route" ]);
  NSArray *breadcrumbs = AppNativeCrashNestedValue(jsonContext, @[ @"breadcrumbs" ]);
  if (![breadcrumbs isKindOfClass:[NSArray class]]) {
    reject(@"native_crash_context_invalid", @"Crash breadcrumbs must be an array", nil);
    return;
  }
  NSArray<NSString *> *serializedBreadcrumbs = AppNativeCrashSerializedBreadcrumbs(breadcrumbs);
  if (serializedBreadcrumbs == nil) {
    reject(@"native_crash_context_invalid", @"Crash breadcrumbs must contain objects", nil);
    return;
  }

  NSString *serializedEnvironment = AppNativeCrashJsonString(AppNativeCrashCaptureEnvironment());
  if (serializedEnvironment.length == 0) {
    reject(@"native_crash_context_invalid", @"Crash context could not be serialized", nil);
    return;
  }

  KSCrash *crash = [KSCrash sharedInstance];
  [crash setUserInfoString:route forKey:AppNativeCrashRouteUserInfoKey];
  [crash removeUserInfoValueForKey:AppNativeCrashLegacyContextUserInfoKey];
  for (NSUInteger index = 0; index < AppNativeCrashBreadcrumbLimit; index += 1) {
    NSString *key = AppNativeCrashBreadcrumbUserInfoKey(index);
    if (index >= serializedBreadcrumbs.count) {
      [crash removeUserInfoValueForKey:key];
      continue;
    }
    [crash setUserInfoString:serializedBreadcrumbs[index] forKey:key];
  }
  [crash setUserInfoString:serializedEnvironment forKey:AppNativeCrashEnvironmentUserInfoKey];
  resolve(nil);
}

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

RCT_EXPORT_METHOD(triggerNativeFatalCrash) {
  abort();
}

RCT_EXPORT_METHOD(triggerNativeObjectiveCException) {
  @throw [NSException exceptionWithName:@"AppDebugObjectiveCException"
                                 reason:@"Debug test Objective-C exception"
                               userInfo:nil];
}

RCT_EXPORT_METHOD(triggerNativeCppException) {
  throw std::runtime_error("Debug test C++ exception");
}

@end
`;

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

module.exports = {
    IOS_LEGACY_NATIVE_MODULE_FILE,
    IOS_NATIVE_MODULE_FILE,
    IOS_NATIVE_MODULE_SOURCE,
    addKSCrashPod,
    applyIosPatch,
};
