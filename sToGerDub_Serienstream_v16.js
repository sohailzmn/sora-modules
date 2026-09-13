const V11_SCRIPT_URL_V16 = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v11.js?rev=20260913-1755";
const STO_BASE_V16 = "https://serienstream.to";
const STO_UA_V16 = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

var __v16Loaded = false;
var __v16Loading = null;
var __v16 = { search:null, details:null, episodes:null, extractHosters:null, providerKey:null, multi:null, getCredentials:null, formEncode:null, absolute:null, isSto:null };

async function __v16Text(url) {
  try {
    var r = await fetchv2(url, {"Accept":"text/plain","User-Agent":STO_UA_V16}, "GET", null, true);
    if (!r) return "";
    if (typeof r === "string") return r;
    if (typeof r.text === "function") return await r.text();
    return String(r || "");
  } catch(e) { return ""; }
}

async function __v16Read(r) {
  if (!r) return "";
  if (typeof r === "string") return r;
  try { if (typeof r.text === "function") return await r.text(); } catch(e) {}
  return "";
}

function __v16Header(headers, wanted) {
  if (!headers) return "";
  var lower = String(wanted || "").toLowerCase();
  for (var k in headers) {
    if (Object.prototype.hasOwnProperty.call(headers,k) && String(k).toLowerCase() === lower) return String(headers[k] || "");
  }
  return "";
}

function __v16Attr(tag, name) {
  var re = new RegExp("(?:^|\\s)"+name+"\\s*=\\s*(?:\\\"([^\\\"]*)\\\"|'([^']*)'|([^\\s>]+))","i");
  var m = String(tag||"").match(re);
  return m ? (m[1]!==undefined?m[1]:(m[2]!==undefined?m[2]:(m[3]||""))) : "";
}

function __v16CollectFields(html) {
  var fields = {}, re=/<input\b[^>]*>/gi, m;
  while ((m=re.exec(String(html||"")))!==null) {
    var tag=m[0], name=__v16Attr(tag,"name");
    if (!name) continue;
    var type=__v16Attr(tag,"type").toLowerCase();
    if (type==="submit"||type==="button"||type==="image"||type==="file") continue;
    fields[name]=__v16Attr(tag,"value");
  }
  return fields;
}

function __v16LooksLoggedIn(html) {
  html=String(html||"");
  return /\/home\/logout|href=[\"'][^\"']*(?:logout|abmelden)|\babmelden\b|mein\s*konto|account-settings/i.test(html);
}
function __v16LooksLikeLogin(html) {
  html=String(html||"");
  return /name=[\"']password[\"']/i.test(html)&&/name=[\"']email[\"']/i.test(html);
}
function __v16Diag(lines) {
  var streams=[];
  for (var i=0;i<lines.length;i++) streams.push({title:"DIAG "+(i+1)+" • "+String(lines[i]||"").slice(0,120),streamUrl:"https://example.com/serienstream-v16-diag-"+(i+1)+".m3u8"});
  return JSON.stringify({streams:streams,subtitles:[]});
}

async function __v16Native(url, headers, method, body, followRedirects) {
  var h={"User-Agent":STO_UA_V16,"Accept-Language":"de-DE,de;q=0.9,en;q=0.8"};
  headers=headers||{};
  for (var k in headers) {
    if (String(k).toLowerCase()==="cookie") continue;
    h[k]=headers[k];
  }
  try { return await fetchv2(url,h,method||"GET",body||null,followRedirects!==false); }
  catch(e) { return null; }
}

async function __v16Load() {
  if (__v16Loaded) return true;
  if (__v16Loading) return await __v16Loading;
  __v16Loading=(async function(){
    try {
      var source=await __v16Text(V11_SCRIPT_URL_V16);
      if (!source) return false;
      source=source.replace(/async\s+function\s+extractStreamUrl\s*\(/,"async function __v11LegacyStreamV16(");
      source+="\n;__v16.search=(typeof searchResults==='function')?searchResults:null;";
      source+="\n;__v16.details=(typeof extractDetails==='function')?extractDetails:null;";
      source+="\n;__v16.episodes=(typeof extractEpisodes==='function')?extractEpisodes:null;";
      source+="\n;__v16.extractHosters=(typeof __v11!=='undefined'&&__v11)?__v11.extractHosters:null;";
      source+="\n;__v16.providerKey=(typeof __v11!=='undefined'&&__v11)?__v11.providerKey:null;";
      source+="\n;__v16.multi=(typeof __v11!=='undefined'&&__v11)?__v11.multi:null;";
      source+="\n;__v16.getCredentials=(typeof __v11!=='undefined'&&__v11)?__v11.getCredentials:null;";
      source+="\n;__v16.formEncode=(typeof __v11!=='undefined'&&__v11)?__v11.formEncode:null;";
      source+="\n;__v16.absolute=(typeof __v11!=='undefined'&&__v11)?__v11.absolute:null;";
      source+="\n;__v16.isSto=(typeof __v11!=='undefined'&&__v11)?__v11.isSto:null;";
      eval(source);
      if (typeof __v11Load==="function") await __v11Load();
      if (typeof __v11!=="undefined"&&__v11) {
        if (!__v16.extractHosters) __v16.extractHosters=__v11.extractHosters;
        if (!__v16.providerKey) __v16.providerKey=__v11.providerKey;
        if (!__v16.multi) __v16.multi=__v11.multi;
        if (!__v16.getCredentials) __v16.getCredentials=__v11.getCredentials;
        if (!__v16.formEncode) __v16.formEncode=__v11.formEncode;
        if (!__v16.absolute) __v16.absolute=__v11.absolute;
        if (!__v16.isSto) __v16.isSto=__v11.isSto;
      }
      __v16Loaded=!!(__v16.search&&__v16.details&&__v16.episodes&&__v16.extractHosters&&__v16.providerKey&&__v16.multi&&__v16.getCredentials&&__v16.formEncode&&__v16.absolute&&__v16.isSto);
      return __v16Loaded;
    } catch(e) { console.log("[SerienStream v16] load failed:",e); return false; }
    finally { __v16Loading=null; }
  })();
  return await __v16Loading;
}

async function __v16LoginNative() {
  var out={ok:false,getStatus:0,postStatus:0,accountStatus:0,accountLocation:"",fields:0,reason:"unknown"};
  var creds=__v16.getCredentials?__v16.getCredentials():null;
  if (!creds||!creds.email||!creds.password||String(creds.email).indexOf("__PUT_")===0) { out.reason="credentials missing"; return out; }

  var loginPage=await __v16Native(STO_BASE_V16+"/login",{"Accept":"text/html,application/xhtml+xml"},"GET",null,true);
  out.getStatus=Number((loginPage&&loginPage.status)||0);
  var loginHtml=await __v16Read(loginPage);
  if (__v16LooksLoggedIn(loginHtml)) { out.ok=true; out.reason="already authenticated"; return out; }

  var payload=__v16CollectFields(loginHtml);
  delete payload.email; delete payload.password;
  payload.email=creds.email; payload.password=creds.password;
  if (!Object.prototype.hasOwnProperty.call(payload,"autoLogin")) payload.autoLogin="on";
  out.fields=Object.keys(payload).length;

  var post=await __v16Native(STO_BASE_V16+"/login",{
    "Content-Type":"application/x-www-form-urlencoded","Accept":"text/html,application/xhtml+xml","Origin":STO_BASE_V16,"Referer":STO_BASE_V16+"/login"
  },"POST",__v16.formEncode(payload),true);
  out.postStatus=Number((post&&post.status)||0);
  var postHtml=await __v16Read(post);
  if (__v16LooksLoggedIn(postHtml)) { out.ok=true; out.reason="POST final page authenticated"; return out; }

  var account=await __v16Native(STO_BASE_V16+"/account",{"Accept":"text/html,application/xhtml+xml","Referer":STO_BASE_V16+"/"},"GET",null,false);
  out.accountStatus=Number((account&&account.status)||0);
  out.accountLocation=account?(__v16Header(account.headers,"location")||""):"";
  var accountHtml=await __v16Read(account);
  if (__v16LooksLoggedIn(accountHtml)) { out.ok=true; out.reason="account authenticated"; return out; }
  if (out.accountStatus===200&&!__v16LooksLikeLogin(accountHtml)) { out.ok=true; out.reason="account HTTP 200 without login form"; return out; }

  var home=await __v16Native(STO_BASE_V16+"/",{"Accept":"text/html,application/xhtml+xml","Referer":STO_BASE_V16+"/login"},"GET",null,true);
  var homeHtml=await __v16Read(home);
  if (__v16LooksLoggedIn(homeHtml)) { out.ok=true; out.reason="homepage authenticated"; return out; }

  out.reason=out.accountLocation&&/\/login/i.test(out.accountLocation)?"account redirected to login":"no authenticated marker";
  return out;
}

function __v16ExternalFromHtml(html,provider) {
  html=String(html||""); var p=String(provider||"").toLowerCase(); var hints=[];
  if (p.indexOf("voe")!==-1) hints=["voe.","voe.sx","voe-unblock.com"];
  else if (p.indexOf("vidmoly")!==-1) hints=["vidmoly."];
  else if (p.indexOf("dood")!==-1) hints=["dood.","doodstream.","doodwatch.","dood.to"];
  else if (p.indexOf("filemoon")!==-1) hints=["filemoon."];
  else if (p.indexOf("vidoza")!==-1) hints=["vidoza."];
  else if (p.indexOf("speed")!==-1) hints=["speedfiles.","speedvideo."];
  else if (p.indexOf("mp4upload")!==-1) hints=["mp4upload."];
  var candidates=[],patterns=[/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,/location\.href\s*=\s*["']([^"']+)["']/gi,/location\.replace\(\s*["']([^"']+)["']\s*\)/gi,/<iframe\b[^>]*src=["']([^"']+)["']/gi];
  for (var i=0;i<patterns.length;i++){var m;while((m=patterns[i].exec(html))!==null)candidates.push(m[1]);}
  var abs=/https?:\/\/[^"'<>\\s]+/gi,a; while((a=abs.exec(html))!==null)candidates.push(a[0]);
  for (var c=0;c<candidates.length;c++) {
    var candidate=String(candidates[c]||"").replace(/\\\//g,"/").replace(/&amp;/gi,"&");
    if (!/^https?:\/\//i.test(candidate)||__v16.isSto(candidate)) continue;
    var lower=candidate.toLowerCase();
    for (var h=0;h<hints.length;h++) if (lower.indexOf(hints[h])!==-1) return candidate;
  }
  return "";
}

async function __v16ResolveHoster(hoster,episodeUrl) {
  var current=hoster.href,referer=episodeUrl,lastStatus=0,lastHtml="";
  for (var hop=0;hop<6;hop++) {
    var r=await __v16Native(current,{"Accept":"text/html,application/xhtml+xml,*/*","Referer":referer},"GET",null,false);
    if (!r) return {url:"",status:lastStatus,html:lastHtml};
    lastStatus=Number(r.status||0); var location=__v16Header(r.headers,"location"); lastHtml=await __v16Read(r);
    if (location&&lastStatus>=300&&lastStatus<400) {
      var next=__v16.absolute(location,current);
      if (!__v16.isSto(next)) return {url:next,status:lastStatus,html:lastHtml};
      referer=current; current=next; continue;
    }
    var inferred=__v16ExternalFromHtml(lastHtml,hoster.provider);
    if (inferred) return {url:inferred,status:lastStatus,html:lastHtml};
    return {url:"",status:lastStatus,html:lastHtml};
  }
  return {url:"",status:lastStatus,html:lastHtml};
}

async function searchResults(keyword){if(!(await __v16Load()))return JSON.stringify([]);try{return await __v16.search(keyword);}catch(e){return JSON.stringify([]);}}
async function extractDetails(url){if(!(await __v16Load()))return JSON.stringify([{description:"",aliases:"",airdate:""}]);try{return await __v16.details(url);}catch(e){return JSON.stringify([{description:"",aliases:"",airdate:""}]);}}
async function extractEpisodes(url){if(!(await __v16Load()))return JSON.stringify([]);try{return await __v16.episodes(url);}catch(e){return JSON.stringify([]);}}

async function extractStreamUrl(url) {
  try {
    if (!(await __v16Load())) return __v16Diag(["V16 LOAD FEHLER"]);
    var login=await __v16LoginNative();
    var episodeUrl=String(url||"").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i,STO_BASE_V16);
    var ep=await __v16Native(episodeUrl,{"Accept":"text/html,application/xhtml+xml","Referer":STO_BASE_V16+"/"},"GET",null,true);
    var epStatus=Number((ep&&ep.status)||0),epHtml=await __v16Read(ep),hosters=__v16.extractHosters(epHtml)||[];
    var providerMap={},resolved=0,states=[];
    for (var i=0;i<hosters.length;i++) {
      var rr=await __v16ResolveHoster(hosters[i],episodeUrl);
      states.push(String(hosters[i].provider||"?")+":"+rr.status+(rr.url?"→extern":"→intern"));
      if (!rr.url) continue;
      resolved++; providerMap[rr.url]=__v16.providerKey(hosters[i].provider);
    }
    if (resolved>0) {
      var streams=await __v16.multi(providerMap);
      if (Array.isArray(streams)&&streams.length>0) return JSON.stringify({streams:streams,subtitles:[]});
      if (typeof streams==="string") { try { var parsed=JSON.parse(streams); if(parsed&&Array.isArray(parsed.streams)&&parsed.streams.length>0)return JSON.stringify({streams:parsed.streams,subtitles:parsed.subtitles||[]}); } catch(e){} }
    }
    var accountLoc=login.accountLocation?String(login.accountLocation).replace(STO_BASE_V16,""):"keins";
    return __v16Diag([
      "LOGIN "+(login.ok?"OK ✅":"FEHLER ❌")+" • GET "+login.getStatus+" POST "+login.postStatus+" ACCOUNT "+login.accountStatus,
      "LOGIN: "+login.reason+" • account redirect: "+accountLoc+" • fields "+login.fields,
      "EPISODE HTTP "+epStatus+" • Hoster "+hosters.length+" • resolved "+resolved,
      "REDIRECTS: "+(states.join(" | ")||"keine")
    ]);
  } catch(e) { return __v16Diag(["V16 EXCEPTION",String(e)]); }
}
