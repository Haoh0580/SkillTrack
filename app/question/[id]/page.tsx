import { env } from "cloudflare:workers";
import { questions } from "../../lib/questions";

type StoredQuestion = { id: string; year: number; title: string; category: string; level: string; note: string; file: string; page: number };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const historical = questions.find((item) => item.id === id);
  const q = historical ?? await env.DB.prepare("SELECT * FROM resources WHERE id=?").bind(id).first<StoredQuestion>();
  if (!q) return <main className="question"><a href="/">← 回到題庫</a><h1>找不到題目</h1></main>;
  return <main className="question"><a href="/">← 回到題庫</a><p className="kicker">{q.year} 學年度 · {q.category} · {q.level}</p><h1>{q.title}</h1><p className="focus">練習焦點：{q.note}</p><div className="pdf"><iframe title={q.title} src={`${q.file}#page=${q.page}&view=FitH`}/></div><p className="source">已定位到題目起始頁；若題目跨頁，直接向下閱讀即可。</p></main>;
}
