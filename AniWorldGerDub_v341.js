var __shiroxSourceDomains={};
function __shiroxSourceURL(url){
 return String(url).replace(/^(https:\/\/)(aniworld|serienstream)\.to(?=\/|$)/i,function(origin,scheme,name){return __shiroxSourceDomains[name.toLowerCase()]||origin});
}
async function __shiroxSourceRequest(url,headers,method,body){
 var target=__shiroxSourceURL(url),response,error;
 try{response=await fetchv2(target,headers,method,body)}catch(e){error=e}
 if(response&&[403,502,503,504].indexOf(Number(response.status))<0)return response;
 var alternate=String(target).replace(/^(https:\/\/)(aniworld)\.to(?=\/|$)/i,"$1$2.cc")
   .replace(/^(https:\/\/)(serienstream)\.to(?=\/|$)/i,"$1$2.cx");
 if(alternate===target){if(response)return response;throw error}
 var scoped={};Object.keys(headers||{}).forEach(function(key){if(!/^(cookie|authorization)$/i.test(key))scoped[key]=headers[key]});
 try{
  var next=await fetchv2(alternate,scoped,method,body);
  if(next&&Number(next.status)>=200&&Number(next.status)<400){
   var match=alternate.match(/^https:\/\/(aniworld|serienstream)\.(?:cc|cx)/i);
   if(match)__shiroxSourceDomains[match[1].toLowerCase()]=match[0];
   return next;
  }
  if(response)return response;return next;
 }catch(e){if(response)return response;throw e}
}
// __SHIROX_LANGUAGE_CONTRACT_V2: per-episode language-aware resolver.
function __shiroxAttr(tag,key){
 var m=String(tag||"").match(new RegExp("(?:^|\\s)"+key+"\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')","i"));
 return m?(m[1]===undefined?m[2]:m[1]):"";
}
function __shiroxLanguage(label){
 var s=String(label||"").toLowerCase(),sub=/sub|untertitel/.test(s),de=/deutsch|german|\bger\b/.test(s),en=/english|englisch|\beng\b/.test(s);
 if(!s)return null;
 return {audioLanguage:de&&!sub?"de":en&&!sub?"en":"und",
         subtitleLanguage:sub?(de?"de":en?"en":null):null,
         isHardsub:sub&&(de||en),languagePriority:de&&!sub?0:de&&sub?1:en&&sub?2:3};
}
function __shiroxAbsolute(value,base){
 value=String(value||"").replace(/&amp;/g,"&");
 if(/^https?:\/\//i.test(value))return value;
 if(value.indexOf("//")===0)return "https:"+value;
 if(!value||/^[a-z][\w+.-]*:/i.test(value))return "";
 var origin=(String(base).match(/^https?:\/\/[^/]+/i)||[])[0];if(!origin)return "";
 return value.charAt(0)==="/"?origin+value:String(base).split(/[?#]/)[0].replace(/[^/]*$/,"")+value;
}
function __shiroxTracks(html,page){
 var tags=String(html||"").match(/<track\b[^>]*>/gi)||[],out=[];
 tags.forEach(function(tag){
  var lang=__shiroxAttr(tag,"srclang"),label=__shiroxAttr(tag,"label"),src=__shiroxAbsolute(__shiroxAttr(tag,"src"),page);
  if(src&&/^(?:de|deu|ger|en|eng)(?:-|$)/i.test(lang))out.push({title:label||lang,url:src,lang:lang,headers:{Referer:page}});
 });
 return out;
}
function __shiroxDecorate(stream,hoster,html,page){
 var out=Object.assign({},stream),metadata=hoster.language||{};
 out.audioLanguage=metadata.audioLanguage||"und";
 out.subtitleLanguage=metadata.subtitleLanguage||undefined;
 out.isHardsub=metadata.isHardsub===true;
 out.allSubtitles=__shiroxTracks(html,page);
 return out;
}
function __shiroxStreamPriority(stream){
 if(stream.audioLanguage==="de")return 0;
 var languages=(stream.allSubtitles||[]).map(function(t){return t.lang});
 if(stream.isHardsub&&stream.subtitleLanguage==="de"||languages.some(function(l){return /^(de|deu|ger)(-|$)/i.test(l)}))return 1;
 if(stream.isHardsub&&stream.subtitleLanguage==="en"||languages.some(function(l){return /^(en|eng)(-|$)/i.test(l)}))return 2;
 return 3;
}
async function __shiroxResolveLanguage(hosters,capture,options){
 var specified=options&&typeof options.languagePriority==="number",first=specified?options.languagePriority:0,last=specified?first:2;
 var blockedReason=null;
 for(var priority=first;priority<=last;priority++){
  var candidates=hosters.filter(function(h){var l=h.language||{};return l.languagePriority===priority||(priority>0&&l.languagePriority===3)}).slice(0,12);
  if(!candidates.length)continue;
  var streams=await new Promise(function(resolve){
   var done=false,next=0,active=0,out=[],seen={},grace,timer=setTimeout(finish,24000);
   function finish(){if(done)return;done=true;clearTimeout(timer);if(grace)clearTimeout(grace);resolve(out)}
   function pump(){
    while(!done&&active<3&&next<candidates.length){
     var hoster=candidates[next++];active++;
     Promise.resolve(hoster).then(capture).then(function(value){
      if(done)return;
      var values=Array.isArray(value)?value:[value];
      values.forEach(function(s){if(s&&s.blockedReason)out.blockedReason=s.blockedReason;if(s&&s.streamUrl&&(priority===0?s.audioLanguage==="de":s.audioLanguage!=="de"&&(s.isHardsub&&s.subtitleLanguage===(priority===1?"de":"en")||(s.allSubtitles||[]).some(function(t){return priority===1?/^(de|deu|ger)(-|$)/i.test(t.lang):/^(en|eng)(-|$)/i.test(t.lang)})))&&!seen[s.streamUrl]){seen[s.streamUrl]=true;out.push(s)}});
      if(out.length>=2)finish();else if(out.length&&!grace)grace=setTimeout(finish,500);
     },function(){}).then(function(){active--;if(!done){if(next===candidates.length&&active===0)finish();else pump()}});
    }
   }
   pump();
  });
  if(streams.blockedReason)blockedReason=streams.blockedReason;
  if(streams.length)return streams;
 }
 var empty=[];if(blockedReason)empty.blockedReason=blockedReason;return empty;
}

const BASE_URL = "https://aniworld.to";
// v3.5.1: standalone, no runtime script downloader.

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
    response = await __shiroxSourceRequest(url, headers, options.method || "GET", options.body || null);
  } catch (e) {
    try {
      response = await fetch(url, options);
    } catch (e2) {
      console.log("[AniWorld v3.5.1] request failed:", url, e2);
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

function __animeHref(link) {
  if (!link) return "";
  link = String(link).trim();
  if (/^https?:\/\//i.test(link)) return link;
  if (link.indexOf("/anime/stream/") === 0) return BASE_URL + link;
  if (link.indexOf("anime/stream/") === 0) return BASE_URL + "/" + link;
  if (link.charAt(0) === "/") return BASE_URL + link;
  return BASE_URL + "/anime/stream/" + link.replace(/^\/+/, "");
}

function __seasonNumber(url) {
  var m = String(url || "").match(/\/staffel-(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function __episodeNumber(url) {
  var m = String(url || "").match(/\/episode-(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function __unique(items) {
  var seen = {};
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var value = items[i];
    if (!value || seen[value]) continue;
    seen[value] = true;
    out.push(value);
  }
  return out;
}



async function searchResults(keyword) {
  try {
    var text = await __requestText(
      BASE_URL + "/ajax/seriesSearch?keyword=" + encodeURIComponent(keyword),
      { headers: { "Accept": "application/json", "Referer": BASE_URL + "/" } }
    );
    if (!text) return JSON.stringify([]);

    var data = JSON.parse(text);
    if (!Array.isArray(data)) return JSON.stringify([]);

    var results = [];
    for (var i = 0; i < data.length; i++) {
      var item = data[i] || {};
      if (!item.name || !item.link) continue;
      results.push({
        title: String(item.name).trim(),
        image: item.cover ? __absolute(item.cover) : "",
        href: __animeHref(item.link)
      });
    }

    console.log("[AniWorld v3.5.1] search results:", results.length);
    return JSON.stringify(results);
  } catch (error) {
    console.log("[AniWorld v3.5.1] search error:", error);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    var html=await __requestText(url,{headers:{Accept:"text/html",Referer:BASE_URL+"/"}});
    var tag=(html.match(/<p\b[^>]*class=["'][^"']*seri_des[^"']*["'][^>]*>/i)||[""])[0];
    var desc=__awAttr(tag,"data-full-description");
    if(!desc)desc=(html.match(/<p\b[^>]*class=["'][^"']*seri_des[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)||[])[1]||"";
    var title=__awAttr((html.match(/<h1\b[^>]*>/i)||[""])[0],"data-alternativetitles");
    var clean=function(x){return String(x||"").replace(/<[^>]*>/g," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g," ").trim()};
    return JSON.stringify([{description:clean(desc),aliases:clean(title),airdate:""}]);
  } catch(e){__awLog("details failed: "+String(e).slice(0,100));return JSON.stringify([{description:"",aliases:"",airdate:""}])}
}


// All seasons must be discovered from the SERIES landing page, not just S1's
// episode table. Shirox consumes one flat list, so convert per-season E1..N
// to chronological episode numbers (S1 E24 => #24, S2 E1 => #25).
function __awSeriesRoot(value) {
  var url=String(value||"").trim().replace(/&amp;/gi,"&");
  if(url.indexOf("//")===0)url="https:"+url;
  if(url.charAt(0)==="/")url=BASE_URL+url;
  var match=url.match(/^https?:\/\/(?:www\.)?aniworld\.(?:to|cc)\/anime\/stream\/([^/?#]+)/i);
  if(!match)return "";
  return BASE_URL+"/anime/stream/"+match[1];
}
function __awSeasonLinks(html,root) {
  // Supports quoted, unquoted, attribute spaces, absolute and relative URLs.
  var urls=[],seen={},str=String(html||"");
  var re=/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,m;
  while((m=re.exec(str))!==null) {
    var raw=m[1]||m[2]||m[3]||"";
    var link=__awAbsolute(raw,BASE_URL+"/");
    var info=link.match(/^(https?:\/\/(?:www\.)?aniworld\.(?:to|cc)\/anime\/stream\/[^/?#]+)\/staffel-(\d+)(?:\/|[?#]|$)/i);
    if(!info||__awSeriesRoot(info[1])!==root)continue;
    var number=parseInt(info[2],10);
    if(!Number.isFinite(number)||number<1)continue;
    var canonical=root+"/staffel-"+number;
    if(!seen[canonical]){seen[canonical]=true;urls.push({number:number,url:canonical})}
  }
  urls.sort(function(a,b){return a.number-b.number});
  return urls;
}
function __awEpisodeLinks(html,root,expectedSeason){
  var links=[],seen={},re=/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,m;
  while((m=re.exec(String(html||"")))!==null) {
    var raw=m[1]||m[2]||m[3]||"";
    var url=__awAbsolute(raw,BASE_URL+"/");
    var parts=url.match(/^(https?:\/\/(?:www\.)?aniworld\.(?:to|cc)\/anime\/stream\/[^/?#]+)\/staffel-(\d+)\/episode-(\d+)(?=[/?#]|$)/i);
    if(!parts||__awSeriesRoot(parts[1])!==root)continue;
    var season=parseInt(parts[2],10),episode=parseInt(parts[3],10);
    if(season!==expectedSeason||episode<1||!Number.isFinite(episode))continue;
    var href=root+"/staffel-"+season+"/episode-"+episode;
    if(!seen[href]){seen[href]=true;links.push({href:href,localNumber:episode})}
  }
  links.sort(function(a,b){return a.localNumber-b.localNumber});
  return links;
}
async function extractEpisodes(url,options) {
  var root=__awSeriesRoot(url);
  if(!root){__awLog("Episode list: invalid series URL");return JSON.stringify([])}
  try{
    // The series overview lists all known seasons. Visiting a season page first
    // can otherwise trap discovery in that season only.
    var initial=await __requestText(root,{
      headers:{"Accept":"text/html,application/xhtml+xml","Referer":BASE_URL+"/"}
    });
    if(!initial){__awLog("Episode list: series overview unavailable");return JSON.stringify([])}
    var seasons=__awSeasonLinks(initial,root);
    // When the site omits the nav on a one-season title, use S1 from overview.
    if(!seasons.length)seasons=[{number:1,url:root+"/staffel-1"}];
    var suppliedSeason=Number(options&&options.season)||Number((String(url).match(/\/staffel-(\d+)/i)||[])[1]||0);
    if(suppliedSeason && !seasons.some(function(s){return s.number===suppliedSeason})){
      seasons.push({number:suppliedSeason,url:root+"/staffel-"+suppliedSeason});
      seasons.sort(function(a,b){return a.number-b.number});
    }
    if(options&&options.season)seasons=seasons.filter(function(s){return s.number===Number(options.season)});
    var seasonResults=new Array(seasons.length);
    // Limited concurrency avoids a long chain of sequential network requests
    // without sending every season of a very long anime at once.
    var cursor=0;
    async function worker() {
      while(cursor<seasons.length){
        var idx=cursor++,s=seasons[idx];
        var html="";
        // Series overview normally is the S1 episode table as well.
        if(s.number===1){
          var primary=__awEpisodeLinks(initial,root,1);
          if(primary.length){seasonResults[idx]=primary;continue}
        }
        try{
          html=await __requestText(s.url,{
            headers:{"Accept":"text/html,application/xhtml+xml","Referer":root}
          });
        }catch(e){__awLog("Season "+s.number+" fetch failed")}
        seasonResults[idx]=__awEpisodeLinks(html,root,s.number);
      }
    }
    var jobs=[];
    for(var w=0;w<Math.min(3,seasons.length);w++)jobs.push(worker());
    await Promise.all(jobs);
    var output=[],seen={},offset=0;
    for(var i=0;i<seasons.length;i++){
      var season=seasons[i],links=seasonResults[i]||[],highest=0;
      for(var j=0;j<links.length;j++){
        var item=links[j];
        highest=Math.max(highest,item.localNumber);
        if(seen[item.href])continue;
        seen[item.href]=true;
        output.push({href:item.href,number:offset+item.localNumber});
      }
      offset+=highest;
      __awLog("Season "+season.number+": "+links.length+" episodes");
    }
    __awLog("All seasons: "+seasons.length+", total episodes: "+output.length);
    return JSON.stringify(output);
  }catch(error){
    __awLog("Episode list error: "+String(error).slice(0,160));
    return JSON.stringify([]);
  }
}

// v3.5.1: The episode exists but the old fetch-only resolver often sees no media
// in hoster pages. Shirox networkFetch observes real browser/player requests.
function __awLog(message) {
  if (typeof console !== "undefined" && typeof console.warn === "function") console.warn("[AniWorld v3.5.1] " + message);
  else if (typeof console !== "undefined" && typeof console.log === "function") console.log("[AniWorld v3.5.1] " + message);
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
function __awHosters(html) {
  var flags = {};
  var imgs = String(html || "").match(/<img\b[^>]*>/gi) || [];
  for (var i = 0; i < imgs.length; i++) {
    var key = __awAttr(imgs[i], "data-lang-key"), title = __awAttr(imgs[i], "title") || __awAttr(imgs[i], "alt");
    if (key && title) flags[key] = title;
  }
  var out = [], seen = {};
  var list = String(html || "").match(/<li\b[^>]*data-lang-key\s*=\s*["'][^"']+["'][\s\S]*?<\/li>/gi) || [];
  for (var j = 0; j < list.length; j++) {
    var li = list[j], open = (li.match(/^<li\b[^>]*>/i) || [""])[0];
    var langKey = __awAttr(open, "data-lang-key");
    var language = flags[langKey] || (langKey === "1" ? "Deutsch" : "");
    var languageMetadata=__shiroxLanguage(language); if(!languageMetadata)continue;
    var link = (li.match(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/i) || [])[1];
    var url = __awAbsolute(link, BASE_URL + "/");
    if (!url || !/^https:\/\/aniworld\.(?:to|cc)\/redirect\//i.test(url) || seen[url]) continue;
    seen[url] = true;
    var hoster = (li.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i) || [])[1] || "Video";
    hoster = hoster.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    out.push({ url: url, title: hoster, language:languageMetadata });
  }
  // Keep compatibility with v2 episode layouts using provider buttons.
  // Respect the published German audio language and same-origin redirect.
  var buttons = String(html || "").match(/<button\b[^>]*data-play-url\s*=\s*["'][^"']+["'][^>]*>/gi) || [];
  for (var b = 0; b < buttons.length; b++) {
    var tag = buttons[b], language = __awAttr(tag, "data-language-label") ||
      (__awAttr(tag, "data-language-id") === "1" ? "Deutsch" : "");
    var languageMetadata=__shiroxLanguage(language); if(!languageMetadata)continue;
    var buttonURL = __awAbsolute(__awAttr(tag, "data-play-url"), BASE_URL + "/");
    if (!/^https:\/\/aniworld\.(?:to|cc)\/(?:redirect\/|r\?)/i.test(buttonURL) || seen[buttonURL]) continue;
    seen[buttonURL] = true;
    out.push({url:buttonURL,title:__awAttr(tag,"data-provider-name") || "Video",language:languageMetadata});
  }
  var order = { voe: 0, vidmoly: 1, filemoon: 2, loadx: 3, luluvdo: 4 };
  out.sort(function(a,b) {
    var x = a.title.toLowerCase(), y = b.title.toLowerCase();
    var ax = order[x] === undefined ? 10 : order[x];
    var by = order[y] === undefined ? 10 : order[y];
    return ax - by;
  });
  return out;
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
    if (!url || !__awPublic(url) || !__awMediaKind(url) || /doubleclick|googlesyndication|test-videos\.co\.uk|\/preroll\//i.test(url) || seen[url]) continue;
    seen[url] = true;
    urls.push(url);
  }
  urls.sort(function(a, b) { return (__awMediaKind(a) === "hls" ? 0 : 1) - (__awMediaKind(b) === "hls" ? 0 : 1); });
  return urls;
}
async function __awVerify(url,page) {
  if(typeof fetchv2!=="function" && typeof fetch!=="function")return null;
  var origin=__awOrigin(page),headerSets=[
    {Referer:origin+"/",Origin:origin},
    {Referer:BASE_URL+"/"},
    {}
  ];
  for(var p=0;p<headerSets.length;p++){
    var headers=headerSets[p];
    try{
      var r=typeof fetchv2==="function" ?
        await fetchv2(url,headers,__awMediaKind(url)==="mp4"?"HEAD":"GET",null) :
        await fetch(url,{headers:headers,method:__awMediaKind(url)==="mp4"?"HEAD":"GET"});
      if(!r || typeof r==="string" || (typeof r.status==="number"&&(r.status<200||r.status>=300)))continue;
      if(__awMediaKind(url)==="hls"){
        var content=await r.text();
        content=String(content||"").replace(/^\uFEFF/,"").trim();
        if(!/^#EXTM3U(?:\r?\n|$)/.test(content))continue;
        return {url:url,headers:headers,playlist:content,type:"hls"};
      }
      var hh=r.headers||{},mime=typeof hh.get==="function"?hh.get("content-type"):hh["content-type"]||hh["Content-Type"]||"";
      if(/^video\//i.test(String(mime)))return{url:url,headers:headers,type:"mp4"};
    }catch(e){}
  }
  return null;
}
function __awVariantUrl(master,uri){
  uri=String(uri||"").trim().replace(/&amp;/gi,"&");
  if(!uri)return "";
  if(/^https?:\/\//i.test(uri))return uri;
  if(/^\/\//.test(uri))return "https:"+uri;
  if(/^[a-z][\w+.-]*:/i.test(uri))return "";
  var origin=__awOrigin(master),clean=String(master||"").split("#")[0].split("?")[0],path="";
  if(uri.charAt(0)==="/")path=uri;
  else{
    path=clean.slice(origin.length).replace(/[^/]*$/,"")+uri;
  }
  var pieces=path.split("/"),parts=[];
  for(var i=0;i<pieces.length;i++){
    if(pieces[i]===".."){if(parts.length)parts.pop()}
    else if(pieces[i]!==""&&pieces[i]!==".")parts.push(pieces[i]);
  }
  return origin+"/"+parts.join("/");
}
function __awParseVariants(content,url){
  if(!/#EXT-X-STREAM-INF/i.test(content))return[];
  // A rendition with separately declared audio can lose sound if played directly.
  if(/#EXT-X-MEDIA:[^\r\n]*TYPE=AUDIO/i.test(content))return[];
  var lines=String(content||"").split(/\r?\n/),out=[];
  for(var i=0;i<lines.length;i++){
    if(!/^#EXT-X-STREAM-INF\s*:/i.test(lines[i]))continue;
    var metadata=lines[i],resolution=metadata.match(/\bRESOLUTION\s*=\s*(\d+)x(\d+)/i);
    var height=resolution?Number(resolution[2]):0;
    var bw=(metadata.match(/\bBANDWIDTH\s*=\s*(\d+)/i)||[])[1];
    // Never label a stream as SD/HD if the resolution is unknown.
    if(!height||height>720||height<144)continue;
    var next="";
    for(var j=i+1;j<lines.length;j++){
      var line=lines[j].trim();
      if(!line||line.charAt(0)==="#"&& !/^#EXT-X-STREAM-INF/i.test(line))continue;
      if(line.charAt(0)==="#")break;
      next=line;break;
    }
    var target=__awVariantUrl(url,next);
    if(__awPublic(target)&&__awMediaKind(target)==="hls")out.push({url:target,height:height,bandwidth:Number(bw||0)});
  }
  return out;
}
async function __awQualityOptions(verified,page,providerName){
  var main={title:providerName+" · Auto HLS",streamUrl:verified.url,headers:verified.headers};
  if(verified.type!=="hls"||!verified.playlist)return[{title:providerName+" · Video",streamUrl:verified.url,headers:verified.headers}];
  // The verified master already contains adaptive quality and audio choices.
  // Do not serially load fixed renditions before allowing playback to start.
  return [main];
}


async function __awCapture(provider) {
  if(typeof networkFetch!=="function")return null;
  var result=await networkFetch(__shiroxSourceURL(provider.url),{
    timeoutSeconds:10,cutoff:".m3u8",returnHTML:true,returnCookies:false,
    headers:{Referer:BASE_URL+"/"},waitForSelectors:["video","source"],
    clickSelectors:[".vjs-big-play-button",".jw-icon-display","button[aria-label='Play']",".art-icon-play[aria-label='Play']"],
    maxWaitTime:3
  });
  if(!result||result.success===false){__awLog(provider.title+" web player failed");return null}
  var requests=Array.isArray(result.requests)?result.requests:[];
  var page=__awPublic(result.mediaPageURL||result.originalUrl||result.url)?result.mediaPageURL||result.originalUrl||result.url:provider.url;
  for(var j=0;j<requests.length;j++){
    var link=typeof requests[j]==="string"?requests[j]:requests[j]&&(requests[j].url||requests[j].requestUrl);
    if(page===provider.url&&link&&__awPublic(link)&&!/^https:\/\/aniworld\.(?:to|cc)\//i.test(link)&&
      /(voe|vidmoly|filemoon|loadx|luluvdo)/i.test(__awOrigin(link))&&!__awMediaKind(link)){page=link;break}
  }
  var urls=__awCandidates(result,page);
  // Prefer master manifests (with low-bitrate renditions) over fixed high-quality files.
  urls.sort(function(a,b){
    function rank(u){
      if(__awMediaKind(u)==="mp4")return 10;
      if(/(?:master|index|playlist)\.m3u8(?:[?#]|$)/i.test(u))return 0;
      if(/(?:480|540)p?(?:[\/_.-]|$)/i.test(u))return 1;
      if(/(?:720)p?(?:[\/_.-]|$)/i.test(u))return 2;
      if(/(?:1080|1440|2160|4k)p?(?:[\/_.-]|$)/i.test(u))return 9;
      return 3;
    }
    return rank(a)-rank(b)
  });
  __awLog(provider.title+": "+urls.length+" player media candidates");
  for(var k=0;k<Math.min(3,urls.length);k++){
    var checked=await __awVerify(urls[k],page);
    if(checked){var choices=await __awQualityOptions(checked,page,provider.title);return choices.map(function(s){return __shiroxDecorate(s,provider,result.html,page)})}
  }
  return null;
}


async function extractStreamUrl(url,options){
  try{
    var html=await __requestText(url,{headers:{Accept:"text/html,application/xhtml+xml",Referer:BASE_URL+"/"}});
    if(!html){__awLog("episode page is empty");return JSON.stringify({streams:[],subtitles:[]})}
    var hosters=__awHosters(html);
    __awLog("German hosters: "+hosters.map(function(x){return x.title}).join(", "));
    if(typeof networkFetch!=="function")__awLog("browser fetch is unavailable");
    var streams=await __shiroxResolveLanguage(hosters,__awCapture,options);
    if(streams.length)return JSON.stringify({streams:streams,subtitles:[]});
    __awLog("No working stream from checked German hosters");
  }catch(e){__awLog("stream lookup failed: "+String(e).slice(0,140))}
  return JSON.stringify({streams:[],subtitles:[]});
}
