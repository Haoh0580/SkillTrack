"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./globals.css";
import { getStoredOpenAiKey, setStoredOpenAiKey, getStoredOpenAiModel, setStoredOpenAiModel } from "@/lib/settings/openai-key";

type Question={id:string;year:number;title:string;category:string;level:string;note:string};
type Attempt={resource_id:string;score:number;status:string;minutes:number;created_at:string};
type Draft={id:string;difficulty:string;category:string;title:string;summary:string;statement:string;inputSpec:string;outputSpec:string;constraints:string[];examples:{input:string;output:string;explanation:string}[];tests:{input:string;expectedOutput:string;visibility:string}[]};

const difficultyLabel:{[key:string]:string}={foundation:"保底",core:"核心",integration:"整合"};
const levelStyle:{[key:string]:{bg:string;fg:string}}={"保底":{bg:"#eafbf0",fg:"#16a34a"},"核心":{bg:"#eaf1ff",fg:"#315dea"},"整合":{bg:"#f6eeff",fg:"#9333ea"}};
const categoryShort:{[key:string]:string}={"數學、矩陣、幾何":"數學矩陣","動態規劃與最佳化":"動態規劃","狀態與事件模擬":"狀態模擬","檔案與資料處理":"檔案資料","圖論與樹":"圖論","字串、排序與格式輸出":"字串排序","GUI、繪圖、影像":"GUI影像"};
const shortCategory=(category:string)=>categoryShort[category]??(category.length>4?`${category.slice(0,4)}…`:category);

function dayKey(value:string|Date){return new Date(value).toISOString().slice(0,10)}
function daysAgo(value:string){return Math.floor((Date.now()-new Date(value).getTime())/86400000)}
function average(values:number[]){return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0}

function radarPoint(count:number,index:number,fraction:number){const size=232,center=size/2,radius=(size/2-34)*fraction,angle=(Math.PI*2*index)/count-Math.PI/2;return{x:center+radius*Math.cos(angle),y:center+radius*Math.sin(angle)}}
function ringPolygon(count:number,fraction:number){return Array.from({length:count},(_,i)=>{const p=radarPoint(count,i,fraction);return`${p.x},${p.y}`}).join(" ")}
function dataPolygon(values:number[]){return values.map((v,i)=>{const p=radarPoint(values.length,i,Math.min(Math.max(v,0),100)/100);return`${p.x},${p.y}`}).join(" ")}

function DeltaBadge({current,previous,hasBaseline,unit}:{current:number;previous:number;hasBaseline:boolean;unit?:string}){
  if(!hasBaseline)return<b className="delta-flat">首週紀錄</b>;
  const diff=current-previous;
  if(diff===0)return<b className="delta-flat">與上週持平</b>;
  return<b className={diff>0?"delta-up":"delta-down"}>{diff>0?"↑":"↓"} {Math.abs(diff)}{unit??""} 較上週</b>;
}

function AbilityRadar({data}:{data:{category:string;score:number}[]}){
  const values=data.map(d=>d.score);
  return<svg viewBox="0 0 232 232" className="radar" role="img" aria-label="能力雷達圖">
    {[0.34,0.67,1].map(fraction=><polygon key={fraction} points={ringPolygon(data.length,fraction)} className="radar-ring"/>)}
    {data.map((_,i)=>{const p=radarPoint(data.length,i,1);return<line key={i} x1={116} y1={116} x2={p.x} y2={p.y} className="radar-axis"/>})}
    <polygon points={dataPolygon(values)} className="radar-data"/>
    {data.map((d,i)=>{const p=radarPoint(data.length,i,1.17);return<text key={d.category} x={p.x} y={p.y} className="radar-label" textAnchor="middle">{shortCategory(d.category)}</text>})}
  </svg>;
}

export default function TrainingDashboard(){
 const [questions,setQuestions]=useState<Question[]>([]);
 const [records,setRecords]=useState<Attempt[]>([]);
 const [active,setActive]=useState<Question|null>(null);
 const [generating,setGenerating]=useState(false);
 const [generationMessage,setGenerationMessage]=useState("");
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [hasApiKey,setHasApiKey]=useState(()=>!!getStoredOpenAiKey());
 const [drafts,setDrafts]=useState<Draft[]>([]);
 const [reviewing,setReviewing]=useState<Draft|null>(null);
 const [levelFilter,setLevelFilter]=useState("all");
 const [onlyIncomplete,setOnlyIncomplete]=useState(false);
 const [categoryFocus,setCategoryFocus]=useState<string|null>(null);

 const load=()=>fetch("/api/data").then(x=>x.json()).then(x=>{setQuestions(x.resources);setRecords(x.records)});
 const loadDrafts=()=>fetch("/api/problem-drafts").then(x=>x.json()).then(x=>setDrafts(x.drafts));
 useEffect(()=>{load();loadDrafts()},[]);

 function saveApiKey(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const key=String(f.get("apiKey")||"");setStoredOpenAiKey(key);setStoredOpenAiModel(String(f.get("model")||""));setHasApiKey(!!key.trim());setSettingsOpen(false)}
 function clearApiKey(){setStoredOpenAiKey("");setHasApiKey(false)}

 const completedIds=useMemo(()=>new Set(records.filter(r=>r.status==="完成").map(r=>r.resource_id)),[records]);
 const ability=useMemo(()=>[...new Set(questions.map(x=>x.category))].map(category=>{const ids=new Set(questions.filter(x=>x.category===category).map(x=>x.id));const rs=records.filter(x=>ids.has(x.resource_id));return{category,n:ids.size,score:average(rs.map(r=>r.score))}}),[questions,records]);
 const measured=useMemo(()=>[...ability].filter(a=>a.score>0).sort((a,b)=>a.score-b.score),[ability]);
 const weakest=measured[0];

 const recordDates=useMemo(()=>new Set(records.map(r=>dayKey(r.created_at))),[records]);
 const streak=useMemo(()=>{let count=0;const cursor=new Date();while(recordDates.has(dayKey(cursor))){count++;cursor.setDate(cursor.getDate()-1)}return count},[recordDates]);
 const last14Days=useMemo(()=>Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return{key:dayKey(d),active:recordDates.has(dayKey(d)),isToday:i===13}}),[recordDates]);
 const thisWeek=useMemo(()=>records.filter(r=>daysAgo(r.created_at)<7),[records]);
 const lastWeek=useMemo(()=>records.filter(r=>{const d=daysAgo(r.created_at);return d>=7&&d<14}),[records]);
 const thisWeekCompleted=thisWeek.filter(r=>r.status==="完成").length;
 const lastWeekCompleted=lastWeek.filter(r=>r.status==="完成").length;
 const thisWeekMinutes=thisWeek.reduce((a,r)=>a+r.minutes,0);
 const lastWeekMinutes=lastWeek.reduce((a,r)=>a+r.minutes,0);
 const thisWeekAvg=average(thisWeek.map(r=>r.score));
 const lastWeekAvg=average(lastWeek.map(r=>r.score));

 const recommendation=records.length===0?"尚未有練習紀錄，建議先從保底題建立基線":weakest?`優先加強：${weakest.category}（目前 ${weakest.score} 分）`:"各項能力都有基礎分數，持續保持節奏";

 const filteredQuestions=useMemo(()=>questions.filter(q=>(levelFilter==="all"||q.level===levelFilter)&&(!onlyIncomplete||!completedIds.has(q.id))&&(!categoryFocus||q.category===categoryFocus)),[questions,levelFilter,onlyIncomplete,categoryFocus,completedIds]);

 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await fetch("/api/data",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({resourceId:active!.id,score:+f.get("score")!,minutes:+f.get("minutes")!,status:f.get("status"),notes:f.get("notes")})});setActive(null);load()}
 async function generate(e:FormEvent<HTMLFormElement>){e.preventDefault();const apiKey=getStoredOpenAiKey();if(!apiKey){setGenerationMessage("請先點選右上角「設定 API Key」輸入你的 OpenAI API Key。");return}setGenerationMessage("AI 正在依競賽範圍建立題目草稿…");const f=new FormData(e.currentTarget);try{const r=await fetch("/api/problem-drafts",{method:"POST",headers:{"content-type":"application/json","x-openai-api-key":apiKey},body:JSON.stringify({difficulty:f.get("difficulty"),model:getStoredOpenAiModel()||undefined})});const data=await r.json();if(!r.ok)throw new Error(data.error||"AI 出題暫時無法使用");setGenerating(false);setReviewing({id:data.id,...data.draft});loadDrafts()}catch(error){setGenerationMessage(error instanceof Error?error.message:"AI 出題暫時無法使用")}}
 async function publishDraft(id:string){await fetch(`/api/problem-drafts/${id}/publish`,{method:"POST"});setReviewing(null);loadDrafts();load()}
 async function discardDraft(id:string){if(!window.confirm("確定捨棄這則草稿？此動作無法復原。"))return;await fetch(`/api/problem-drafts/${id}`,{method:"DELETE"});setReviewing(null);loadDrafts()}
 async function reset(){if(!window.confirm("確定清除全部練習紀錄？此動作只會清除成績、耗時與筆記，題庫會保留。"))return;await fetch("/api/data",{method:"DELETE"});load()}
 async function removeQuestion(id:string,title:string){if(!window.confirm(`確定刪除「${title}」？題檔與此題練習紀錄都會一併刪除。`))return;await fetch(`/api/question/${id}`,{method:"DELETE"});load()}

 return <main>
  <nav className="appnav"><Link className="brand" href="/"><span>⊹</span> CODE CAMP<span className="tagline">工科賽・電腦軟體設計</span></Link><div className="header-actions"><button className="ghost-dark" onClick={()=>setSettingsOpen(true)}>⚙ 設定 API Key{hasApiKey?"（已設定）":""}</button><button onClick={()=>{setGenerationMessage("");setGenerating(true)}}>✦ AI 出題</button></div></nav>

  <section className="hero">
   <div className="hero-top"><div><p className="kicker">訓練總覽</p><h1>本週訓練狀態</h1><p className="lead">{recommendation}</p></div></div>
   <div className="stat-row">
    <div className="stat-tile"><span>連續訓練</span><strong className="streak-flame">🔥 {streak}</strong><small>天</small></div>
    <div className="stat-tile"><span>本週完成題數</span><strong>{thisWeekCompleted}</strong><DeltaBadge current={thisWeekCompleted} previous={lastWeekCompleted} hasBaseline={lastWeek.length>0}/></div>
    <div className="stat-tile"><span>本週練習時數</span><strong>{thisWeekMinutes}</strong><small>分鐘</small><DeltaBadge current={thisWeekMinutes} previous={lastWeekMinutes} hasBaseline={lastWeek.length>0} unit=" 分"/></div>
    <div className="stat-tile"><span>本週平均分數</span><strong>{thisWeek.length?thisWeekAvg:"—"}</strong>{thisWeek.length>0&&<DeltaBadge current={thisWeekAvg} previous={lastWeekAvg} hasBaseline={lastWeek.length>0}/>}</div>
   </div>
   <div className="strip" aria-label="近 14 天訓練紀錄">{last14Days.map(d=><i key={d.key} className={`${d.active?"on":""} ${d.isToday?"today":""}`.trim()} title={d.key}/>)}</div>
  </section>

  <section className="panel ability-panel">
   <p className="kicker">能力雷達</p><h2>一眼看出這週的強項與待加強項目</h2>
   <div className="ability-layout">
    {ability.length>0?<AbilityRadar data={ability}/>:<p className="generation-copy">尚無題庫資料。</p>}
    <div className="weak-list">
     {measured.length===0&&<p className="generation-copy">還沒有可比較的分數，完成幾題練習後這裡會列出最需要加強的項目。</p>}
     {measured.slice(0,3).map(x=><div className="weak-item" key={x.category}><div><b>{x.category}</b><small>{x.n} 題 · 已練習可比較分數</small></div><div className="weak-item-action"><span className="weak-score">{x.score}</span><button className="ghost-line" onClick={()=>{setCategoryFocus(x.category);document.getElementById("bank")?.scrollIntoView({behavior:"smooth"})}}>去練習</button></div></div>)}
    </div>
   </div>
  </section>

  <section id="bank" className="panel bank-panel">
   <p className="kicker">題庫</p><h2>依難度與完成度篩選，安排下一題</h2>
   <div className="chip-row">
    {["all","保底","核心","整合"].map(level=><button key={level} className={`chip${levelFilter===level?" active":""}`} onClick={()=>setLevelFilter(level)}>{level==="all"?"全部難度":level}</button>)}
    <button className={`chip${onlyIncomplete?" active":""}`} onClick={()=>setOnlyIncomplete(v=>!v)}>只看未完成</button>
    {categoryFocus&&<span className="focus-chip">{categoryFocus}<button type="button" className="focus-chip-clear" onClick={()=>setCategoryFocus(null)} aria-label="清除分類篩選">×</button></span>}
   </div>
   <div className="grid">{filteredQuestions.map(x=>{const isOfficial=/^\d{3}-\d+$/.test(x.id),isAi=x.id.startsWith("ai-"),style=levelStyle[x.level];return <article key={x.id}><div><em>{isAi?"AI 出題":x.year}</em><span style={style?{background:style.bg,color:style.fg}:undefined}>{x.level}</span></div><h3>{x.title}{completedIds.has(x.id)&&<span className="done-badge">✓ 已完成</span>}</h3><p>{x.note}</p><footer>{(isOfficial||isAi)&&<a className="practice-link" href={`/practice/${x.id}`}>進入作答工作區</a>}{!isAi&&<a href={`/question/${x.id}`}>閱讀題目</a>}<button onClick={()=>setActive(x)}>回填練習</button>{!isOfficial&&<button className="delete" onClick={()=>removeQuestion(x.id,x.title)}>刪除題目</button>}</footer></article>})}</div>
   {filteredQuestions.length===0&&<p className="generation-copy">目前篩選條件下沒有題目，試著調整篩選或清除分類。</p>}
  </section>

  {drafts.length>0&&<section className="panel drafts-panel"><p className="kicker">AI 出題草稿</p><h2>審核後才會加入正式題庫</h2><div className="grid">{drafts.map(x=><article key={x.id}><div><em>{difficultyLabel[x.difficulty]??x.difficulty}</em><span>{x.category}</span></div><h3>{x.title}</h3><p>{x.summary}</p><footer><button onClick={()=>setReviewing(x)}>查看並審核</button></footer></article>)}</div></section>}

  <section className="panel history-panel"><div className="maphead"><div><p className="kicker">練習紀錄</p><h2>回填的歷史成績</h2></div>{records.length>0&&<button className="delete" onClick={reset}>重設練習紀錄</button>}</div><p className="generation-copy">共 {records.length} 筆紀錄，完成 {records.filter(r=>r.status==="完成").length} 次。</p></section>

  {active&&<div className="modal" onClick={()=>setActive(null)}><form onSubmit={save} onClick={e=>e.stopPropagation()}><button type="button" onClick={()=>setActive(null)} aria-label="取消並關閉">×</button><p className="kicker">完成後回填</p><h2>{active.title}</h2><label>結果<select name="status"><option>完成</option><option>部分完成</option><option>未完成</option></select></label><label>分數<input name="score" type="number" min="0" max="100" required/></label><label>耗時（分）<input name="minutes" type="number" min="1" required/></label><label>筆記<textarea name="notes"/></label><button>儲存</button></form></div>}

  {settingsOpen&&<div className="modal" onClick={()=>setSettingsOpen(false)}><form onSubmit={saveApiKey} onClick={e=>e.stopPropagation()}><button type="button" onClick={()=>setSettingsOpen(false)} aria-label="取消並關閉">×</button><p className="kicker">BYOK</p><h2>設定你的 OpenAI API Key</h2><p className="generation-copy">AI 出題功能改由你自己的 OpenAI API Key 呼叫，Key 只會存在你瀏覽器的 localStorage，不會送到我們的伺服器保存，每次出題時才會隨請求一起帶上。</p><label>OpenAI API Key<input name="apiKey" type="password" autoComplete="off" defaultValue={getStoredOpenAiKey()} placeholder="sk-..."/></label><label>模型代號（選填）<input name="model" type="text" autoComplete="off" defaultValue={getStoredOpenAiModel()} placeholder="留空使用預設 gpt-4o-mini"/></label><p className="generation-note">若出現「does not have access to model」錯誤，代表你的 OpenAI 專案沒有該模型權限，請到 platform.openai.com 確認帳號可用的模型名稱，填在這裡覆蓋預設值。</p>{hasApiKey&&<button type="button" className="delete" onClick={clearApiKey}>清除已儲存的 Key</button>}<button>儲存</button></form></div>}

  {generating&&<div className="modal" onClick={()=>setGenerating(false)}><form onSubmit={generate} onClick={e=>e.stopPropagation()}><button type="button" onClick={()=>setGenerating(false)} aria-label="取消並關閉">×</button><p className="kicker">AI 題庫擴充</p><h2>依歷屆範圍產生原創題</h2><p className="generation-copy">題目會以高中／高職 C# 主控台作答為範圍，保持標準輸入輸出，才能由判題器評分。</p><label>難度<select name="difficulty" defaultValue="core"><option value="foundation">保底｜單一基礎能力，20–30 分鐘</option><option value="core">核心｜主要演算法或狀態模型，40–60 分鐘</option><option value="integration">整合｜兩項以上能力整合，70–100 分鐘</option></select></label><p className="generation-note">AI 題會先成為草稿；通過測資驗證與人工確認後，才會加入正式題庫。</p>{generationMessage&&<p className="generation-message" role="status">{generationMessage}</p>}<button>產生題目草稿</button></form></div>}

  {reviewing&&<div className="modal" onClick={()=>setReviewing(null)}><div className="review-panel" onClick={e=>e.stopPropagation()}><button type="button" onClick={()=>setReviewing(null)} aria-label="取消並關閉">×</button><p className="kicker">草稿審核 · {difficultyLabel[reviewing.difficulty]??reviewing.difficulty} · {reviewing.category}</p><h2>{reviewing.title}</h2><p>{reviewing.statement}</p><h3>輸入</h3><p>{reviewing.inputSpec}</p><h3>輸出</h3><p>{reviewing.outputSpec}</p><h3>限制</h3><ul>{reviewing.constraints.map((c,i)=><li key={i}>{c}</li>)}</ul><h3>範例</h3>{reviewing.examples.map((ex,i)=><div key={i} className="example"><pre>輸入：{ex.input}</pre><pre>輸出：{ex.output}</pre><small>{ex.explanation}</small></div>)}<h3>測資（{reviewing.tests.filter(t=>t.visibility==="public").length} 公開 ／ {reviewing.tests.filter(t=>t.visibility==="private").length} 私有）</h3><p className="generation-note">確認題意、規格與測資都正確無誤後再發布；發布後會立即出現在題庫並可進入作答工作區。</p><div className="review-actions"><button type="button" className="delete" onClick={()=>discardDraft(reviewing.id)}>捨棄草稿</button><button type="button" onClick={()=>publishDraft(reviewing.id)}>發布到題庫</button></div></div></div>}
 </main>;
}
