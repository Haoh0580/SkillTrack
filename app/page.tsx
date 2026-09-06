import Link from "next/link";
import "./globals.css";

const capabilities = [
  ["01", "題庫對焦", "從歷屆命題脈絡出發，先選擇真正需要補強的題型。"],
  ["02", "模擬作答", "在同一個工作區閱讀題目、撰寫 C#，建立比賽節奏。"],
  ["03", "回看進步", "將得分與耗時轉成能力地圖，安排下一週的優先訓練。"],
];

export default function LandingPage() {
  return <main className="landing">
    <header className="landing-header"><Link className="brand" href="/"><span>⊹</span> CODE CAMP</Link><nav><a href="#how-it-works">訓練方式</a><a href="#coverage">能力範圍</a></nav><Link className="header-cta" href="/training">進入平台 <span>↗</span></Link></header>
    <section className="landing-hero"><div className="hero-copy"><p className="eyebrow"><i/> 工科賽・電腦軟體設計</p><h1>把每一次練習，<br/><em>變成下一次得分。</em></h1><p className="hero-description">為高中與高職 C# 選手打造的競賽訓練工作台。從選題、模擬作答到能力回顧，讓訓練有目標，也看得見成長。</p><div className="hero-actions"><Link className="primary-cta" href="/training">開始進入訓練 <span>→</span></Link><a className="text-cta" href="#how-it-works">看看怎麼練 <span>↓</span></a></div><div className="hero-proof"><div><b>18+</b><span>歷屆題型整理</span></div><div><b>C#</b><span>競賽作答環境</span></div><div><b>3</b><span>難度訓練層級</span></div></div></div>
      <div className="hero-console" aria-label="訓練平台功能預覽"><div className="console-top"><span className="console-mark">訓練中</span><span className="console-time">01:42:08</span><i/></div><div className="console-content"><div className="console-label">本週訓練焦點</div><h2>核心演算法<br/>與狀態轉移</h2><div className="console-progress"><span>完成進度</span><b>72%</b><i><u/></i></div><div className="console-cards"><article><span>今日任務</span><b>最小編輯距離</b><small>動態規劃 · 核心</small></article><article><span>能力訊號</span><b className="signal">持續上升 ↗</b><small>近 7 日 6 次紀錄</small></article></div></div><div className="console-orbit orbit-one"/><div className="console-orbit orbit-two"/></div>
    </section>
    <section id="how-it-works" className="landing-section workflow"><div className="section-intro"><p className="eyebrow"><i/> 不只是題庫</p><h2>用一套循環，<br/>讓練習更接近比賽。</h2></div><div className="workflow-list">{capabilities.map(([number,title,description])=><article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div><b>↗</b></article>)}</div></section>
    <section id="coverage" className="landing-section coverage"><div><p className="eyebrow"><i/> 以歷屆範圍為基礎</p><h2>從基本盤到<br/><em>整合題的臨場感。</em></h2></div><div className="coverage-grid"><article><span>保底</span><p>字串、迴圈、陣列、排序、數學與格式輸出。</p></article><article><span>核心</span><p>動態規劃、矩陣、資料處理、事件模擬與圖論基礎。</p></article><article><span>整合</span><p>結合多項能力，練習分析、拆解與時間分配。</p></article></div></section>
    <section className="landing-final"><p className="eyebrow"><i/> 從今天的一題開始</p><h2>準備好，把實力<br/>做成看得見的紀錄嗎？</h2><Link className="primary-cta light" href="/training">進入測試平台 <span>→</span></Link></section>
    <footer className="landing-footer"><Link className="brand" href="/"><span>⊹</span> CODE CAMP</Link><p>工科賽・電腦軟體設計訓練平台</p><Link href="/training">前往訓練平台 ↗</Link></footer>
  </main>;
}
