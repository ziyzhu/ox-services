window.ox.install(({ action }) => {
const retryFetch = async (input, init, options) => {
  const method = String(init?.method ?? "GET").toUpperCase();
  const retries = ["GET", "HEAD"].includes(method) ? (options?.retries ?? 3) : 0;
  const delay = options?.delay ?? 400;
  const factor = options?.factor ?? 2;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await window.fetch(input, init);
      const retryable = response.status === 408 || response.status === 429
        || (response.status >= 500 && response.status <= 599);
      if (response.ok || !retryable || attempt >= retries) return response;
      console.log(`retryFetch: status ${response.status}, attempt ${attempt + 1}/${retries}`);
    } catch (error) {
      const message = String(error?.message ?? "");
      const retryable = message.includes("Load failed")
        || message.includes("NetworkError")
        || message.includes("Failed to fetch");
      if (!retryable || attempt >= retries) throw error;
      console.log(`retryFetch: network ${JSON.stringify(message)}, attempt ${attempt + 1}/${retries}`);
    }
    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(factor, attempt)));
  }
};


  const cleanText = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const text = v => cleanText(String(v == null ? "" : v));
  const arr = v => Array.isArray(v) ? v.map(text).filter(Boolean) : [];
  const trademarkFields = ["abandonDate","alive","attorney","cancelDate","coordinatedClass","currentBasis","designCodeDescription","disclaimer","drawingCode","filedDate","goodsAndServices","id","internationalClass","markDescription","markType","originalBasis","ownerName","ownerType","priorityDate","publishForOppositionDate","registrationDate","registrationId","registrationType","supplementalRegistrationDate","translation","usClass","wordmark","wordmarkPseudoText"];
  function trademarkBody(query, size, from, id) { const must = id ? [{term:{_id:id}}] : [{bool:{should:[{match_phrase:{WM:{query,boost:5}}},{match:{WM:{query,boost:2}}},{match_phrase:{PM:{query,boost:2}}}]}}]; return {query:{bool:{must}},size,from,track_total_hits:true,_source:trademarkFields}; }
  function mapTrademark(hit, detail=false) { const s=hit && hit.source || {}; const out={id:text(s.id||hit.id),wordmark:s.wordmark==null?null:text(s.wordmark),alive:Boolean(s.alive),filedDate:s.filedDate==null?null:text(s.filedDate),registrationId:s.registrationId==null?null:text(s.registrationId),registrationDate:s.registrationDate==null?null:text(s.registrationDate),ownerNames:arr(s.ownerName),internationalClasses:arr(s.internationalClass),markTypes:arr(s.markType),goodsAndServices:arr(s.goodsAndServices)}; if(detail){out.attorney=s.attorney==null?null:text(s.attorney);out.markDescriptions=arr(s.markDescription);out.designCodeDescriptions=arr(s.designCodeDescription);} return out; }
  async function tmRequest(body){ const res=await retryFetch("https://tmsearch.uspto.gov/prod-stage-v1-0-0/tmsearch",{method:"POST",credentials:"include",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify(body)}); if(!res.ok) throw new Error("USPTO trademark search failed ("+res.status+")"); const j=await res.json(); if(!j||!j.hits||!Array.isArray(j.hits.hits)) throw new Error("Unexpected trademark search response"); return j; }
  action("searchSite",{async invoke(args){const limit=args.limit==null?10:args.limit;const url=new URL("https://www.uspto.gov/search");url.searchParams.set("searchDomain","USPTO");url.searchParams.set("source","homepage");url.searchParams.set("fresh","1");url.searchParams.set("q",args.query);const res=await retryFetch(url.href,{credentials:"include"});if(!res.ok)throw new Error("USPTO site search failed ("+res.status+")");const doc=new DOMParser().parseFromString(await res.text(),"text/html");const nodes=[...doc.querySelectorAll("#bestBetsList > li, #resultsList > li")];const items=[];for(const li of nodes){const a=li.querySelector(".result-title-link a");if(!a)continue;const title=text(a.querySelector(".link-text")?.textContent||a.textContent);const href=a.getAttribute("href");const resultUrl=href?new URL(href,url.href).href:"";const description=text(li.querySelector(".result-description")?.textContent||"");if(title&&resultUrl&&!items.some(x=>x.url===resultUrl))items.push({title,url:resultUrl,description});if(items.length>=limit)break;}return {items,nextCursor:null};}});
  action("searchTrademarks",{async invoke(args){const limit=args.limit==null?20:args.limit;const from=args.cursor?Number(args.cursor):0;const j=await tmRequest(trademarkBody(args.query,limit,from,null));const total=Number(j.hits.totalValue||0);const items=j.hits.hits.map(h=>mapTrademark(h));return {items,total,nextCursor:from+items.length<total?String(from+items.length):null};}});
  action("getTrademark",{async invoke(args){const j=await tmRequest(trademarkBody("",1,0,args.id));const h=j.hits.hits[0];if(!h)throw new Error("Trademark record not found");return mapTrademark(h,true);}});
  action("getSignInUrl",{async invoke(){return {url:"https://patentcenter.uspto.gov/"};}});
  action("getSignInState",{async invoke(){let res;try{res=await retryFetch("https://patentcenter.uspto.gov/manage/private/v1/enrollment/verify",{credentials:"include",headers:{accept:"application/json"},redirect:"manual"});}catch(e){throw new Error("Unable to check USPTO session");}if(res.status===401||res.status===403)return {signedIn:false};if(res.status!==200)throw new Error("Unexpected USPTO session status ("+res.status+")");let j;try{j=await res.json();}catch{throw new Error("Unexpected USPTO session response");}if(typeof j.status!=="boolean")throw new Error("Unclassified USPTO session response");return {signedIn:true};}});
  action("getAccountAccess",{async invoke(){const res=await retryFetch("https://patentcenter.uspto.gov/manage/public/access/status",{credentials:"include",headers:{accept:"application/json"}});if(res.status===401||res.status===403)throw new Error("USPTO sign-in required");if(!res.ok)throw new Error("Unable to read Patent Center access ("+res.status+")");const j=await res.json();for(const k of ["accessLevel","accessLevelRetrieval","accessLevelFiling"])if(typeof j[k]!=="string")throw new Error("Unexpected Patent Center access response");return {accessLevel:text(j.accessLevel),retrievalAccessLevel:text(j.accessLevelRetrieval),filingAccessLevel:text(j.accessLevelFiling)};}});
});
