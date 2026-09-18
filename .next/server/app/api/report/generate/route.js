"use strict";(()=>{var e={};e.id=8490,e.ids=[8490],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},2007:e=>{e.exports=require("pdf-lib")},5315:e=>{e.exports=require("path")},2761:e=>{e.exports=require("node:async_hooks")},7561:e=>{e.exports=require("node:fs")},1747:e=>{e.exports=require("node:readline")},8536:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>k,patchFetch:()=>B,requestAsyncStorage:()=>R,routeModule:()=>N,serverHooks:()=>D,staticGenerationAsyncStorage:()=>$});var o={};r.r(o),r.d(o,{POST:()=>I,maxDuration:()=>O});var n=r(9303),a=r(8716),i=r(670),s=r(7070),l=r(6097),c=r(9115),d=r(7709),p=r(474),u=r(2007);let m=(0,u.rgb)(.949,.576,.216),h=(0,u.rgb)(.039,.11,.18);(0,u.rgb)(.071,.18,.29);let f=(0,u.rgb)(.957,.969,.984),g=(0,u.rgb)(.051,.118,.18),y=(0,u.rgb)(.369,.49,.608),w=(0,u.rgb)(.153,.663,.42),x=(0,u.rgb)(.91,.333,.333),S=(0,u.rgb)(.949,.576,.216),A=(0,u.rgb)(.898,.918,.945),b=(0,u.rgb)(1,1,1),E=(0,u.rgb)(.949,.576,.216),T={overview:"Full Stair View",riser_front:"Riser Height",rotate_90:"Nosing Check",nosing:"Nosing Close-Up",handrail:"Handrail Height",alt_angle:"Stair Width",tread_top:"Tread Depth"};async function _(e){let{reportText:t,fields:r,frames:o,codeLabel:n,location:a,date:i}=e,s=await u.PDFDocument.create();s.setTitle(`stAIrcode Compliance Report — ${a||n}`),s.setAuthor("stAIrcode by Just Open Technologies Inc."),s.setSubject("Pre-Inspection Stair Compliance Report");let l=await s.embedFont(u.StandardFonts.HelveticaBold),c=await s.embedFont(u.StandardFonts.Helvetica),d=s.addPage([595.28,841.89]),p=821.89;function _(e){p-e<50&&(d=s.addPage([595.28,841.89]),p=791.89)}d.drawRectangle({x:0,y:741.89,width:595.28,height:100,color:h});for(let e=-80;e<675.28;e+=22)d.drawRectangle({x:e,y:741.89,width:11,height:100,color:E,opacity:.35});d.drawRectangle({x:40,y:749.89,width:515.28,height:82,color:h}),d.drawText("st",{x:239.64,y:803.89,size:20,font:l,color:b}),d.drawText("AI",{x:267.64,y:803.89,size:20,font:l,color:m}),d.drawText("rcode",{x:289.64,y:803.89,size:20,font:l,color:b});let v="Stair Compliance Report",O=l.widthOfTextAtSize(v,16);d.drawText(v,{x:297.64-O/2,y:779.89,size:16,font:l,color:b});let P=`${n}${a?" \xb7 "+a:""} \xb7 ${i}`,C=c.widthOfTextAtSize(P,9);d.drawText(P,{x:297.64-C/2,y:761.89,size:9,font:c,color:(0,u.rgb)(.576,.729,.831)}),p=726.89;let I=[{label:"PASSED",val:r.filter(e=>!0===e.pass).length,color:w},{label:"FAILED",val:r.filter(e=>!1===e.pass).length,color:x},{label:"NOT ASSESSED",val:r.filter(e=>null==e.value&&!e.clearAbove).length,color:S}],N=495.28/3-8,R=50;for(let e of I){d.drawRectangle({x:R,y:p-44,width:N,height:44,color:f,borderColor:A,borderWidth:.5});let t=String(e.val),r=l.widthOfTextAtSize(t,20);d.drawText(t,{x:R+N/2-r/2,y:p-24,size:20,font:l,color:e.color});let o=c.widthOfTextAtSize(e.label,7);d.drawText(e.label,{x:R+N/2-o/2,y:p-38,size:7,font:c,color:y}),R+=N+12}p-=60;let $=Object.entries(o).filter(([e,t])=>T[e]&&t&&t.length>100);if($.length>0){_(30),d.drawRectangle({x:50,y:p-22,width:495.28,height:22,color:h}),d.drawText("MEASUREMENT PHOTOS",{x:58,y:p-16,size:9,font:l,color:b}),p-=30,d.drawText(`${$.length} of ${Object.keys(T).length} positions captured during this inspection.`,{x:50,y:p,size:8,font:c,color:y}),p-=16;for(let e=0;e<$.length;e+=2){_(160);let t=$.slice(e,e+2);for(let e=0;e<t.length;e++){let[r,o]=t[e],n=50+253.64*e,a=p-130;d.drawRectangle({x:n,y:a,width:241.64,height:130,borderColor:A,borderWidth:.5,color:f});try{let e;let t=o.startsWith("data:")?o.split(",")[1]:o,r=Uint8Array.from(Buffer.from(t,"base64"));try{e=await s.embedJpg(r)}catch{e=await s.embedPng(r)}let{width:i,height:l}=e,c=Math.min(241.64/i,130/l),p=i*c,u=l*c,m=n+(241.64-p)/2,h=a+(130-u)/2;d.drawImage(e,{x:m,y:h,width:p,height:u})}catch{d.drawText("Photo unavailable",{x:n+120.82-30,y:a+65,size:8,font:c,color:y})}let i=T[r]??r,u=l.widthOfTextAtSize(i,8);d.drawText(i,{x:n+120.82-u/2,y:a-14,size:8,font:l,color:g})}p-=156}p-=8}_(60),d.drawRectangle({x:50,y:p-22,width:495.28,height:22,color:h}),d.drawText("COMPLIANCE ANALYSIS",{x:58,y:p-16,size:9,font:l,color:b}),p-=30,d.drawRectangle({x:50,y:p-18,width:495.28,height:18,color:f}),d.drawText("Measurement",{x:54,y:p-13,size:8,font:l,color:y}),d.drawText("Value",{x:270,y:p-13,size:8,font:l,color:y}),d.drawText("Result",{x:370,y:p-13,size:8,font:l,color:y}),p-=18;for(let e=0;e<r.length;e++){_(20);let t=r[e],o=e%2==0?b:f;d.drawRectangle({x:50,y:p-18,width:495.28,height:18,color:o,borderColor:A,borderWidth:.25});let n=t.clearAbove?"Clear":null!=t.value?`${Math.round(t.value)}mm`:"Not captured",a=null!=t.value||t.clearAbove?!0===t.pass?"PASS":!1===t.pass?"FAIL":"N/A":"NOT ASSESSED",i="PASS"===a?w:"FAIL"===a?x:S;d.drawText(t.label,{x:54,y:p-13,size:8,font:c,color:g}),d.drawText(n,{x:270,y:p-13,size:8,font:c,color:g}),d.drawText(a,{x:370,y:p-13,size:8,font:l,color:i}),p-=18}for(let e of(p-=12,_(50),d.drawRectangle({x:50,y:p-22,width:495.28,height:22,color:h}),d.drawText("DETAILED ASSESSMENT",{x:58,y:p-16,size:9,font:l,color:b}),p-=30,t.split("\n"))){let t=e.trim();if(!t){p-=6;continue}let r=/^[0-9]+\.\s+[A-Z\s]+$/.test(t),o=r?10:9,n=r?l:c,a=r?m:g;r&&(_(20),p-=4);let i=t.split(" "),s="";for(let e of i){let t=s?`${s} ${e}`:e;n.widthOfTextAtSize(t,o)>495.28&&s?(_(o+4),d.drawText(s,{x:50,y:p,size:o,font:n,color:a}),p-=o+3,s=e):s=t}s&&(_(o+4),d.drawText(s,{x:50,y:p,size:o,font:n,color:a}),p-=o+3),r&&(p-=3)}_(40),p-=12,d.drawLine({start:{x:50,y:p},end:{x:545.28,y:p},thickness:.5,color:A}),p-=12;let D=`Pre-inspection AI analysis only — not a certified building inspection. Accuracy \xb19.5–25mm. Always verify against ${n} with your local authority. staircode.app \xb7 \xa9 ${new Date().getFullYear()} Just Open Technologies Inc.`.split(" "),k="";for(let e of D){let t=k?`${k} ${e}`:e;if(c.widthOfTextAtSize(t,7.5)>495.28&&k){let t=c.widthOfTextAtSize(k,7.5);d.drawText(k,{x:297.64-t/2,y:p,size:7.5,font:c,color:y}),p-=11,k=e}else k=t}if(k){let e=c.widthOfTextAtSize(k,7.5);d.drawText(k,{x:297.64-e/2,y:p,size:7.5,font:c,color:y})}let B=await s.save();return Buffer.from(B)}var v=r(8336);let O=60,P=process.env.NEXT_PUBLIC_SURVEY_URL??"https://tally.so/r/1AMRbW";async function C(e,t,r,o,n,a={},i=[]){let s=process.env.RESEND_API_KEY;if(!s)return console.warn("[report/generate] No RESEND_API_KEY"),!1;let l=process.env.EMAIL_FROM??"info@staircode.app",c=new Date().toLocaleDateString("en-CA",{year:"numeric",month:"long",day:"numeric"}),d=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,p=null;try{p=await _({reportText:t,fields:i,frames:a,codeLabel:r,location:o,date:c}),console.log(`[report/generate] PDF generated: ${Math.round(p.length/1024)}KB, ${Object.keys(a).length} photos embedded`)}catch(e){console.error("[report/generate] PDF generation failed:",e)}let u=null;if(p)try{let t=process.env.NEXT_PUBLIC_SUPABASE_URL,n=process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,i=(0,v.createClient)(t,n),s=`reports/${d}.pdf`,{error:l}=await i.storage.from("reports").upload(s,p,{contentType:"application/pdf",upsert:!0});if(l)console.warn("[report/generate] Storage upload failed:",l.message);else{let{data:t}=i.storage.from("reports").getPublicUrl(s);u=t?.publicUrl??null,console.log(`[report/generate] PDF stored at ${u}`),await i.from("report_records").insert({id:d,email:e,code_label:r,location:o,pdf_url:u,pdf_size_kb:Math.round(p.length/1024),photos_count:Object.keys(a).filter(e=>a[e]?.length>100).length,created_at:new Date().toISOString()}).then(({error:e})=>{e&&console.warn("[report/generate] report_records insert failed:",e.message)})}}catch(e){console.error("[report/generate] Storage error:",e)}let m=Object.keys(a).filter(e=>a[e]?.length>100).length,h=`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:1.5rem 1rem;">

  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:1.5rem 2rem;text-align:center;background-image:repeating-linear-gradient(-45deg,#F29337 0px,#F29337 3px,transparent 3px,transparent 14px);background-size:20px 20px;">
    <div style="background:#0A1C2E;padding:1.25rem;border-radius:10px;">
      <img src="https://staircode.app/staircode_logo.png" alt="stAIrcode" style="height:40px;object-fit:contain;display:block;margin:0 auto 0.5rem;" />
      <h1 style="font-size:1.3rem;font-weight:900;color:#E8F4FF;margin:0 0 0.3rem;letter-spacing:-0.02em;">Stair Compliance Report</h1>
      <p style="font-size:0.78rem;color:#93BAD4;margin:0;">${r}${o?" \xb7 "+o:""} \xb7 ${c}</p>
    </div>
  </div>

  <div style="background:#fff;border-left:3px solid #F29337;border-right:3px solid #F29337;padding:2rem;">
    <p style="font-size:1rem;font-weight:700;color:#0A1C2E;margin:0 0 0.5rem;">Your compliance report is attached.</p>
    <p style="font-size:0.88rem;color:#5E7D9B;line-height:1.7;margin:0 0 1rem;">
      The full PDF report — including ${m>0?`${m} measurement photo${1!==m?"s":""}`:"your measurements"}, compliance analysis, and applicable code sections — is attached to this email.
    </p>
    <div style="background:#F4F7FB;border-radius:10px;padding:1rem 1.25rem;font-size:0.82rem;color:#5E7D9B;line-height:1.6;">
      <strong style="color:#0A1C2E;">Included in this report:</strong><br>
      \xb7 Measurement photos from your scan<br>
      \xb7 Pass/fail result for each dimension<br>
      \xb7 Applicable ${r} code sections<br>
      \xb7 Pre-inspection recommendations
    </div>
  </div>

  <div style="background:#0F2438;padding:1.25rem 2rem;text-align:center;">
    <p style="font-size:0.82rem;color:#93BAD4;margin:0 0 1rem;line-height:1.6;">
      How was your experience with stAIrcode?<br>
      <strong style="color:#E8F4FF;">Your feedback helps us improve for the next user.</strong>
    </p>
    <a href="${n}" style="display:inline-block;background:linear-gradient(135deg,#F29337,#C4721E);color:#fff;font-weight:800;font-size:0.88rem;text-decoration:none;padding:0.85rem 2rem;border-radius:12px;letter-spacing:0.04em;">
      Take a 2-min Survey →
    </a>
  </div>

  <div style="background:#0A1C2E;border-radius:0 0 16px 16px;padding:1rem 2rem;text-align:center;">
    <p style="font-size:0.65rem;color:#4E7A9B;margin:0;line-height:1.7;">
      Pre-inspection AI analysis only — not a certified inspection.<br>
      <a href="https://staircode.app" style="color:#417CA4;">staircode.app</a> \xb7 \xa9 ${new Date().getFullYear()} Just Open Technologies Inc.
    </p>
  </div>

</div>
</body>
</html>`,f={from:l,to:[e],subject:`Your stAIrcode Compliance Report — ${o||r}`,html:h};p&&(f.attachments=[{filename:"staircode-compliance-report.pdf",content:p.toString("base64"),content_type:"application/pdf"}]);let g=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s}`},body:JSON.stringify(f)});if(!g.ok)return console.error("[report/generate] Resend error:",await g.json().catch(()=>({}))),!1;let{id:y}=await g.json().catch(()=>({id:null}));return console.log(`[report/generate] Email sent to ${e} (${y}) with PDF attachment (${p?Math.round(p.length/1024):0}KB)`),{emailId:y??!0,pdfUrl:u}}async function I(e){var t,r,o,n,a;let i;let u=(0,l.r)(e),m=(0,l.h)(u);if(!m.allowed)return s.NextResponse.json({error:m.reason},{status:429});let h=process.env.ANTHROPIC_API_KEY;if(!h)return s.NextResponse.json({error:"API key not configured"},{status:503});try{i=await e.json()}catch{return s.NextResponse.json({error:"Invalid request"},{status:400})}let{email:f,fields:g,codeLabel:y,codeRef:w,location:x,isOntario:S,surveyUrl:A}=i,b={};if(i.frames)try{if("object"==typeof i.frames)b=i.frames;else if("string"==typeof i.frames){let e=JSON.parse(i.frames);"string"==typeof e&&(e=JSON.parse(e)),e&&"object"==typeof e&&(b=e)}}catch{b={}}let E=Object.values(b).filter(e=>e&&e.length>100).length;console.log(`[report/generate] Received ${E} valid photo frames (${Object.keys(b).length} total keys)`);let T=function(){let e=process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN??process.env.NEXT_PUBLIC_POSTHOG_KEY,t=process.env.NEXT_PUBLIC_POSTHOG_HOST??"https://us.i.posthog.com";return e?new p.AR(e,{host:t}):null}(),_="control";if(T&&f)try{let e=await T.getFeatureFlag("print-report",f);_=("string"==typeof e?e:e?"test":"control")??"control",T.capture({distinctId:f,event:"$feature_flag_called",properties:{$feature_flag:"print-report",$feature_flag_response:_}})}catch(e){console.warn("[report/generate] PostHog flag eval failed:",e)}if(!g)return s.NextResponse.json({error:"Missing measurement fields"},{status:400});let v=(f||"").toLowerCase().trim(),O=!!i.testimonialToken,I=!0===i.paid||O;if(!I&&v){let e=process.env.NEXT_PUBLIC_SUPABASE_URL,t=process.env.SUPABASE_SERVICE_ROLE_KEY;if(e&&t)try{let r=await fetch(`${e}/rest/v1/report_usage?select=report_count&email=eq.${encodeURIComponent(v)}`,{headers:{apikey:t,Authorization:`Bearer ${t}`}});if(r.ok){let e=await r.json(),t=e[0]?.report_count??0;if(t>=1)return s.NextResponse.json({error:"trial_exhausted",used:t,limit:1},{status:402})}}catch(e){console.warn("[report/generate] Usage check failed — proceeding:",e)}}if(!I&&v){let e=await (0,c.Qs)(v);if(!e.allowed)return s.NextResponse.json({error:"scan_limit_reached",scanCount:e.scanCount,limit:e.limit,message:`You've used all ${e.limit} free scans. Upgrade to Pro for unlimited inspections.`},{status:402})}let N=new Date().toLocaleDateString("en-CA",{year:"numeric",month:"long",day:"numeric"}),R=i.quickScan?(t=i.identification||(g[0]?.label??"Building component"),r=i.observations||(g[0]?.observations??""),o=i.codeNotes||(g[0]?.recommendation??""),n=y||"Building Code",a=x||"",`You are a professional building code compliance consultant. Write a concise pre-inspection assessment report for a single building component that was assessed by AI vision from a field photo.

DATE: ${N}
LOCATION: ${a||"Not specified"}
CODE: ${n}

COMPONENT IDENTIFIED: ${t}

FIELD OBSERVATIONS: ${r}

CODE COMMENTARY (preliminary): ${o}

Write a professional report with exactly these 5 sections. Plain text only — no markdown, no asterisks, no bullet symbols. Use proper grammar and complete sentences.

STRICT RULES:
- Never write [Insert Date], [Address], [Consultant Name], or any bracketed placeholder.
- The date of this assessment is ${N}. Use it directly if you mention a date.
- Do not include a "Prepared By" line.
- This was a preliminary AI-vision assessment from a single photo. Clearly state that a formal on-site inspection by a qualified professional is required to confirm any findings.

1. COMPONENT DESCRIPTION
Describe the component identified and its visible context in 2-3 sentences.

2. CONDITION ASSESSMENT
Summarize the visible condition, materials, and any defects or concerns noted in the observations.

3. APPLICABLE CODE SECTIONS
The specific ${n} sections that apply to this component, with a plain-language summary of each requirement and how the observed condition relates to it.

4. RISK AND PRIORITY
The key compliance or safety risks in order of severity, based on what was observed.

5. RECOMMENDATION
One clear recommendation: whether a formal inspection is needed, what to address first, and next steps.

Keep the total report under 600 words. Be direct and professional. No placeholder text of any kind.`):function(e,t,r,o,n){let a=new Date().toLocaleDateString("en-CA",{year:"numeric",month:"long",day:"numeric"}),i=e.map(e=>{let t=e.clearAbove?"CLEAR (obstruction-free confirmed)":null!=e.value?`${Math.round(e.value)}mm`:"NOT CAPTURED — must be verified during formal inspection",r=null!=e.min&&null!=e.max?`${e.min}–${e.max}mm`:null!=e.min?`≥${e.min}mm`:null!=e.max?`≤${e.max}mm`:"N/A",o=null!=e.value||e.clearAbove?!0===e.pass?"PASS":!1===e.pass?"FAIL":"N/A":"NOT ASSESSED";return`${e.label}: ${t} (required: ${r}) — ${o}`}).join("\n"),s=e.filter(e=>!1===e.pass).map(e=>`${e.label}: measured ${e.value}mm`).join("\n"),l=e.filter(e=>null==e.value&&!e.clearAbove).map(e=>e.label).join(", ");return`You are a professional building code compliance consultant. Write a concise pre-inspection stair assessment report.

DATE: ${a}
LOCATION: ${o||"Not specified"}
CODE: ${t}${r?` (${r})`:""}${n?" — Ontario, Canada":""}

MEASUREMENTS:
${i}

${s?`FAILED ITEMS:
${s}`:"All assessed items passed."}
${l?`NOT CAPTURED (must be verified during formal inspection): ${l}`:""}

Write a professional report with exactly these 5 sections. Plain text only — no markdown, no asterisks, no bullet symbols. Use proper grammar, correct spelling, and complete sentences throughout.

STRICT RULES:
- Never write [Insert Date], [Address], [Consultant Name], or any placeholder in brackets.
- The date of this assessment is ${a}. Use this date directly if you mention it.
- Do not include a "Prepared By" line anywhere in the report.
- For every NOT CAPTURED measurement: state clearly it was not assessed and must be physically verified during a formal inspection. Do not estimate it or guess.
- For every FAIL: explain the specific deficiency and its safety or code consequence.
- For every PASS: confirm it meets the requirement in one sentence.

1. STAIR DESCRIPTION
Brief description of the staircase based on the measurements (2-3 sentences). Do not include dates or consultant names.

2. COMPLIANCE ANALYSIS
For each assessed dimension: what was found, what is required, and the pass/fail result. For any NOT CAPTURED dimension, clearly state it was not assessed.

3. APPLICABLE CODE SECTIONS
The specific ${t} sections that apply, with a plain-language summary of each requirement.

4. PROBABLE OCCUPANCY AND RISK
Most likely occupancy type based on location and dimensions. Key compliance risks in order of severity.

5. RECOMMENDATION
One clear recommendation: whether a formal inspection is needed, what to address first, and next steps.

Keep the total report under 600 words. Be direct and professional. No placeholder text of any kind.`}(g,y||"Building Code",w||"",x||"",S||!1),$="";try{let e=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":h,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:2500,messages:[{role:"user",content:[{type:"text",text:R}]}]})});if(!e.ok){let t=await e.text();return console.error("[report/generate] Anthropic error:",t),s.NextResponse.json({error:"AI service error"},{status:502})}let t=await e.json();if(!($=t.content?.[0]?.text??""))return s.NextResponse.json({error:"Empty report"},{status:502})}catch(e){return console.error("[report/generate] Fetch error:",e),s.NextResponse.json({error:"Report generation failed"},{status:502})}let D=v?await C(v,$,y||"Building Code",x||"",A||P,b,g):null,k=D?"object"==typeof D?D.emailId:D:null,B=D&&"object"==typeof D?D.pdfUrl:null;if(T&&(T.capture({distinctId:v||"anonymous",event:"report_generated_experiment",properties:{experiment_name:"print-report",variant:_,emailed:!!k,code_label:y,location:x||"",is_ontario:S||!1,beta:!0}}),await T.shutdown()),await (0,d.Z)(v||"anonymous","report_generated_server",{emailed:!!k,code_label:y,location:x||"",is_ontario:S||!1,experiment_variant:_}),!I&&v){(0,c.hu)(v).catch(()=>{});let e=process.env.NEXT_PUBLIC_SUPABASE_URL,t=process.env.SUPABASE_SERVICE_ROLE_KEY;if(e&&t)try{await fetch(`${e}/rest/v1/report_usage`,{method:"POST",headers:{apikey:t,Authorization:`Bearer ${t}`,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},body:JSON.stringify({email:v,report_count:1,first_at:new Date().toISOString(),last_at:new Date().toISOString()})}),await fetch(`${e}/rest/v1/rpc/increment_report_usage`,{method:"POST",headers:{apikey:t,Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({user_email:v})})}catch(e){console.warn("[report/generate] Usage increment failed:",e)}}return s.NextResponse.json({ok:!0,emailed:!!k,emailId:k,reportText:$,pdfUrl:B??null})}let N=new n.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/report/generate/route",pathname:"/api/report/generate",filename:"route",bundlePath:"app/api/report/generate/route"},resolvedPagePath:"/home/claude/stAircode/src/app/api/report/generate/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:R,staticGenerationAsyncStorage:$,serverHooks:D}=N,k="/api/report/generate/route";function B(){return(0,i.patchFetch)({serverHooks:D,staticGenerationAsyncStorage:$})}},7709:(e,t,r)=>{r.d(t,{Z:()=>n});var o=r(474);async function n(e,t,r){let n=function(){let e=process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN??process.env.NEXT_PUBLIC_POSTHOG_KEY,t=process.env.NEXT_PUBLIC_POSTHOG_HOST??"https://app.posthog.com";return e?new o.AR(e,{host:t}):(console.info("[analytics-server] No PostHog key — tracking disabled"),null)}();n&&(n.capture({distinctId:e,event:t,properties:{beta:!0,app_version:"1.0.0-beta.1",$lib:"posthog-node",...r}}),await n.shutdown())}},6097:(e,t,r)=>{r.d(t,{h:()=>s,r:()=>l});let o=new Map,n=new Map,a=Date.now();function i(e,t,r,o){let n=Date.now(),a=e.get(t);if(!a||n-a.windowStart>r)return e.set(t,{count:1,windowStart:n}),{allowed:!0,remaining:o-1,resetMs:r};a.count++;let i=Math.max(0,o-a.count),s=r-(n-a.windowStart);return a.count>o?{allowed:!1,remaining:0,resetMs:s}:{allowed:!0,remaining:i,resetMs:s}}function s(e){!function(){let e=Date.now();e-a<3e5||(a=e,o.forEach((t,r)=>{e-t.windowStart>6e4&&o.delete(r)}),n.forEach((t,r)=>{e-t.windowStart>36e5&&n.delete(r)}))}();let t=i(o,e,6e4,15),r=i(n,e,36e5,50);return t.allowed?r.allowed?{allowed:!0,minuteRemaining:t.remaining,hourRemaining:r.remaining,retryAfterMs:0}:{allowed:!1,minuteRemaining:t.remaining,hourRemaining:0,retryAfterMs:r.resetMs,reason:"Hourly limit reached — please try again later."}:{allowed:!1,minuteRemaining:0,hourRemaining:r.remaining,retryAfterMs:t.resetMs,reason:"Too many requests — please wait a moment before trying again."}}function l(e){return e.headers.get("x-nf-client-connection-ip")??e.headers.get("x-real-ip")??e.headers.get("x-forwarded-for")?.split(",")[0].trim()??"unknown"}},9115:(e,t,r)=>{r.d(t,{K9:()=>i,Qs:()=>n,hu:()=>a,ji:()=>o});let o=3;async function n(e){let t=process.env.NEXT_PUBLIC_SUPABASE_URL,r=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!t||!r||!e)return{allowed:!0,scanCount:0,limit:o,isPro:!1,remaining:o};try{let n=await fetch(`${t}/rest/v1/scan_usage?select=scan_count,is_pro&email=eq.${encodeURIComponent(e.toLowerCase())}`,{headers:{apikey:r,Authorization:`Bearer ${r}`}});if(!n.ok)throw Error(`Supabase ${n.status}`);let a=(await n.json())[0],i=a?.scan_count??0;if(a?.is_pro)return{allowed:!0,scanCount:i,limit:1/0,isPro:!0,remaining:1/0};return{allowed:i<o,scanCount:i,limit:o,isPro:!1,remaining:Math.max(0,o-i)}}catch(e){return console.warn("[scan-usage] Check failed — failing open:",e),{allowed:!0,scanCount:0,limit:o,isPro:!1,remaining:o,error:String(e)}}}async function a(e){let t=process.env.NEXT_PUBLIC_SUPABASE_URL,r=process.env.SUPABASE_SERVICE_ROLE_KEY;if(t&&r&&e)try{await fetch(`${t}/rest/v1/rpc/increment_scan_usage`,{method:"POST",headers:{apikey:r,Authorization:`Bearer ${r}`,"Content-Type":"application/json"},body:JSON.stringify({user_email:e.toLowerCase()})})}catch(e){console.warn("[scan-usage] Increment failed:",e)}}async function i(e){let t=process.env.NEXT_PUBLIC_SUPABASE_URL,r=process.env.SUPABASE_SERVICE_ROLE_KEY;if(t&&r&&e)try{await fetch(`${t}/rest/v1/rpc/unlock_pro_scans`,{method:"POST",headers:{apikey:r,Authorization:`Bearer ${r}`,"Content-Type":"application/json"},body:JSON.stringify({user_email:e.toLowerCase()})})}catch(e){console.warn("[scan-usage] Pro unlock failed:",e)}}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),o=t.X(0,[9276,5972,8336,474],()=>r(8536));module.exports=o})();