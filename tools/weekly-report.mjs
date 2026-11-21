// التقرير الأسبوعي لمدرب الأولمبياد: يقرأ التقدم من Supabase ويرسل ملخصاً إلى تيليجرام.
// يشغّله GitHub Actions كل أحد (.github/workflows/weekly-report.yml)، ويمكن تشغيله يدوياً من تبويب Actions.
// يحتاج الأسرار: SUPABASE_SERVICE_KEY و TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID
// التقرير أرقام مجمّعة فقط: لا أسماء ولا إيميلات.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SB = process.env.SUPABASE_URL || "https://wulkwbybjeggejwfhtbc.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY;
const TG = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_CHAT_ID;
const GC = process.env.GOATCOUNTER_TOKEN, GC_SITE = process.env.GOATCOUNTER_SITE || "https://areej-projects.goatcounter.com";
const MOCK = process.env.MOCK_FILE; // للتجربة فقط
const DRY = process.env.DRY_RUN === "1";

// ── التمارين والمواضيع من الصفحة نفسها ──
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const grab = (a, b) => { const i = html.indexOf(a); return html.slice(i + a.length, html.indexOf(b, i)); };
const UNITS = eval("[" + grab("const UNITS=[", "];") + "]");
const SUBS = eval("[" + grab("const SUBS=[", "];") + "]");
const pa = html.indexOf("const P=[") + 8, pb = html.indexOf("];\nconst SMAP=") + 1;
const P = JSON.parse(html.slice(pa, pb));
const PB = Object.fromEntries(P.map(p => [p.id, p]));
const SUB = Object.fromEntries(SUBS.map(s => [s.id, s]));
const UOF = Object.fromEntries(UNITS.map(u => [u.id, u]));

// ── القراءة من Supabase ──
let mock = MOCK ? JSON.parse(fs.readFileSync(MOCK, "utf8")) : null;
async function rest(table, query = "", { count = false } = {}) {
  if (mock) return count ? (mock.counts[table] ?? null) : (mock[table] || []);
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/rest/v1/${table}?${query}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}`, ...(count ? { Prefer: "count=exact" } : {}) }
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    if (count) { const cr = r.headers.get("content-range") || ""; return Number(cr.split("/")[1]) || 0; }
    const rows = await r.json(); out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
const safeCount = async t => { try { return await rest(t, "select=*&limit=1", { count: true }); } catch { return null; } };

const now = mock?.now ? new Date(mock.now) : new Date();
const DAY = 864e5, w1 = new Date(now - 7 * DAY), w2 = new Date(now - 14 * DAY);
const fmt = d => d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", timeZone: "Asia/Riyadh" });

if (KEY && KEY.startsWith("sb_publishable_")) { console.error("المفتاح في SUPABASE_SERVICE_KEY هو المفتاح العام (sb_publishable_). ضعي بدله المفتاح السري الذي يبدأ بـ sb_secret_"); process.exit(1); }
if (!MOCK && (!KEY || !TG || !CHAT)) { console.error("ينقص سر من الأسرار: SUPABASE_SERVICE_KEY أو TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID"); process.exit(1); }

const rows = (await rest("progress", "select=user_id,problem_id,data,updated_at")).filter(r => PB[r.problem_id]);
const inW = (r, a, b) => { const t = new Date(r.updated_at); return t >= a && t < b; };
const thisW = rows.filter(r => inW(r, w1, now)), prevW = rows.filter(r => inW(r, w2, w1));
const users = rs => new Set(rs.map(r => r.user_id)).size;
const solved = rs => rs.filter(r => r.data && r.data.solved).length;
const [students, teachers, groups] = await Promise.all([safeCount("profiles"), safeCount("teachers"), safeCount("groups")]);

// المواضيع: الأكثر تدريباً هذا الأسبوع، والأصعب على كل البيانات
function bySub(rs) {
  const m = {};
  for (const r of rs) {
    const s = PB[r.problem_id].s, d = r.data || {};
    const x = m[s] || (m[s] = { n: 0, ok: 0, hints: 0, users: new Set() });
    x.n++; x.users.add(r.user_id); if (d.solved) x.ok++; x.hints += d.hints || 0;
  }
  return m;
}
const name = s => `${SUB[s].name} (${UOF[SUB[s].u].name})`;
const wk = bySub(thisW), all = bySub(rows);
const top = Object.entries(wk).sort((a, b) => b[1].n - a[1].n).slice(0, 3);
const hard = Object.entries(all).filter(([, x]) => x.n >= 5).map(([s, x]) => [s, x, x.ok / x.n]).sort((a, b) => a[2] - b[2]).slice(0, 3);
const pct = v => Math.round(v * 100) + "%";
const delta = (a, b) => b === 0 ? (a ? "جديد" : "بلا تغيير") : (a === b ? "بلا تغيير" : (a > b ? "▲ " : "▼ ") + Math.abs(Math.round((a - b) / b * 100)) + "%");
const e = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// ── الزوار من GoatCounter (اختياري: يعمل إذا وُجد GOATCOUNTER_TOKEN) ──
const day = d => d.toISOString().slice(0, 10);
async function gcGet(p, q) {
  if (mock) return mock.gc?.[p] ?? null;
  const r = await fetch(`${GC_SITE}/api/v0/${p}?${new URLSearchParams(q)}`, { headers: { Authorization: `Bearer ${GC}`, "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(`goatcounter ${p}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const PRETTY = [["/olympiad-coach/topics/", "صفحات المواضيع"], ["/olympiad-coach", "مدرب الأولمبياد"], ["/app", "حقيبة تحصيلي"], ["/-stem-smart-kits", "معامل STEM"], ["/masari-career-bot", "مساري"]];
const BOTS = { "bot-masari": "مساري", "bot-nafis": "نافس", "bot-qudrat": "قدراتي" };
const project = path => path === "/" ? "الصفحة الرئيسية" : (PRETTY.find(([p]) => path.startsWith(p)) || [null, path])[1];
let G = null;
if (GC || mock?.gc) {
  try {
    const cur = { start: day(w1), end: day(new Date(now - DAY)) }, prev = { start: day(w2), end: day(new Date(w1 - DAY)) };
    const [tc, tp, hits, refs] = await Promise.all([gcGet("stats/total", cur), gcGet("stats/total", prev), gcGet("stats/hits", { ...cur, limit: 50 }), gcGet("stats/toprefs", { ...cur, limit: 6 })]);
    const pages = {}, bots = {};
    for (const h of hits?.hits || []) {
      if (h.event || BOTS[h.path]) { if (BOTS[h.path]) bots[BOTS[h.path]] = (bots[BOTS[h.path]] || 0) + h.count; continue; }
      const k = project(h.path); pages[k] = (pages[k] || 0) + h.count;
    }
    G = { now: tc?.total ?? 0, prev: tp?.total ?? 0, pages: Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 6),
          refs: (refs?.stats || []).map(r => [r.name || "مباشر أو غير معروف", r.count]).sort((a, b) => b[1] - a[1]).slice(0, 5), bots };
  } catch (err) { console.error(String(err)); G = { error: true }; }
}

const L = [];
L.push(`<b>📊 التقرير الأسبوعي لمشاريعك</b>`);
L.push(`${fmt(w1)} – ${fmt(now)}`, "");
if (G && !G.error) {
  L.push(`<b>🌐 الزوار (كل المشاريع)</b>`);
  L.push(`زيارات: <b>${G.now}</b> (الأسبوع الماضي ${G.prev} · ${delta(G.now, G.prev)})`);
  if (G.pages.length) L.push(G.pages.map(([k, n]) => `• ${e(k)}: ${n}`).join("\n"));
  if (G.refs.length) L.push(`<b>من وين جوا</b>`, G.refs.map(([k, n]) => `• ${e(k)}: ${n}`).join("\n"));
  const b = Object.entries(G.bots); if (b.length) L.push(`<b>🤖 فتحوا البوتات من صفحاتك</b>`, b.map(([k, n]) => `• ${k}: ${n}`).join("\n"));
  L.push("");
} else if (G && G.error) L.push("⚠️ تعذّرت قراءة أرقام الزوار هذا الأسبوع.", "");
L.push(`<b>📘 المنصة: الطلاب المسجلون</b>`);
L.push(`👥 طلاب تدرّبوا: <b>${users(thisW)}</b> (الأسبوع الماضي ${users(prevW)} · ${delta(users(thisW), users(prevW))})`);
L.push(`✏️ تمارين اشتغلوا عليها: <b>${thisW.length}</b>، منها محلولة <b>${solved(thisW)}</b>`);
if (top.length) { L.push("", `<b>🔥 الأكثر تدريباً</b>`); top.forEach(([s, x], i) => L.push(`${i + 1}. ${e(name(s))}: تمارين ${x.n} · طلاب ${x.users.size}`)); }
if (hard.length) { L.push("", `<b>🧗 الأصعب على الطلاب</b> (نسبة الحل، كل الفترة)`); hard.forEach(([s, x, r], i) => L.push(`${i + 1}. ${e(name(s))}: ${pct(r)} · ${(x.hints / x.n).toFixed(1)} تلميح للتمرين`)); }
L.push("", `<b>الإجمالي</b>`);
if (students != null) L.push(`🎓 حسابات مسجلة: ${students}`);
L.push(`📚 طلاب تدرّبوا منذ البداية: ${users(rows)} · تمارين محلولة: ${solved(rows)}`);
if (teachers != null) L.push(`👩‍🏫 معلمون: ${teachers}${groups != null ? ` · مجموعات: ${groups}` : ""}`);
if (!thisW.length) L.push("", "ما فيه نشاط مسجل هذا الأسبوع. التدريب كضيف لا يُحفظ، فلا يظهر هنا.");
else L.push("", `<i>لا يشمل من تدرّب كضيف.</i>`);
const text = L.join("\n");

if (MOCK || DRY) { console.log(text); process.exit(0); }
const r = await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: CHAT, text, parse_mode: "HTML", disable_web_page_preview: true })
});
const j = await r.json();
if (!j.ok) { console.error("تيليجرام رفض الرسالة:", j.description); process.exit(1); }
console.log("أُرسل التقرير");
