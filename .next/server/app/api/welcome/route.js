"use strict";(()=>{var e={};e.id=585,e.ids=[585],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3413:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>g,patchFetch:()=>h,requestAsyncStorage:()=>p,routeModule:()=>c,serverHooks:()=>u,staticGenerationAsyncStorage:()=>m});var o={};r.r(o),r.d(o,{POST:()=>d});var n=r(9303),i=r(8716),a=r(670),s=r(7070),l=r(6097);async function d(e){let t,r;let o=(0,l.r)(e),n=(0,l.h)(o);if(!n.allowed)return s.NextResponse.json({error:n.reason},{status:429});let i=process.env.RESEND_API_KEY;if(!i)return console.warn("[welcome] RESEND_API_KEY not set — skipping welcome email"),s.NextResponse.json({ok:!0,skipped:!0});try{let o=await e.json();if(t=o.email?.trim(),r=o.name?.trim()||t?.split("@")[0]||"there",!t||!t.includes("@"))throw Error("Invalid email")}catch{return s.NextResponse.json({error:"Invalid request"},{status:400})}let a=process.env.EMAIL_FROM??"info@staircode.app",d=`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:1.5rem 1rem;">
  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:2rem;text-align:center;background-image:repeating-linear-gradient(-45deg,#F29337 0px,#F29337 3px,transparent 3px,transparent 14px);background-size:20px 20px;">
    <div style="background:#0A1C2E;padding:1.5rem;border-radius:12px;">
      <img src="https://staircode.app/staircode_logo.png" alt="stAIrcode" style="height:44px;display:block;margin:0 auto 0.75rem;" />
      <h1 style="font-size:1.5rem;font-weight:900;color:#E8F4FF;letter-spacing:-0.02em;margin:0 0 0.4rem;">Welcome to stAIrcode</h1>
      <p style="font-size:0.85rem;color:#93BAD4;margin:0;">AI building code compliance — right from your phone.</p>
    </div>
  </div>
  <div style="background:#fff;border-left:3px solid #F29337;border-right:3px solid #F29337;padding:2rem;">
    <p style="font-size:1rem;color:#0A1C2E;line-height:1.7;margin:0 0 1rem;">Hi ${r},</p>
    <p style="font-size:0.92rem;color:#2C4A66;line-height:1.7;margin:0 0 1.5rem;">You're in — and your 7-day free trial is live. stAIrcode uses your phone camera and AI to inspect a building and check it against the code for your location, anywhere. It's built to catch the code and construction issues that get missed on a walkthrough — the ones that turn into expensive rework later.</p>

    <div style="background:#F4F7FB;border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:1.5rem;">
      <p style="font-size:0.85rem;font-weight:700;color:#0A1C2E;margin:0 0 0.9rem;">What stAIrcode does for you:</p>
      <p style="font-size:0.82rem;color:#3A5A78;line-height:1.6;margin:0 0 0.7rem;"><strong style="color:#0A1C2E;">Catch issues before they cost you.</strong> AI flags code violations and construction defects during the build — not after drywall's up, when fixing them costs 10\xd7 more.</p>
      <p style="font-size:0.82rem;color:#3A5A78;line-height:1.6;margin:0 0 0.7rem;"><strong style="color:#0A1C2E;">Save hours per inspection.</strong> Photograph a component, get instant condition and compliance analysis, and generate a professional PDF report in minutes instead of writing it up by hand.</p>
      <p style="font-size:0.82rem;color:#3A5A78;line-height:1.6;margin:0 0 0.7rem;"><strong style="color:#0A1C2E;">Pre-screen as you build.</strong> Run quick checks at each stage of construction so nothing gets buried or fails a formal inspection.</p>
      <p style="font-size:0.82rem;color:#3A5A78;line-height:1.6;margin:0 0 0.7rem;"><strong style="color:#0A1C2E;">Ask the AI anything.</strong> A built-in assistant trained on building code and construction answers your questions in plain language, on site, in real time.</p>
      <p style="font-size:0.82rem;color:#3A5A78;line-height:1.6;margin:0;"><strong style="color:#0A1C2E;">Keep it all in one place.</strong> Every photo, finding, and report is saved to your project database and retrievable from any device.</p>
    </div>

    <p style="font-size:0.85rem;color:#5E7D9B;line-height:1.6;margin:0 0 1.25rem;">New to it? A stair scan is the quickest way to see how it works — you'll have a pass/fail result in under a minute. From there, start a full inspection with as much or as little detail as you like.</p>

    <div style="text-align:center;margin-bottom:1.5rem;">
      <a href="https://staircode.app" style="display:inline-block;background:linear-gradient(135deg,#F29337,#C4721E);color:#000;font-weight:800;font-size:1rem;text-decoration:none;padding:0.95rem 2.5rem;border-radius:14px;box-shadow:0 4px 20px rgba(242,147,55,0.4);">Start My First Scan</a>
      <p style="font-size:0.72rem;color:#9DB4C5;margin:0.75rem 0 0;">Free for 7 days \xb7 then $38.99/month \xb7 cancel anytime</p>
    </div>

    <div style="background:rgba(39,169,107,0.07);border:1px solid rgba(39,169,107,0.25);border-radius:10px;padding:0.85rem 1rem;">
      <p style="font-size:0.8rem;color:#0A1C2E;font-weight:700;margin:0 0 0.25rem;">You're an early adopter</p>
      <p style="font-size:0.78rem;color:#2C4A66;line-height:1.6;margin:0;">You joined during our beta, so your feedback directly shapes what gets built next. Tell us what would make stAIrcode indispensable for your work.</p>
    </div>
  </div>
  <div style="background:#0F2438;border-radius:0 0 16px 16px;padding:1.25rem 2rem;text-align:center;">
    <p style="font-size:0.72rem;color:#4E7A9B;line-height:1.7;margin:0 0 0.4rem;">Questions? Reply to this email or contact <a href="mailto:info@staircode.app" style="color:#93BAD4;">info@staircode.app</a></p>
    <p style="font-size:0.65rem;color:#2C4A66;margin:0;">Just Open Technologies Inc. &middot; staircode.app &middot; &copy; ${new Date().getFullYear()}<br>You received this because you created an account at staircode.app.</p>
  </div>
</div>
</body>
</html>`;try{let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${i}`,"Content-Type":"application/json"},body:JSON.stringify({from:a,to:t,subject:"Welcome to stAIrcode — catch code issues before they cost you",html:d})});if(!e.ok){let t=await e.text();return console.error("[welcome] Resend error:",t),s.NextResponse.json({error:"Email send failed"},{status:502})}return console.log(`[welcome] Welcome email sent to ${t}`),s.NextResponse.json({ok:!0})}catch(e){return console.error("[welcome] Unexpected error:",e),s.NextResponse.json({error:"Unexpected error"},{status:500})}}let c=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/welcome/route",pathname:"/api/welcome",filename:"route",bundlePath:"app/api/welcome/route"},resolvedPagePath:"/home/claude/stAircode/src/app/api/welcome/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:p,staticGenerationAsyncStorage:m,serverHooks:u}=c,g="/api/welcome/route";function h(){return(0,a.patchFetch)({serverHooks:u,staticGenerationAsyncStorage:m})}},6097:(e,t,r)=>{r.d(t,{h:()=>s,r:()=>l});let o=new Map,n=new Map,i=Date.now();function a(e,t,r,o){let n=Date.now(),i=e.get(t);if(!i||n-i.windowStart>r)return e.set(t,{count:1,windowStart:n}),{allowed:!0,remaining:o-1,resetMs:r};i.count++;let a=Math.max(0,o-i.count),s=r-(n-i.windowStart);return i.count>o?{allowed:!1,remaining:0,resetMs:s}:{allowed:!0,remaining:a,resetMs:s}}function s(e){!function(){let e=Date.now();e-i<3e5||(i=e,o.forEach((t,r)=>{e-t.windowStart>6e4&&o.delete(r)}),n.forEach((t,r)=>{e-t.windowStart>36e5&&n.delete(r)}))}();let t=a(o,e,6e4,15),r=a(n,e,36e5,50);return t.allowed?r.allowed?{allowed:!0,minuteRemaining:t.remaining,hourRemaining:r.remaining,retryAfterMs:0}:{allowed:!1,minuteRemaining:t.remaining,hourRemaining:0,retryAfterMs:r.resetMs,reason:"Hourly limit reached — please try again later."}:{allowed:!1,minuteRemaining:0,hourRemaining:r.remaining,retryAfterMs:t.resetMs,reason:"Too many requests — please wait a moment before trying again."}}function l(e){return e.headers.get("x-nf-client-connection-ip")??e.headers.get("x-real-ip")??e.headers.get("x-forwarded-for")?.split(",")[0].trim()??"unknown"}}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),o=t.X(0,[9276,5972],()=>r(3413));module.exports=o})();