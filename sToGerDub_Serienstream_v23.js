/*
 * s.to (GER DUB) 1.8.5
 * Self-contained Sora/Shirox module: no remote source evaluation, credentials or placeholder streams.
 */
var BASE_URL = "https://serienstream.to";
async function __requestText(url, options) {
  options = options || {};
  var headers = options.headers || {};
  if (!headers["User-Agent"]) {
    headers["User-Agent"] = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
  }
  if (!headers["Accept-Language"]) {
    headers["Accept-Language"] = "de-DE,de;q=0.9,en;q=0.8";
  }

  var response = null;
  try {
    response = await fetchv2(url, headers, options.method || "GET", options.body || null);
  } catch (e) {
    try {
      response = await fetch(url, options);
    } catch (e2) {
      console.log("[AniWorld v3.3.2] request failed:", url, e2);
      return "";
    }
  }

  if (!response) return "";
  if (typeof response === "string") return response;
  try {
    if (typeof response.text === "function") return await response.text();
  } catch (e3) {}
  try { return String(response); } catch (e4) { return ""; }
}

function __absolute(url) {
  if (!url) return "";
  url = String(url).trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  if (url.charAt(0) === "/") return BASE_URL + url;
  return BASE_URL + "/" + url;
}

function __awLog(message) {
  if (typeof console !== "undefined" && typeof console.warn === "function") console.warn("[SerienStream v1.8.5] " + message);
  else if (typeof console !== "undefined" && typeof console.log === "function") console.log("[SerienStream v1.8.5] " + message);
}
function __awAttr(tag, key) {
  var re = new RegExp("(?:^|\\s)" + key.replace(/[-]/g, "\\-") + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i");
  var match = String(tag || "").match(re);
  return match ? (match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3]) : "";
}
function __awOrigin(url) {
  var m = String(url || "").match(/^https?:\/\/[^/]+/i);
  return m ? m[0] : BASE_URL;
}
function __awAbsolute(path, base) {
  path = String(path || "").trim().replace(/&amp;/g, "&").replace(/\\\//g, "/");
  if (/^https?:\/\//i.test(path)) return path;
  if (/^\/\//.test(path)) return "https:" + path;
  if (/^[a-z][\w+.-]*:/i.test(path)) return "";
  if (!path) return "";
  if (path[0] === "/") return __awOrigin(base) + path;
  return String(base || BASE_URL + "/").replace(/[^/]*$/, "") + path;
}
function __awPublic(url) {
  var m = String(url || "").match(/^https?:\/\/([^/?#]+)/i);
  if (!m || /[@\[\]\s\\]/.test(m[1])) return false;
  var host = m[1].split(":")[0].toLowerCase();
  return host.indexOf(".") >= 0 && host !== "localhost" &&
    !/^(?:127|10|0|192\.168|169\.254)\./.test(host) &&
    !/^172\.(?:1[6-9]|2\d|3[01])\./.test(host);
}
function __awMediaKind(url) {
  var path = String(url || "").split(/[?#]/)[0];
  if (/\.m3u8$/i.test(path)) return "hls";
  if (/\.mp4$/i.test(path)) return "mp4";
  return "";
}
function __awCandidates(capture, pageUrl) {
  var inputs = Array.isArray(capture && capture.requests) ? capture.requests.slice() : [];
  if (capture && capture.cutoffUrl) inputs.push(capture.cutoffUrl);
  var html = String(capture && capture.html || "");
  var tags = html.match(/<(?:video|source)\b[^>]*>/gi) || [];
  for (var j = 0; j < tags.length; j++) inputs.push(__awAttr(tags[j], "src") || __awAttr(tags[j], "data-src"));
  // Some players expose the HLS file in a JS config without emitting a request.
  var js = /(?:["']?(?:file|src|source|hls)["']?\s*:\s*["'])(https?:[^"'<>]+?\.(?:m3u8|mp4)(?:\?[^"'<>]*)?)/gi, match;
  while ((match = js.exec(html)) !== null) inputs.push(match[1]);
  var seen = {}, urls = [];
  for (var i = 0; i < inputs.length; i++) {
    var item = inputs[i], raw = typeof item === "string" ? item : item && (item.url || item.requestUrl);
    var url = __awAbsolute(raw, pageUrl);
    if (!url || !__awPublic(url) || !__awMediaKind(url) || /doubleclick|googlesyndication|\/preroll\//i.test(url) || seen[url]) continue;
    seen[url] = true;
    urls.push(url);
  }
  urls.sort(function(a, b) { return (__awMediaKind(a) === "hls" ? 0 : 1) - (__awMediaKind(b) === "hls" ? 0 : 1); });
  return urls;
}
async function __awVerify(url, page) {
  if (typeof fetchv2 !== "function" && typeof fetch !== "function") return null;
  var headersList = [{ Referer: __awOrigin(page) + "/", Origin: __awOrigin(page) },
                     { Referer: BASE_URL + "/" }, {}];
  for (var h = 0; h < headersList.length; h++) {
    var headers = headersList[h];
    try {
      var response = typeof fetchv2 === "function"
        ? await fetchv2(url, headers, __awMediaKind(url) === "mp4" ? "HEAD" : "GET", null)
        : await fetch(url, { headers: headers, method: __awMediaKind(url) === "mp4" ? "HEAD" : "GET" });
      if (!response || typeof response === "string" || (typeof response.status === "number" && (response.status < 200 || response.status >= 300))) continue;
      if (__awMediaKind(url) === "hls") {
        var body = await response.text();
        if (!/^#EXTM3U(?:\r?\n|$)/.test(String(body || "").replace(/^\uFEFF/, "").trim())) continue;
      } else {
        var mime = response.headers && (typeof response.headers.get === "function" ? response.headers.get("content-type") :
          response.headers["content-type"] || response.headers["Content-Type"]) || "";
        if (!/^video\//i.test(String(mime))) continue;
      }
      return { title: "GER DUB", streamUrl: url, headers: headers };
    } catch (error) { /* Try the next referer policy. */ }
  }
  return null;
}

function stoCanon(url){return String(url||"").replace(/^https?:\/\/(?:www\.)?(?:s\.to|serienstream\.cx|186\.2\.175\.5)/i,BASE_URL)}
function stoSeries(link){
 link=String(link||"").trim();
 if(/^[a-z0-9][a-z0-9-]*$/i.test(link))return BASE_URL+"/serie/"+link;
 var abs=stoCanon(__awAbsolute(link,BASE_URL+"/")),m=abs.match(/^https?:\/\/[^/]+\/serie\/(?:stream\/)?([^/?#]+)/i);
 return m?BASE_URL+"/serie/"+m[1]:"";
}
function stoClean(t){return String(t||"").replace(/<[^>]*>/g," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&nbsp;/gi," ").replace(/\s+/g," ").trim()}
async function searchResults(keyword){
 try{
  keyword=String(keyword||"").trim();if(!keyword)return "[]";
  var found=[],seen={},txt=await __requestText(BASE_URL+"/ajax/seriesSearch?keyword="+encodeURIComponent(keyword),{headers:{Accept:"application/json",Referer:BASE_URL+"/"}});
  var values=[];try{values=JSON.parse(txt)}catch(e){}
  if(Array.isArray(values))for(var i=0;i<values.length;i++){
   var v=values[i]||{},u=stoSeries(v.link||v.href),n=stoClean(v.name||v.title);
   if(n&&u&&!seen[u]){seen[u]=true;found.push({title:n,href:u,image:__awAbsolute(v.cover||v.image,BASE_URL+"/")})}
  }
  if(found.length)return JSON.stringify(found);
  var html=await __requestText(BASE_URL+"/suche?term="+encodeURIComponent(keyword),{headers:{Accept:"text/html",Referer:BASE_URL+"/"}});
  var re=/<a\b([^>]*)href\s*=\s*["']([^"']*\/serie\/[^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi,m;
  while((m=re.exec(html))!==null){
   var href=stoSeries(m[2]);if(!href||seen[href])continue;
   var img=(m[4].match(/<img\b[^>]*>/i)||[""])[0],h=(m[4].match(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>/i)||[])[1];
   var title=stoClean(h||__awAttr(m[1]+" "+m[3],"title")||__awAttr(img,"alt")||m[4]);
   if(!title||title.length>170)continue;
   seen[href]=true;
   found.push({title:title,href:href,image:__awAbsolute(__awAttr(img,"data-src")||__awAttr(img,"src"),BASE_URL+"/")});
  }
  __awLog("search results "+found.length);return JSON.stringify(found);
 }catch(e){__awLog("search "+String(e).slice(0,120));return "[]"}
}
async function extractDetails(url){
 try{
  var html=await __requestText(stoCanon(url),{headers:{Accept:"text/html",Referer:BASE_URL+"/"}});
  var desc=__awAttr((html.match(/<p\b[^>]*class=["'][^"']*seri_des[^"']*["'][^>]*>/i)||[""])[0],"data-full-description")||
   (html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)||[])[1]||"";
  var aliases=__awAttr((html.match(/<h1\b[^>]*>/i)||[""])[0],"data-alternativetitles");
  return JSON.stringify([{description:stoClean(desc),aliases:stoClean(aliases),airdate:""}]);
 }catch(e){return JSON.stringify([{description:"",aliases:"",airdate:""}])}
}
function stoSeason(url){var m=String(url||"").match(/\/staffel-(\d+)/);return m?Number(m[1]):0}
function stoEpisodeLinks(html){
 var r=/href\s*=\s*["']([^"']*\/staffel-(\d+)\/episode-(\d+)[^"']*)["']/gi,m,arr=[],seen={};
 while((m=r.exec(String(html||"")))!==null){
  var u=stoCanon(__awAbsolute(m[1],BASE_URL+"/"));
  if(!seen[u]){seen[u]=true;arr.push({href:u,season:Number(m[2]),number:Number(m[3])})}
 }
 arr.sort(function(a,b){return a.season-b.season||a.number-b.number});return arr;
}
async function extractEpisodes(url){
 try{
  var u=stoCanon(url),first=await __requestText(u,{headers:{Accept:"text/html",Referer:BASE_URL+"/"}});
  if(!first)return "[]";
  var seasons=[],seen={},r=/href\s*=\s*["']([^"']*\/staffel-(\d+)(?:[/?][^"']*)?)["']/gi,m;
  if(/\/staffel-\d+/.test(u))seasons.push(u.replace(/\/episode-\d+.*$/i,""));
  else while((m=r.exec(first))!==null){
   var link=stoCanon(__awAbsolute(m[1],BASE_URL+"/")).replace(/\/episode-\d+.*$/i,"").replace(/[?#].*$/,"");
   if(!seen[link]){seen[link]=true;seasons.push(link)}
  }
  if(!seasons.length){var root=u.match(/^(https?:\/\/[^/]+\/serie\/(?:stream\/)?[^/?#]+)/i);if(root)seasons.push(root[1]+"/staffel-1")}
  seasons.sort(function(a,b){return stoSeason(a)-stoSeason(b)});
  var offset=0,out=[],done={};
  for(var i=0;i<Math.min(seasons.length,30);i++){
   var target=seasons[i],html=target===u?first:await __requestText(target,{headers:{Accept:"text/html",Referer:u}});
   var entries=stoEpisodeLinks(html),max=0;
   for(var j=0;j<entries.length;j++){
    var e=entries[j];if(e.season!==stoSeason(target))continue;
    max=Math.max(max,e.number);
    if(!done[e.href]){done[e.href]=true;out.push({href:e.href,number:offset+e.number})}
   }
   offset+=max;
  }
  __awLog("episodes "+out.length+" seasons "+seasons.length);
  return JSON.stringify(out);
 }catch(e){__awLog("episodes "+String(e).slice(0,120));return "[]"}
}
function stoGerman(label){
 label=String(label||"");
 return /(deutsch|german|ger dub)/i.test(label)&&!/(untertitel|\bsub\b|subbed)/i.test(label);
}
function stoHosters(html){
 html=String(html||"");var out=[],seen={},add=function(href,provider,lang){
  if(!stoGerman(lang))return;
  var url=stoCanon(__awAbsolute(href,BASE_URL+"/"));
  if(!url||!/^https?:\/\/serienstream\.to\//i.test(url)||seen[url])return;
  seen[url]=true;out.push({url:url,title:stoClean(provider)||"Hoster"});
 };
 var tags=html.match(/<[^>]*data-play-url\s*=\s*["'][^"']+["'][^>]*>/gi)||[];
 for(var i=0;i<tags.length;i++)add(__awAttr(tags[i],"data-play-url"),__awAttr(tags[i],"data-provider-name")||__awAttr(tags[i],"title"),__awAttr(tags[i],"data-language-label")||__awAttr(tags[i],"data-audio-language"));
 var langs={},imgs=html.match(/<img\b[^>]*>/gi)||[];
 for(var j=0;j<imgs.length;j++){var k=__awAttr(imgs[j],"data-lang-key");if(k)langs[k]=__awAttr(imgs[j],"title")||__awAttr(imgs[j],"alt")}
 var rows=html.match(/<li\b[^>]*data-lang-key\s*=\s*["'][^"']+["'][\s\S]*?<\/li>/gi)||[];
 for(var n=0;n<rows.length;n++){
  var row=rows[n],open=(row.match(/^<li\b[^>]*>/i)||[""])[0],a=(row.match(/<a\b[^>]*>/i)||[""])[0];
  add(__awAttr(a,"href"),(row.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)||[])[1],langs[__awAttr(open,"data-lang-key")]||__awAttr(open,"data-language-label"));
 }
 var order=["voe","vidmoly","filemoon","speedfiles","vidoza","mp4upload","doodstream"];
 out.sort(function(a,b){var ai=order.indexOf(a.title.toLowerCase()),bi=order.indexOf(b.title.toLowerCase());return(ai<0?99:ai)-(bi<0?99:bi)});
 return out;
}
function stoProvider(capture,provider){
 var items=Array.isArray(capture&&capture.requests)?capture.requests.slice():[];
 if(capture&&capture.cutoffUrl)items.unshift(capture.cutoffUrl);
 var hint=provider.toLowerCase();if(hint.indexOf("voe")>=0)hint="voe";
 for(var i=0;i<items.length;i++){
  var url=typeof items[i]==="string"?items[i]:items[i]&&(items[i].url||items[i].requestUrl);
  if(__awPublic(url)&&!/^https?:\/\/(?:www\.)?serienstream\.to\//i.test(url)&&!__awMediaKind(url)&&(!hint||__awOrigin(url).toLowerCase().indexOf(hint)>=0))return url;
 }
 return "";
}
async function stoCapture(h,episode){
 if(typeof networkFetch!=="function")return null;
 var options={timeoutSeconds:14,returnHTML:true,returnCookies:false,maxWaitTime:4,
  waitForSelectors:["video","source"],
  clickSelectors:[".vjs-big-play-button",".jw-icon-display","button[aria-label='Play']",".art-icon-play[aria-label='Play']"]};
 var first=await networkFetch(h.url,Object.assign({},options,{headers:{Referer:episode,"X-Shirox-SerienStream-Episode":episode}}));
 if(!first||first.success===false)return null;
 var external=stoProvider(first,h.title),captures=[{data:first,base:external||h.url}];
 if(external){
  try{
   var second=await networkFetch(external,Object.assign({},options,{headers:{Referer:BASE_URL+"/"}}));
   if(second&&second.success!==false)captures.unshift({data:second,base:external});
  }catch(e){__awLog("hoster "+h.title+" second player failed")}
 }
 for(var i=0;i<captures.length;i++){
  var c=captures[i],urls=__awCandidates(c.data,c.base);
  __awLog(h.title+": "+urls.length+" candidate URLs");
  for(var j=0;j<Math.min(urls.length,4);j++){
   var verified=await __awVerify(urls[j],c.base);
   if(verified)return {title:h.title+" · GER DUB",streamUrl:verified.streamUrl,headers:verified.headers};
  }
 }
 return null;
}
async function extractStreamUrl(url){
 try{
  var episode=stoCanon(url),html=await __requestText(episode,{headers:{Accept:"text/html",Referer:BASE_URL+"/"}});
  if(!html){__awLog("episode page empty");return JSON.stringify({streams:[],subtitles:[]})}
  if(/name=["']password["']/i.test(html)&&/name=["']email["']/i.test(html))__awLog("website session required");
  var hosters=stoHosters(html);
  __awLog("German hosters "+hosters.length+" ("+hosters.map(function(h){return h.title}).join(", ")+")");
  for(var i=0;i<Math.min(hosters.length,5);i++){
   try{var stream=await stoCapture(hosters[i],episode);if(stream)return JSON.stringify({streams:[stream],subtitles:[]})}
   catch(e){__awLog("hoster "+hosters[i].title+" failed: "+String(e).slice(0,100))}
  }
 }catch(e){__awLog("stream lookup failed: "+String(e).slice(0,150))}
 return JSON.stringify({streams:[],subtitles:[]});
}
