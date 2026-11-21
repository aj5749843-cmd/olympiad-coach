// يبني صفحات المواضيع وملفات الظهور في محركات البحث وأدوات الذكاء الاصطناعي.
// شغّليه بعد build-student.mjs في كل مرة تتغير فيها التمارين:
//   node tools/build-seo.mjs
// يقرأ التمارين من index.html (نسخة الطلاب، بلا حلول) ويكتب:
//   topics/*.html · sitemap.xml · llms.txt
// ويضيف إلى index.html (مرة واحدة فقط): وسوم البحث، ورابط المواضيع، والرابط المباشر للموضوع.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://aj5749843-cmd.github.io/olympiad-coach/";
const SITE = "مدرب الأولمبياد";
const TODAY = new Date().toISOString().slice(0, 10);

const idxPath = path.join(ROOT, "index.html");
let html = fs.readFileSync(idxPath, "utf8");
const grab = (start, end) => {
  const a = html.indexOf(start); if (a < 0) throw new Error("لم أجد " + start);
  const b = html.indexOf(end, a); return html.slice(a + start.length, b);
};
const UNITS = eval("[" + grab("const UNITS=[", "];") + "]");
const SUBS = eval("[" + grab("const SUBS=[", "];") + "]");
const a = html.indexOf("const P=[") + "const P=".length, b = html.indexOf("];\nconst SMAP=") + 1;
const P = JSON.parse(html.slice(a, b));
for (const p of P) if (p.sol || p.ans != null || p.ansText) throw new Error("index.html فيه حلول: شغّلي build-student أولاً (" + p.id + ")");
UNITS.forEach(u => u.subj = u.subj || "math");
const UOF = Object.fromEntries(UNITS.map(u => [u.id, u]));
const T = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/seo-topics.json"), "utf8"));
for (const s of SUBS) if (!T[s.id]) throw new Error("لا يوجد وصف للموضوع " + s.id + " في tools/seo-topics.json");

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const strip = s => String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const url = s => BASE + "topics/" + T[s.id].slug + ".html";
const track = s => UOF[s.u].subj === "sci" ? "حقيبة العلوم" : s.t === 2 ? "حقيبة رياضيات 2 (كبار)" : "حقيبتا رياضيات 1 و2 (ناشئين وكبار)";
const nAr = n => n === 1 ? "تمرين واحد" : n === 2 ? "تمرينان" : n <= 10 ? n + " تمارين" : n + " تمريناً";
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const firstSentence = t => t.split(/(?<=[.:])\s/)[0];

const CSS = `
:root{--bg:#F4F5F6;--surface:#fff;--ink:#2A3137;--muted:#69737B;--line:#DCE0E4;--tint:#E2F4F3;--brand:#0B827E;--hero:#0C8F8A;--hero-2:#19B3AD;
--display:"Readex Pro","IBM Plex Sans Arabic",Tahoma,sans-serif;--body:"IBM Plex Sans Arabic",Tahoma,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#14181B;--surface:#1D2327;--ink:#EEF1F3;--muted:#A2ACB4;--line:#333B42;--tint:#173836;--brand:#3CC8C1;--hero:#0A6460;--hero-2:#0F8782}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);line-height:1.9;font-size:17px}
a{color:var(--brand)}.wrap{max-width:860px;margin:0 auto;padding:0 20px}
header.bar{background:var(--surface);border-bottom:1px solid var(--line)}
header.bar .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px}
.logo{font-family:var(--display);font-weight:700;color:var(--ink);text-decoration:none;display:flex;align-items:center;gap:10px}
.logo i{width:30px;height:30px;border-radius:8px;background:var(--brand);display:inline-block}
.hero{background:linear-gradient(135deg,var(--hero),var(--hero-2));color:#fff;padding:36px 0 30px}
.hero h1{font-family:var(--display);font-size:clamp(1.6rem,4.5vw,2.3rem);line-height:1.4;margin:6px 0 10px}
.crumbs{font-size:.88rem;opacity:.9}.crumbs a{color:#fff}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.meta li{background:rgba(255,255,255,.16);border-radius:999px;padding:2px 12px;font-size:.9rem}
main{padding:28px 0 40px}
section{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin:0 0 18px}
h2{font-family:var(--display);font-size:1.25rem;margin:0 0 10px}
.chips{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:0;list-style:none}
.chips li{background:var(--tint);border-radius:999px;padding:2px 12px;font-size:.92rem}
.ex{border-top:1px solid var(--line);padding-top:16px;margin-top:16px}.ex:first-of-type{border-top:0;margin-top:0;padding-top:0}
.ex h3{font-family:var(--display);font-size:1.08rem;margin:0 0 4px}
.lv{font-size:.85rem;color:var(--muted)}
.ex ol,.ex ul{margin:6px 0;padding-inline-start:26px}
.src{font-size:.85rem;color:var(--muted);margin:6px 0 0}
.m{font-family:var(--mono);direction:ltr;unicode-bidi:isolate;font-size:.94em}
table.ftbl{border-collapse:collapse;margin:6px auto;font-family:var(--mono)}
table.ftbl td,table.ftbl th{border:1.5px solid currentColor;min-width:22px;height:28px;padding:2px 6px;text-align:center;font-size:.9rem}
table.ftbl.arith td{border:0;font-size:1.15rem;font-weight:700}table.ftbl.arith tr:nth-child(3) td{border-bottom:2px solid currentColor}
.fig{margin:12px 0 0;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;place-items:center;overflow-x:auto}
.fig svg{width:min(100%,300px);height:auto;direction:ltr}
.fig .s{stroke:var(--ink);stroke-width:2;fill:none}.fig .s.a{stroke:var(--brand)}
.fig .c{fill:var(--brand);fill-opacity:.1;stroke:var(--brand);stroke-width:2}
.fig text{fill:var(--ink);font-family:var(--mono);font-size:14px;font-weight:600}.fig .dot{fill:var(--ink)}.fig .grid{stroke:var(--line);stroke-width:1;fill:none}
.cta{display:inline-block;background:var(--brand);color:#fff;text-decoration:none;font-family:var(--display);font-weight:600;padding:12px 26px;border-radius:12px;margin-top:6px}
.hero .cta{background:#fff;color:var(--hero)}
.list{list-style:none;padding:0;margin:0;display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
.list a{display:block;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px 14px;text-decoration:none;color:var(--ink)}
.list small{display:block;color:var(--muted)}
footer{border-top:1px solid var(--line);padding:22px 0;font-size:.9rem;color:var(--muted)}
`;

const page = ({ title, desc, canon, body, schema }) => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta name="theme-color" content="#0B827E">
<meta property="og:type" content="article">
<meta property="og:locale" content="ar_SA">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${BASE}og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${BASE}og.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Readex+Pro:wght@600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>${CSS}</style>
${schema.map(ld).join("\n")}
</head>
<body>
<header class="bar"><div class="wrap"><a class="logo" href="../"><i aria-hidden="true"></i>${SITE}</a><a href="./">كل المواضيع</a></div></header>
${body}
<footer><div class="wrap">التمارين من حقائب المرحلة الأولى لأولمبياد العلوم والرياضيات الوطني «نسمو» المنشورة على موقع موهبة، ويُذكر مصدر كل تمرين تحته. · <a href="../">${SITE}</a> · <a href="./">كل المواضيع</a></div></footer>
</body>
</html>
`;

// يختار أمثلة متدرجة: مثال من كل مستوى، ويفضّل النص القصير
function examples(list) {
  const byLv = {};
  for (const p of list) (byLv[p.lv] = byLv[p.lv] || []).push(p);
  const out = [];
  for (const lv of Object.keys(byLv).sort()) {
    const c = byLv[lv].slice().sort((x, y) => (x.q.length + JSON.stringify(x.parts || "").length) - (y.q.length + JSON.stringify(y.parts || "").length));
    out.push(c[0]);
  }
  for (const p of list) { if (out.length >= 3) break; if (!out.includes(p)) out.push(p); }
  return out.slice(0, 3).sort((x, y) => x.lv - y.lv);
}
const exHTML = p => `<div class="ex">
<h3>${esc(p.title)}</h3><div class="lv">المستوى ${p.lv}${p.lv === 3 ? " · تحدٍّ" : ""}${p.strat ? " · " + esc(p.strat) : ""}</div>
<p>${p.q}</p>
${p.parts ? `<ol type="a">${p.parts.map(q => `<li>${q.e || ""}</li>`).join("")}</ol>` : ""}
${p.ch ? `<ul>${p.ch.map(c => `<li>${c}</li>`).join("")}</ul>` : ""}
${p.fig ? `<figure class="fig">${p.fig}</figure>` : ""}
<p class="src">المصدر: ${esc(p.src || "")}</p>
</div>`;

fs.mkdirSync(path.join(ROOT, "topics"), { recursive: true });
const made = [];
for (const s of SUBS) {
  const u = UOF[s.u], list = P.filter(p => p.s === s.id);
  if (!list.length) continue;
  const lvC = [1, 2, 3].map(l => list.filter(p => p.lv === l).length);
  const strats = [...new Set(list.map(p => strip(p.strat || "").replace(/⟪.*?⟫/g, "").trim()).filter(Boolean))].slice(0, 12);
  const sibs = SUBS.filter(x => x.u === s.u && x.id !== s.id && P.some(p => p.s === x.id));
  const intro = T[s.id].intro;
  const title = `تمارين أولمبياد ${s.name} | ${SITE}`;
  const desc = `${firstSentence(intro)} ${nAr(list.length)} من حقائب نسمو بمستويات متدرجة وتلميحات، لطلاب المرحلة المتوسطة.`;
  const go = `../?s=${s.id}`;
  const body = `<div class="hero"><div class="wrap">
<nav class="crumbs" aria-label="مسار التنقل"><a href="../">${SITE}</a> › <a href="./">المواضيع</a> › ${esc(u.name)}</nav>
<h1>تمارين أولمبياد: ${esc(s.name)}</h1>
<ul class="meta"><li>${esc(u.name)}</li><li>${track(s)}</li><li>${nAr(list.length)}</li><li>المرحلة المتوسطة</li></ul>
<p style="margin:16px 0 0"><a class="cta" href="${go}">ابدأ التدريب على هذا الموضوع</a></p>
</div></div>
<main><div class="wrap">
<section><h2>عن الموضوع</h2><p>${esc(intro)}</p>
<p>في المنصة ${nAr(list.length)} في هذا الموضوع: ${lvC[0]} في المستوى الأول، و${lvC[1]} في الثاني، و${lvC[2]} تحدياً في الثالث. يحل الطالب على السبورة، ويطلب تلميحاً عند الحاجة، ويُتحقق من إجابته فوراً.</p></section>
${strats.length ? `<section><h2>أفكار وطرق تتدرب عليها</h2><ul class="chips">${strats.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>` : ""}
<section><h2>أمثلة من الحقيبة</h2>
${examples(list).map(exHTML).join("\n")}
<p style="margin-top:18px"><a class="cta" href="${go}">حلّ هذه التمارين وغيرها في المنصة</a></p>
<p class="src">الحلول والتلميحات داخل المنصة، ولا تُعرض هنا.</p></section>
${sibs.length ? `<section><h2>مواضيع أخرى في ${esc(u.name)}</h2><ul class="list">${sibs.map(x => `<li><a href="${T[x.id].slug}.html">${esc(x.name)}<small>${nAr(P.filter(p => p.s === x.id).length)}</small></a></li>`).join("")}</ul></section>` : ""}
</div></main>`;
  const schema = [{
    "@context": "https://schema.org", "@type": "LearningResource", name: `تمارين أولمبياد: ${s.name}`, description: intro,
    url: url(s), inLanguage: "ar", learningResourceType: ["تمارين", "Practice problems"], educationalLevel: "المرحلة المتوسطة",
    teaches: [s.name, ...strats.slice(0, 6)], about: { "@type": "Thing", name: u.name },
    audience: { "@type": "EducationalAudience", educationalRole: "student" }, isAccessibleForFree: true,
    numberOfItems: list.length, timeRequired: undefined,
    isBasedOn: { "@type": "CreativeWork", name: "حقائب المرحلة الأولى لأولمبياد العلوم والرياضيات الوطني (نسمو)", publisher: { "@type": "Organization", name: "موهبة" } },
    isPartOf: { "@type": "WebSite", name: SITE, url: BASE }, dateModified: TODAY
  }, {
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE, item: BASE },
      { "@type": "ListItem", position: 2, name: "المواضيع", item: BASE + "topics/" },
      { "@type": "ListItem", position: 3, name: s.name, item: url(s) }]
  }];
  fs.writeFileSync(path.join(ROOT, "topics", T[s.id].slug + ".html"), page({ title, desc, canon: url(s), body, schema }));
  made.push({ s, u, n: list.length });
}

// صفحة كل المواضيع
const hubBody = `<div class="hero"><div class="wrap">
<nav class="crumbs"><a href="../">${SITE}</a> › المواضيع</nav>
<h1>مواضيع التدريب على أولمبياد الرياضيات والعلوم</h1>
<ul class="meta"><li>${made.length} موضوعاً</li><li>${nAr(P.length)}</li><li>المرحلة المتوسطة</li></ul>
<p style="margin:16px 0 0"><a class="cta" href="../">افتح المنصة</a></p>
</div></div>
<main><div class="wrap">
<section><h2>عن المنصة</h2><p>منصة مجانية لتدريب طلاب المرحلة المتوسطة على أولمبياد العلوم والرياضيات الوطني «نسمو»، وفق محاور حقائب المرحلة الأولى: رياضيات 1 (ناشئين) ورياضيات 2 (كبار) والعلوم. تظهر كل مسألة على سبورة، ويكتب الطالب حلّه ويطلب تلميحاً عند الحاجة، ويتابع تقدمه في خريطة مهارات. ويستطيع المعلم متابعة طلابه بعد موافقتهم.</p></section>
${UNITS.map(u => { const m = made.filter(x => x.u.id === u.id); return m.length ? `<section><h2>${esc(u.name)}</h2><ul class="list">${m.map(x => `<li><a href="${T[x.s.id].slug}.html">${esc(x.s.name)}<small>${nAr(x.n)}</small></a></li>`).join("")}</ul></section>` : ""; }).join("\n")}
</div></main>`;
fs.writeFileSync(path.join(ROOT, "topics", "index.html"), page({
  title: `مواضيع أولمبياد الرياضيات والعلوم للمتوسط | ${SITE}`,
  desc: `${made.length} موضوعاً و${nAr(P.length)} من حقائب نسمو في الجبر والهندسة ونظرية الأعداد والتراكيب والفيزياء والكيمياء والأحياء، بتلميحات ومستويات متدرجة.`,
  canon: BASE + "topics/", body: hubBody,
  schema: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "مواضيع التدريب على أولمبياد الرياضيات والعلوم", url: BASE + "topics/", inLanguage: "ar",
    mainEntity: { "@type": "ItemList", itemListElement: made.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.s.name, url: url(x.s) })) } }]
}));

// خريطة الموقع
const urls = [BASE, BASE + "topics/", ...made.map(x => url(x.s))];
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}
</urlset>
`);

// لا نكتب robots.txt: المحركات تقرؤه من جذر النطاق فقط (aj5749843-cmd.github.io/robots.txt)
// لا من مجلد المشروع، وعدم وجوده يعني أن كل المحركات وأدوات الذكاء الاصطناعي مسموح لها.

// llms.txt: ملخص للمنصة لأدوات الذكاء الاصطناعي
fs.writeFileSync(path.join(ROOT, "llms.txt"), `# ${SITE} · رياضيات وعلوم

> منصة مجانية باللغة العربية لتدريب طلاب المرحلة المتوسطة في السعودية على أولمبياد العلوم والرياضيات الوطني «نسمو». فيها ${nAr(P.length)} مأخوذة من حقائب المرحلة الأولى المنشورة على موقع موهبة (رياضيات 1 للناشئين، ورياضيات 2 للكبار، والعلوم)، مع ذكر مصدر كل تمرين.

- يحل الطالب المسألة على سبورة، ويطلب تلميحات متدرجة، ويُتحقق من إجابته فوراً، ويتابع تقدمه في خريطة مهارات.
- يمكن التدريب ضيفاً دون تسجيل، أو الدخول بالإيميل لحفظ التقدم.
- يستطيع المعلم متابعة تقدم طلابه بعد موافقتهم، وتنزيله ملف CSV.
- مجانية ومتاحة على: ${BASE}

## المنصة
- [${SITE}](${BASE}): المنصة نفسها
- [كل المواضيع](${BASE}topics/): فهرس المواضيع ${made.length}

${UNITS.map(u => { const m = made.filter(x => x.u.id === u.id); return m.length ? `## ${u.name}\n${m.map(x => `- [${x.s.name}](${url(x.s)}): ${firstSentence(T[x.s.id].intro)} (${nAr(x.n)})`).join("\n")}` : ""; }).filter(Boolean).join("\n\n")}
`);

// تعديلات index.html: تضاف مرة واحدة، وتعاد إضافتها لو أعيد بناء الصفحة
const HEAD_MARK = "<!-- seo:head -->";
if (!html.includes(HEAD_MARK)) {
  html = html.replace('<meta property="og:image" content="og.png">', `<meta property="og:image" content="${BASE}og.png">`)
             .replace('<meta name="twitter:image" content="og.png">', `<meta name="twitter:image" content="${BASE}og.png">`);
  const headAdd = `${HEAD_MARK}
<link rel="canonical" href="${BASE}">
<meta property="og:url" content="${BASE}">
<meta property="og:site_name" content="${SITE}">
${ld({ "@context": "https://schema.org", "@graph": [
  { "@type": "WebSite", "@id": BASE + "#site", name: SITE, url: BASE, inLanguage: "ar" },
  { "@type": "WebApplication", name: SITE + " · رياضيات وعلوم", url: BASE, applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: "ar",
    description: "منصة مجانية لتدريب طلاب المرحلة المتوسطة على أولمبياد العلوم والرياضيات الوطني (نسمو)، بتمارين من حقائب موهبة وتلميحات متدرجة وخريطة مهارات.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "SAR" }, audience: { "@type": "EducationalAudience", educationalRole: "student" },
    isAccessibleForFree: true, image: BASE + "og.png" }] })}
`;
  html = html.replace("</head>", headAdd + "</head>");
}
const FOOT_MARK = "<!-- seo:foot -->";
if (!html.includes(FOOT_MARK)) {
  html = html.replace(/(<footer><div class="wrap">)([\s\S]*?)(<\/div><\/footer>)/, `$1$2 ${FOOT_MARK}· <a href="topics/">مواضيع التدريب</a>$3`);
  if (!html.includes(FOOT_MARK)) throw new Error("لم أجد التذييل في index.html");
}
const LINK_MARK = "/* seo:deeplink */";
if (!html.includes(LINK_MARK)) {
  const anchor = 'route();renderAll();if(location.hash==="#train")renderWork(true);';
  if (!html.includes(anchor)) throw new Error("لم أجد مكان الرابط المباشر في index.html");
  const code = `${LINK_MARK}(function(){try{const q=new URLSearchParams(location.search).get("s");if(!q||!SUB[q])return;const sci=UOF[SUB[q].u].subj==="sci";if(sci)S.track=3;else if(S.track===3)S.track=SUB[q].t===2?2:1;else if(SUB[q].t===2)S.track=2;let v=vis().filter(p=>p.s===q);if(!v.length&&!sci){S.track=S.track===1?2:1;v=vis().filter(p=>p.s===q);}if(v.length){S.cur=(v.find(p=>!(S.p[p.id]&&S.p[p.id].solved))||v[0]).id;save();}history.replaceState(null,"",location.pathname+"#train");}catch(e){}})();\n`;
  html = html.replace(anchor, code + anchor);
}
fs.writeFileSync(idxPath, html);
console.log("صفحات:", made.length + 1, "· روابط في الخريطة:", urls.length, "· تمارين:", P.length);
