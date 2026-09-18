"use strict";(()=>{var e={};e.id=5755,e.ids=[5755],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4931:(e,t,n)=>{n.r(t),n.d(t,{originalPathname:()=>y,patchFetch:()=>x,requestAsyncStorage:()=>w,routeModule:()=>h,serverHooks:()=>f,staticGenerationAsyncStorage:()=>b});var r={};n.r(r),n.d(r,{POST:()=>m,maxDuration:()=>c});var a=n(9303),i=n(8716),o=n(670),s=n(7070),l=n(6097);let c=60,u="https://api.anthropic.com/v1/messages",d="claude-sonnet-4-5";function p(e){let t=e?.address??"Not specified",n=(e?.province??"").toLowerCase(),r=n.includes("ontario")||"on"===n?"Ontario Building Code 2024":n.includes("quebec")||n.includes("qu\xe9bec")||"qc"===n?"Code de construction du Qu\xe9bec (CCQ 2015 / RBQ)":n.includes("british columbia")||"bc"===n?"BC Building Code 2024":n.includes("alberta")||"ab"===n?"Alberta Building Code 2019":e?.province?`${e.province} Building Code (NBC 2020 base)`:"applicable building code";return`You are an expert building inspector and code compliance consultant specialising in residential construction documentation. You are analysing approved architectural drawings for a building inspection.

PROPERTY: ${t}
APPLICABLE CODE: ${r}

You have been given the approved drawings submitted to and approved by the Authority Having Jurisdiction (AHJ) / municipality. These drawings represent the design intention that was legally approved. During the inspection, field conditions will be checked against these drawings.

YOUR ROLE:
1. Extract key compliance data from the drawings: permit numbers, setbacks, lot coverage, building height, occupancy class, construction type, etc.
2. Answer specific questions about the drawings: "What is the approved ceiling height?", "What fire separation is required between the garage and house?"
3. Flag any code compliance issues visible in the approved drawings
4. When field conditions are later described, compare them to these drawings

Be precise. Quote section numbers, dimension callouts, and note titles from the drawings directly. If information is not visible in the provided pages, say so clearly.

IMPORTANT: These are APPROVED drawings. Differences between these and field conditions are deficiencies that must be documented.`}let g=`Analyse these architectural drawings and extract all available information. Look at:
- Title block (permit number, date, applicant, architect, engineer, address)
- Site plan (setbacks, lot coverage, lot area, building area, parking)
- Building sections and elevations (heights, stories)
- Occupancy classification notes
- Construction type notes
- Any code compliance tables or summaries

Reply ONLY with valid JSON, no markdown:
{
  "permitNumber": "string or null",
  "permitDate": "string or null",
  "applicant": "string or null",
  "architect": "string or null",
  "engineer": "string or null",
  "projectAddress": "string or null",
  "zoneClass": "string or null",
  "lotArea": "number in m\xb2 or null",
  "buildingArea": "number in m\xb2 or null",
  "grossFloorArea": "number in m\xb2 or null",
  "lotCoverage": "percentage string or null",
  "frontSetback": "number in metres or null",
  "rearSetback": "number in metres or null",
  "sideSetbackLeft": "number in metres or null",
  "sideSetbackRight": "number in metres or null",
  "buildingHeight": "number in metres or null",
  "stories": "number or null",
  "parkingSpaces": "number or null",
  "fireSeparation": "string describing fire separation requirements or null",
  "occupancyClass": "string e.g. Group C — Residential or null",
  "constructionType": "string e.g. Part 9 — Wood Frame or null",
  "drawingSheets": "array of sheet names/numbers found",
  "revisionDate": "string or null",
  "codeNotes": "array of important code compliance notes from the drawings",
  "summary": "2-3 sentence description of what these drawings show"
}`;async function m(e){let t;let n=(0,l.r)(e),r=(0,l.h)(n);if(!r.allowed)return s.NextResponse.json({error:r.reason},{status:429});let a=process.env.ANTHROPIC_API_KEY;if(!a)return s.NextResponse.json({error:"API key not configured"},{status:503});try{t=await e.json()}catch{return s.NextResponse.json({error:"Invalid request"},{status:400})}let{mode:i="extract",pages:o=[],messages:c=[],userMessage:m="",jobContext:h}=t;if(!o?.length)return s.NextResponse.json({error:"No drawing pages provided"},{status:400});if(o.length>20)return s.NextResponse.json({error:"Maximum 20 pages per upload"},{status:400});let w=o.slice(0,8).map(e=>({type:"image",source:{type:"base64",media_type:e.startsWith("/9j/")?"image/jpeg":"image/png",data:e}}));try{if("extract"===i){let e=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json","x-api-key":a,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:d,max_tokens:4096,system:p(h),messages:[{role:"user",content:[...w,{type:"text",text:g}]}]})});if(!e.ok){let t=await e.text();return console.error("[drawings-chat/extract]",e.status,t),s.NextResponse.json({error:"AI extraction failed"},{status:502})}let t=await e.json(),n=t.content?.[0]?.text??"",r=null;try{let e=n.replace(/```json|```/g,"").trim().match(/\{[\s\S]*\}/);e&&(r=JSON.parse(e[0]))}catch{}return s.NextResponse.json({text:n,fields:r})}{let e=[...0===c.length?[{role:"user",content:[...w,{type:"text",text:`I have uploaded the approved architectural drawings. ${m||"Please introduce yourself and give me a brief summary of what you can see in these drawings."}`}]}]:[{role:"user",content:[...w,{type:"text",text:"These are the approved architectural drawings."}]},{role:"assistant",content:"I have reviewed the approved architectural drawings. I can answer questions about the design, dimensions, code compliance requirements, setbacks, and any other information shown in the documents."},...c,{role:"user",content:m}]],t=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json","x-api-key":a,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:d,max_tokens:2048,system:p(h),messages:e})});if(!t.ok){let e=await t.text();return console.error("[drawings-chat/chat]",t.status,e),s.NextResponse.json({error:"AI chat failed"},{status:502})}let n=await t.json(),r=n.content?.[0]?.text??"";return s.NextResponse.json({text:r})}}catch(e){return console.error("[drawings-chat] Error:",e),s.NextResponse.json({error:"Service error"},{status:503})}}let h=new a.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/drawings-chat/route",pathname:"/api/drawings-chat",filename:"route",bundlePath:"app/api/drawings-chat/route"},resolvedPagePath:"/home/claude/stAircode/src/app/api/drawings-chat/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:w,staticGenerationAsyncStorage:b,serverHooks:f}=h,y="/api/drawings-chat/route";function x(){return(0,o.patchFetch)({serverHooks:f,staticGenerationAsyncStorage:b})}},6097:(e,t,n)=>{n.d(t,{h:()=>s,r:()=>l});let r=new Map,a=new Map,i=Date.now();function o(e,t,n,r){let a=Date.now(),i=e.get(t);if(!i||a-i.windowStart>n)return e.set(t,{count:1,windowStart:a}),{allowed:!0,remaining:r-1,resetMs:n};i.count++;let o=Math.max(0,r-i.count),s=n-(a-i.windowStart);return i.count>r?{allowed:!1,remaining:0,resetMs:s}:{allowed:!0,remaining:o,resetMs:s}}function s(e){!function(){let e=Date.now();e-i<3e5||(i=e,r.forEach((t,n)=>{e-t.windowStart>6e4&&r.delete(n)}),a.forEach((t,n)=>{e-t.windowStart>36e5&&a.delete(n)}))}();let t=o(r,e,6e4,15),n=o(a,e,36e5,50);return t.allowed?n.allowed?{allowed:!0,minuteRemaining:t.remaining,hourRemaining:n.remaining,retryAfterMs:0}:{allowed:!1,minuteRemaining:t.remaining,hourRemaining:0,retryAfterMs:n.resetMs,reason:"Hourly limit reached — please try again later."}:{allowed:!1,minuteRemaining:0,hourRemaining:n.remaining,retryAfterMs:t.resetMs,reason:"Too many requests — please wait a moment before trying again."}}function l(e){return e.headers.get("x-nf-client-connection-ip")??e.headers.get("x-real-ip")??e.headers.get("x-forwarded-for")?.split(",")[0].trim()??"unknown"}}};var t=require("../../../webpack-runtime.js");t.C(e);var n=e=>t(t.s=e),r=t.X(0,[9276,5972],()=>n(4931));module.exports=r})();