"use strict";(()=>{var e={};e.id=4642,e.ids=[4642],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},7702:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>m,patchFetch:()=>h,requestAsyncStorage:()=>l,routeModule:()=>d,serverHooks:()=>g,staticGenerationAsyncStorage:()=>u});var o={};r.r(o),r.d(o,{POST:()=>c});var i=r(9303),n=r(8716),a=r(670),s=r(7070),p=r(8336);async function c(e){let t;try{let r=await e.text();t=JSON.parse(r)}catch{return s.NextResponse.json({error:"Invalid body"},{status:400})}let{email:r,jobId:o,address:i,inspectorName:n}=t;if(!r||!o)return s.NextResponse.json({error:"Missing email or jobId"},{status:400});let a=process.env.NEXT_PUBLIC_SUPABASE_URL,c=process.env.SUPABASE_SERVICE_ROLE_KEY,d="https://staircode.app",l=process.env.RESEND_API_KEY,u=process.env.EMAIL_FROM??"info@staircode.app";if(!l)return s.NextResponse.json({ok:!1,reason:"Email not configured"});let g=`${d}/?signin=1&goto=projects&project=${o}`,m=g;if(a&&c)try{let e=(0,p.createClient)(a,c,{auth:{autoRefreshToken:!1,persistSession:!1}}),{data:t}=await e.auth.admin.generateLink({type:"magiclink",email:r,options:{redirectTo:g}});t?.properties?.action_link&&(m=t.properties.action_link)}catch(e){console.warn("[magic-link] Supabase generateLink unavailable, using direct link:",e)}let h=function(e){let{address:t,inspectorName:r,magicLink:o,appUrl:i}=e;return`<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#0A1C2E;padding:2rem;text-align:center">
    <div style="font-size:1.5rem;font-weight:800;color:#F29337">stAIrcode</div>
    <div style="color:rgba(255,255,255,0.45);font-size:0.72rem;margin-top:0.2rem">by Just Open Technologies Inc.</div>
  </div>
  <div style="background:#F29337;height:5px"></div>
  <div style="padding:2rem">
    <h2 style="font-size:1.2rem;font-weight:700;color:#0A1C2E;margin:0 0 0.5rem">Inspection project started</h2>
    <p style="color:#5E7D9B;font-size:0.88rem;line-height:1.65;margin:0 0 1.5rem">
      Hi ${r}, your inspection project for
      <strong style="color:#0D1E2E">${t}</strong>
      has been created and saved. Click the button below to return to this project at any time —
      it will sign you in automatically.
    </p>
    <a href="${o}"
      style="display:block;text-align:center;padding:1rem 2rem;background:linear-gradient(135deg,#F29337,#C4721E);color:#fff;border-radius:11px;text-decoration:none;font-weight:800;font-size:1rem;margin-bottom:1.25rem;box-shadow:0 4px 16px rgba(242,147,55,0.4)">
      Continue My Inspection →
    </a>
    <div style="background:#F4F7FB;border-radius:9px;padding:0.85rem 1rem;font-size:0.78rem;color:#5E7D9B;line-height:1.65">
      This button signs you in automatically and takes you directly to your project.
      Valid for 24 hours. After that, sign in at
      <a href="${i}" style="color:#417CA4;font-weight:600">${i}</a>
      and you will find your project in My Inspections.
    </div>
  </div>
  <div style="background:#0A1C2E;padding:1.25rem 2rem">
    <p style="margin:0;color:rgba(255,255,255,0.25);font-size:0.65rem">
      stAIrcode by Just Open Technologies Inc. \xb7 staircode.app
    </p>
  </div>
</div>
</body></html>`}({address:i,inspectorName:n||"Inspector",magicLink:m,appUrl:d});try{let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${l}`},body:JSON.stringify({from:u,to:[r],subject:`Your inspection — ${i}`,html:h})});if(!e.ok)return console.error("[magic-link] Resend error:",await e.text()),s.NextResponse.json({ok:!1});return s.NextResponse.json({ok:!0})}catch(e){return console.error("[magic-link] Error:",e),s.NextResponse.json({ok:!1})}}let d=new i.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/inspection/magic-link/route",pathname:"/api/inspection/magic-link",filename:"route",bundlePath:"app/api/inspection/magic-link/route"},resolvedPagePath:"/home/claude/stAircode/src/app/api/inspection/magic-link/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:l,staticGenerationAsyncStorage:u,serverHooks:g}=d,m="/api/inspection/magic-link/route";function h(){return(0,a.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:u})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),o=t.X(0,[9276,5972,8336],()=>r(7702));module.exports=o})();