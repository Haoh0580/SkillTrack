"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SubmissionResult, SupportedLanguage } from "@/features/practice/domain";
import type { ProblemDefinition } from "@/features/practice/problem-definitions";

type Props = { id: string; title: string; category: string; note: string; definition?: ProblemDefinition };
const starter: Record<SupportedLanguage, string> = { csharp: "using System;\n\npublic class Program\n{\n    public static void Main()\n    {\n        // 從這裡開始作答\n    }\n}\n" };

export function PracticeWorkspace({ id, title, category, note, definition }: Props) {
  const [language] = useState<SupportedLanguage>("csharp");
  const [source, setSource] = useState(starter.csharp);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("尚未送出");
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [running]);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const submit = async () => {
    setNotice("送出中…");
    setSubmissionResult(null);
    try {
      const response = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: id, language, source }) });
      const result = await response.json() as SubmissionResult & { error?: string };
      if (result.verdict) {
        setSubmissionResult(result);
        setNotice(result.verdict === "judge_not_configured" ? "判題服務尚未接入，已驗證送出 API 契約" : "送出完成");
      } else setNotice(result.error ?? "送出失敗，請稍後再試。");
    } catch {
      setNotice("網路連線失敗，請稍後再試。");
    }
  };

  return <main className="practice-shell">
    <nav className="practice-nav"><Link href="/">← 題庫</Link><span>{category}</span><strong>{time}</strong><button onClick={() => setRunning((value) => !value)}>{running ? "暫停" : "開始計時"}</button></nav>
    <section className="practice-layout">
      <article className="problem-panel"><p className="kicker">作答工作區 · 第 2 層</p><h1>{title}</h1><p>{definition?.statement ?? note}</p><hr/>{definition ? <><h2>輸入說明</h2><p>{definition.inputSpec}</p><h2>輸出說明</h2><p>{definition.outputSpec}</p><h2>限制與提示</h2><ul>{definition.constraints.map((item) => <li key={item}>{item}</li>)}</ul><h2>範例測資</h2>{definition.examples.map((example, index) => <div className="example" key={example.input}><b>範例 {index + 1}</b><pre>{`輸入\n${example.input}\n\n輸出\n${example.output}`}</pre>{example.explanation && <small>{example.explanation}</small>}</div>)}</> : <><h2>題目內容</h2><p>此題尚待轉為結構化資料。目前可先閱讀原始題目，下一批會依相同欄位補齊輸入、輸出、限制與測資。</p><a href={`/question/${id}`}>閱讀官方題目</a></>}<small>題目代號：{id}</small></article>
      <section className="editor-panel"><div className="editor-toolbar"><label>語言 <b>C#</b></label><span>草稿模式</span></div><textarea aria-label="C# 程式碼編輯器" value={source} onFocus={() => setRunning(true)} onChange={(event) => setSource(event.target.value)} spellCheck={false}/><div className="result-panel"><div><b>評測結果</b><span>{notice}</span></div>{submissionResult ? <div className="judge-summary"><p>{submissionResult.verdict === "accepted" ? `已通過 ${submissionResult.passed} / ${submissionResult.total} 測資` : `結果：${submissionResult.verdict}（通過 ${submissionResult.passed} / ${submissionResult.total}）`}</p>{submissionResult.elapsedMs !== undefined && <p>耗時 {submissionResult.elapsedMs} ms</p>}{submissionResult.stdout && <p>程式輸出：{submissionResult.stdout}</p>}{submissionResult.stderr && <p>訊息：{submissionResult.stderr}</p>}</div> : <p>送出後將在這裡顯示通過數、耗時與執行訊息。</p>}<button onClick={submit}>送出評測</button></div></section>
    </section>
  </main>;
}
