const fs = require('fs');
const path = require('path');

const DEFAULT_ASSET_DIRECTORY = 'assets';
const DEFAULT_LARGE_FILE_THRESHOLD_BYTES = 100 * 1024;
const IGNORED_RESOURCE_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db']);

const parseBytes = (rawValue) => {
    if (rawValue === undefined) {
        return DEFAULT_LARGE_FILE_THRESHOLD_BYTES;
    }

    if (!/^\d+$/.test(rawValue)) {
        throw new Error(`Invalid byte threshold: ${rawValue}`);
    }

    return Number(rawValue);
};

const formatBytes = (byteCount) => {
    if (byteCount < 1024) {
        return `${byteCount} B`;
    }

    const units = ['KiB', 'MiB', 'GiB'];
    let amount = byteCount;
    let unitIndex = -1;

    do {
        amount /= 1024;
        unitIndex += 1;
    } while (amount >= 1024 && unitIndex < units.length - 1);

    return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

const formatPercent = (part, whole) => whole === 0 ? '0.0%' : `${((part / whole) * 100).toFixed(1)}%`;

const getDisplayWidth = (text) => [...String(text)].reduce((width, character) => {
    const codePoint = character.codePointAt(0);
    const isFullWidth = codePoint >= 0x1100 && (
        codePoint <= 0x115F
        || codePoint === 0x2329
        || codePoint === 0x232A
        || (codePoint >= 0x2E80 && codePoint <= 0xA4CF && codePoint !== 0x303F)
        || (codePoint >= 0xAC00 && codePoint <= 0xD7A3)
        || (codePoint >= 0xF900 && codePoint <= 0xFAFF)
        || (codePoint >= 0xFE10 && codePoint <= 0xFE19)
        || (codePoint >= 0xFE30 && codePoint <= 0xFE6F)
        || (codePoint >= 0xFF00 && codePoint <= 0xFF60)
        || (codePoint >= 0xFFE0 && codePoint <= 0xFFE6)
    );

    return width + (isFullWidth ? 2 : 1);
}, 0);

const padEndByDisplayWidth = (text, width) => {
    const value = String(text);
    return `${value}${' '.repeat(Math.max(width - getDisplayWidth(value), 0))}`;
};

const getDirectoryFiles = (directoryPath) => {
    const childEntries = fs.readdirSync(directoryPath, { withFileTypes: true });

    return childEntries.flatMap((entry) => {
        const childPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            return getDirectoryFiles(childPath);
        }

        if (entry.isFile() && !IGNORED_RESOURCE_FILE_NAMES.has(entry.name)) {
            return [{ path: childPath, size: fs.statSync(childPath).size }];
        }

        return [];
    });
};

const getTopLevelDirectoryName = (assetDirectory, filePath) => {
    const relativePath = path.relative(assetDirectory, filePath);
    const [topLevelDirectoryName] = relativePath.split(path.sep);
    return topLevelDirectoryName === relativePath ? '(根目录)' : topLevelDirectoryName;
};

const createDirectorySummary = (assetDirectory, files) => {
    const summaries = new Map();

    files.forEach((file) => {
        const directoryName = getTopLevelDirectoryName(assetDirectory, file.path);
        const summary = summaries.get(directoryName) ?? { fileCount: 0, size: 0 };
        summary.fileCount += 1;
        summary.size += file.size;
        summaries.set(directoryName, summary);
    });

    return [...summaries.entries()]
        .map(([directoryName, summary]) => ({ directoryName, ...summary }))
        .sort((left, right) => right.size - left.size);
};

const printTable = (headers, rows) => {
    const widths = headers.map((header, columnIndex) => Math.max(
        getDisplayWidth(header),
        ...rows.map((row) => getDisplayWidth(row[columnIndex])),
    ));
    const formatRow = (row) => row.map((cell, columnIndex) => padEndByDisplayWidth(cell, widths[columnIndex])).join('  ');

    console.log(formatRow(headers));
    console.log(widths.map((width) => '-'.repeat(width)).join('  '));
    rows.forEach((row) => console.log(formatRow(row)));
};

const printUsage = () => {
    console.log('用法：npm run report:asset-size -- [资源目录] [大文件阈值（字节）]');
    console.log(`默认资源目录：${DEFAULT_ASSET_DIRECTORY}`);
    console.log(`默认大文件阈值：${formatBytes(DEFAULT_LARGE_FILE_THRESHOLD_BYTES)}`);
};

const main = () => {
    const [assetDirectoryArgument, largeFileThresholdArgument] = process.argv.slice(2);
    if (assetDirectoryArgument === '--help' || assetDirectoryArgument === '-h') {
        printUsage();
        return;
    }

    const assetDirectory = path.resolve(process.cwd(), assetDirectoryArgument ?? DEFAULT_ASSET_DIRECTORY);
    if (!fs.existsSync(assetDirectory) || !fs.statSync(assetDirectory).isDirectory()) {
        throw new Error(`Asset directory does not exist: ${assetDirectory}`);
    }

    const largeFileThreshold = parseBytes(largeFileThresholdArgument);
    const files = getDirectoryFiles(assetDirectory).sort((left, right) => right.size - left.size);
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const directorySummary = createDirectorySummary(assetDirectory, files);
    const largeFiles = files.filter((file) => file.size >= largeFileThreshold);

    console.log('\n资源大小报告');
    console.log(`目录：${path.relative(process.cwd(), assetDirectory) || '.'}`);
    console.log(`文件：${files.length} 个`);
    console.log(`总大小：${formatBytes(totalSize)}（${totalSize.toLocaleString('en-US')} B）`);
    console.log(`大文件阈值：${formatBytes(largeFileThreshold)}`);

    console.log('\n按一级目录汇总');
    printTable(
        ['目录', '文件数', '大小', '占比'],
        directorySummary.map((summary) => [
            summary.directoryName,
            summary.fileCount,
            formatBytes(summary.size),
            formatPercent(summary.size, totalSize),
        ]),
    );

    console.log(`\n最大 ${Math.min(10, files.length)} 个文件`);
    printTable(
        ['文件', '大小', '占比'],
        files.slice(0, 10).map((file) => [
            path.relative(assetDirectory, file.path),
            formatBytes(file.size),
            formatPercent(file.size, totalSize),
        ]),
    );

    console.log(`\n达到 ${formatBytes(largeFileThreshold)} 的文件（${largeFiles.length} 个）`);
    if (largeFiles.length === 0) {
        console.log('无');
        return;
    }

    printTable(
        ['文件', '大小'],
        largeFiles.map((file) => [
            path.relative(assetDirectory, file.path),
            formatBytes(file.size),
        ]),
    );
};

try {
    main();
} catch (error) {
    console.error(`资源大小报告生成失败：${error.message}`);
    process.exitCode = 1;
}
