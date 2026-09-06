"use client";

import { useEffect, useState } from "react";
import type { SupportedLanguage } from "@/features/practice/domain";

type Props = { id: string; title: string; category: string; note: string };
const starter: Record<SupportedLanguage, string> = { csharp: "using System;\n\npublic class Program\n{\n    public static void Main()\n    {\n        // 從這裡開始作答\n    }\n}\n" };

export function PracticeWorkspace({ id, title, category, note }: Props) {
  const [language] = useState<SupportedLanguage>("csharp");
  const [source, setSource] = useState(starter.csharp);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("尚未送出");
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [running]);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const submit = async () => { const response = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problemId: id, language, source }) }); const result = await response.json(); setNotice(result.verdict === "judge_not_configured" ? "判題服務尚未接入，已驗證送出 API 契約" : result.error ?? "送出完成"); };

  return <main className="practice-shell">
    <nav className="practice-nav"><a href="/">← 題庫</a><span>{category}</span><strong>{time}</strong><button onClick={() => setRunning((value) => !value)}>{running ? "暫停" : "開始計時"}</button></nav>
    <section className="practice-layout">
      <article className="problem-panel"><p className="kicker">作答工作區 · 第 1 層</p><h1>{title}</h1><p>{note}</p><hr/><h2>題目內容</h2><p>本層先建立題目、程式碼與結果同畫面的操作流程。下一層會把題目完整敘述、輸入輸出格式與範例測資轉為結構化資料。</p><h2>範例測資</h2><pre>{"輸入：待建立\\n輸出：待建立"}</pre><small>題目代號：{id}</small></article>
      <section className="editor-panel"><div className="editor-toolbar"><label>語言 <b>C#</b></label><span>草稿模式</span></div><textarea aria-label="C# 程式碼編輯器" value={source} onFocus={() => setRunning(true)} onChange={(event) => setSource(event.target.value)} spellCheck={false}/><div className="result-panel"><div><b>評測結果</b><span>{notice}</span></div><p>送出 API 已建立；正式判題器與安全沙盒會在第三層串接，現在不會假裝執行程式。</p><button onClick={submit}>送出評測</button></div></section>
    </section>
  </main>;
}
