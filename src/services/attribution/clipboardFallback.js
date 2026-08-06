import { parseAttributionClipboardFallbackParams } from '@/services/attribution/reporter';

export const parseAttributionClipboardFallback = (clipboardContent) => {
    const rawClipboardContent = String(clipboardContent ?? '').trim();
    if (!rawClipboardContent) {
        return null;
    }

    let parsedClipboardContent = null;
    try {
        parsedClipboardContent = JSON.parse(rawClipboardContent);
    } catch {
        return null;
    }

    if (!parsedClipboardContent || typeof parsedClipboardContent !== 'object' || Array.isArray(parsedClipboardContent)) {
        return null;
    }

    const normalizedParams = parseAttributionClipboardFallbackParams(parsedClipboardContent);
    const deepLinkValue = String(normalizedParams?.linkValue ?? '').trim();
    return deepLinkValue ? normalizedParams : null;
};
