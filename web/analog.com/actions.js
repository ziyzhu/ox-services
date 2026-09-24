window.ox.install(({ action }) => {
  const cleanText = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const valid = /^[A-Za-z0-9+_.-]{3,80}$/;
  const norm = v => { const m=cleanText(String(v||"" )).toUpperCase(); if(!valid.test(m)) throw new Error("请输入有效的 ADI 型号。"); return m; };
  const num=v=>{if(v===null||v===undefined||v==="")return null;const n=Number(String(v).replace(/,/g,""));return Number.isFinite(n)?n:null};
  const families=m=>{const a=[];const x=m.match(/^(ADUM\d+[A-Z]*|ADXL\d+[A-Z]*|ADM\d+[A-Z]*|AD\d+[A-Z]*|LTC\d+[A-Z]*)/i);if(x){a.push(x[1].toLowerCase());a.push(x[1].replace(/[A-Z]+$/i,"").toLowerCase());const b=m.match(/^(ADM258[27]E)/i);if(b)a.unshift(b[1].toLowerCase())}return[...new Set(a.filter(Boolean))]};
  async function one(input,country){const model=norm(input),retrievedAt=new Date().toISOString();let page=null;for(const f of families(model)){const url="https://www.analog.com/en/products/"+f+"/sample-buy.html";try{const r=await fetch(url,{credentials:"include"});if(!r.ok)continue;const raw=await r.text(),d=new DOMParser().parseFromString(raw,"text/html"),text=cleanText(d.body?.innerText||"");if((text+" "+raw).toUpperCase().includes(model)){page={url,text,raw,family:(d.title.match(/^([^ ]+) Sample & Buy/i)||[])[1]||f.toUpperCase()};break}}catch(_){}}
    if(!page)return{model,family:null,status:"not_found",productUrl:null,sampleBuyUrl:null,lifecycle:null,adiStock:null,leadTime:null,prices:[],sampleAvailable:false,quoteAvailable:false,sellers:[],message:"未找到对应的官方 Sample & Buy 页面。",retrievedAt};
    let data={};try{const r=await fetch("https://eshop.analog.com/modelService/product/PostSampleBuyData",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({CountryID:country||"US",ExcludeThirdParty:false,ProductIDList:[model],Type:"pdp",LanguageCode:"en"})});if(r.ok)data=await r.json()}catch(_){}
    const offers=Array.isArray(data[model])?data[model]:[],adi=offers.find(x=>String(x.name).toUpperCase()==="ADI"),sellers=offers.filter(x=>String(x.name).toUpperCase()!=="ADI").map(x=>({name:cleanText(x.name||"Distributor"),stock:num(x.stock),purchaseAvailable:!!x.purchase,url:x.distiurl||null}));
    const p=page.text.toUpperCase().indexOf(model),block=p>=0?page.text.slice(p,p+2200):"",life=(block.match(/(?:^|\n)(PRODUCTION|PRE-RELEASE|NOT RECOMMENDED FOR NEW DESIGNS|OBSOLETE|LAST TIME BUY)(?:\n|$)/i)||[])[1]||null,lead=(block.match(/Ships in [^\n]+/i)||[])[0]||null,lines=block.split("\n").map(cleanText).filter(Boolean),prices=[];for(let j=0;j<lines.length-1;j++)if(/^(?:\d+(?:\.\d+)?[KkMm]?u?|\d+[KkMm]?)$/.test(lines[j])&&/^\$[0-9,.]+$/.test(lines[j+1]))prices.push({quantity:lines[j],unitPrice:lines[j+1]});
    return{model,family:page.family,status:"found",productUrl:"https://www.analog.com/en/products/"+page.family.toLowerCase()+".html",sampleBuyUrl:page.url,lifecycle:life?cleanText(life):null,adiStock:num(adi?.stock),leadTime:lead,prices,sampleAvailable:!!adi?.sample||/\nSample\n/i.test(block),quoteAvailable:/Request Quote/i.test(block),sellers,message:null,retrievedAt};
  }
  action("getSignInUrl",{async invoke(){return{url:"https://my.analog.com/"}}});
  action("getSignInState",{async invoke(){
    const raw=localStorage.getItem("active-tokens");
    let token=null;
    try{token=raw?JSON.parse(raw)?.my?.token:null}catch(_){throw new Error("无法读取 myAnalog 会话凭据。")} 
    const headers={"content-type":"application/json"};
    if(token)headers.authorization="Bearer "+token;
    let response;
    try{response=await fetch("https://myapi.analog.com/api/user/notification?context=sampleandbuy&languageCode=en",{credentials:"include",headers})}catch(_){throw new Error("无法连接 myAnalog 会话验证服务。")} 
    if(response.status===401||response.status===403)return{signedIn:false};
    if(response.status!==200)throw new Error("myAnalog 会话验证返回意外状态："+response.status);
    let body;
    try{body=await response.json()}catch(_){throw new Error("myAnalog 会话验证响应无法解析。")} 
    if(!body||body.context!=="sampleandbuy"||typeof body.notificationType!=="string")throw new Error("myAnalog 会话验证响应格式异常。");
    return{signedIn:true};
  }});
  action("searchProducts",{async invoke(args){const q=cleanText(String(args.query||""));if(q.length<2)throw new Error("搜索词太短。");const limit=Math.max(1,Math.min(20,Number(args.limit||10)));await new Promise(r=>setTimeout(r,500));const seen=new Set(),items=[];for(const a of document.querySelectorAll('a[href*="/en/products/"]')){const url=a.href.split("#")[0],title=cleanText(a.innerText||a.getAttribute("aria-label")||"");if(!title||!(title+" "+url).toLowerCase().includes(q.toLowerCase())||seen.has(url))continue;seen.add(url);items.push({name:((url.match(/\/products\/([^/.]+)/i)||[])[1]||q).toUpperCase(),title,url,snippet:title});if(items.length>=limit)break}if(!items.length&&valid.test(q)){const x=await one(q,"US");if(x.status==="found")items.push({name:x.model,title:(x.family||x.model)+" Sample & Buy",url:x.sampleBuyUrl,snippet:"Analog Devices 官方购买页面"})}return{items,nextCursor:null}}});
  action("getPurchasingDetails",{async invoke(args){return await one(args.model,args.country||"US")}});
  action("compareParts",{async invoke(args){if(!Array.isArray(args.models)||!args.models.length||args.models.length>20)throw new Error("请提供 1 至 20 个型号。");const items=[];for(const m of args.models)items.push(await one(m,args.country||"US"));return{items,retrievedAt:new Date().toISOString()}}});
});
