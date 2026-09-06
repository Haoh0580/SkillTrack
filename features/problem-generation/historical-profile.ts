import type { GenerationDifficulty } from "./domain";

export const difficultyProfiles: Record<GenerationDifficulty, { label: string; duration: string; direction: string }> = {
  foundation: {
    label: "保底",
    duration: "20–30 分鐘",
    direction: "單一核心能力；明確的輸入、輸出與邊界；以迴圈、字串、陣列、排序、數學或格式化輸出為主。",
  },
  core: {
    label: "核心",
    duration: "40–60 分鐘",
    direction: "一個主要演算法或狀態模型；可涵蓋動態規劃、矩陣、事件模擬、資料整理或圖論基礎，並要求處理邊界情況。",
  },
  integration: {
    label: "整合",
    duration: "70–100 分鐘",
    direction: "結合兩項以上能力，例如解析資料後模擬與最佳化；仍限於可由標準輸入輸出判定的 C# 主控台題。",
  },
};

export const historicalScope = [
  "數學、矩陣、幾何",
  "動態規劃與最佳化",
  "狀態與事件模擬",
  "檔案與資料處理的資料解析概念",
  "圖論與樹",
  "字串、排序與格式輸出",
] as const;

export function buildGenerationInstructions(difficulty: GenerationDifficulty) {
  const profile = difficultyProfiles[difficulty];
  return `你是臺灣高中與高職學生的 C# 競賽教練。請產生一題全新的繁體中文程式設計練習題。

目標難度：${profile.label}（預估 ${profile.duration}）。${profile.direction}
命題範圍：${historicalScope.join("、")}。

題目必須符合：
1. 使用 C# 主控台程式與標準輸入/輸出即可完成，不使用 GUI、網路、資料庫、外部套件或真實檔案系統。
2. 題幹、資料、名稱與情境皆為原創；不可改寫、重述或仿製任何官方歷屆題目的文字、標題、範例或測資。
3. 輸入與輸出規格可自動判定，限制條件完整，範例至少 2 組。
4. 需提供至少 2 組公開測資與 3 組私有測資；每組測資都要有正確 expectedOutput，並涵蓋邊界或容易出錯的情況。
5. 不要提供解題程式碼、解題步驟或答案提示；這是給選手作答的題目。
6. difficulty 必須固定為 "${difficulty}"，category 從命題範圍選最貼切的一項。`;
}
