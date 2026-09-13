const V17_SCRIPT_URL_V18 = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v17.js?rev=20260913-2008";
const STO_BASE_V18 = "https://serienstream.to";

var __v18Loaded = false;
var __v18Loading = null;
var __v18 = {
  search:null, details:null, episodes:null,
  extractHosters:null, providerKey:null, multi:null,
  getCredentials:null, collectFields:null, looksLoggedIn:null,
  externalFromHtml:null
};

async function __v18Read(r) {
  if (!r) return "";
  if (typeof r === "string") return r;
  try { if (typeof r.text === "function") return await r.text(); } catch(e) {}
  return "";
}

async function __v18Text(url) {
  try {
    var r = await fetchv2(url, {"Accept":"text/plain"}, "GET", null, true);
    return await __v18Read(r);
  } catch(e) { return ""; }
}

function __v18Header(headers, wanted) {
  if (!headers) return "";
  var target = String(wanted || "").toLowerCase();
  for (var k in headers) {
    if (Object.prototype.hasOwnProperty.call(headers,k) && String(k).toLowerCase() === target) {
      return String(headers[k] || "");
    }
  }
  return "";
}

function __v18Absolute(value, base) {
  value = String(value || "").trim().replace(/&amp;/gi,"&");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.indexOf("//") === 0) return "https:" + value;
  var origin = (String(base || STO_BASE_V18).match(/^(https?:\/\/[^\/]+)/i) || [])[1] || STO_BASE_V18;
  if (value.charAt(0) === "/") return origin + value;
  var clean = String(base || origin + "/").split("#")[0].split("?")[0];
  var slash = clean.lastIndexOf("/");
  return (slash > clean.indexOf("://") + 2 ? clean.substring(0,slash+1) : clean + "/") + value;
}

function __v18IsSto(url) {
  return /^https?:\/\/(?:www\.)?(?:serienstream\.(?:to|cx)|s\.to)(?:\/|$)/i.test(String(url || ""));
}

function __v18FormEncode(obj) {
  var out=[];
  for (var k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj,k) || obj[k] == null) continue;
    out.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(obj[k])));
  }
  return out.join("&");
}

function __v18CaptureCookies(jar, response) {
  if (!response || !response.headers) return;
  var raw = __v18Header(response.headers,"set-cookie");
  if (!raw) return;
  var parts = String(raw).split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/g);
  for (var i=0;i<parts.length;i++) {
    var first = String(parts[i] || "").split(";")[0].trim();
    var eq = first.indexOf("=");
    if (eq <= 0) continue;
    var name = first.substring(0,eq).trim();
    var value = first.substring(eq+1).trim();
    if (!name) continue;
    if (!value || /^deleted$/i.test(value)) delete jar[name];
    else jar[name] = value;
  }
}

function __v18CookieHeader(jar) {
  var out=[];
  for (var k in jar) if (Object.prototype.hasOwnProperty.call(jar,k)) out.push(k + "=" + jar[k]);
  return out.join("; ");
}

async function __v18Request(jar, url, headers, method, body, follow) {
  var h={"Accept-Language":"de-DE,de;q=0.9,en;q=0.8"};
  headers=headers||{};
  for (var k in headers) h[k]=headers[k];
  var c=__v18CookieHeader(jar);
  if (c) h["Cookie"]=c;
  try {
    var r=await fetchv2(url,h,method||"GET",body == null ? null : body,follow===true);
    __v18CaptureCookies(jar,r);
    return r;
  } catch(e) { return null; }
}

function __v18LoginAction(html) {
  html=String(html||"");
  var formRe=/<form\b([^>]*)>([\s\S]*?)<\/form>/gi,m;
  while((m=formRe.exec(html))!==null) {
    if (!/name\s*=\s*["']email["']/i.test(m[2]||"") || !/name\s*=\s*["']password["']/i.test(m[2]||"")) continue;
    var am=String(m[1]||"").match(/\baction\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    return __v18Absolute(am ? (am[1]||am[2]||am[3]||"") : "/login", STO_BASE_V18+"/login");
  }
  return STO_BASE_V18+"/login";
}

async function __v18LoginCookieJar() {
  var out={ok:false,reason:"unknown",jar:{},getStatus:0,postStatus:0,finalStatus:0,fields:0,hops:0};
  var creds=__v18.getCredentials?__v18.getCredentials():null;
  if (!creds || !creds.email || !creds.password || String(creds.email).indexOf("__PUT_")===0) {
    out.reason="credentials missing"; return out;
  }

  var get=await __v18Request(out.jar,STO_BASE_V18+"/login",{"Accept":"text/html,application/xhtml+xml"},"GET",null,false);
  out.getStatus=Number(get&&get.status||0);
  var html=await __v18Read(get);
  if (__v18.looksLoggedIn && __v18.looksLoggedIn(html)) { out.ok=true; out.reason="already authenticated"; return out; }

  var fields=__v18.collectFields?(__v18.collectFields(html)||{}):{};
  fields.email=creds.email;
  fields.password=creds.password;
  if (!Object.prototype.hasOwnProperty.call(fields,"autoLogin")) fields.autoLogin="on";
  out.fields=Object.keys(fields).length;

  var action=__v18LoginAction(html);
  var post=await __v18Request(out.jar,action,{
    "Content-Type":"application/x-www-form-urlencoded",
    "Accept":"text/html,application/xhtml+xml",
    "Origin":STO_BASE_V18,
    "Referer":STO_BASE_V18+"/login"
  },"POST",__v18FormEncode(fields),false);
  out.postStatus=Number(post&&post.status||0);
  html=await __v18Read(post);
  if (__v18.looksLoggedIn && __v18.looksLoggedIn(html)) { out.ok=true; out.reason="POST authenticated"; return out; }

  var current=action;
  var response=post;
  for (var hop=0;hop<6;hop++) {
    var status=Number(response&&response.status||0);
    var loc=response?__v18Header(response.headers,"location"):"";
    if (!(status>=300&&status<400&&loc)) break;
    current=__v18Absolute(loc,current);
    if (!__v18IsSto(current)) break;
    response=await __v18Request(out.jar,current,{"Accept":"text/html,application/xhtml+xml","Referer":action},"GET",null,false);
    out.hops++;
    out.finalStatus=Number(response&&response.status||0);
    html=await __v18Read(response);
    if (__v18.looksLoggedIn && __v18.looksLoggedIn(html)) { out.ok=true; out.reason="redirect authenticated"; return out; }
  }

  var account=await __v18Request(out.jar,STO_BASE_V18+"/account",{"Accept":"text/html,application/xhtml+xml","Referer":STO_BASE_V18+"/"},"GET",null,false);
  var accountStatus=Number(account&&account.status||0);
  var accountLoc=account?__v18Header(account.headers,"location"):"";
  var accountHtml=await __v18Read(account);
  if (__v18.looksLoggedIn && __v18.looksLoggedIn(accountHtml)) { out.ok=true; out.reason="account authenticated"; return out; }
  if (accountStatus===200 && !/name\s*=\s*["']password["']/i.test(accountHtml)) { out.ok=true; out.reason="account 200 without login form"; return out; }
  out.reason=accountLoc&&/\/login/i.test(accountLoc)?"account redirected to login":"no auth marker";
  return out;
}

function __v18Hint(provider) {
  var p=String(provider||"").toLowerCase();
  if (p.indexOf("voe")!==-1) return "voe";
  if (p.indexOf("dood")!==-1) return "dood";
  if (p.indexOf("vidmoly")!==-1) return "vidmoly";
  if (p.indexOf("filemoon")!==-1) return "filemoon";
  if (p.indexOf("vidoza")!==-1) return "vidoza";
  if (p.indexOf("speed")!==-1) return "speed";
  if (p.indexOf("mp4upload")!==-1) return "mp4upload";
  return "";
}

function __v18ExternalFromRequests(requests,provider) {
  if (!Array.isArray(requests)) return "";
  var hint=__v18Hint(provider);
  for (var i=requests.length-1;i>=0;i--) {
    var u=String(requests[i]||"");
    if (!/^https?:\/\//i.test(u)||__v18IsSto(u)) continue;
    if (!hint||u.toLowerCase().indexOf(hint)!==-1) return u;
  }
  return "";
}

async function __v18Resolve(jar,hoster,episodeUrl) {
  var first=await __v18Request(jar,hoster.href,{"Accept":"text/html,application/xhtml+xml,*/*","Referer":episodeUrl},"GET",null,false);
  var status=Number(first&&first.status||0),loc=first?__v18Header(first.headers,"location"):"",html=await __v18Read(first);
  if (loc&&status>=300&&status<400) {
    var next=__v18Absolute(loc,hoster.href);
    if (!__v18IsSto(next)) return {url:next,mode:"http-redirect",status:status,web:0};
  }
  if (__v18.externalFromHtml) {
    var inferred=__v18.externalFromHtml(html,hoster.provider)||"";
    if (inferred&&!__v18IsSto(inferred)) return {url:inferred,mode:"http-html",status:status,web:0};
  }

  if (typeof networkFetch==="function") {
    try {
      var headers={"Referer":episodeUrl};
      var cookie=__v18CookieHeader(jar);
      if (cookie) headers["Cookie"]=cookie;
      var res=await networkFetch(hoster.href,{
        timeoutSeconds:12,
        headers:headers,
        returnHTML:true,
        returnCookies:true,
        cutoff:__v18Hint(hoster.provider)||null
      });
      var url="";
      if (res&&res.cutoffTriggered&&res.cutoffUrl&&!__v18IsSto(res.cutoffUrl)) url=String(res.cutoffUrl);
      if (!url) url=__v18ExternalFromRequests(res&&res.requests,hoster.provider);
      if (!url&&__v18.externalFromHtml) url=__v18.externalFromHtml(String(res&&res.html||""),hoster.provider)||"";
      if (url&&!__v18IsSto(url)) return {url:url,mode:"webkit",status:status,web:Number(res&&res.totalRequests||0)};
      return {url:"",mode:"webkit-intern",status:status,web:Number(res&&res.totalRequests||0)};
    } catch(e) {}
  }
  return {url:"",mode:"intern",status:status,web:0};
}

function __v18Diag(lines) {
  var streams=[];
  for (var i=0;i<lines.length;i++) streams.push({title:"DIAG "+(i+1)+" • "+String(lines[i]||"").slice(0,120),streamUrl:"https://example.com/serienstream-v18-diag-"+(i+1)+".m3u8"});
  return JSON.stringify({streams:streams,subtitles:[]});
}

async function __v18Load() {
  if (__v18Loaded) return true;
  if (__v18Loading) return await __v18Loading;
  __v18Loading=(async function(){
    try {
      var source=await __v18Text(V17_SCRIPT_URL_V18);
      if (!source) return false;
      source=source.replace(/async\s+function\s+extractStreamUrl\s*\(/,"async function __v17LegacyStreamV18(");
      source+="\n;__v18.search=(typeof searchResults==='function')?searchResults:null;";
      source+="\n;__v18.details=(typeof extractDetails==='function')?extractDetails:null;";
      source+="\n;__v18.episodes=(typeof extractEpisodes==='function')?extractEpisodes:null;";
      source+="\n;__v18.extractHosters=(typeof __v17!=='undefined'&&__v17)?__v17.extractHosters:null;";
      source+="\n;__v18.providerKey=(typeof __v17!=='undefined'&&__v17)?__v17.providerKey:null;";
      source+="\n;__v18.multi=(typeof __v17!=='undefined'&&__v17)?__v17.multi:null;";
      source+="\n;__v18.getCredentials=(typeof __v17!=='undefined'&&__v17)?__v17.getCredentials:null;";
      source+="\n;__v18.collectFields=(typeof __v17!=='undefined'&&__v17)?__v17.collectFields:null;";
      source+="\n;__v18.looksLoggedIn=(typeof __v17!=='undefined'&&__v17)?__v17.looksLoggedIn:null;";
      source+="\n;__v18.externalFromHtml=(typeof __v17!=='undefined'&&__v17)?__v17.externalFromHtml:null;";
      eval(source);
      if (typeof __v17Load==="function") await __v17Load();
      if (typeof __v17!=="undefined"&&__v17) {
        if (!__v18.extractHosters) __v18.extractHosters=__v17.extractHosters;
        if (!__v18.providerKey) __v18.providerKey=__v17.providerKey;
        if (!__v18.multi) __v18.multi=__v17.multi;
        if (!__v18.getCredentials) __v18.getCredentials=__v17.getCredentials;
        if (!__v18.collectFields) __v18.collectFields=__v17.collectFields;
        if (!__v18.looksLoggedIn) __v18.looksLoggedIn=__v17.looksLoggedIn;
        if (!__v18.externalFromHtml) __v18.externalFromHtml=__v17.externalFromHtml;
      }
      __v18Loaded=!!(__v18.search&&__v18.details&&__v18.episodes&&__v18.extractHosters&&__v18.providerKey&&__v18.multi&&__v18.getCredentials&&__v18.collectFields&&__v18.looksLoggedIn);
      return __v18Loaded;
    } catch(e) { console.log("[SerienStream v18] load failed",e); return false; }
    finally { __v18Loading=null; }
  })();
  return await __v18Loading;
}

async function searchResults(keyword){if(!(await __v18Load()))return JSON.stringify([]);try{return await __v18.search(keyword);}catch(e){return JSON.stringify([]);}}
async function extractDetails(url){if(!(await __v18Load()))return JSON.stringify([{description:"",aliases:"",airdate:""}]);try{return await __v18.details(url);}catch(e){return JSON.stringify([{description:"",aliases:"",airdate:""}]);}}
async function extractEpisodes(url){if(!(await __v18Load()))return JSON.stringify([]);try{return await __v18.episodes(url);}catch(e){return JSON.stringify([]);}}

async function extractStreamUrl(url) {
  try {
    if (!(await __v18Load())) return __v18Diag(["V18 LOAD FEHLER"]);
    var login=await __v18LoginCookieJar();
    var episodeUrl=String(url||"").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i,STO_BASE_V18);
    var ep=await __v18Request(login.jar,episodeUrl,{"Accept":"text/html,application/xhtml+xml","Referer":STO_BASE_V18+"/"},"GET",null,true);
    var epStatus=Number(ep&&ep.status||0),epHtml=await __v18Read(ep),hosters=__v18.extractHosters(epHtml)||[];
    var providerMap={},resolved=0,states=[];
    for (var i=0;i<hosters.length;i++) {
      var rr=await __v18Resolve(login.jar,hosters[i],episodeUrl);
      states.push(String(hosters[i].provider||"?")+":"+rr.mode+":"+rr.status+(rr.web?"/web"+rr.web:"")+(rr.url?"→extern":"→intern"));
      if (!rr.url) continue;
      resolved++; providerMap[rr.url]=__v18.providerKey(hosters[i].provider);
    }
    if (resolved>0) {
      var streams=await __v18.multi(providerMap);
      if (Array.isArray(streams)&&streams.length>0) return JSON.stringify({streams:streams,subtitles:[]});
      if (typeof streams==="string") { try { var parsed=JSON.parse(streams); if(parsed&&Array.isArray(parsed.streams)&&parsed.streams.length>0)return JSON.stringify({streams:parsed.streams,subtitles:parsed.subtitles||[]}); } catch(e){} }
    }
    return __v18Diag([
      "COOKIE LOGIN "+(login.ok?"OK ✅":"FEHLER ❌")+" • "+login.reason+" • GET "+login.getStatus+" POST "+login.postStatus,
      "COOKIES "+Object.keys(login.jar||{}).length+" • fields "+login.fields+" • hops "+login.hops,
      "EPISODE HTTP "+epStatus+" • Hoster "+hosters.length+" • resolved "+resolved,
      "RESOLVE: "+(states.join(" | ")||"keine Hoster")
    ]);
  } catch(e) { return __v18Diag(["V18 EXCEPTION",String(e)]); }
}
