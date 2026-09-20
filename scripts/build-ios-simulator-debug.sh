#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
IOS_DIR="$ROOT_DIR/ios"
CONFIGURATION=Debug
DESTINATION=${DESTINATION:-generic/platform=iOS Simulator}
RCT_USE_RN_DEP=${RCT_USE_RN_DEP:-0}
RCT_USE_PREBUILT_RNCORE=${RCT_USE_PREBUILT_RNCORE:-0}

export RCT_USE_RN_DEP
export RCT_USE_PREBUILT_RNCORE

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required command: $1"
  fi
}

prefer_system_git() {
  if [ -x /usr/bin/git ]; then
    PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
    export PATH
    GIT_EXEC_PATH=$(/usr/bin/git --exec-path)
    export GIT_EXEC_PATH
  fi
}

install_js_dependencies() {
  if [ -f "$ROOT_DIR/package-lock.json" ]; then
    need_cmd npm
    log "Installing JS dependencies with npm ci..."
    (
      cd "$ROOT_DIR"
      npm ci
    )
    return
  fi

  if [ -f "$ROOT_DIR/yarn.lock" ]; then
    need_cmd yarn
    log "Installing JS dependencies with yarn..."
    (
      cd "$ROOT_DIR"
      yarn install
    )
    return
  fi

  fail "No supported lockfile found. Expected package-lock.json or yarn.lock."
}

run_expo_prebuild() {
  need_cmd npx

  (
    cd "$ROOT_DIR"

    n=$#
    i=0
    user_set_clean=0
    while [ "$i" -lt "$n" ]; do
      arg=$1
      shift
      case "$arg" in
        -c|--clear)
          arg=--clean
          ;;
      esac
      case "$arg" in
        --clean|--no-clean)
          user_set_clean=1
          ;;
      esac
      set -- "$@" "$arg"
      i=$((i + 1))
    done

    if [ "$user_set_clean" = 1 ]; then
      npx expo prebuild -p ios --no-install "$@"
    else
      npx expo prebuild -p ios --no-install --no-clean "$@"
    fi
  )
}

resolve_workspace() {
  if [ -n "${WORKSPACE_PATH:-}" ]; then
    printf '%s\n' "$WORKSPACE_PATH"
    return
  fi

  find "$IOS_DIR" -maxdepth 1 -name '*.xcworkspace' | sort | head -n 1
}

resolve_scheme() {
  if [ -n "${SCHEME:-}" ]; then
    printf '%s\n' "$SCHEME"
    return
  fi

  SCHEME_PATH=$(find "$IOS_DIR" -path '*/xcshareddata/xcschemes/*.xcscheme' | sort | head -n 1)

  if [ -z "$SCHEME_PATH" ]; then
    fail "No shared Xcode scheme found under ios/. Set SCHEME manually and retry."
  fi

  basename "$SCHEME_PATH" .xcscheme
}

resolve_expo_app_name() {
  if ! command -v npx >/dev/null 2>&1; then
    return
  fi

  if ! command -v node >/dev/null 2>&1; then
    return
  fi

  (
    cd "$ROOT_DIR"
    npx expo config --json 2>/dev/null | node -e 'const fs = require("fs");
try {
  const config = JSON.parse(fs.readFileSync(0, "utf8"));
  const name = typeof config.name === "string" ? config.name.trim() : "";
  if (name) {
    process.stdout.write(name);
  }
} catch {}'
  )
}

need_cmd find
prefer_system_git
need_cmd git
need_cmd xcodebuild
need_cmd zip
need_cmd pod

if [ ! -d "$ROOT_DIR/node_modules" ] || [ "${FORCE_INSTALL:-0}" = "1" ]; then
  install_js_dependencies
fi

if [ ! -d "$IOS_DIR" ]; then
  log "ios directory not found. Running Expo prebuild..."
  run_expo_prebuild "$@"
elif [ "${SYNC_EXPO_CONFIG:-1}" = "1" ]; then
  log "Syncing Expo iOS config into native project..."
  run_expo_prebuild "$@"
fi

if [ ! -f "$IOS_DIR/Podfile" ]; then
  fail "Podfile not found under ios/. Check Expo prebuild output first."
fi

SCHEME_NAME=$(resolve_scheme)
BUILD_DIR="$IOS_DIR/build"
DERIVED_DATA_DIR="$BUILD_DIR/derived-data-simulator-debug"
PRODUCTS_DIR="$DERIVED_DATA_DIR/Build/Products/${CONFIGURATION}-iphonesimulator"
OUTPUT_DIR="$BUILD_DIR/output"
APP_DISPLAY_NAME=$(resolve_expo_app_name || true)
DEFAULT_OUTPUT_BASENAME=$SCHEME_NAME

if [ -n "$APP_DISPLAY_NAME" ]; then
  DEFAULT_OUTPUT_BASENAME=$APP_DISPLAY_NAME
fi

OUTPUT_NAME=${OUTPUT_NAME:-$(printf '%s-simulator-debug-%s' "$DEFAULT_OUTPUT_BASENAME" "$(date +%Y%m%d%H%M%S)" | tr ' ' '-')}
ZIP_PATH="$OUTPUT_DIR/$OUTPUT_NAME.zip"

log "React Native pods mode: RCT_USE_RN_DEP=$RCT_USE_RN_DEP, RCT_USE_PREBUILT_RNCORE=$RCT_USE_PREBUILT_RNCORE"
log "Using git: $(command -v git)"
log "Installing CocoaPods dependencies..."
(
  cd "$IOS_DIR"
  pod install
)

WORKSPACE=$(resolve_workspace)

if [ -z "$WORKSPACE" ]; then
  fail "No .xcworkspace found under ios/. pod install did not create a workspace."
fi

log "Building $SCHEME_NAME ($CONFIGURATION) for $DESTINATION without code signing..."
rm -rf "$DERIVED_DATA_DIR"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME_NAME" \
  -configuration "$CONFIGURATION" \
  -destination "$DESTINATION" \
  -sdk iphonesimulator \
  -derivedDataPath "$DERIVED_DATA_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  build

APP_PATH=$(find "$PRODUCTS_DIR" -maxdepth 1 -type d -name '*.app' | sort | head -n 1)

if [ -z "$APP_PATH" ]; then
  fail "No simulator .app artifact found under $PRODUCTS_DIR."
fi

mkdir -p "$OUTPUT_DIR"
rm -f "$ZIP_PATH"
(
  cd "$(dirname "$APP_PATH")"
  zip -qry "$ZIP_PATH" "$(basename "$APP_PATH")"
)

log "Simulator app created: $APP_PATH"
log "Simulator app archive created: $ZIP_PATH"
