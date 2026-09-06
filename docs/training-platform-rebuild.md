# 工科賽訓練平台：積木式重構藍圖

## 重構原則

現有平台保留為「題庫與歷程」模組；新平台的主流程改為：選題 → 閱讀題目 → 在工作區撰寫程式 → 送出評測 → 取得回饋 → 更新能力地圖。

每一層都必須可使用、可驗證，下一層只接在已完成的能力上。

## 五問拆解

| 功能 | 1. 要做什麼 | 2. 輸入／輸出 | 3. 技術與套件 | 4. 限制 | 5. 現況與下一步 |
| --- | --- | --- | --- | --- | --- |
| 題庫選題 | 依年度、題型、難度挑選一題 | 輸入：篩選條件；輸出：題目卡、作答入口 | Next App Router、D1 | 官方題目不可誤刪 | 已有題庫；下一步改成作答入口 |
| 作答工作區 | 題目、編輯器、計時與測資顯示於同頁 | 輸入：程式碼、語言；輸出：暫存作答與時間 | React Client Component、CodeMirror/Monaco（第二層） | 第一層不假裝能執行程式 | 本版建立畫面與狀態模型 |
| 執行與評分 | 將程式送往安全執行環境，回傳每組測資結果 | 輸入：source、language、test cases；輸出：AC/WA/TLE、stdout、stderr | `POST /api/submissions`、Judge adapter、D1 | Cloudflare Worker 不可直接執行學生程式 | 第三層接 Judge0 或自建沙盒 |
| AI 回饋 | 根據結果與程式提供可行的提示 | 輸入：題目、程式、評測結果；輸出：分級提示、除錯方向 | `POST /api/feedback`、OpenAI API | 不能把 AI 評語當作正確性判斷 | 第四層，先採提示而非直接給完整答案 |
| 能力與週訓練 | 依有效送出紀錄給下週重點 | 輸入：題型、分數、耗時、錯誤類型；輸出：能力圖、訓練清單 | D1、聚合查詢 | 需以真實評測結果為主 | 現有能力圖保留，改接 submission 資料 |

## 分層交付順序

1. **畫面層**：題庫進入工作區；題目、程式區、計時、測資與結果面板先就位。
2. **資料層**：題目敘述、範例測資、草稿、送出歷程的資料模型與 API。第一個完整範本為 112-2 最小編輯距離（C#）。
3. **判題層**：先保存每次送出與結果，再接入 Judge Adapter；先支援一種語言與公開測資，再擴充。
4. **回饋層**：將判題結果交給 AI 產生分級提示與復盤問題。
5. **訓練層**：以送出結果產生能力地圖、弱點題單與每週檢視。

## API 合約（先定義、後串接）

```ts
type SubmissionRequest = {
  problemId: string;
  language: "csharp"; // 第一階段僅支援 C#
  source: string;
};

type SubmissionResult = {
  id: string;
  verdict: "queued" | "accepted" | "wrong_answer" | "runtime_error" | "time_limit";
  passed: number;
  total: number;
  elapsedMs?: number;
  stdout?: string;
  stderr?: string;
};
```

`/api/submissions` 不會直接在網站伺服器跑程式。它先保存送出內容與狀態，再透過 C# Judge Adapter 呼叫未來的安全執行環境。這能讓雲端判題服務、校內主機或其他安全沙盒可替換。

目前已建立 `lib/judge/` 的 C# 判題介面與暫時的不可用實作。接入真正的判題服務時，只替換 Adapter，不更動題庫、工作區或能力地圖。

## 本次完成的第三層基礎

- 新增 `submissions` 資料表與查詢索引，保存題目、C# 原始碼、評測狀態、通過題數、輸出與時間。
- 每次有效送出會先建立 `queued` 紀錄；Judge Adapter 回覆後只更新評測欄位，保留原始程式與建立時間。
- 目前 Adapter 明確回傳 `judge_not_configured`，不執行學生程式碼；接入外部沙盒前，不需要 API Key。
- 真正接入外部 C# 判題服務時，再評估該服務的帳號、費用與金鑰，並以伺服器端祕密設定保存，絕不傳到瀏覽器。

## 目錄責任

```text
app/practice/[id]/       作答工作區頁面
app/api/submissions/     送出與查詢 API
features/practice/       題目、草稿、評測的 UI 與 domain types
lib/judge/               未來的 Judge Adapter
db/                      題目、測資、送出、回饋、訓練資料表
```

## 本次完成的第一層

- 新增題目工作區畫面。
- 題庫可導向工作區。
- 程式、語言、計時與送出面板先採本機互動狀態，明確標示尚未啟用正式判題。
- 後續每一項功能皆依本文件的五問表補齊後再併入主線。
