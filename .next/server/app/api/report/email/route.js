"use strict";(()=>{var e={};e.id=526,e.ids=[526],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},8767:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>f,patchFetch:()=>h,requestAsyncStorage:()=>m,routeModule:()=>c,serverHooks:()=>u,staticGenerationAsyncStorage:()=>g});var o={};r.r(o),r.d(o,{POST:()=>p});var i=r(9303),n=r(8716),a=r(670),s=r(7070),l=r(6097);let d="https://staircode.app";async function p(e){let t,r,o,i,n;let a=(0,l.r)(e),p=(0,l.h)(a);if(!p.allowed)return s.NextResponse.json({error:p.reason},{status:429});try{let a=await e.json();if(t=a.email?.trim(),r=a.reportText??"",o=Array.isArray(a.fields)?a.fields:[],i=a.codeLabel||"Building Code",n=a.location||"",!t)throw Error("Missing email")}catch{return s.NextResponse.json({error:"Invalid request"},{status:400})}let c=process.env.RESEND_API_KEY;if(!c)return console.warn("[report/email] RESEND_API_KEY not set"),s.NextResponse.json({ok:!0,skipped:!0});let m=process.env.EMAIL_FROM??"info@staircode.app",g=`Your stAIrcode Results — ${n||i}`,u=new Date().toLocaleDateString("en-CA",{year:"numeric",month:"long",day:"numeric"}),f=r.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0,3).join(" "),h=o.filter(e=>null!=e.value||e.clearAbove),y="#27A96B",b="#E84545",x=h.map(e=>{let t=!0===e.pass||!0===e.clearAbove,r=!1===e.pass,o=e.clearAbove?"CLEAR":t?"PASS":r?"FAIL":"N/A",i=e.clearAbove?y:t?y:r?b:"#9BB5C8",n=null!=e.value?`${e.value} mm`:e.clearAbove?"Clear":"—";return`
      <tr style="border-bottom:1px solid #E5EBF2;">
        <td style="padding:0.7rem 0.75rem;font-size:0.82rem;color:#0D1E2E;font-weight:600;">${e.label??e.id}</td>
        <td style="padding:0.7rem 0.75rem;font-size:0.82rem;color:#0D1E2E;text-align:center;">${n}</td>
        <td style="padding:0.7rem 0.75rem;text-align:center;">
          <span style="display:inline-block;padding:0.2rem 0.65rem;border-radius:20px;font-size:0.72rem;font-weight:800;color:#fff;background:${i};letter-spacing:0.06em;">${o}</span>
        </td>
      </tr>`}).join(""),w=`${d}/unlock?email=${encodeURIComponent(t)}&code=${encodeURIComponent(i)}&loc=${encodeURIComponent(n)}`;try{let e=await fetch(`${d}/api/report/save`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:t,fields:h,codeLabel:i,location:n})}),r=await e.json();r.token&&"fallback"!==r.token&&(w=`${d}/unlock?token=${r.token}`)}catch{}let v=h.filter(e=>!0===e.pass||e.clearAbove).length,A=h.filter(e=>!1===e.pass).length,E=0===A&&h.length>0,k=E?y:b,F=`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:1.5rem 1rem;">

  <!-- Header -->
  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:1.75rem 2rem;text-align:center;">
    <img src="https://staircode.app/staircode_logo.png" alt="stAIrcode" style="height:36px;object-fit:contain;display:block;margin:0 auto 0.5rem;" />
    <h1 style="font-size:1.2rem;font-weight:900;color:#E8F4FF;margin:0 0 0.25rem;letter-spacing:-0.02em;">Your Stair Compliance Results</h1>
    <p style="font-size:0.75rem;color:#93BAD4;margin:0;">${i}${n?" \xb7 "+n:""} \xb7 ${u}</p>
  </div>

  <!-- Beta pricing banner -->
  <div style="background:linear-gradient(135deg,#F29337,#C4721E);padding:0.75rem 2rem;text-align:center;">
    <p style="margin:0;font-size:0.85rem;font-weight:800;color:#fff;">
       Access with your stAIrcode subscription — $38.99/month \xb7 Cancel anytime
    </p>
  </div>

  <!-- Overall verdict -->
  <div style="background:#fff;padding:1.25rem 2rem;border-left:4px solid ${k};border-right:4px solid ${k};text-align:center;">
    <div style="display:inline-block;padding:0.5rem 1.5rem;background:${E?"rgba(39,169,107,0.1)":"rgba(232,69,69,0.1)"};border:2px solid ${k};border-radius:30px;font-size:1.1rem;font-weight:900;color:${k};letter-spacing:0.06em;">
      ${E?" COMPLIANT":" REVIEW REQUIRED"}
    </div>
    <p style="margin:0.6rem 0 0;font-size:0.8rem;color:#5E7D9B;">${v} passed \xb7 ${A} failed \xb7 ${h.length} measured</p>
  </div>

  <!-- Brief description -->
  ${f?`<div style="background:#fff;padding:1rem 2rem;border-left:4px solid #F29337;border-right:4px solid #F29337;">
    <p style="margin:0;font-size:0.82rem;color:#2C4A66;line-height:1.7;">${f.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>
  </div>`:""}

  <!-- Pass/Fail table -->
  <div style="background:#fff;border-left:4px solid #F29337;border-right:4px solid #F29337;padding:0 0 0.5rem;">
    <div style="padding:0.75rem 1.5rem 0.4rem;">
      <span style="font-size:0.65rem;font-weight:800;letter-spacing:0.14em;color:#F29337;text-transform:uppercase;">Measurement Summary</span>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#F0F5FA;">
          <th style="padding:0.5rem 0.75rem;font-size:0.72rem;font-weight:700;color:#5E7D9B;text-align:left;letter-spacing:0.06em;">DIMENSION</th>
          <th style="padding:0.5rem 0.75rem;font-size:0.72rem;font-weight:700;color:#5E7D9B;text-align:center;letter-spacing:0.06em;">MEASURED</th>
          <th style="padding:0.5rem 0.75rem;font-size:0.72rem;font-weight:700;color:#5E7D9B;text-align:center;letter-spacing:0.06em;">RESULT</th>
        </tr>
      </thead>
      <tbody>${x||'<tr><td colspan="3" style="padding:1rem;text-align:center;color:#9BB5C8;font-size:0.8rem;">No measurements recorded</td></tr>'}</tbody>
    </table>
  </div>

  <!-- Locked / paywall section -->
  <div style="background:#fff;border-left:4px solid #F29337;border-right:4px solid #F29337;padding:0 2rem 0;">
    <!-- Blurred preview text -->
    <div style="filter:blur(3px);user-select:none;padding:1rem 0 0.5rem;opacity:0.45;font-size:0.82rem;color:#2C4A66;line-height:1.7;">
      Detailed compliance analysis with specific code references. Building code section citations for each dimension. Pre-inspection summary and recommendations for your contractor or building inspector. Measurement photographs from each scan position.
    </div>
    <!-- Gradient fade -->
    <div style="height:40px;background:linear-gradient(to bottom,rgba(255,255,255,0),rgba(255,255,255,1));margin-top:-40px;position:relative;"></div>

    <!-- Lock + CTA -->
    <div style="text-align:center;padding:1rem 0 1.75rem;">
      <div style="font-size:1.8rem;margin-bottom:0.5rem;"></div>
      <p style="font-size:0.95rem;font-weight:800;color:#0D1E2E;margin:0 0 0.35rem;">Full report locked</p>
      <p style="font-size:0.78rem;color:#5E7D9B;margin:0 0 1.25rem;line-height:1.6;">
        Your full report includes detailed code citations, measurement photos,<br>and a pre-inspection summary — ready to share with your inspector.
      </p>
      <!-- CTA -->
      <a href="${w}" style="display:inline-block;background:linear-gradient(135deg,#F29337,#C4721E);color:#fff;font-weight:800;font-size:1rem;text-decoration:none;padding:0.85rem 2.5rem;border-radius:14px;letter-spacing:0.04em;box-shadow:0 4px 20px rgba(242,147,55,0.4);">
        Subscribe for Full Access →
      </a>
      <p style="font-size:0.68rem;color:#9BB5C8;margin:0.6rem 0 0;">
        <span style="text-decoration:line-through;opacity:0.65;">Regular price $38.99</span> \xb7 Beta testing discount applied at checkout
      </p>
    </div>
  </div>

  <!-- What's included -->
  <div style="background:#F0F7FF;border-left:4px solid #F29337;border-right:4px solid #F29337;padding:1.25rem 2rem;">
    <p style="font-size:0.72rem;font-weight:800;color:#0D1E2E;margin:0 0 0.6rem;letter-spacing:0.06em;text-transform:uppercase;">Your full PDF report includes:</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="font-size:0.78rem;color:#2C4A66;padding:0.2rem 0.5rem 0.2rem 0;width:50%;"> All measurements with code limits</td>
        <td style="font-size:0.78rem;color:#2C4A66;padding:0.2rem 0;"> Building code section citations</td>
      </tr>
      <tr>
        <td style="font-size:0.78rem;color:#2C4A66;padding:0.2rem 0.5rem 0.2rem 0;"> Measurement photographs</td>
        <td style="font-size:0.78rem;color:#2C4A66;padding:0.2rem 0;"> Pre-inspection summary</td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="background:#0F2438;border-radius:0 0 16px 16px;padding:1.25rem 2rem;text-align:center;">
    <p style="font-size:0.68rem;color:#4E7A9B;margin:0 0 0.4rem;line-height:1.6;">
      This is a pre-inspection AI analysis only. It does not constitute a certified inspection<br>and should not be used as evidence of building code compliance.
    </p>
    <p style="font-size:0.62rem;color:#2C4A66;margin:0;">
      stAIrcode \xb7 <a href="${d}" style="color:#417CA4;">staircode.app</a>
    </p>
  </div>

</div>
</body>
</html>`;try{let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${c}`,"Content-Type":"application/json"},body:JSON.stringify({from:m,to:t,subject:g,html:F})});if(!e.ok){let t=await e.text();return console.error("[report/email] Resend error:",t),s.NextResponse.json({error:"Email send failed"},{status:502})}return console.log(`[report/email] Teaser emailed to ${t}`),s.NextResponse.json({ok:!0})}catch(e){return console.error("[report/email] Unexpected error:",e),s.NextResponse.json({error:"Unexpected error"},{status:500})}}let c=new i.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/report/email/route",pathname:"/api/report/email",filename:"route",bundlePath:"app/api/report/email/route"},resolvedPagePath:"/home/claude/stAircode/src/app/api/report/email/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:m,staticGenerationAsyncStorage:g,serverHooks:u}=c,f="/api/report/email/route";function h(){return(0,a.patchFetch)({serverHooks:u,staticGenerationAsyncStorage:g})}},6097:(e,t,r)=>{r.d(t,{h:()=>s,r:()=>l});let o=new Map,i=new Map,n=Date.now();function a(e,t,r,o){let i=Date.now(),n=e.get(t);if(!n||i-n.windowStart>r)return e.set(t,{count:1,windowStart:i}),{allowed:!0,remaining:o-1,resetMs:r};n.count++;let a=Math.max(0,o-n.count),s=r-(i-n.windowStart);return n.count>o?{allowed:!1,remaining:0,resetMs:s}:{allowed:!0,remaining:a,resetMs:s}}function s(e){!function(){let e=Date.now();e-n<3e5||(n=e,o.forEach((t,r)=>{e-t.windowStart>6e4&&o.delete(r)}),i.forEach((t,r)=>{e-t.windowStart>36e5&&i.delete(r)}))}();let t=a(o,e,6e4,15),r=a(i,e,36e5,50);return t.allowed?r.allowed?{allowed:!0,minuteRemaining:t.remaining,hourRemaining:r.remaining,retryAfterMs:0}:{allowed:!1,minuteRemaining:t.remaining,hourRemaining:0,retryAfterMs:r.resetMs,reason:"Hourly limit reached — please try again later."}:{allowed:!1,minuteRemaining:0,hourRemaining:r.remaining,retryAfterMs:t.resetMs,reason:"Too many requests — please wait a moment before trying again."}}function l(e){return e.headers.get("x-nf-client-connection-ip")??e.headers.get("x-real-ip")??e.headers.get("x-forwarded-for")?.split(",")[0].trim()??"unknown"}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),o=t.X(0,[9276,5972],()=>r(8767));module.exports=o})();