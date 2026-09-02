#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ANDROID_DIR="$ROOT_DIR/android"
CONFIGURATION=${CONFIGURATION:-Release}
BUILD_TYPE=""

n=$#
i=0
while [ "$i" -lt "$n" ]; do
  arg=$1
  shift
  case "$arg" in
    apk|aab)
      BUILD_TYPE="$arg"
      ;;
    *)
      set -- "$@" "$arg"
      ;;
  esac
  i=$((i + 1))
done
BUILD_TYPE=${BUILD_TYPE:-apk}

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
      npx expo prebuild -p android --no-install "$@"
    else
      npx expo prebuild -p android --no-install --no-clean "$@"
    fi
  )
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

case "$BUILD_TYPE" in
  apk|aab)
    ;;
  *)
    fail "Invalid build type: $BUILD_TYPE. Use 'apk' or 'aab'."
    ;;
esac

case "$CONFIGURATION" in
  Debug|Release)
    ;;
  debug)
    CONFIGURATION=Debug
    ;;
  release)
    CONFIGURATION=Release
    ;;
  *)
    fail "Invalid configuration: $CONFIGURATION. Use 'Debug' or 'Release'."
    ;;
esac

CONFIGURATION_DIR=$(printf '%s' "$CONFIGURATION" | tr '[:upper:]' '[:lower:]')

need_cmd find

if [ ! -d "$ROOT_DIR/node_modules" ] || [ "${FORCE_INSTALL:-0}" = "1" ]; then
  install_js_dependencies
fi

if [ ! -d "$ANDROID_DIR" ]; then
  log "android directory not found. Running Expo prebuild..."
  run_expo_prebuild "$@"
elif [ "${SYNC_EXPO_CONFIG:-1}" = "1" ]; then
  log "Syncing Expo Android config into native project..."
  run_expo_prebuild "$@"
fi

if [ ! -f "$ANDROID_DIR/gradlew" ]; then
  fail "gradlew not found under android/. Check Expo prebuild output first."
fi

APP_DISPLAY_NAME=$(resolve_expo_app_name || true)
if [ -z "$APP_DISPLAY_NAME" ]; then
  APP_DISPLAY_NAME="app"
fi

OUTPUT_DIR="$ANDROID_DIR/app/build/outputs"
mkdir -p "$OUTPUT_DIR"

if [ "$BUILD_TYPE" = "apk" ]; then
  log "Building APK ($CONFIGURATION)..."
  (
    cd "$ANDROID_DIR"
    ./gradlew "assemble$CONFIGURATION"
  )

  APK_DIR="$OUTPUT_DIR/apk/$CONFIGURATION_DIR"
  if [ ! -d "$APK_DIR" ]; then
    fail "APK output directory not found: $APK_DIR"
  fi

  APK_PATH=$(find "$APK_DIR" -maxdepth 1 -name '*.apk' | sort | head -n 1)

  if [ -z "$APK_PATH" ]; then
    fail "No .apk artifact found under $APK_DIR."
  fi

  OUTPUT_NAME=${OUTPUT_NAME:-$(printf '%s-%s-%s.apk' "$APP_DISPLAY_NAME" "$CONFIGURATION_DIR" "$(date +%Y%m%d%H%M%S)" | tr ' ' '-')}
  FINAL_PATH="$OUTPUT_DIR/$OUTPUT_NAME"
  cp "$APK_PATH" "$FINAL_PATH"
  log "APK created: $FINAL_PATH"

else
  log "Building AAB ($CONFIGURATION)..."
  (
    cd "$ANDROID_DIR"
    ./gradlew "bundle$CONFIGURATION"
  )

  AAB_DIR="$OUTPUT_DIR/bundle/$CONFIGURATION_DIR"
  if [ ! -d "$AAB_DIR" ]; then
    fail "AAB output directory not found: $AAB_DIR"
  fi

  AAB_PATH=$(find "$AAB_DIR" -maxdepth 1 -name '*.aab' | sort | head -n 1)

  if [ -z "$AAB_PATH" ]; then
    fail "No .aab artifact found under $AAB_DIR."
  fi

  OUTPUT_NAME=${OUTPUT_NAME:-$(printf '%s-%s-%s.aab' "$APP_DISPLAY_NAME" "$CONFIGURATION_DIR" "$(date +%Y%m%d%H%M%S)" | tr ' ' '-')}
  FINAL_PATH="$OUTPUT_DIR/$OUTPUT_NAME"
  cp "$AAB_PATH" "$FINAL_PATH"
  log "AAB created: $FINAL_PATH"
fi
