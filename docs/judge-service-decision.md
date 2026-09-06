# C# 判題服務選型與啟用條件

## 結論

第一個正式接入目標採用 **自架 Judge0 CE**，並放在獨立主機或雲端容器中；訓練平台只透過 HTTPS 呼叫它。Judge0 是專門用於線上程式執行的沙盒系統，支援以 API 設定執行資源限制，也可查詢可用語言。C# 的實際版本和 language ID 必須以部署後的 `/languages` 回應為準，不能寫死在前端。

這是目前最符合「競賽 C# 練習、可控制成本、可保存私有測資」的起步方案。這是根據 Judge0 的自架與沙盒能力所做的技術判斷，而不是對其安全性的絕對保證；主機仍須隔離、更新與限流。

官方資料： [Judge0 CE API 文件](https://ce.judge0.com/docs)、[Judge0 原始碼與自架說明](https://github.com/judge0/judge0)。

## 五問確認

| 問題 | 決定 |
| --- | --- |
| 要做什麼 | 接收 C# 程式與伺服器端測資，在隔離環境編譯、執行並回傳結果。 |
| 輸入／輸出 | 輸入為 source、stdin、時間／記憶體限制；輸出為編譯或執行狀態、stdout、stderr、耗時。平台再比對正確輸出。 |
| 技術 | Cloudflare Worker 作為平台 API；獨立 Judge0 CE 主機作為執行沙盒；HTTPS 與伺服器端密鑰。 |
| 限制 | Worker 不可直接執行學生程式；私有測資不能送到瀏覽器；需限制每人送出頻率、程式長度與同時執行數。 |
| 現況位置 | 平台已有通用遠端 Adapter、送出紀錄及 112-2 的測資；尚未建立或設定 Judge0 主機。 |

## 啟用清單

1. 建立獨立的 Judge0 CE 主機，勿與平台資料庫或檔案服務共用執行環境。
2. 以防火牆或反向代理限制僅接受平台的 HTTPS 請求，並開啟 Judge0 認證。
3. 在主機上確認 C# 可用語言與 language ID，並以小型測資驗證編譯、逾時和記憶體限制。
4. 將 `JUDGE_PROVIDER` 設為 `judge0`、判題端點存為 `JUDGE_ENDPOINT`、該實例的 C# language ID 存為 `JUDGE0_CSHARP_LANGUAGE_ID`；認證值存為 `JUDGE_API_KEY` 的部署祕密。
5. 以公開與私有測資做端對端驗證後，才將這組設定用於正式平台。

## 金鑰處理規則

- `JUDGE_ENDPOINT` 可以是非機密的部署設定；`JUDGE_API_KEY` 必須是部署平台的 Secret。
- `JUDGE_PROVIDER=judge0` 與 `JUDGE0_CSHARP_LANGUAGE_ID` 是非機密設定；C# language ID 必須從該 Judge0 實例的 `/languages` 查得，不能假設所有實例相同。
- 本機若需測試，僅使用未提交的 `.dev.vars`；`.dev.vars*` 已列入 Git 忽略規則。
- Worker Secret 可以透過 `cloudflare:workers` 的 `env` 讀取，且不會由 API 回傳給瀏覽器。Cloudflare 也明確建議敏感值使用 Secret、不要寫入 Wrangler 的明文設定或提交到 Git。[Cloudflare Secrets 文件](https://developers.cloudflare.com/workers/configuration/secrets/)
