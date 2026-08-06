# OpenUrl 剪贴板缓存升级说明

本文只面向已经发布过旧版 OpenUrl 剪贴板文本缓存的下游项目。`baseApp` 不包含、也不应包含这段迁移代码；不同下游的旧 key、发布版本和升级入口不同，迁移必须由各下游显式拥有。

## 要解决的问题

旧版只会在“普通剪贴板命中且已成功跳转”后保存一个文本值，例如：

```text
OPEN_URL_CLIPBOARD_CONTENT_CACHE -> "旧剪贴板文本"
```

当前策略改为保存完整快照：

```js
{
    capturedAtMs: 1786000000000,
    hasReadClipboard: true,
    clipboardContent: '旧剪贴板文本',
}
```

新快照的 key 为 `APP_STORAGE_KEYS.openUrl.clipboardSnapshot`。它需要明确区分“已读取但内容为空”和“没有读取”。旧文本缓存只保存过非空文本，因此旧 key 存在时可以迁移为 `hasReadClipboard: true`。

迁移的唯一目的，是让已经 `openUrl.jumped=1` 的旧用户升级后，`h5Verify=1` 请求仍可复用此前成功跳转使用的剪贴板文本。未跳转用户会在新启动流程中重新读取当前剪贴板，不依赖旧文本缓存。

## 适用范围

仅当下游同时满足以下条件时才需要迁移：

1. 线上历史版本写入过“成功跳转后的纯文本剪贴板缓存”。
2. 升级后仍要让已跳转用户在 `h5Verify=1` 场景复用这份文本。
3. 下游已确定旧 key 的准确字符串和写入语义。

以下情况不需要迁移：

- 从未发布过旧文本缓存的下游。
- 只使用 AF deep link 参数、没有普通剪贴板文本缓存的下游。
- 可以接受已跳转旧用户升级后首次 `h5Verify=1` 请求不携带旧文本的下游。

不要迁移旧版 `deferredJump`、旧目标 URL、旧 fingerprint 或旧 AF pending 状态。它们不是剪贴板快照，当前启动策略会自行重新建任务或按最新接口结果决策。

## 执行位置与时机

迁移必须是下游升级入口的显式一次性操作，并且发生在当前启动策略第一次读取 `openUrl.clipboardSnapshot` 之前。

推荐顺序：

1. 下游应用启动，存储已经可用。
2. 执行 `migrateLegacyOpenUrlClipboardSnapshot()`。
3. 完成后再进入 `runBootstrapAction()` 或下游自己的 bootstrap 入口。

不要把迁移放在以下位置：

- `readOpenUrlClipboardSnapshot()` 或其他普通读写函数。
- `requestBootstrapOpenUrl()`、`requestDeferredOpenUrl()` 或计时回调。
- `h5Verify=1` 分支内。
- 页面组件 render、AppState 回调或每次接口请求前。

这些位置会把一次性升级修复混入正常业务流程，导致旧 key 被重复读取，且难以审计迁移是否完成。

## 状态决策表

| 新快照 | 旧文本 key | 迁移动作 |
| --- | --- | --- |
| 有效 | 任意 | 新快照为准，绝不覆盖；删除遗留旧 key 后记录迁移完成。 |
| 不存在 | 非空文本 | 写入新快照，校验写入结果，删除旧 key，最后记录迁移完成。 |
| 不存在 | 不存在 | 仅记录迁移完成。 |
| 无效/损坏 | 非空文本 | 由迁移操作显式删除无效新快照后，按旧文本重新写入；不要在普通读取路径中静默兜底。 |
| 写入或校验失败 | 任意 | 保留旧 key，且不写完成标记；下次启动重试。 |

“有效新快照”必须同时满足：`capturedAtMs` 是正的有限数值、`hasReadClipboard` 是布尔值、`clipboardContent` 是字符串。迁移不能用 `newSnapshot || legacyText` 这类隐式回退表达状态。

## 推荐实现

下游应拥有自己的旧 key 和升级版本 key。下面是流程示例，名称仅供参考：

```js
const LEGACY_CLIPBOARD_TEXT_KEY = 'OPEN_URL_CLIPBOARD_CONTENT_CACHE';
const CLIPBOARD_SNAPSHOT_MIGRATION_KEY = 'app.migration.openUrlClipboardSnapshot.v1';

const createClipboardSnapshot = (clipboardContent) => ({
    capturedAtMs: Date.now(),
    hasReadClipboard: true,
    clipboardContent,
});

export const migrateLegacyOpenUrlClipboardSnapshot = async () => {
    const migrationDone = await AsyncStorage.getItem(CLIPBOARD_SNAPSHOT_MIGRATION_KEY);
    if (migrationDone === '1') {
        return;
    }

    const currentSnapshot = await readAndValidateCurrentSnapshot();
    if (currentSnapshot) {
        await AsyncStorage.removeItem(LEGACY_CLIPBOARD_TEXT_KEY);
        await AsyncStorage.setItem(CLIPBOARD_SNAPSHOT_MIGRATION_KEY, '1');
        return;
    }

    await removeInvalidCurrentSnapshotExplicitly();
    const legacyClipboardContent = await AsyncStorage.getItem(LEGACY_CLIPBOARD_TEXT_KEY);
    if (legacyClipboardContent === null) {
        await AsyncStorage.setItem(CLIPBOARD_SNAPSHOT_MIGRATION_KEY, '1');
        return;
    }

    const nextSnapshot = createClipboardSnapshot(legacyClipboardContent);
    await AsyncStorage.setItem(
        APP_STORAGE_KEYS.openUrl.clipboardSnapshot,
        JSON.stringify(nextSnapshot),
    );

    const savedSnapshot = await readAndValidateCurrentSnapshot();
    if (!savedSnapshot || savedSnapshot.clipboardContent !== legacyClipboardContent) {
        throw new Error('OpenUrl clipboard snapshot migration verification failed');
    }

    await AsyncStorage.removeItem(LEGACY_CLIPBOARD_TEXT_KEY);
    await AsyncStorage.setItem(CLIPBOARD_SNAPSHOT_MIGRATION_KEY, '1');
};
```

示例中的 `readAndValidateCurrentSnapshot()` 与 `removeInvalidCurrentSnapshotExplicitly()` 必须由下游实现为明确操作；不要调用基础框架内部函数去读取下游的历史 key。下游若沿用旧项目自己的 key 映射，`APP_STORAGE_KEYS.openUrl.clipboardSnapshot` 也应使用该下游映射后的字符串。

## 幂等与故障恢复

AsyncStorage 没有跨 key 的原子事务，因此顺序不可调整：

1. 先写入新快照。
2. 读取并校验新快照。
3. 再删除旧文本 key。
4. 最后写入迁移完成标记。

任意步骤中断后，下次启动都可安全继续：

- 新快照已写入、旧 key 未删除：新快照优先，补删旧 key 并写完成标记。
- 旧 key 已删除、完成标记未写入：新快照仍存在，补写完成标记。
- 新快照写入失败：旧 key 仍在，不写完成标记，下一次继续尝试。

迁移完成后，不要保留“每次启动继续兼容读取旧 key”的逻辑。它会掩盖新快照损坏、让旧状态重新参与业务决策，也会让迁移窗口永久存在。

## 验收场景

至少验证以下场景：

1. 已跳转旧用户：旧 key 有文本，升级后新快照存在；`h5Verify=1` 请求携带同一文本。
2. 未跳转旧用户：升级后启动阶段读取当前系统剪贴板，不能依赖历史旧文本覆盖当前快照。
3. 新快照已存在：迁移不能覆盖它，即使旧 key 仍有不同文本。
4. 写入失败：旧 key 不被删除，完成标记不被写入。
5. 迁移中断后重启：能够按上述顺序收敛到“新快照存在、旧 key 删除、完成标记存在”。
6. AF direct 命中：AF 参数优先时可不使用文本快照，但迁移不应修改 AF 参数缓存。

完成既定升级窗口后，删除下游迁移文件和升级版本 key；基础框架始终保持不读取历史文本 key 的状态。
