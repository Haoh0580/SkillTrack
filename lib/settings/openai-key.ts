const STORAGE_KEY = "training-platform:openai-api-key";

export function getStoredOpenAiKey(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredOpenAiKey(key: string) {
  try {
    if (key.trim()) window.localStorage.setItem(STORAGE_KEY, key.trim());
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage 無法使用（例如無痕模式關閉儲存）時，僅在當次連線期間跳過保存。
  }
}
