"use strict";(()=>{var e={};e.id=8551,e.ids=[8551],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},2007:e=>{e.exports=require("pdf-lib")},2787:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>h,patchFetch:()=>y,requestAsyncStorage:()=>g,routeModule:()=>m,serverHooks:()=>u,staticGenerationAsyncStorage:()=>f});var o={};r.r(o),r.d(o,{POST:()=>c,maxDuration:()=>p});var i=r(9303),n=r(8716),a=r(670),s=r(7070),d=r(6356),l=r(8336);let p=60;async function c(e){let t;try{t=await e.json()}catch{return s.NextResponse.json({error:"Invalid request"},{status:400})}let{job:r}=t;if(!r?.id)return s.NextResponse.json({error:"Missing job data"},{status:400});try{console.log(`[generate-inspection] Generating report for job ${r.id}`);let e=await (0,d.Pj)(r),t=e.toString("base64"),o=null,i=process.env.NEXT_PUBLIC_SUPABASE_URL,n=process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(i&&n)try{let t=(0,l.createClient)(i,n),a=`inspection-${r.id}-${Date.now()}.pdf`,s=`inspection-reports/${a}`,{error:d}=await t.storage.from("reports").upload(s,e,{contentType:"application/pdf",cacheControl:"3600",upsert:!0});if(!d){let{data:e}=t.storage.from("reports").getPublicUrl(s);o=e?.publicUrl??null,await t.from("inspection_jobs").update({report_url:o,updated_at:new Date().toISOString()}).eq("id",r.id),console.log(`[generate-inspection] Report uploaded: ${o}`)}}catch(e){console.warn("[generate-inspection] Storage upload failed:",e)}let a=[],p=process.env.RESEND_API_KEY,c=process.env.EMAIL_FROM??"info@staircode.app";if([r.clientEmail,void(r.inspectorName&&(r.clientEmail,r.clientEmail))].filter(Boolean),p&&r.clientEmail)try{let e=function(e,t){let r=`${e.address.street}, ${e.address.city}, ${e.address.province}`,o=new Date(e.inspectionDate).toLocaleDateString("en-CA",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),i=0,n=0;for(let t of e.phases)for(let e of t.modules)for(let t of e.findings)n++,("major"===t.severity||"critical"===t.severity)&&i++;return`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

  <!-- Header -->
  <div style="background:#0A1C2E;padding:2rem 2rem 1.5rem;text-align:center">
    <div style="font-size:1.5rem;font-weight:800;color:#F29337;letter-spacing:-0.02em">stAIrcode</div>
    <div style="color:rgba(255,255,255,0.6);font-size:0.78rem;margin-top:0.25rem">by Just Open Technologies Inc.</div>
  </div>

  <!-- Orange bar -->
  <div style="background:#F29337;height:5px"></div>

  <!-- Body -->
  <div style="padding:2rem">
    <h2 style="font-size:1.3rem;font-weight:700;color:#0A1C2E;margin:0 0 0.5rem">Your Inspection Report is Ready</h2>
    <p style="color:#5E7D9B;margin:0 0 1.5rem;line-height:1.6">The full building inspection report for <strong>${r}</strong> has been generated and is attached to this email as a PDF.</p>

    <!-- Property summary -->
    <div style="background:#F4F7FB;border-radius:10px;padding:1.25rem;margin-bottom:1.5rem">
      <div style="font-size:0.68rem;font-weight:700;color:#417CA4;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.75rem">Inspection Summary</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:0.35rem 0;font-size:0.85rem;color:#5E7D9B;width:45%">Property</td>
          <td style="padding:0.35rem 0;font-size:0.85rem;font-weight:600;color:#0D1E2E">${r}</td>
        </tr>
        <tr>
          <td style="padding:0.35rem 0;font-size:0.85rem;color:#5E7D9B">Date</td>
          <td style="padding:0.35rem 0;font-size:0.85rem;font-weight:600;color:#0D1E2E">${o}</td>
        </tr>
        <tr>
          <td style="padding:0.35rem 0;font-size:0.85rem;color:#5E7D9B">Inspected by</td>
          <td style="padding:0.35rem 0;font-size:0.85rem;font-weight:600;color:#0D1E2E">${e.inspectorName||"Inspector"}</td>
        </tr>
        <tr>
          <td style="padding:0.35rem 0;font-size:0.85rem;color:#5E7D9B">Total observations</td>
          <td style="padding:0.35rem 0;font-size:0.85rem;font-weight:600;color:#0D1E2E">${n}</td>
        </tr>
        ${i>0?`<tr>
          <td style="padding:0.35rem 0;font-size:0.85rem;color:#5E7D9B">Significant findings</td>
          <td style="padding:0.35rem 0;font-size:0.85rem;font-weight:700;color:#E84545">${i} item${1!==i?"s":""} requiring attention</td>
        </tr>`:""}
      </table>
    </div>

    <p style="color:#5E7D9B;font-size:0.85rem;line-height:1.6">The full report PDF is attached to this email. ${t?`You can also <a href="${t}" style="color:#417CA4">download it here</a>.`:""}</p>

    ${i>0?`<div style="background:rgba(232,69,69,0.06);border:1px solid rgba(232,69,69,0.2);border-radius:8px;padding:1rem;margin:1rem 0;font-size:0.85rem;color:#C44000">
      <strong>${i} significant finding${1!==i?"s":""}</strong> require${1===i?"s":""} attention. Please review the Summary section of the report.
    </div>`:""}

    <a href="https://staircode.app" style="display:inline-block;margin-top:1rem;padding:0.85rem 2rem;background:linear-gradient(135deg,#F29337,#C4721E);color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.9rem">Open stAIrcode →</a>
  </div>

  <!-- Footer -->
  <div style="background:#0A1C2E;padding:1.25rem 2rem;margin-top:1.5rem">
    <p style="margin:0;color:rgba(255,255,255,0.45);font-size:0.72rem;line-height:1.6">
      This report was generated by stAIrcode and is a visual inspection aid only. It does not replace an inspection by a licensed professional. All findings should be verified by qualified tradespeople before taking action.
    </p>
    <p style="margin:0.75rem 0 0;color:rgba(255,255,255,0.25);font-size:0.65rem">
      stAIrcode by Just Open Technologies Inc. \xb7 staircode.app
    </p>
  </div>
</div>
</body>
</html>`}(r,o),i=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${p}`},body:JSON.stringify({from:c,to:[r.clientEmail],subject:`Building Inspection Report — ${r.address.street}, ${r.address.city}`,html:e,attachments:[{filename:`inspection-report-${r.address.street.replace(/[^a-zA-Z0-9]/g,"-")}.pdf`,content:t,content_type:"application/pdf"}]})});if(i.ok)a.push(r.clientEmail),console.log(`[generate-inspection] Email sent to ${r.clientEmail}`);else{let e=await i.text();console.error("[generate-inspection] Email error:",e)}}catch(e){console.error("[generate-inspection] Email failed:",e)}return s.NextResponse.json({ok:!0,pdfBase64:t,reportUrl:o,emailsSent:a,message:a.length>0?`Report generated and emailed to ${a.join(", ")}`:"Report generated. Add a client email address to send by email."})}catch(e){return console.error("[generate-inspection] Error:",e),s.NextResponse.json({error:e?.message??"Report generation failed"},{status:500})}}let m=new i.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/report/generate-inspection/route",pathname:"/api/report/generate-inspection",filename:"route",bundlePath:"app/api/report/generate-inspection/route"},resolvedPagePath:"/home/claude/stAircode/src/app/api/report/generate-inspection/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:g,staticGenerationAsyncStorage:f,serverHooks:u}=m,h="/api/report/generate-inspection/route";function y(){return(0,a.patchFetch)({serverHooks:u,staticGenerationAsyncStorage:f})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),o=t.X(0,[9276,5972,8336,7098,6356],()=>r(2787));module.exports=o})();