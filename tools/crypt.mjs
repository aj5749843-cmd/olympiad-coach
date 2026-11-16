#!/usr/bin/env node
// مدرب الأولمبياد — أداة تشفير نسخة المراجعة
//
// فك التشفير للتعديل:   OC_PIN=الرقم node tools/crypt.mjs decrypt index.html source.html
// إعادة التشفير بعده:    OC_PIN=الرقم node tools/crypt.mjs encrypt source.html index.html
//
// لا تضيفي source.html إلى المستودع: ملف .gitignore يمنع ذلك، لأنه النسخة غير المشفّرة.
// لتغيير الرقم السري: فكّي بالرقم القديم ثم شفّري بالرقم الجديد.

import { readFileSync, writeFileSync } from "node:fs";

const ITER = 600000;
const FLAG = '<!--review-flag--><script>window.REVIEW_MODE=true;</script><!--/review-flag-->';
const { subtle } = globalThis.crypto;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u8 => Buffer.from(u8).toString("base64");
const unb64 = s => new Uint8Array(Buffer.from(s, "base64"));

async function keyFrom(pin, salt, iter) {
  const base = await subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function shell(payload) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>مدرب الأولمبياد · نسخة المراجعة</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230B827E'/%3E%3Cpath d='M16 6 8.5 25h15z M8.5 25l11.6-8.2' fill='none' stroke='white' stroke-width='2' stroke-linejoin='round'/%3E%3C/svg%3E">
<style>
:root{--brand:#0B827E;--hero:#0C8F8A;--hero2:#19B3AD;--ink:#2A3137;--muted:#69737B;--line:#DCE0E4;--bad:#B23F37;color-scheme:light}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{font-family:"IBM Plex Sans Arabic",Tahoma,"Segoe UI",sans-serif;background:radial-gradient(900px 500px at 15% 0%,var(--hero2),transparent 70%),var(--hero);color:var(--ink);display:grid;place-items:center;padding:20px}
.card{background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.18);padding:34px 30px;width:min(100%,380px);text-align:center}
.card svg{width:56px;height:56px}
h1{font-size:1.5rem;margin:12px 0 4px}
p{margin:0;color:var(--muted)}
form{display:flex;flex-direction:column;gap:10px;margin-top:22px;text-align:start}
label{font-weight:600;font-size:.92rem}
input{font:inherit;font-size:1.3rem;letter-spacing:.3em;text-align:center;direction:ltr;border:1px solid var(--line);border-radius:10px;padding:10px}
input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px #E2F4F3}
button{font:inherit;font-weight:700;background:var(--brand);color:#fff;border:0;border-radius:10px;padding:11px;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}
#msg{min-height:1.5em;color:var(--bad);font-weight:600;text-align:center}
:focus-visible{outline:3px solid #F5B940;outline-offset:2px}
</style>
</head>
<body>
<main class="card">
  <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0B827E"/><path d="M16 6 8.5 25h15z M8.5 25l11.6-8.2" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>
  <h1>مدرب الأولمبياد</h1>
  <p>نسخة المراجعة محمية برقم سري.</p>
  <form id="f">
    <label for="pin">الرقم السري</label>
    <input id="pin" type="password" inputmode="numeric" autocomplete="current-password" required>
    <button id="go" type="submit">دخول</button>
    <p id="msg" role="alert"></p>
  </form>
</main>
<script type="application/json" id="payload">${JSON.stringify(payload)}</script>
<script>
(function(){
  var d=JSON.parse(document.getElementById("payload").textContent);
  var b=function(s){return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0)})};
  function unlock(pin){
    var te=new TextEncoder();
    return crypto.subtle.importKey("raw",te.encode(pin),"PBKDF2",false,["deriveKey"])
      .then(function(k){return crypto.subtle.deriveKey({name:"PBKDF2",salt:b(d.salt),iterations:d.iter,hash:"SHA-256"},k,{name:"AES-GCM",length:256},false,["decrypt"])})
      .then(function(k){return crypto.subtle.decrypt({name:"AES-GCM",iv:b(d.iv)},k,b(d.ct))})
      .then(function(pt){return new TextDecoder().decode(pt)});
  }
  function show(html){document.open();document.write(html);document.close();}
  var f=document.getElementById("f"),pin=document.getElementById("pin"),go=document.getElementById("go"),msg=document.getElementById("msg");
  if(!window.crypto||!crypto.subtle){msg.textContent="افتحي الرابط عبر https في متصفح حديث.";go.disabled=true;return;}
  var saved=null;try{saved=sessionStorage.getItem("oc-pin")}catch(e){}
  if(saved){unlock(saved).then(show,function(){try{sessionStorage.removeItem("oc-pin")}catch(e){}});}
  f.addEventListener("submit",function(e){
    e.preventDefault();msg.textContent="";go.disabled=true;go.textContent="جارٍ الفتح…";
    var v=pin.value.trim();
    unlock(v).then(function(html){try{sessionStorage.setItem("oc-pin",v)}catch(e){}show(html);},
      function(){msg.textContent="الرقم السري غير صحيح.";go.disabled=false;go.textContent="دخول";pin.select();});
  });
  pin.focus();
})();
</script>
</body>
</html>
`;
}

async function encrypt(src, out, pin) {
  let html = readFileSync(src, "utf8");
  if (!html.includes(FLAG)) html = html.replace(/<head>/i, "<head>\n" + FLAG);
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(pin, salt, ITER);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(html)));
  writeFileSync(out, shell({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
  console.log(`شُفّر ${src} ← ${out}`);
}

async function decrypt(src, out, pin) {
  const m = readFileSync(src, "utf8").match(/<script type="application\/json" id="payload">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("لم أجد البيانات المشفّرة في الملف");
  const d = JSON.parse(m[1]);
  const key = await keyFrom(pin, unb64(d.salt), d.iter);
  let html;
  try { html = dec.decode(await subtle.decrypt({ name: "AES-GCM", iv: unb64(d.iv) }, key, unb64(d.ct))); }
  catch { throw new Error("الرقم السري غير صحيح"); }
  writeFileSync(out, html.replace("\n" + FLAG, "").replace(FLAG, ""));
  console.log(`فُك ${src} ← ${out}`);
}

const [cmd, src, out] = process.argv.slice(2);
const pin = process.env.OC_PIN;
if (!["encrypt", "decrypt"].includes(cmd) || !src || !out || !pin) {
  console.error("الاستخدام: OC_PIN=الرقم node tools/crypt.mjs encrypt|decrypt <من> <إلى>");
  process.exit(1);
}
(cmd === "encrypt" ? encrypt : decrypt)(src, out, pin).catch(e => { console.error(e.message); process.exit(1); });
