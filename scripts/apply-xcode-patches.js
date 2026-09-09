'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
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

const readInstalledVersion = (packageName) => {
    const pkgPath = path.join(ROOT, 'node_modules', ...packageName.split('/'), 'package.json');
    try {
        return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
    } catch (error) {
        return null;
    }
};

const parsePatchFileName = (fileName) => {
    const withoutExt = fileName.replace(/\.patch$/, '');
    const lastPlus = withoutExt.lastIndexOf('+');
    if (lastPlus <= 0) {
        return null;
    }
    return {
        packageName: withoutExt.slice(0, lastPlus).replace(/\+/g, '/'),
        version: withoutExt.slice(lastPlus + 1),
    };
};

const assertPatchVersionsMatch = () => {
    const patchesDir = path.join(ROOT, 'patches');
    const files = fs.readdirSync(patchesDir).filter((file) => file.endsWith('.patch'));
    const mismatches = [];

    for (const file of files) {
        const parsed = parsePatchFileName(file);
        if (!parsed) {
            mismatches.push(`${file}: invalid patch file name`);
            continue;
        }
        const installed = readInstalledVersion(parsed.packageName);
        if (installed !== parsed.version) {
            mismatches.push(`${file} targets ${parsed.packageName}@${parsed.version}, installed is ${installed || 'missing'}`);
        }
    }

    if (mismatches.length > 0) {
        console.error('[apply-xcode-patches] patch version mismatch; remake patches for the installed packages:');
        for (const line of mismatches) {
            console.error(`  ${line}`);
        }
        process.exit(1);
    }
};

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
assertPatchVersionsMatch();

const patchPackage = path.join(ROOT, 'node_modules', 'patch-package', 'index.js');
const result = spawnSync(process.execPath, [patchPackage, '--error-on-fail'], {
    cwd: ROOT,
    stdio: 'inherit',
});

process.exit(result.status === null ? 1 : result.status);
