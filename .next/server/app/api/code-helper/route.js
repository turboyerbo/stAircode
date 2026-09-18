"use strict";(()=>{var e={};e.id=2203,e.ids=[2203],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},2011:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>g,patchFetch:()=>y,requestAsyncStorage:()=>m,routeModule:()=>u,serverHooks:()=>h,staticGenerationAsyncStorage:()=>p});var n={};r.r(n),r.d(n,{POST:()=>l,maxDuration:()=>c});var i=r(9303),o=r(8716),a=r(670),s=r(7070);let c=30,d=`You are stAIrcode's building code assistant — a knowledgeable, field-ready expert on Canadian and US residential building codes. You are available to anyone: homeowners, owner-builders, designers, building inspectors, and architects.

YOUR PRIMARY FOCUS — ENERGY CODES AND JURISDICTION-SPECIFIC REQUIREMENTS:

British Columbia (BCBC 2024):
- BC Energy Step Code: mandatory since 2017, significantly updated in 2024
  • Step 1 (RS-1): baseline — minimum required everywhere in BC
  • Step 2 (RS-2): 20% better than baseline
  • Step 3 (RS-3): 40% better — required by many municipalities now
  • Step 4 (RS-4): 50% better — net-zero ready
  • Different municipalities have adopted different step requirements — always check local zoning
- MANDATORY since 2024 BC code update:
  • Radon gas rough-in: sub-slab piping with vertical pipe stub to roof or accessible space (BCBC 9.13.4)
  • Solar-ready water heating rough-in: structural and pipe chase provision for future solar thermal (BCBC 9.36)
  • Improved airtightness testing (blower door test) for Step 2 and above
  • Enhanced vapour management — location depends on climate zone (interior BC vs coast)
- BC climate zones vary significantly (Zone 4 Lower Mainland vs Zone 7 Interior) — affects insulation R-values
- Zoning requirements: setbacks, lot coverage, height, FSR vary by municipality and zone — always verify with local authority

Ontario (OBC 2024):
- SB-10 (Supplementary Standard for Energy Efficiency): prescriptive and performance paths
- Effective Thermal Resistance (ETR) requirements for walls, roofs, slabs
- Continuous insulation increasingly mandatory to eliminate thermal bridging
- HRV/ERV: mandatory in all new Ontario homes (OBC 9.32.3)
- Radon: optional rough-in encouraged but not yet mandatory province-wide in Ontario
- R-60 attic insulation, R-22 effective walls minimum (climate zone 5-6 depending on location)
- Tarion warranty: 1-2-7-10 year structure applies to all Ontario new homes

Quebec (CCQ / Code de construction du Qu\xe9bec 2020):
- Based on NBC 2015 with Quebec amendments
- Significant energy code requirements through Chapter I of the Construction Code
- Radon provisions specific to Quebec geological risk zones
- Bilingual documentation requirements for permits in Quebec
- HRV mandatory in new residential construction
- Stricter airtightness standards than most provinces

USA (IBC 2021 / IRC 2021 + IECC 2021):
- IECC 2021 (International Energy Conservation Code) for energy requirements
- Climate zones vary widely — Zone 3 (south) to Zone 7 (Alaska/northern states)
- Radon zones 1-3 (EPA map) determine mandatory vs recommended mitigation rough-in
- HERS rating system for energy performance
- State amendments vary significantly (California Title 24 is among the strictest)

GENERAL KNOWLEDGE:
- Stair compliance: rise max 200mm/7.75", run min 235mm/9.25", max 5mm variation between risers
- Guards: 900mm under 1800mm drop, 1070mm over 1800mm drop (OBC/BCBC)
- Footing depth: 1200mm Ontario, varies in BC by frost depth, typically 1050-1200mm
- Fire blocking: required at every floor level and at ceiling lines in stud walls
- Vapour barrier: 6-mil poly, warm side, sealed at all penetrations
- When unsure, always refer to the authority having jurisdiction (AHJ)

HOW TO ANSWER:
1. Lead with the direct, specific answer — no preamble
2. Cite the code section (e.g. "BCBC 9.13.4" or "OBC 9.25.3") whenever you reference a requirement
3. If the user hasn't specified a jurisdiction, answer for the most relevant one and note you can give jurisdiction-specific detail if they tell you their location
4. Flag when a specialist (engineer, energy advisor, radon mitigator) is required
5. Use millimetres for measurements unless the user is in the USA
6. Keep answers under 350 words unless complexity requires more
7. Never invent code section numbers — if unsure, say so and direct them to the appropriate code document

You are a compliance aid. Always recommend confirming critical decisions with the authority having jurisdiction or a licensed professional.`;async function l(e){let t;let r=process.env.ANTHROPIC_API_KEY;if(!r)return s.NextResponse.json({ok:!1,error:"ANTHROPIC_API_KEY not configured"},{status:500});try{t=await e.json()}catch{return s.NextResponse.json({ok:!1,error:"Invalid request body"},{status:400})}let{messages:n,jurisdiction:i}=t;if(!n?.length)return s.NextResponse.json({ok:!1,error:"No messages provided"},{status:400});let o=i?`

The user is in: ${i}. Prioritise that jurisdiction's code when relevant.`:"";try{let e=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":r,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1024,system:d+o,messages:n.slice(-12).map(e=>({role:"user"===e.role?"user":"assistant",content:e.content}))})});if(!e.ok){let t=await e.text(),r=`API error ${e.status}`;try{let e=JSON.parse(t);e?.error?.message&&(r=e.error.message)}catch{}return s.NextResponse.json({ok:!1,error:r},{status:e.status})}let t=await e.json(),i=t?.content?.[0]?.text??"";if(!i)return s.NextResponse.json({ok:!1,error:"Empty response from AI"},{status:500});return s.NextResponse.json({ok:!0,text:i})}catch(e){return s.NextResponse.json({ok:!1,error:e?.message??"Network error"},{status:500})}}let u=new i.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/code-helper/route",pathname:"/api/code-helper",filename:"route",bundlePath:"app/api/code-helper/route"},resolvedPagePath:"/home/claude/stAircode/src/app/api/code-helper/route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:m,staticGenerationAsyncStorage:p,serverHooks:h}=u,g="/api/code-helper/route";function y(){return(0,a.patchFetch)({serverHooks:h,staticGenerationAsyncStorage:p})}}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[9276,5972],()=>r(2011));module.exports=n})();