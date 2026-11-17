// يبني نسخة الطلاب: يحذف الإجابات والحلول من الصفحة، ويكتبها في answers.sql لقاعدة البيانات
import fs from "fs";
const [src,outHtml,outSql,outKeys]=process.argv.slice(2);
const s=fs.readFileSync(src,"utf8");
const a=s.indexOf("const P=[")+"const P=".length, b=s.indexOf("];\nconst SMAP=")+1;
const P=eval("("+s.slice(a,b)+")");
const normE=v=>String(v).toLowerCase().replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[−–]/g,"-")
  .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,m=>"^"+[...m].map(c=>"⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).join("")).replace(/\*\*/g,"^").replace(/[\s×*·{}()]/g,"");
const K={},out=[];
for(const p of P){
  const t=p.self?"self":p.parts?"parts":p.ch?"ch":"num";
  const k={t,sol:p.sol};
  if(t==="num"||t==="ch"){k.a=p.ans;if(p.tol!=null)k.tol=p.tol;if(p.rtol!=null)k.rtol=p.rtol;}
  if(t==="parts")k.parts=p.parts.map(q=>{const o={t:q.t};if(q.t==="expr")o.acc=[...new Set(q.acc.map(normE))];else{o.a=q.a;if(q.tol!=null)o.tol=q.tol;if(q.rtol!=null)o.rtol=q.rtol;}return o;});
  K[p.id]=k;
  const c={...p};for(const f of ["ans","ansText","sol","note","tol","rtol"])delete c[f];
  if(c.parts)c.parts=c.parts.map(q=>{const o={...q};for(const f of ["a","acc","show","tol","rtol"])delete o[f];return o;});
  out.push(c);
}
let lit="[\n"+out.map(o=>" "+JSON.stringify(o)).join(",\n")+"\n]";
if(/<\/script/i.test(lit))throw new Error("script tag in data");
let h=s.slice(0,a)+lit+s.slice(b);
// تأكد أنه لا يبقى أي حل أو إجابة نصية في الصفحة
for(const p of P){if(p.sol&&p.sol.length>25&&h.includes(p.sol))throw new Error("sol leaked "+p.id);}
fs.writeFileSync(outHtml,h);
fs.writeFileSync(outKeys,JSON.stringify(K));
const sq=v=>"'"+String(v).replace(/'/g,"''")+"'";
let sql=`-- مفاتيح الإجابات والحلول لمنصة مدرب الأولمبياد (${P.length} تمريناً)
-- شغّليه في SQL Editor بعد ملف olympiad-schema.sql. يمكن تشغيله أكثر من مرة.
begin;
delete from public.oc_keys;
insert into public.oc_keys (id, data) values
`+Object.entries(K).map(([id,k])=>`(${sq(id)}, ${sq(JSON.stringify(k))}::jsonb)`).join(",\n")+";\ncommit;\n";
fs.writeFileSync(outSql,sql);
console.log("items",P.length,"html",h.length,"sql",sql.length);
