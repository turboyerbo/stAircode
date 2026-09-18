"use strict";(()=>{var e={};e.id=560,e.ids=[560],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},5839:(e,t,o)=>{o.r(t),o.d(t,{originalPathname:()=>f,patchFetch:()=>x,requestAsyncStorage:()=>c,routeModule:()=>m,serverHooks:()=>u,staticGenerationAsyncStorage:()=>g});var r={};o.r(r),o.d(r,{POST:()=>l});var i=o(9303),n=o(8716),a=o(670),d=o(7070),s=o(6097);async function l(e){let t,o,r,i,n,a,l;let m=(0,s.r)(e),c=(0,s.h)(m);if(!c.allowed)return d.NextResponse.json({error:c.reason},{status:429});try{let s=await e.json();if(t=(s.name??"").trim(),o=(s.title??"").trim(),r=(s.business??"").trim(),i=(s.comment??"").trim(),n=(s.email??"").trim(),a=(s.location??"").trim(),l=(s.codeLabel??"Building Code").trim(),!t||!o||!r||i.length<50)return d.NextResponse.json({error:"Please fill in all fields. Comment must be at least 50 characters."},{status:400})}catch{return d.NextResponse.json({error:"Invalid request"},{status:400})}let g=process.env.RESEND_API_KEY,u=process.env.EMAIL_FROM??"info@staircode.app",f=new Date().toLocaleString("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}),x=`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>New stAIrcode Beta Testimonial</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f7fb;margin:0;padding:0;">
  <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0A1C2E,#0D2B42);padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:1.5rem;font-weight:900;color:#F29337;letter-spacing:-0.02em;font-family:monospace;">stAIrcode</div>
        <div style="font-size:0.7rem;background:rgba(242,147,55,0.2);color:#F29337;border:1px solid rgba(242,147,55,0.4);padding:2px 8px;border-radius:10px;font-family:monospace;letter-spacing:0.08em;">BETA</div>
      </div>
      <div style="color:#93BAD4;font-size:0.8rem;margin-top:6px;">New Beta Testimonial — ${f}</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">

      <h2 style="margin:0 0 20px;font-size:1.1rem;color:#0A1C2E;"> New Testimonial Submitted</h2>

      <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
        <tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;width:110px;">Name</td>
          <td style="padding:10px 0;color:#0A1C2E;font-weight:700;">${p(t)}</td>
        </tr>
        <tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;">Title / Role</td>
          <td style="padding:10px 0;color:#0A1C2E;">${p(o)}</td>
        </tr>
        <tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;">Business</td>
          <td style="padding:10px 0;color:#0A1C2E;">${p(r)}</td>
        </tr>
        ${n?`<tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;">Email</td>
          <td style="padding:10px 0;color:#0A1C2E;">${p(n)}</td>
        </tr>`:""}
        ${a?`<tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;">Location</td>
          <td style="padding:10px 0;color:#0A1C2E;">${p(a)}</td>
        </tr>`:""}
        <tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;">Code</td>
          <td style="padding:10px 0;color:#0A1C2E;">${p(l)}</td>
        </tr>
      </table>

      <!-- Comment -->
      <div style="margin-top:20px;padding:16px 20px;background:#F4F7FB;border-left:4px solid #F29337;border-radius:0 10px 10px 0;">
        <div style="font-size:0.7rem;font-weight:800;color:#F29337;letter-spacing:0.1em;margin-bottom:8px;font-family:monospace;">TESTIMONIAL</div>
        <div style="font-size:0.92rem;color:#0A1C2E;line-height:1.7;">${p(i)}</div>
      </div>

      <div style="margin-top:24px;padding:14px 18px;background:#E8F5EE;border-radius:10px;font-size:0.78rem;color:#1A6B44;">
         This user has been granted a <strong>free report unlock</strong> as thanks for their testimonial.
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#F4F7FB;font-size:0.7rem;color:#8FAAB8;text-align:center;">
      stAIrcode Beta \xb7 staircode.app \xb7 This is an automated notification
    </div>
  </div>
</body>
</html>`;if(g)try{await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${g}`},body:JSON.stringify({from:u,to:["yerbury@staircode.app"],subject:` New Beta Testimonial — ${t}, ${r}`,html:x,reply_to:n||void 0})})}catch(e){console.warn("[testimonial] Failed to send email:",e)}else console.log("[testimonial] No RESEND_API_KEY — testimonial received but not emailed");let y=process.env.TESTIMONIAL_SECRET??"staircode-beta-testimonial",h=`${t}|${r}|${Date.now()}`,b=Buffer.from(`${y}:${h}`).toString("base64");return d.NextResponse.json({ok:!0,unlockToken:b})}function p(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;").replace(/\n/g,"<br>")}let m=new i.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/testimonial/route",pathname:"/api/testimonial",filename:"route",bundlePath:"app/api/testimonial/route"},resolvedPagePath:"/home/claude/stAircode/src/app/api/testimonial/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:c,staticGenerationAsyncStorage:g,serverHooks:u}=m,f="/api/testimonial/route";function x(){return(0,a.patchFetch)({serverHooks:u,staticGenerationAsyncStorage:g})}},6097:(e,t,o)=>{o.d(t,{h:()=>d,r:()=>s});let r=new Map,i=new Map,n=Date.now();function a(e,t,o,r){let i=Date.now(),n=e.get(t);if(!n||i-n.windowStart>o)return e.set(t,{count:1,windowStart:i}),{allowed:!0,remaining:r-1,resetMs:o};n.count++;let a=Math.max(0,r-n.count),d=o-(i-n.windowStart);return n.count>r?{allowed:!1,remaining:0,resetMs:d}:{allowed:!0,remaining:a,resetMs:d}}function d(e){!function(){let e=Date.now();e-n<3e5||(n=e,r.forEach((t,o)=>{e-t.windowStart>6e4&&r.delete(o)}),i.forEach((t,o)=>{e-t.windowStart>36e5&&i.delete(o)}))}();let t=a(r,e,6e4,15),o=a(i,e,36e5,50);return t.allowed?o.allowed?{allowed:!0,minuteRemaining:t.remaining,hourRemaining:o.remaining,retryAfterMs:0}:{allowed:!1,minuteRemaining:t.remaining,hourRemaining:0,retryAfterMs:o.resetMs,reason:"Hourly limit reached — please try again later."}:{allowed:!1,minuteRemaining:0,hourRemaining:o.remaining,retryAfterMs:t.resetMs,reason:"Too many requests — please wait a moment before trying again."}}function s(e){return e.headers.get("x-nf-client-connection-ip")??e.headers.get("x-real-ip")??e.headers.get("x-forwarded-for")?.split(",")[0].trim()??"unknown"}}};var t=require("../../../webpack-runtime.js");t.C(e);var o=e=>t(t.s=e),r=t.X(0,[9276,5972],()=>o(5839));module.exports=r})();