const V18_SCRIPT_URL_V19 = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v18.js?rev=20260913-2010";
const STO_BASE_V19 = "https://serienstream.to";
const STO_UA_V19 = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

var __v19Loaded=false;
var __v19Loading=null;
var __v19={
  search:null,details:null,episodes:null,
  login:null,request:null,read:null,resolve:null,
  extractHosters:null,providerKey:null,multi:null
};

async function __v19Text(url){
  try{
    var r=await fetchv2(url,{"Accept":"text/plain"},"GET",null,true);
    if(!r)return "";
    if(typeof r==="string")return r;
    if(typeof r.text==="function")return await r.text();
    return String(r||"");
  }catch(e){return "";}
}

function __v19IsHttp(v){return /^https?:\/\//i.test(String(v||"").trim());}
function __v19Origin(url){var m=String(url||"").match(/^(https?:\/\/[^\/]+)/i);return m?m[1]:"";}

function __v19Normalize(result){
  if(typeof result==="string"){
    try{result=JSON.parse(result);}catch(e){}
  }
  if(result&&!Array.isArray(result)&&Array.isArray(result.streams))result=result.streams;
  if(!Array.isArray(result))return [];
  var out=[];
  for(var i=0;i<result.length;i++){
    var item=result[i];
    if(item&&typeof item==="object"){
      var u=String(item.streamUrl||item.url||"").trim();
      if(__v19IsHttp(u))out.push({label:String(item.title||item.name||""),url:u,headers:item.headers||null});
      continue;
    }
    var cur=String(item||"").trim();
    if(!cur)continue;
    if(__v19IsHttp(cur)){
      out.push({label:"",url:cur,headers:null});
      continue;
    }
    if(i+1<result.length&&__v19IsHttp(result[i+1])){
      out.push({label:cur,url:String(result[i+1]).trim(),headers:null});
      i++;
    }
  }
  return out;
}

function __v19Diag(lines){
  var streams=[];
  for(var i=0;i<lines.length;i++)streams.push({
    title:"DIAG "+(i+1)+" • "+String(lines[i]||"").slice(0,120),
    streamUrl:"https://example.com/serienstream-v19-diag-"+(i+1)+".m3u8"
  });
  return JSON.stringify({streams:streams,subtitles:[]});
}

async function __v19Load(){
  if(__v19Loaded)return true;
  if(__v19Loading)return await __v19Loading;
  __v19Loading=(async function(){
    try{
      var source=await __v19Text(V18_SCRIPT_URL_V19);
      if(!source)return false;
      source=source.replace(/async\s+function\s+extractStreamUrl\s*\(/,"async function __v18LegacyStreamV19(");
      source+="\n;__v19.search=(typeof searchResults==='function')?searchResults:null;";
      source+="\n;__v19.details=(typeof extractDetails==='function')?extractDetails:null;";
      source+="\n;__v19.episodes=(typeof extractEpisodes==='function')?extractEpisodes:null;";
      source+="\n;__v19.login=(typeof __v18LoginCookieJar==='function')?__v18LoginCookieJar:null;";
      source+="\n;__v19.request=(typeof __v18Request==='function')?__v18Request:null;";
      source+="\n;__v19.read=(typeof __v18Read==='function')?__v18Read:null;";
      source+="\n;__v19.resolve=(typeof __v18Resolve==='function')?__v18Resolve:null;";
      source+="\n;__v19.extractHosters=(typeof __v18!=='undefined'&&__v18)?__v18.extractHosters:null;";
      source+="\n;__v19.providerKey=(typeof __v18!=='undefined'&&__v18)?__v18.providerKey:null;";
      source+="\n;__v19.multi=(typeof __v18!=='undefined'&&__v18)?__v18.multi:null;";
      eval(source);
      if(typeof __v18Load==="function")await __v18Load();
      if(typeof __v18!=="undefined"&&__v18){
        if(!__v19.extractHosters)__v19.extractHosters=__v18.extractHosters;
        if(!__v19.providerKey)__v19.providerKey=__v18.providerKey;
        if(!__v19.multi)__v19.multi=__v18.multi;
      }
      __v19Loaded=!!(__v19.search&&__v19.details&&__v19.episodes&&__v19.login&&__v19.request&&__v19.read&&__v19.resolve&&__v19.extractHosters&&__v19.providerKey&&__v19.multi);
      return __v19Loaded;
    }catch(e){console.log("[SerienStream v19] load failed",e);return false;}
    finally{__v19Loading=null;}
  })();
  return await __v19Loading;
}

async function searchResults(keyword){if(!(await __v19Load()))return JSON.stringify([]);try{return await __v19.search(keyword);}catch(e){return JSON.stringify([]);}}
async function extractDetails(url){if(!(await __v19Load()))return JSON.stringify([{description:"",aliases:"",airdate:""}]);try{return await __v19.details(url);}catch(e){return JSON.stringify([{description:"",aliases:"",airdate:""}]);}}
async function extractEpisodes(url){if(!(await __v19Load()))return JSON.stringify([]);try{return await __v19.episodes(url);}catch(e){return JSON.stringify([]);}}

async function extractStreamUrl(url){
  try{
    if(!(await __v19Load()))return __v19Diag(["V19 LOAD FEHLER"]);
    var login=await __v19.login();
    var episodeUrl=String(url||"").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i,STO_BASE_V19);
    var ep=await __v19.request(login.jar,episodeUrl,{"Accept":"text/html,application/xhtml+xml","Referer":STO_BASE_V19+"/"},"GET",null,true);
    var epStatus=Number(ep&&ep.status||0);
    var epHtml=await __v19.read(ep);
    var hosters=__v19.extractHosters(epHtml)||[];
    var sources=[];
    var seen={};
    var states=[];

    for(var i=0;i<hosters.length;i++){
      var h=hosters[i];
      var rr=await __v19.resolve(login.jar,h,episodeUrl);
      if(!rr||!rr.url){
        states.push(String(h.provider||"?")+":"+(rr?rr.mode:"none")+"→intern");
        continue;
      }
      var map={};
      map[rr.url]=__v19.providerKey(h.provider);
      var extracted=null;
      try{extracted=await __v19.multi(map);}catch(ex){extracted=null;}
      var candidates=__v19Normalize(extracted);
      states.push(String(h.provider||"?")+":"+rr.mode+"→extern/media"+candidates.length);

      for(var j=0;j<candidates.length;j++){
        var media=candidates[j];
        if(!__v19IsHttp(media.url)||seen[media.url])continue;
        seen[media.url]=true;
        var provider=String(h.provider||media.label||"Stream");
        var title=provider;
        if(candidates.length>1)title+=" "+(j+1);
        var headers={"User-Agent":STO_UA_V19,"Referer":rr.url};
        var origin=__v19Origin(rr.url);
        if(origin)headers["Origin"]=origin;
        if(media.headers&&typeof media.headers==="object"){
          for(var hk in media.headers)if(Object.prototype.hasOwnProperty.call(media.headers,hk))headers[hk]=String(media.headers[hk]);
        }
        sources.push({title:title,streamUrl:media.url,headers:headers});
      }
    }

    if(sources.length){
      return JSON.stringify({streams:sources,subtitles:[]});
    }

    return __v19Diag([
      "LOGIN "+(login.ok?"OK ✅":"FEHLER ❌")+" • "+login.reason,
      "EPISODE HTTP "+epStatus+" • Hoster "+hosters.length+" • playable 0",
      "RESOLVE: "+(states.join(" | ")||"keine Hoster"),
      "Kein direkter Media-Link vom Hoster-Extractor"
    ]);
  }catch(e){return __v19Diag(["V19 EXCEPTION",String(e)]);}
}
