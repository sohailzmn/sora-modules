/*
 * s.to (GER DUB) 1.8.7
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
      console.log("[SerienStream v1.8.7] request failed:", url, e2);
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
  if (typeof console !== "undefined" && typeof console.warn === "function") console.warn("[SerienStream v1.8.7] " + message);
  else if (typeof console !== "undefined" && typeof console.log === "function") console.log("[SerienStream v1.8.7] " + message);
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

// Site v2 no longer offers the v1 AJAX API. Series now have /serie/<slug>
// pages instead of /serie/stream/<slug>. Prefer a validated direct match,
// then parse the site's public search HTML without inventing results.
function stoNormalizeTitle(value) {
  return stoClean(value).toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/ß/g,"ss").replace(/&/g," and ")
    .replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function stoSlug(value) {
  return stoClean(value).toLowerCase()
    .replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/&/g,"-").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}
function stoMeta(html,name) {
  var re=/<meta\b[^>]*>/gi,m;
  while((m=re.exec(String(html||"")))!==null) {
    var key=__awAttr(m[0],"property")||__awAttr(m[0],"name");
    if(key.toLowerCase()===name.toLowerCase())return __awAttr(m[0],"content");
  }
  return "";
}
function stoActualTitle(html) {
  html=String(html||"");
  // A 200 response with a generic error page must never become a search hit.
  if(/<h1\b[^>]*>\s*(?:404|not found|seite nicht gefunden)/i.test(html))return "";
  var heading=(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1];
  var name=stoClean(heading||stoMeta(html,"og:title")||"");
  if(!name) {
    var docTitle=(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"";
    name=stoClean(docTitle).replace(/\s*(?:Staffel|Season)\s+\d+\s*(?:\||-|–|•).*$/i,"")
       .replace(/\s*[|–•]\s*(?:S\.to|SerienStream).*$/i,"");
  }
  return name;
}

function stoImage(html,title){
 var src=stoMeta(html,"og:image"),imgs=String(html||"").match(/<img\b[^>]*>/gi)||[],fallback="";
 if(!src)for(var i=0;i<imgs.length;i++){
  var tag=imgs[i],alt=stoNormalizeTitle(__awAttr(tag,"alt"));
  var url=__awAttr(tag,"data-src")||__awAttr(tag,"src")||__awAttr(tag,"data-original");
  if(!url){var srcset=__awAttr(tag,"srcset");if(srcset)url=srcset.split(",")[0].trim().split(/\s+/)[0]}
  if(!url||url.indexOf("data:")===0)continue;
  if(alt===stoNormalizeTitle(title)){src=url;break}
  if(!fallback && /poster|cover|serie/i.test(alt))fallback=url;
 }
 src=src||fallback;
 return src?__awAbsolute(src,BASE_URL+"/"):"";
}

function stoHtmlSearch(html,keyword) {
  var results=[],seen={},text=String(html||""),re=/<a\b([^>]*)href\s*=\s*(?:"([^"]+)"|'([^']+)')([^>]*)>([\s\S]*?)<\/a>/gi,m;
  var term=stoNormalizeTitle(keyword);
  while((m=re.exec(text))!==null){
    var href=stoSeries(m[2]||m[3]);if(!href||seen[href])continue;
    var inner=m[5],attrs=m[1]+" "+m[4],img=(inner.match(/<img\b[^>]*>/i)||[""])[0];
    var heading=(inner.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)||[])[1];
    var title=stoClean(heading||__awAttr(img,"alt")||__awAttr(attrs,"title")||inner);
    if(!title||title.length>160)continue;
    if(stoNormalizeTitle(title).indexOf(term)<0)continue;
    seen[href]=true;
    var cover=__awAttr(img,"data-src")||__awAttr(img,"src");
    results.push({title:title,href:href,image:cover?__awAbsolute(cover,BASE_URL+"/"):""});
  }
  return results;
}
async function stoValidatedExact(keyword) {
  var slug=stoSlug(keyword);
  if(!slug)return null;
  var href=BASE_URL+"/serie/"+slug;
  var html=await __requestText(href,{headers:{Accept:"text/html,application/xhtml+xml",Referer:BASE_URL+"/"}});
  if(!html||String(html).length<40)return null;
  var title=stoActualTitle(html);
  if(stoNormalizeTitle(title)!==stoNormalizeTitle(keyword))return null;
  // Series layouts expose season/episode links or identifying metadata.
  if(!/(?:\/staffel-\d+|\/episode-\d+|(?:property|name)=["']og:(?:title|type)["'])/i.test(html))return null;
  return {title:title,href:href,image:stoImage(html,title)};
}
async function searchResults(keyword) {
  keyword=String(keyword||"").trim();
  if(!keyword)return "[]";
  var exact=null,all=[],seen={};
  try {
    // Fast path for named series, e.g. Dexter -> /serie/dexter on site v2.
    exact=await stoValidatedExact(keyword);
    if(exact) {seen[exact.href]=true;all.push(exact);}
  }catch(e){__awLog("exact title probe: "+String(e).slice(0,120));}
  // v2 may render the search through JS. Try standard GET form fields; a
  // result is accepted only when its TITLE actually matches the user query.
  var routes=[
    BASE_URL+"/suche?q="+encodeURIComponent(keyword),
    BASE_URL+"/suche?term="+encodeURIComponent(keyword)
  ];
  for(var i=0;i<routes.length;i++) {
    try {
      var html=await __requestText(routes[i],{headers:{Accept:"text/html,application/xhtml+xml",Referer:BASE_URL+"/suche"}});
      var matches=stoHtmlSearch(html,keyword);
      for(var j=0;j<matches.length;j++){
        var item=matches[j];
        if(!seen[item.href]){seen[item.href]=true;all.push(item);}
      }
      // No need to request the second endpoint if the first returned matches.
      if(matches.length)break;
    }catch(e){__awLog("search HTML route "+(i+1)+": "+String(e).slice(0,100));}
  }
  all.sort(function(a,b){
    var aa=stoNormalizeTitle(a.title),bb=stoNormalizeTitle(b.title),q=stoNormalizeTitle(keyword);
    return (aa===q?0:aa.indexOf(q)===0?1:2)-(bb===q?0:bb.indexOf(q)===0?1:2);
  });
  __awLog("search "+keyword+": "+all.length+" title matches"+(exact?" (exact page verified)":""));
  return JSON.stringify(all.slice(0,25));
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

function stoSeason(url){var m=String(url||"").match(/\/staffel-(\d+)/i);return m?Number(m[1]):0}
function stoReadable(html){
 return String(html||"").replace(/\\u002[fF]|&#47;|&#x2f;/g,"/").replace(/\\\//g,"/").replace(/&quot;|&#34;/g,'"').replace(/&amp;/g,"&");
}
function stoSeasonNumbers(html,root){
 var slug=root.split("/").pop(),text=stoReadable(html),list=[],seen={},m;
 var regex=/\/serie\/(?:stream\/)?([a-z0-9-]+)\/staffel-(\d+)(?=[/?#"'\\\s<>]|$)/gi;
 while((m=regex.exec(text))!==null)if(m[1]===slug)seen[Number(m[2])]=true;
 var tabs=/(?:data-season(?:-number)?=["'](\d+)["']|<option[^>]*value=["'](\d+)["'][^>]*>\s*Staffel\s+\d+)/gi;
 while((m=tabs.exec(text))!==null)seen[Number(m[1]||m[2])]=true;
 for(var key in seen)if(Number(key)>=1 && Number(key)<=99)list.push(Number(key));
 return list.sort(function(a,b){return a-b});
}
function stoEpisodeLinks(html,root,season){
 var slug=root.split("/").pop(),text=stoReadable(html),seen={},list=[],m;
 var regex=/\/serie\/(?:stream\/)?([a-z0-9-]+)\/staffel-(\d+)\/episode-(\d+)(?=[/?#"'\\\s<>&]|$)/gi;
 while((m=regex.exec(text))!==null){
  var s=Number(m[2]),n=Number(m[3]),url=root+"/staffel-"+s+"/episode-"+n;
  if(m[1]!==slug||s!==season||n<1||n>1000||seen[url])continue;
  seen[url]=true;list.push({href:url,number:n});
 }
 return list.sort(function(a,b){return a.number-b.number});
}
function stoNumbersInTable(html){
 var text=stoReadable(html),rows=text.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[],found={},i;
 var pos=text.search(/<table\b/i),context=pos<0?"":text.slice(Math.max(0,pos-700),pos+700);
 if(/staffel|season|episode|folge|titel|anschauen|sprache/i.test(context))
 for(i=0;i<rows.length;i++){
  var cells=rows[i].match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi)||[],n=stoClean(cells[0]);
  if(cells.length>=2&&/^\d{1,3}$/.test(n)&&Number(n)>0&&Number(n)<=300)found[Number(n)]=true;
 }
 var re=/(?:episodeNumber|episode_number|data-episode-number)["']?\s*[:=]\s*["']?(\d{1,3})/gi,m;
 while((m=re.exec(text))!==null)if(Number(m[1])>0)found[Number(m[1])]=true;
 return Object.keys(found).map(Number).sort(function(a,b){return a-b});
}
async function stoHydratedHTML(url){
 if(typeof networkFetch!=="function")return "";
 try{
  var r=await networkFetch(url,{timeoutSeconds:9,returnHTML:true,returnCookies:false,
    waitForSelectors:["main","table","a[href*='/episode-']"],maxWaitTime:3});
  return r && r.success!==false?String(r.html||""):"";
 }catch(e){__awLog("browser episodes "+String(e).slice(0,100));return ""}
}
async function stoEpisodeValidated(url){
 try{
  var response=typeof fetchv2==="function"?
    await fetchv2(url,{Accept:"text/html",Referer:BASE_URL+"/"},"GET",null):
    await fetch(url,{headers:{Accept:"text/html"},method:"GET"});
  if(!response||Number(response.status||0)>=400||typeof response.text!=="function")return false;
  var html=String(await response.text()||"");
  if(html.length<55||/<h1\b[^>]*>\s*(?:404|not found)/i.test(html))return false;
  var canonical=stoMeta(html,"og:url")||(html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)||[])[1]||"";
  if(canonical && !/\/episode-\d+(?:[/?#]|$)/i.test(canonical))return false;
  return /episode|folge|staffel|season|video|player|<main\b/i.test(html);
 }catch(e){return false}
}
async function extractEpisodes(url){
 var root=stoSeries(url);
 if(!root)return "[]";
 try{
  var overview=await __requestText(root,{headers:{Accept:"text/html,application/xhtml+xml",Referer:BASE_URL+"/"}});
  if(!overview){__awLog("episodes overview empty");return "[]"}
  var seasons=stoSeasonNumbers(overview,root),requested=stoSeason(url);
  if(requested>0&&seasons.indexOf(requested)<0)seasons.push(requested);
  if(!seasons.length)seasons=[1];
  seasons.sort(function(a,b){return a-b});
  var results=new Array(seasons.length),cursor=0;
  async function worker(){
   while(cursor<seasons.length){
    var i=cursor++,season=seasons[i],href=root+"/staffel-"+season,html=season===1?overview:"";
    var links=stoEpisodeLinks(html,root,season);
    if(!links.length){
      html=await __requestText(href,{headers:{Accept:"text/html",Referer:root}});
      links=stoEpisodeLinks(html,root,season);
    }
    if(!links.length){
      var rendered=await stoHydratedHTML(href);
      if(rendered){links=stoEpisodeLinks(rendered,root,season);if(!links.length)html=rendered;}
    }
    if(!links.length){
      var nums=stoNumbersInTable(html);
      if(!nums.length&&season===1)nums=stoNumbersInTable(overview);
      if(nums.length && await stoEpisodeValidated(href+"/episode-"+nums[0])){
        links=nums.map(function(n){return {href:href+"/episode-"+n,number:n}});
        __awLog("Season "+season+": "+links.length+" table episodes verified");
      }
    }
    results[i]=links;
   }
  }
  var workers=[];for(var w=0;w<Math.min(3,seasons.length);w++)workers.push(worker());
  await Promise.all(workers);
  var episodes=[],seen={},offset=0;
  for(var a=0;a<seasons.length;a++){
   var items=results[a]||[],maximum=0;
   for(var b=0;b<items.length;b++){
    var x=items[b];maximum=Math.max(maximum,x.number);
    if(!seen[x.href]){seen[x.href]=true;episodes.push({href:x.href,number:offset+x.number})}
   }
   offset+=maximum;
   __awLog("Season "+seasons[a]+": "+items.length+" episodes");
  }
  return JSON.stringify(episodes);
 }catch(e){__awLog("episodes: "+String(e).slice(0,140));return "[]";}
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
