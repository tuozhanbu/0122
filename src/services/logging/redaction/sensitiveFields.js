const SENSITIVE_FIELD_KEY_PATTERN = /(token|password|authorization|credential|private|phone|code|secret|key)/i;

export const isSensitiveFieldKey = (key) => {
    return SENSITIVE_FIELD_KEY_PATTERN.test(String(key ?? ''));
};
