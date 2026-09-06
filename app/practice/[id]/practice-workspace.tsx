"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SubmissionResponse, SupportedLanguage } from "@/features/practice/domain";
import type { ProblemDefinition } from "@/features/practice/problem-definitions";

type Props = { id: string; title: string; category: string; note: string; definition?: ProblemDefinition };
const starter: Record<SupportedLanguage, string> = { csharp: "using System;\n\npublic class Program\n{\n    public static void Main()\n    {\n        // 從這裡開始作答\n    }\n}\n" };

// Ungraded "Run Code" result from /api/judge — separate from SubmissionResponse,
// which is the scored 送出評測 verdict compared against stored test cases.
type RunResult = {
  status: { id?: number; description?: string } | null;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;
  memory: number | null;
};

export function PracticeWorkspace({ id, title, category, note, definition }: Props) {
  const [language] = useState<SupportedLanguage>("csharp");
  const [source, setSource] = useState(starter.csharp);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("尚未送出");
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null);
  const [backfillStatus, setBackfillStatus] = useState("部分完成");
  const [backfillScore, setBackfillScore] = useState(60);
  const [needsManualBackfill, setNeedsManualBackfill] = useState(false);
  const [backfillSaved, setBackfillSaved] = useState(false);
  const [backfillSaving, setBackfillSaving] = useState(false);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runStdin, setRunStdin] = useState("");
  // A ref (not state) so a second click is rejected synchronously even if it lands
  // before React has re-rendered the disabled button — state alone can't close that race.
  const runInFlightRef = useRef(false);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [running]);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const elapsedMinutes = () => Math.max(1, Math.round(seconds / 60));

  const saveRecord = async (status: string, score: number, notes: string) => {
    await fetch("/api/data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceId: id, score, minutes: elapsedMinutes(), status, notes }),
    });
  };

  const runCode = async () => {
    if (runInFlightRef.current) return;
    runInFlightRef.current = true;
    setIsRunningCode(true);
    setRunError(null);
    setRunResult(null);
    try {
      const response = await fetch("/api/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // runStdin is forwarded exactly as typed — no trim() — so an intentional
        // trailing blank line (e.g. "abc\n\n") reaches Judge0 unchanged.
        body: JSON.stringify({ source_code: source, language_id: 51, stdin: runStdin }),
      });
      const data = await response.json() as (RunResult & { error?: string });
      if (!response.ok) {
        setRunError(data.error ?? "Execution service temporarily unavailable.");
        return;
      }
      setRunResult(data);
    } catch {
      setRunError("Execution service temporarily unavailable.");
    } finally {
      runInFlightRef.current = false;
      setIsRunningCode(false);
    }
  };

  const submit = async () => {
    setRunning(false);
    setNotice("送出中…");
    setSubmissionResult(null);
    setNeedsManualBackfill(false);
    setBackfillSaved(false);
    try {
      // The server is the sole scoring authority: /api/submissions judges, computes
      // score/status, and writes the training record itself. The workspace no
      // longer decides "is this accepted" or POSTs a score to /api/data on its own —
      // it only sends the code and elapsed time (elapsedSeconds is purely
      // informational display data; the server clamps it and it never affects
      // verdict or score), then renders whatever the server already finalized.
      const response = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: id, language, source, elapsedSeconds: seconds }) });
      const result = await response.json() as SubmissionResponse & { error?: string };
      if (!result.verdict) {
        setNotice(result.error ?? "送出失敗，請稍後再試。");
        return;
      }
      setSubmissionResult(result);
      if (result.finalized) {
        setNotice("送出完成，已自動更新分數結果與能力雷達");
        setBackfillSaved(true);
      } else if (result.score !== undefined) {
        // A real, scoreable verdict came back, but the server failed to persist the
        // training record — never claim success here. The verdict itself is safely
        // stored; resubmitting is safe (it can't double-score this attempt) but
        // starts a fresh submission rather than recovering this exact one.
        setNotice("評測已完成，但寫入正式成績時發生問題，請稍後重新整理訓練總覽確認，或重新送出評測。");
      } else if (result.verdict === "judge_unavailable") {
        // Upstream judge failed (timeout/5xx/malformed response) on a validated
        // problem — never the student's fault, so never score it or offer the
        // manual-confirm form (that's reserved for problems with no test data yet).
        setNotice(result.stderr ?? "判題服務暫時無法使用，請稍後重新送出評測（本次不計入成績）。");
      } else {
        setNotice("判題服務尚未接入，已驗證送出 API 契約");
        setNeedsManualBackfill(true);
      }
    } catch {
      setNotice("網路連線失敗，請稍後再試。");
    }
  };

  const confirmManualBackfill = async () => {
    setBackfillSaving(true);
    try {
      await saveRecord(backfillStatus, backfillScore, "工作區送出評測後回填（判題服務尚未接入，由作答者確認結果）");
      setBackfillSaved(true);
      setNeedsManualBackfill(false);
    } finally {
      setBackfillSaving(false);
    }
  };

  return <main className="practice-shell">
    <nav className="practice-nav"><Link href="/training" prefetch={false} onClick={(event) => { event.preventDefault(); window.location.assign("/training"); }}>← 題庫</Link><span>{category}</span><strong>{time}</strong><button onClick={() => setRunning((value) => !value)}>{running ? "暫停" : "開始計時"}</button></nav>
    <section className="practice-layout">
      <article className="problem-panel"><p className="kicker">作答工作區 · 第 2 層</p><h1>{title}</h1><p>{definition?.statement ?? note}</p><hr/>{definition ? <><h2>輸入說明</h2><p>{definition.inputSpec}</p><h2>輸出說明</h2><p>{definition.outputSpec}</p><h2>限制與提示</h2><ul>{definition.constraints.map((item) => <li key={item}>{item}</li>)}</ul><h2>範例測資</h2>{definition.examples.map((example, index) => <div className="example" key={example.input}><b>範例 {index + 1}</b><pre>{`輸入\n${example.input}\n\n輸出\n${example.output}`}</pre>{example.explanation && <small>{example.explanation}</small>}</div>)}</> : <><h2>題目內容</h2><p>此題尚待轉為結構化資料。目前可先閱讀原始題目，下一批會依相同欄位補齊輸入、輸出、限制與測資。</p><a href={`/question/${id}`}>閱讀官方題目</a></>}<small>題目代號：{id}</small></article>
      <section className="editor-panel">
        <div className="editor-toolbar"><label>語言 <b>C#</b></label><span>草稿模式</span></div>
        <textarea aria-label="C# 程式碼編輯器" value={source} onFocus={() => setRunning(true)} onChange={(event) => setSource(event.target.value)} spellCheck={false}/>
        <div className="stdin-panel">
          <label htmlFor="run-stdin">測試輸入 / Standard Input</label>
          <textarea id="run-stdin" aria-label="測試輸入" value={runStdin} onChange={(event) => setRunStdin(event.target.value)} spellCheck={false} rows={3}/>
          <button type="button" onClick={runCode} disabled={isRunningCode}>{isRunningCode ? "執行中…" : "執行程式"}</button>
        </div>
        {(isRunningCode || runResult || runError) && <div className="run-panel">
          <div><b>執行結果</b><span>{isRunningCode ? "執行中…" : runResult?.status?.description ?? (runError ? "執行失敗" : "")}</span></div>
          {runError && <p className="run-error">{runError}</p>}
          {runResult && <>
            {runResult.compile_output && <p><b>Compile Error</b><br/>{runResult.compile_output}</p>}
            {!runResult.compile_output && runResult.stderr && <p><b>Runtime Error</b><br/>{runResult.stderr}</p>}
            {!runResult.compile_output && !runResult.stderr && runResult.stdout && <p><b>Output</b><br/>{runResult.stdout}</p>}
            {!runResult.compile_output && !runResult.stderr && !runResult.stdout && <p>程式沒有輸出內容</p>}
            <small>{runResult.time !== null && `耗時 ${runResult.time}s`}{runResult.memory !== null && ` · 記憶體 ${runResult.memory} KB`}</small>
          </>}
        </div>}
        <div className="result-panel">
          <div><b>評測結果</b><span>{notice}</span></div>
          {submissionResult ? <div className="judge-summary">
            <p>{submissionResult.verdict === "accepted" ? `已通過 ${submissionResult.passed} / ${submissionResult.total} 測資` : `結果：${submissionResult.verdict}（通過 ${submissionResult.passed} / ${submissionResult.total}）`}</p>
            {submissionResult.score !== undefined && <p>正式分數：{submissionResult.score}（{submissionResult.status}）</p>}
            {submissionResult.elapsedMs !== undefined && <p>耗時 {submissionResult.elapsedMs} ms</p>}
            {submissionResult.stdout && <p>程式輸出：{submissionResult.stdout}</p>}
            {submissionResult.stderr && <p>訊息：{submissionResult.stderr}</p>}
          </div> : <p>送出後將在這裡顯示通過數、耗時與執行訊息。</p>}
          {backfillSaved && <p className="backfill-saved">✓ 已回填至練習紀錄，重新整理訓練總覽即可看到最新的分數與能力雷達。</p>}
          {needsManualBackfill && !backfillSaved && <div className="backfill-inline">
            <p>此題目前還沒有可自動驗證的判題資料，請誠實評估這次作答的完成度再送出；送出後會直接回填分數結果與能力雷達，不需要再到訓練總覽手動填寫。</p>
            <label>結果狀態 <select value={backfillStatus} onChange={(event) => setBackfillStatus(event.target.value)}><option>完成</option><option>部分完成</option><option>未完成</option></select></label>
            <label>分數 <input type="number" min={0} max={100} value={backfillScore} onChange={(event) => setBackfillScore(Number(event.target.value))}/></label>
            <label>耗時（分） <b>{elapsedMinutes()}</b></label>
            <button type="button" onClick={confirmManualBackfill} disabled={backfillSaving}>{backfillSaving ? "回填中…" : "確認並回填成績"}</button>
          </div>}
          <button onClick={submit}>送出評測</button>
        </div>
      </section>
    </section>
  </main>;
}
