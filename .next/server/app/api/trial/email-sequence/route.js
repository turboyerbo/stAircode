"use strict";(()=>{var e={};e.id=492,e.ids=[492],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4955:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>w,patchFetch:()=>$,requestAsyncStorage:()=>v,routeModule:()=>A,serverHooks:()=>_,staticGenerationAsyncStorage:()=>x});var i={};r.r(i),r.d(i,{GET:()=>f,POST:()=>b,maxDuration:()=>g});var n=r(9303),o=r(8716),s=r(670),a=r(7070),l=r(1183);let c="https://staircode.app",d=process.env.EMAIL_FROM??"info@staircode.app",m=`${c}/staircode_logo.png`;function u(e){return`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:1.5rem 1rem;">
  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:1.75rem 2rem 1.25rem;text-align:center;">
    <img src="${m}" alt="stAIrcode" style="height:38px;display:block;margin:0 auto;" />
  </div>
  <div style="background:#fff;padding:2rem;border-radius:0 0 16px 16px;border:1px solid #DCE7F0;border-top:none;">
    ${e}
  </div>
  <div style="text-align:center;padding:1.25rem 1rem;color:#9DB4C5;font-size:0.7rem;line-height:1.6;">
    stAIrcode by Just Open Technologies Inc.<br/>
    <a href="${c}" style="color:#5E7D9B;">staircode.app</a> \xb7
    Building code compliance, anywhere.
  </div>
</div></body></html>`}function p(e,t,r="#27A96B"){return`<a href="${t}" style="display:inline-block;background:${r};color:#fff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:0.85rem 1.75rem;border-radius:10px;margin:0.5rem 0;">${e}</a>`}async function h(e,t,r){let i=process.env.RESEND_API_KEY;if(!i)return console.warn("[trial-emails] RESEND_API_KEY not set — skipping send to",e),!1;try{return(await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${i}`},body:JSON.stringify({from:`stAIrcode <${d}>`,to:[e],subject:t,html:r})})).ok}catch(e){return console.error("[trial-emails] send failed:",e),!1}}let g=60;async function y(e){if(!function(e){let t=process.env.CRON_SECRET;return!t||(e.nextUrl.searchParams.get("key")??e.headers.get("x-cron-secret")??"")===t}(e))return a.NextResponse.json({error:"Unauthorized"},{status:401});let t=(0,l.jF)(),r=Date.now(),{data:i,error:n}=await t.from("trials").select("email, name, trial_start, trial_end, subscribed, email_day1_sent, email_day5_sent, email_day7_sent").eq("subscribed",!1).limit(500);if(n)return console.error("[email-sequence]",n.message),a.NextResponse.json({error:"Query failed"},{status:500});let o=0,s={day1:0,day5:0,day7:0};for(let e of i??[]){let i;let n=Math.floor((r-new Date(e.trial_start).getTime())/864e5),a=Math.max(0,Math.ceil((new Date(e.trial_end).getTime()-r)/864e5)),l=e.name??e.email.split("@")[0],d=null;if(n>=7&&!e.email_day7_sent?d="day7":n>=5&&n<7&&!e.email_day5_sent?d="day5":n>=1&&n<5&&!e.email_day1_sent&&(d="day1"),!d)continue;if("day5"===d){let r=e.email.toLowerCase(),{count:n}=await t.from("inspection_jobs").select("id",{count:"exact",head:!0}).or(`user_id.eq.${r},inspector_email.eq.${r}`),{count:o}=await t.from("inspection_jobs").select("id",{count:"exact",head:!0}).or(`user_id.eq.${r},inspector_email.eq.${r}`).not("report_url","is",null);i={projects:n??0,reports:o??0}}let{subject:m,html:g}=function(e,t,r=0,i){let n=(t||"").trim()||"there";return"day1"===e?{subject:"Your first scan takes 2 minutes — here's how",html:u(`
      <h1 style="font-size:1.4rem;font-weight:800;color:#0A1C2E;margin:0 0 0.75rem;letter-spacing:-0.02em;">Welcome aboard, ${n} 👋</h1>
      <p style="font-size:0.92rem;color:#3A5A78;line-height:1.7;margin:0 0 1rem;">
        Your 7-day free trial is live. The fastest way to see what stAIrcode does is a quick stair scan — point your phone and the AI measures rise, run, headroom, nosing, and handrail, then checks each against your local building code in seconds.
      </p>
      <p style="font-size:0.92rem;color:#3A5A78;line-height:1.7;margin:0 0 1.25rem;">
        But stairs are just the demo. stAIrcode runs full building inspections across every system — and its real value is catching the code and construction issues that get missed on site, before they become costly rework.
      </p>
      <div style="text-align:center;margin:1.5rem 0;">
        ${p("Run your first scan →",`${c}/?scan=stair`)}
      </div>
      <div style="background:#F7FAFC;border-radius:10px;padding:1.1rem 1.25rem;margin-top:1rem;">
        <p style="font-size:0.82rem;color:#3A5A78;line-height:1.6;margin:0 0 0.55rem;"><strong style="color:#0A1C2E;">Catch issues early</strong> — flag defects during the build, when they're cheap to fix.</p>
        <p style="font-size:0.82rem;color:#3A5A78;line-height:1.6;margin:0 0 0.55rem;"><strong style="color:#0A1C2E;">Pre-screen as you go</strong> — check each stage before it's covered up or formally inspected.</p>
        <p style="font-size:0.82rem;color:#3A5A78;line-height:1.6;margin:0 0 0.55rem;"><strong style="color:#0A1C2E;">Ask the AI assistant</strong> — a code-and-construction expert answering in plain language, on site.</p>
        <p style="font-size:0.82rem;color:#3A5A78;line-height:1.6;margin:0;"><strong style="color:#0A1C2E;">Keep everything</strong> — photos, findings, and reports saved to your project, on any device.</p>
      </div>
    `)}:"day5"===e?function(e,t,r){let i=r&&(r.projects>0||r.reports>0),n=i?`
      <div style="background:#F0F8F4;border:1px solid rgba(39,169,107,0.3);border-radius:10px;padding:1.1rem 1.25rem;margin:0 0 1.25rem;">
        <p style="font-size:0.82rem;color:#1A7A50;line-height:1.6;margin:0 0 0.4rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">What you've built so far</p>
        <p style="font-size:1.05rem;color:#0A1C2E;line-height:1.5;margin:0;font-weight:700;">
          ${r.projects} ${1===r.projects?"project":"projects"}${r.reports>0?` \xb7 ${r.reports} ${1===r.reports?"report":"reports"}`:""}
        </p>
        <p style="font-size:0.8rem;color:#5E7D9B;line-height:1.6;margin:0.5rem 0 0;">
          All of it stays saved and accessible the moment you subscribe — and disappears from view when your trial ends.
        </p>
      </div>`:"";return{subject:i?`${t} days left — don't lose your ${r.projects} ${1===r.projects?"project":"projects"}`:`${t} days left in your stAIrcode trial`,html:u(`
      <h1 style="font-size:1.4rem;font-weight:800;color:#0A1C2E;margin:0 0 0.75rem;letter-spacing:-0.02em;">${t} days left, ${e}</h1>
      ${n}
      <p style="font-size:0.92rem;color:#3A5A78;line-height:1.7;margin:0 0 1rem;">
        Your free trial ends soon. If stAIrcode has been useful, now's the moment to lock in continued access — every project, report, and photo you've created stays exactly where it is.
      </p>
      <p style="font-size:0.92rem;color:#3A5A78;line-height:1.7;margin:0 0 1.25rem;">
        With a membership you keep the tools that catch problems before they cost you:
      </p>
      <ul style="font-size:0.9rem;color:#3A5A78;line-height:1.9;margin:0 0 1.25rem;padding-left:1.1rem;">
        <li>Unlimited AI-vision scans that flag code and construction issues</li>
        <li>Full multi-phase inspections and stage-by-stage pre-screening</li>
        <li>Professional PDF compliance reports, emailed from the field</li>
        <li>The live AI assistant — building-code answers on site, in real time</li>
        <li>Your project database — every photo, finding, and report, on any device</li>
      </ul>
      <div style="text-align:center;margin:1.5rem 0;">
        ${p("Keep my access →",`${c}/?subscribe=1`)}
      </div>
      <p style="font-size:0.8rem;color:#9DB4C5;line-height:1.6;margin:1rem 0 0;text-align:center;">
        $38.99/month \xb7 cancel anytime
      </p>
    `)}}(n,r,i):{subject:"Your trial has ended — your projects are saved",html:u(`
      <h1 style="font-size:1.4rem;font-weight:800;color:#0A1C2E;margin:0 0 0.75rem;letter-spacing:-0.02em;">Your free trial has ended</h1>
      <p style="font-size:0.92rem;color:#3A5A78;line-height:1.7;margin:0 0 1rem;">
        ${n}, your 7-day trial is up — but nothing has been deleted. Every project, report, and photo you created is saved and waiting. Subscribe to pick up exactly where you left off.
      </p>
      <div style="background:#FFF6ED;border:1px solid rgba(242,147,55,0.3);border-radius:10px;padding:1rem 1.25rem;margin:1.25rem 0;">
        <p style="font-size:0.88rem;color:#9A5A1E;line-height:1.6;margin:0;">
          <strong>Your work is held securely.</strong> Reactivate any time to regain full access to your saved projects and reports.
        </p>
      </div>
      <div style="text-align:center;margin:1.5rem 0;">
        ${p("Reactivate my account →",`${c}/?subscribe=1`,"#F29337")}
      </div>
      <p style="font-size:0.8rem;color:#9DB4C5;line-height:1.6;margin:1rem 0 0;text-align:center;">
        $38.99/month \xb7 cancel anytime \xb7 your data is never deleted
      </p>
    `)}}(d,l,a,i);if(!await h(e.email,m,g))continue;let y="day1"===d?"email_day1_sent":"day5"===d?"email_day5_sent":"email_day7_sent";await t.from("trials").update({[y]:new Date().toISOString()}).eq("email",e.email),o++,s[d]++}return a.NextResponse.json({ok:!0,processed:i?.length??0,sent:o,results:s})}async function f(e){return y(e)}async function b(e){return y(e)}let A=new n.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/trial/email-sequence/route",pathname:"/api/trial/email-sequence",filename:"route",bundlePath:"app/api/trial/email-sequence/route"},resolvedPagePath:"/home/claude/stAircode/src/app/api/trial/email-sequence/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:v,staticGenerationAsyncStorage:x,serverHooks:_}=A,w="/api/trial/email-sequence/route";function $(){return(0,s.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:x})}},1183:(e,t,r)=>{r.d(t,{b7:()=>c,gs:()=>a,jF:()=>s,vV:()=>l});var i=r(8336);let n=process.env.NEXT_PUBLIC_SUPABASE_URL??"",o=process.env.SUPABASE_SERVICE_ROLE_KEY??"";function s(){if(!n||!o)throw Error("Supabase not configured");return(0,i.createClient)(n,o,{auth:{persistSession:!1,autoRefreshToken:!1}})}async function a(e){try{let t=(e.headers.get("authorization")??"").replace(/^Bearer\s+/i,"").trim();if(!t||!n||!o)return null;let r=(0,i.createClient)(n,o,{auth:{persistSession:!1,autoRefreshToken:!1}}),{data:s,error:a}=await r.auth.getUser(t);if(a||!s?.user?.email)return null;return s.user.email.toLowerCase()}catch{return null}}function l(e){return/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e)}function c(e){return/^[a-zA-Z0-9_-]{1,120}$/.test(e)}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),i=t.X(0,[9276,5972,8336],()=>r(4955));module.exports=i})();