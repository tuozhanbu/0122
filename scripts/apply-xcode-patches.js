'use strict';

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIN_XCODE = '26.0';
const PATCH_UNTIL_XCODE = '26.4';

const compareVersions = (left, right) => {
    const leftParts = String(left).split('.').map((part) => parseInt(part, 10) || 0);
    const rightParts = String(right).split('.').map((part) => parseInt(part, 10) || 0);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
        const leftValue = leftParts[index] || 0;
        const rightValue = rightParts[index] || 0;
        if (leftValue > rightValue) {
            return 1;
        }
        if (leftValue < rightValue) {
            return -1;
        }
    }

    return 0;
};

const readCommand = (command, args) => {
    try {
        return execFileSync(command, args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch (error) {
        return null;
    }
};

const readXcodeVersion = () => {
    const output = readCommand('xcodebuild', ['-version']);
    if (!output) {
        return null;
    }

    const match = output.match(/^Xcode\s+(\d+(?:\.\d+)*)/m);
    return match ? match[1] : null;
};

const readMacOSVersion = () => readCommand('sw_vers', ['-productVersion']);

const shouldApplyPatches = () => {
    const xcodeVersion = readXcodeVersion();
    if (xcodeVersion) {
        const apply =
            compareVersions(xcodeVersion, MIN_XCODE) >= 0 &&
            compareVersions(xcodeVersion, PATCH_UNTIL_XCODE) < 0;
        return {
            apply,
            reason: `Xcode ${xcodeVersion}`,
        };
    }

    const macosVersion = readMacOSVersion();
    if (macosVersion && macosVersion.startsWith('15.')) {
        return {
            apply: true,
            reason: `macOS ${macosVersion}, no xcodebuild`,
        };
    }

    return {
        apply: false,
        reason: macosVersion ? `macOS ${macosVersion}, no xcodebuild` : 'no Xcode or macOS version',
    };
};

const decision = shouldApplyPatches();
if (!decision.apply) {
    console.log(`[apply-xcode-patches] skip (${decision.reason}); apply only for Xcode ${MIN_XCODE}–<${PATCH_UNTIL_XCODE} or macOS 15 without xcodebuild`);
    process.exit(0);
}

console.log(`[apply-xcode-patches] apply (${decision.reason})`);

const patchPackage = path.join(ROOT, 'node_modules', 'patch-package', 'index.js');
const result = spawnSync(process.execPath, [patchPackage, '--error-on-fail'], {
    cwd: ROOT,
    stdio: 'inherit',
});

process.exit(result.status === null ? 1 : result.status);
