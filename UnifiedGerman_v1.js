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
// Decode VOE's published JSON payload without evaluating page scripts.
function __shiroxVoeSources(html){
 if(typeof atob!=="function")return [];
 var blocks=String(html||"").match(/<script\b[^>]*type=["']application\/json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
 for(var i=0;i<Math.min(blocks.length,8);i++)try{
  var body=blocks[i].replace(/^<script\b[^>]*>|<\/script>$/gi,"");if(body.length>262144)continue;
  var payload=JSON.parse(body);if(!Array.isArray(payload)||typeof payload[0]!=="string")continue;
  var stage=payload[0].replace(/[A-Za-z]/g,function(c){var n=c.charCodeAt(0),base=n<=90?65:97;return String.fromCharCode(base+(n-base+13)%26)});
  ["@$","^^","~@","%?","*~","!!","#&"].forEach(function(noise){stage=stage.split(noise).join("_")});
  stage=atob(stage.replace(/_/g,""));stage=stage.split("").map(function(c){return String.fromCharCode(c.charCodeAt(0)-3)}).reverse().join("");
  var data=JSON.parse(atob(stage));
  var values=[data.source,data.direct_access_url].filter(function(url){return typeof url==="string"&&/^https?:\/\//i.test(url)&&/\.(?:m3u8|mp4)(?:[?#]|$)/i.test(url)});
  if(values.length)return values;
 }catch(e){}
 return [];
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
 var blockedReason=null,concurrency=options&&options.sequentialCaptures?1:3,firstOnly=!!(options&&options.firstVerifiedOnly);
 for(var priority=first;priority<=last;priority++){
  var candidates=hosters.filter(function(h){var l=h.language||{};return l.languagePriority===priority||(priority>0&&l.languagePriority===3)});
  // A remembered provider is only a tie-breaker INSIDE the current language.
  // Never promote a previously selected subtitle mirror above German audio.
  var preferred=options&&options.preferredProvider;
  function providerName(value){return String(value||"").split(/[·|]/)[0].trim().toLowerCase()}
  if(preferred)candidates.sort(function(a,b){return Number(providerName(b.title)===providerName(preferred))-Number(providerName(a.title)===providerName(preferred))});
  candidates=candidates.slice(0,12);
  if(!candidates.length)continue;
  var streams=await new Promise(function(resolve){
   var done=false,next=0,active=0,out=[],seen={},grace,timer=setTimeout(finish,options&&options.sequentialCaptures?30000:24000);
   function finish(){if(done)return;done=true;clearTimeout(timer);if(grace)clearTimeout(grace);resolve(out)}
   function pump(){
    while(!done&&active<concurrency&&next<candidates.length){
     var hoster=candidates[next++];active++;
     Promise.resolve(hoster).then(capture).then(function(value){
      if(done)return;
      var values=Array.isArray(value)?value:[value];
      values.forEach(function(s){if(s&&s.blockedReason)out.blockedReason=s.blockedReason;if(s&&s.streamUrl&&(priority===0?s.audioLanguage==="de":s.audioLanguage!=="de"&&(s.isHardsub&&s.subtitleLanguage===(priority===1?"de":"en")||(s.allSubtitles||[]).some(function(t){return priority===1?/^(de|deu|ger)(-|$)/i.test(t.lang):/^(en|eng)(-|$)/i.test(t.lang)})))&&!seen[s.streamUrl]){seen[s.streamUrl]=true;out.push(s)}});
      if(out.length&&(firstOnly||out.length>=2))finish();else if(out.length&&!grace)grace=setTimeout(finish,500);
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

/* Shirox Unified German v2.0.0
 * Two isolated provider runtimes. No shared globals between their parsers.
 * Bundled source code (not remote eval). Fetches use Shirox's existing
 * fetchv2/networkFetch bridges. No AniBridge server or API key required.
 */
var __UNIFIED_ANIWORLD=(function(){
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
  inputs=inputs.concat(__shiroxVoeSources(html),__shiroxVoeSources(capture&&capture.playerHTML));
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
  // Start with the already verified adaptive master; AVPlayer selects quality.
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
  var page=__awPublic(result.mediaPageURL||result.playerPageURL||result.originalUrl||result.url)?result.mediaPageURL||result.playerPageURL||result.originalUrl||result.url:provider.url;
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
    // An access challenge is not a media page. Surface the actual reason
    // instead of silently reporting an episode as unavailable.
    if(/(?:cf-turnstile|cf-challenge|__cf_chl_|challenges\.cloudflare\.com|cf-mitigated|<title[^>]*>\s*just a moment|checking your browser|verify you are human)/i.test(html)){
      __awLog("Episode host requires website verification");
      return JSON.stringify({streams:[],subtitles:[],blockedReason:"website_verification_required"});
    }
    var hosters=__awHosters(html);
    __awLog("German hosters: "+hosters.map(function(x){return x.title}).join(", "));
    if(typeof networkFetch!=="function")__awLog("browser fetch is unavailable");
    var streams=await __shiroxResolveLanguage(hosters,__awCapture,options);
    if(streams.length)return JSON.stringify({streams:streams,subtitles:[]});
    __awLog("No working stream from checked German hosters");
  }catch(e){__awLog("stream lookup failed: "+String(e).slice(0,140))}
  return JSON.stringify({streams:[],subtitles:[]});
}

return {searchResults:searchResults,extractDetails:extractDetails,extractEpisodes:extractEpisodes,extractStreamUrl:extractStreamUrl};
})();
var __UNIFIED_SERIENSTREAM=(function(){
/*
 * s.to (GER DUB) 1.11.0
 * Self-contained Sora/Shirox module: no remote source evaluation, credentials or placeholder streams.
 */
var BASE_URL = "https://serienstream.to";
async function __requestText(url, options) {
  options = options || {};
  var headers = options.headers || {};
  // Use the iOS networking stack's real User-Agent. Spoofing a Safari UA
  // on a URLSession TLS fingerprint can cause intermittent bot checks.
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
      console.log("[SerienStream v1.11.0] request failed:", url, e2);
      return "";
    }
  }

  if (!response) return "";
  // Search needs to distinguish an HTTP error from a legitimate empty list.
  // Other module calls keep their existing best-effort behavior.
  if (options.strictStatus && typeof response.status === "number" &&
      (response.status < 200 || response.status >= 400)) {
    throw new Error("HTTP " + response.status);
  }
  if (typeof response === "string") return response;
  try {
    if (typeof response.text === "function") return await response.text();
  } catch (e3) {}
  // Support older fetch bridges wrapping HTML into body/data/html.
  if(typeof response.body==="string")return response.body;
  if(typeof response.data==="string")return response.data;
  if(typeof response.html==="string")return response.html;
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
  if (typeof console !== "undefined" && typeof console.warn === "function") console.warn("[SerienStream v1.11.0] " + message);
  else if (typeof console !== "undefined" && typeof console.log === "function") console.log("[SerienStream v1.11.0] " + message);
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
  inputs=inputs.concat(__shiroxVoeSources(html),__shiroxVoeSources(capture&&capture.playerHTML));
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
      if (!response || typeof response === "string") continue;
      __awLog("media "+__awMediaKind(url)+" HTTP "+response.status+" origin="+__awOrigin(url)+" player="+__awOrigin(page));
      if (typeof response.status === "number" && (response.status < 200 || response.status >= 300)) {
        var denial=String(await response.text()).slice(0,2048);
        __awLog("media denial="+(/expired/i.test(denial)?"expired":/signature/i.test(denial)?"signature":/token/i.test(denial)?"token":/\b(?:ip|asn)\b/i.test(denial)?"network-binding":/forbidden/i.test(denial)?"forbidden":"other"));
        continue;
      }
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
 for(var i=0;i<imgs.length;i++){
  var tag=imgs[i],alt=stoNormalizeTitle(__awAttr(tag,"alt"));
  var url=__awAttr(tag,"data-src")||__awAttr(tag,"src")||__awAttr(tag,"data-original");
  if(!url){var srcset=__awAttr(tag,"srcset");if(srcset)url=srcset.split(",")[0].trim().split(/\s+/)[0]}
  if(!url||url.indexOf("data:")===0)continue;
  if(alt===stoNormalizeTitle(title)||alt===stoNormalizeTitle(title)+" poster"||alt===stoNormalizeTitle(title)+" cover"){src=url;break}
  if(!fallback && /poster|cover|serie/i.test(alt))fallback=url;
 }
 src=src||fallback;
 return src?__awAbsolute(src,BASE_URL+"/"):"";
}

function stoHtmlSearch(html,keyword) {
  var results=[],seen={},text=String(html||""),term=stoNormalizeTitle(keyword);
  if(!term)return [];
  var re=/<a\b([^>]*)href\s*=\s*(?:"([^"]+)"|'([^']+)')([^>]*)>([\s\S]*?)<\/a>/gi,m;
  while((m=re.exec(text))!==null) {
    var href=stoSeries(m[2]||m[3]);if(!href||seen[href])continue;
    var inner=m[5],attrs=m[1]+" "+m[4],img=(inner.match(/<img\b[^>]*>/i)||[""])[0];
    var headline=(inner.match(/<(?:h[1-6]|strong|span)\b[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong|span)>/i)||[])[1];
    var candidates=[headline,__awAttr(attrs,"aria-label"),__awAttr(attrs,"data-title"),
      __awAttr(attrs,"title"),__awAttr(img,"alt"),inner].map(stoClean);
    var title="";
    for(var i=0;i<candidates.length;i++)
      if(candidates[i]&&candidates[i].length<=160&&stoNormalizeTitle(candidates[i]).indexOf(term)>=0){
        title=candidates[i];break;
      }
    if(!title) {
      // A linked series slug is site data, not a fabricated search result.
      var slug=href.split("/").pop();
      if(stoNormalizeTitle(slug).indexOf(term)>=0)
        title=slug.replace(/-/g," ").replace(/\b[a-z]/g,function(c){return c.toUpperCase()});
    }
    if(!title)continue;
    seen[href]=true;
    var cover=__awAttr(img,"data-src")||__awAttr(img,"src")||__awAttr(img,"data-original");
    results.push({title:title,href:href,image:cover?__awAbsolute(cover,BASE_URL+"/"):""});
  }
  return results;
}

var stoVerificationRequired=false;
var stoSearchPageSucceeded=false;
var stoSearchProblem="";
function stoExplicitlyEmptySearch(html) {
  // Only the site's explicit "no matching series" message is evidence of an
  // actual zero-result search. A generic 200 HTML landing page is NOT.
  return /(?:keine (?:treffer|ergebnisse|serien gefunden)|nichts gefunden|0 ergebnisse|no results|nothing found)/i.test(String(html||""));
}
function stoIsUnavailablePage(html) {
  var text=String(html||"");
  return /<title[^>]*>[^<]*(?:403 forbidden|access denied|service unavailable|bad gateway|web server is down|temporarily unavailable)/i.test(text) ||
    /<h1[^>]*>\s*(?:403 forbidden|access denied|service unavailable|bad gateway)/i.test(text);
}
function stoIsSecurityPage(html) {
  var text=String(html||"");
  // "captcha" in a legitimate page's footer is not itself a challenge.
  return /(?:cf-turnstile|cf-challenge|__cf_chl_|challenges\.cloudflare\.com|cf-mitigated|<title[^>]*>\s*just a moment|checking your browser|checking if the site connection is secure|verify you are human|<form[^>]+(?:captcha|challenge))/i.test(text);
}
async function stoBrowserPage(url) {
  // Passive WebKit load only. Never perform an automated security challenge,
  // submit credentials, or claim that a blocked website is searchable.
  if(typeof networkFetch!=="function")return "";
  try {
    var page=await networkFetch(__shiroxSourceURL(url),{
      timeoutSeconds:8,returnHTML:true,returnCookies:false,
      waitForSelectors:["h1","main","a[href*='/serie/']"],maxWaitTime:2
    });
    return page&&page.success!==false?String(page.html||""):"";
  }catch(e){__awLog("WebKit page failed: "+String(e).slice(0,100));return ""}
}
async function stoSearchPage(url) {
  if(stoVerificationRequired)return "";
  var html="";
  try {
    html=await __requestText(url,{
      headers:{Accept:"text/html,application/xhtml+xml",Referer:BASE_URL+"/"},
      strictStatus:true
    });
  }catch(e){
    stoSearchProblem="SerienStream ist über das Modul nicht erreichbar ("+String(e.message||e).slice(0,110)+").";
    __awLog(stoSearchProblem);
  }
  if(stoIsSecurityPage(html)){
    stoVerificationRequired=true;
    stoSearchProblem="SerienStream verlangt eine Bestätigung im Browser. Bitte die Website manuell öffnen und anschließend erneut suchen.";
    __awLog(stoSearchProblem);
    return "";
  }
  if(stoIsUnavailablePage(html)){
    stoSearchProblem="SerienStream hat eine Fehlerseite statt Suchergebnissen zurückgegeben.";
    html="";
  }
  if(html) {
    if(/\/suche(?:[?#]|$)/i.test(url) && stoExplicitlyEmptySearch(html))stoSearchPageSucceeded=true;
    return html;
  }
  // Passive WebKit rendering is only a fallback. Never solve security
  // challenges automatically or fabricate a missing series.
  var rendered=await stoBrowserPage(url);
  if(stoIsSecurityPage(rendered)){
    stoVerificationRequired=true;
    stoSearchProblem="SerienStream verlangt eine Bestätigung im Browser. Bitte die Website manuell öffnen und anschließend erneut suchen.";
    __awLog(stoSearchProblem);
    return "";
  }
  if(stoIsUnavailablePage(rendered)){
    stoSearchProblem="SerienStream hat eine Fehlerseite statt Suchergebnissen zurückgegeben.";
    return "";
  }
  if(rendered) {
    if(/\/suche(?:[?#]|$)/i.test(url) && stoExplicitlyEmptySearch(rendered))stoSearchPageSucceeded=true;
    return rendered;
  }
  if(!stoSearchProblem)stoSearchProblem="SerienStream hat keine lesbare Seite geliefert. Prüfe die Modulversion und die Verbindung.";
  return "";
}
async function stoValidatedExact(keyword) {
  var slug=stoSlug(keyword);
  if(!slug)return null;
  var href=BASE_URL+"/serie/"+slug;
  var html=await stoSearchPage(href);
  if(!html||stoIsSecurityPage(html)||String(html).length<40)return null;
  var title=stoActualTitle(html);
  if(stoNormalizeTitle(title)!==stoNormalizeTitle(keyword)) {
    // Some mobile responses contain only the JS app shell. Passive WebKit
    // rendering once can expose a genuine series title; no challenge bypass.
    if(typeof networkFetch!=="function")return null;
    var rendered=await stoBrowserPage(href);
    if(stoIsSecurityPage(rendered)){stoVerificationRequired=true;return null}
    if(!rendered)return null;
    html=rendered;title=stoActualTitle(html);
    if(stoNormalizeTitle(title)!==stoNormalizeTitle(keyword))return null;
  }
  // Reject redirects to a generic landing page. Keep real title pages even
  // if the new design hides episode links behind JS.
  if(!/(?:\/staffel-\d+|\/episode-\d+|<h1\b|og:title|og:type)/i.test(html))return null;
  return {title:title,href:href,image:stoImage(html,title)};
}
// Alternative titles are used only as probes; every hit must come from an
// actual S.to page. Example: "Dexter: Resurrection" is listed as
// "Dexter: Wiedererwachen". Never invent a result from a slug alone.
function stoCandidateQueries(keyword){
 var text=stoClean(keyword),variants=[],seen={};
 function add(value){value=stoClean(value);if(!value)return;
  var key=stoNormalizeTitle(value);if(!key||seen[key])return;
  seen[key]=1;variants.push(value);
 }
 add(text);
 var seasonless=text.replace(/\s+(?:season|staffel)\s*\d{1,2}\s*$/i,"").trim();
 add(seasonless);
 if(/^dexter\s*:?\s*resurrection(?:\s+(?:season|staffel)\s*\d+)?$/i.test(seasonless))
   add("Dexter: Wiedererwachen");
 var words=seasonless.split(/[\s:]+/).filter(Boolean);
 // Generic discovery for localized titles; avoid weak "the"/"die" searches.
 if(words.length>1 && words[0].length>=5 &&
    !/^(?:other|their|series|movie)$/i.test(words[0]))add(words[0]);
 return variants.slice(0,4);
}
function stoSearchWithin(promise,timeoutMs,fallback){
 // Node VM regression runners may not install timer globals; the real Shirox
 // JSContext does. Keep both environments compatible.
 if(typeof setTimeout!=="function")return Promise.resolve(promise).catch(function(){return fallback});
 return new Promise(function(resolve){
  var finished=false,timer=setTimeout(function(){if(finished)return;finished=true;resolve(fallback)},timeoutMs);
  Promise.resolve(promise).then(function(value){if(finished)return;finished=true;clearTimeout(timer);resolve(value)},
   function(){if(finished)return;finished=true;clearTimeout(timer);resolve(fallback)});
 });
}
async function stoFastExact(keyword){
 var slug=stoSlug(keyword);if(slug.length<3)return null;
 var href=BASE_URL+"/serie/"+slug;
 try{
  var html=await __requestText(href,{strictStatus:true,headers:{Accept:"text/html",Referer:BASE_URL+"/"}});
  if(!html||stoIsUnavailablePage(html))return null;
  if(stoIsSecurityPage(html)){stoVerificationRequired=true;return null}
  var title=stoActualTitle(html);
  if(stoNormalizeTitle(title)!==stoNormalizeTitle(keyword))return null;
  if(!/(?:\/staffel-\d+|\/episode-\d+|<h1\b|og:title)/i.test(html))return null;
  return {title:title,href:href,image:stoImage(html,title)};
 }catch(e){
  if(!stoSearchProblem)stoSearchProblem="SerienStream ist nicht erreichbar ("+String(e.message||e).slice(0,90)+").";
  return null;
 }
}
async function stoFastPageSearch(keyword){
 var url=BASE_URL+"/suche?q="+encodeURIComponent(keyword);
 try{
  var html=await __requestText(url,{strictStatus:true,headers:{Accept:"text/html",Referer:BASE_URL+"/"}});
  if(stoIsSecurityPage(html)){stoVerificationRequired=true;return []}
  if(!html||stoIsUnavailablePage(html))return [];
  if(stoExplicitlyEmptySearch(html))stoSearchPageSucceeded=true;
  var results=stoHtmlSearch(html,keyword);
  if(results.length)stoSearchPageSucceeded=true;
  return results;
 }catch(e){
  if(!stoSearchProblem)stoSearchProblem="SerienStream ist nicht erreichbar ("+String(e.message||e).slice(0,90)+").";
  return [];
 }
}
async function searchResults(keyword){
 keyword=stoClean(keyword);
 if(!keyword)return "[]";
 stoVerificationRequired=false;
 stoSearchPageSucceeded=false;
 stoSearchProblem="";
 var queries=stoCandidateQueries(keyword),all=[],seen={};
 function append(items){
  if(!Array.isArray(items))return;
  for(var i=0;i<items.length;i++){
   var item=items[i];
   if(!item||!item.href||!item.title||seen[item.href])continue;
   seen[item.href]=true;all.push(item);
  }
 }
 // Initial exact/known-localized names and ordinary search run in parallel.
 // The old implementation waited for exact + two search pages + WebKit
 // hydration sequentially, usually exceeding Unified GER's 7.5s deadline.
 var exacts=queries.slice(0,3).filter(function(q){return q.length>=5});
 var first=exacts.map(function(q){return stoSearchWithin(stoFastExact(q),3500,null)});
 first.push(stoSearchWithin(stoFastPageSearch(queries[0]),3500,[]));
 var group=await Promise.all(first);
 for(var g=0;g<group.length;g++)append(Array.isArray(group[g])?group[g]:group[g]?[group[g]]:[]);
 // If no exact/localized hit, search a distinctive shorter title.
 if(!all.length&&queries.length>1){
  var broad=queries[queries.length-1];
  append(await stoSearchWithin(stoFastPageSearch(broad),2200,[]));
 }
 // Last resort: one passive WebKit search; never automate verification.
 if(!all.length&&typeof networkFetch==="function"){
  var rendered=await stoSearchWithin(stoBrowserPage(
   BASE_URL+"/suche?q="+encodeURIComponent(queries[queries.length-1])
  ),9000,"");
  if(!stoIsSecurityPage(rendered))
   append(stoHtmlSearch(rendered,queries[queries.length-1]));
 }
 // A blocked lookup is not evidence that no episodes exist. Make site
 // verification and generic HTML shells visible rather than reporting a
 // genuine, empty series catalogue.
 if(!all.length&&stoVerificationRequired)
  throw new Error("SerienStream benötigt eine Bestätigung im Browser.");
 if(!all.length&&!stoSearchPageSucceeded)
  throw new Error(stoSearchProblem||"SerienStream lieferte keine verwertbaren Suchdaten.");
 var q=stoNormalizeTitle(keyword);
 all.sort(function(a,b){
  var aName=stoNormalizeTitle(a.title),bName=stoNormalizeTitle(b.title);
  function score(name){return name===q?0:name.indexOf(q)===0?1:
    /^dexter resurrection/.test(q)&&name==="dexter wiedererwachen"?0:
    name.indexOf(q.split(" ")[0])>=0?3:6}
  return score(aName)-score(bName);
 });
 __awLog("search "+keyword+": "+all.length+" grounded results");
 return JSON.stringify(all.slice(0,30));
}

async function extractDetails(url){
 try{
  var html=await __requestText(stoCanon(url),{headers:{Accept:"text/html",Referer:BASE_URL+"/"}});
  var desc=(html.match(/<(?:span|p|div)\b[^>]*class=["'][^"']*\bdescription-text\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|p|div)>/i)||[])[1]||
   __awAttr((html.match(/<p\b[^>]*class=["'][^"']*seri_des[^"']*["'][^>]*>/i)||[""])[0],"data-full-description")||
   (html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)||[])[1]||"";
  var aliases=__awAttr((html.match(/<h1\b[^>]*>/i)||[""])[0],"data-alternativetitles");
  return JSON.stringify([{description:stoClean(desc||stoMeta(html,"og:description")),aliases:stoClean(aliases),airdate:"",image:stoImage(html,stoActualTitle(html)),backdrop:stoMeta(html,"og:image")?__awAbsolute(stoMeta(html,"og:image"),BASE_URL+"/"):""}]);
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
 // New S.to sometimes server-renders S1 only; the title's official
 // "Kommende Episode S02E04" marker identifies another season to check.
 // We still verify the season page/episode page before exposing links.
 var next=/(?:kommende|nächste|neueste|aktuelle)\s+episode[^<\n]{0,180}?S0?(\d{1,2})\s*E0?\d{1,3}/gi;
 while((m=next.exec(text))!==null)seen[Number(m[1])]=true;
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
// A verified episode page can supply a missing latest release when the
// season index is client-rendered. Never show a scheduled-only episode.
function stoLatestPublishedHint(html,season) {
 var text=stoReadable(html),match,latest=0;
 var re=/(?:kommende|nächste|neueste|aktuelle)\s+episode[^<\n]{0,180}?S0?(\d{1,2})\s*E0?(\d{1,3})/gi;
 while((match=re.exec(text))!==null)if(Number(match[1])===season)latest=Math.max(latest,Number(match[2]));
 return latest;
}
function stoIsPublishedEpisode(html,season,number) {
 var text=stoReadable(html);
 if(stoIsSecurityPage(text)||stoIsUnavailablePage(text))return false;
 var header=/<h[12]\b[^>]*>[\s\S]{0,140}?S0?(\d{1,2})\s*E0?(\d{1,3})\b/i.exec(text);
 if(!header||Number(header[1])!==season||Number(header[2])!==number)return false;
 // A real episode with a German audio selector/hoster. The site may use a
 // button or a provider list; plain metadata about a future episode is not enough.
 return /(?:data-language-id=["']1["']|data-language-label=["']Deutsch["']|>\s*Deutsch\s*<|Deutsch\s+(?:VOE|Doodstream))/i.test(text);
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
async function extractEpisodes(url,options){
 var root=stoSeries(url);
 if(!root)return "[]";
 try{
  var overview=await __requestText(root,{headers:{Accept:"text/html,application/xhtml+xml",Referer:BASE_URL+"/"}});
  if(stoIsSecurityPage(overview)){
    stoVerificationRequired=true;
    __awLog("Episode catalog needs website verification");
    return "[]";
  }
  if(!overview){__awLog("episodes overview empty");return "[]"}
  var seasons=stoSeasonNumbers(overview,root),requested=Number(options&&options.season)||stoSeason(url);
  if(requested>0&&seasons.indexOf(requested)<0)seasons.push(requested);
  if(!seasons.length)seasons=[1];
  seasons.sort(function(a,b){return a-b});
  if(options&&options.season)seasons=seasons.filter(function(s){return s===Number(options.season)});
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
      // Trust episode numbers explicitly published by the series table. The
      // previous implementation opened episode 1 just to "verify" the table,
      // adding one HTTP request and sometimes a Cloudflare Security Check.
      // No headless-browser challenge and no additional episode probe.
      var nums=stoNumbersInTable(html);
      if(!nums.length&&season===1)nums=stoNumbersInTable(overview);
      if(nums.length){
        links=nums.map(function(n){return {href:href+"/episode-"+n,number:n}});
        __awLog("Season "+season+": "+links.length+" episodes from existing page table");
      }
    }
    // Do not use the schedule as evidence of a playable episode.
    // Verify a single most recent, explicitly advertised SxxExx page when
    // the season index exposes no actual episode links.
    if(!links.length && season>1){
      var last=stoLatestPublishedHint(overview,season);
      if(last>0&&last<=300){
        var episodeURL=href+"/episode-"+last;
        var episodeHTML=await __requestText(episodeURL,{
          headers:{Accept:"text/html",Referer:root}
        });
        if(stoIsPublishedEpisode(episodeHTML,season,last)){
          links=[{href:episodeURL,number:last}];
          __awLog("Season "+season+": validated recent episode "+last);
        }
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
 html=String(html||"");var out=[],seen={},add=function(href,provider,lang,selector){
  var languageMetadata=__shiroxLanguage(lang);if(!languageMetadata)return;
  var url=stoCanon(__awAbsolute(href,BASE_URL+"/"));
  if(!url||!/^https?:\/\/serienstream\.to\//i.test(url)||seen[url])return;
  seen[url]=true;out.push({url:url,title:stoClean(provider)||"Hoster",language:languageMetadata,selector:selector||null});
 };
 var tags=html.match(/<[^>]*data-play-url\s*=\s*["'][^"']+["'][^>]*>/gi)||[];
 for(var i=0;i<tags.length;i++){
  var language=__awAttr(tags[i],"data-language-label")||__awAttr(tags[i],"data-audio-language")||
    (__awAttr(tags[i],"data-language-id")==="1"?"Deutsch":"");
  var provider=__awAttr(tags[i],"data-provider-name"),languageID=__awAttr(tags[i],"data-language-id"),languageLabel=__awAttr(tags[i],"data-language-label");
  var quote=function(value){return String(value).replace(/\\/g,"\\\\").replace(/"/g,'\\"')};
  var selector=provider?'[data-provider-name="'+quote(provider)+'"]':"";
  if(selector&&languageID)selector+='[data-language-id="'+quote(languageID)+'"]';
  else if(selector&&languageLabel)selector+='[data-language-label="'+quote(languageLabel)+'"]';
  else selector="";
  add(__awAttr(tags[i],"data-play-url"),provider||__awAttr(tags[i],"title"),language,selector);
 }
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
 var finalPage=capture&&(capture.playerPageURL||capture.mediaPageURL||capture.originalUrl||capture.url);
 if(__awPublic(finalPage)&&!/^https?:\/\/(?:www\.)?(?:serienstream\.(?:to|cx)|s\.to)\//i.test(finalPage)&&!__awMediaKind(finalPage))return finalPage;
 var items=Array.isArray(capture&&capture.requests)?capture.requests.slice():[];
 if(capture&&capture.cutoffUrl)items.unshift(capture.cutoffUrl);
 var hint=provider.toLowerCase();if(hint.indexOf("voe")>=0)hint="voe";
 for(var i=0;i<items.length;i++){
  var url=typeof items[i]==="string"?items[i]:items[i]&&(items[i].url||items[i].requestUrl);
  if(__awPublic(url)&&!/^https?:\/\/(?:www\.)?serienstream\.to\//i.test(url)&&!__awMediaKind(url)&&(!hint||__awOrigin(url).toLowerCase().indexOf(hint)>=0))return url;
 }
 return "";
}
function stoCaptureSummary(capture){
 if(!capture)return "no browser result";
 var title=stoClean((String(capture.html||"").match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"").slice(0,80);
 var origins=[],seen={};(capture.requests||[]).forEach(function(value){var url=typeof value==="string"?value:value&&value.url;var origin=__awOrigin(url||"");if(origin&&!seen[origin]){seen[origin]=true;origins.push(origin)}});
 return "page="+__awOrigin(capture.originalUrl||capture.url||"")+" title="+title+" verificationResponse="+(capture.verificationResponsePresent===true)+" continued="+(capture.verifiedContinuationClicked===true)+" activated="+(capture.verificationProviderActivated===true)+" contextMatches="+(capture.verificationContextMatches===true)+" proof="+String(capture.verificationProofState||"unknown")+" playerPayload="+!!capture.playerHTML+" playerOrigin="+__awOrigin(capture.playerPageURL||capture.mediaPageURL||"")+" cutoff="+(capture.cutoffTriggered===true)+" requests="+(capture.requests||[]).length+" origins="+origins.slice(0,8).join(",");
}
async function stoNativePlayerCapture(player, episode) {
 if(!__awPublic(player)||!/^\/e\/[a-z0-9]+\/?$/i.test(String(player).replace(/^https?:\/\/[^/]+/i,"").split(/[?#]/)[0]))return null;
 for(var hop=0;hop<2;hop++){
  try{
   var response=typeof fetchv2==="function"?await fetchv2(player,{Referer:__awOrigin(episode)+"/"},"GET",null):await fetch(player,{headers:{Referer:__awOrigin(episode)+"/"}});
   __awLog("native player HTTP "+(response&&response.status)+" origin="+__awOrigin(player));
   if(!response||Number(response.status)!==200)return null;
   var html=String(await response.text());if(html.length>1000000)return null;
   var finalPage=__awPublic(response.url)?response.url:player;
   if(__shiroxVoeSources(html).length)return {html:html,playerHTML:html,playerPageURL:finalPage,requests:[]};
   var redirect=html.match(/window\.location\.href\s*=\s*["']([^"']+)["']/);
   var next=redirect&&__awAbsolute(redirect[1],finalPage);
   if(!__awPublic(next)||!/^\/e\/[a-z0-9]+\/?$/i.test(String(next).replace(/^https?:\/\/[^/]+/i,"").split(/[?#]/)[0]))return null;
   player=next;
  }catch(e){return null}
 }
 return null;
}
async function stoCapture(h,episode){
 if(typeof networkFetch!=="function")return null;
 var options={timeoutSeconds:8,cutoff:".m3u8",returnHTML:true,returnCookies:false,maxWaitTime:2,
  waitForSelectors:["video","source"],
  clickSelectors:[".vjs-big-play-button",".jw-icon-display","button[aria-label='Play']",".art-icon-play[aria-label='Play']"]};
 var pageOptions=Object.assign({},options,{headers:{Referer:episode}});
 var firstURL=h.url;
 if(h.selector){
  // The site's encrypted redirect belongs to its browser session. Activate
  // the actual provider/language button in that same episode document.
  // Advertising frames also request manifests. Wait for the actual
  // player document instead of ending this source session at an ad URL.
  firstURL=episode;pageOptions.cutoff=null;pageOptions.timeoutSeconds=14;pageOptions.maxWaitTime=3;
  pageOptions.waitForSelectors=[h.selector];
  pageOptions.clickSelectors=[h.selector].concat(options.clickSelectors);
 }
 var first=await networkFetch(__shiroxSourceURL(firstURL),pageOptions);
 __awLog(h.title+" browser: "+stoCaptureSummary(first));
 if(first&&stoPlayerBlocked(first.html)&&!first.verificationResponsePresent&&!__awCandidates(first,first.mediaPageURL||first.originalUrl||first.url||firstURL).length)return {blockedReason:"website_verification_required"};
 if(!first||first.success===false)return null;
 var blocked=false,external=stoProvider(first,h.title),captures=[{data:first,base:external||h.url}];
 // Obtain short-lived media URLs with the native client that will verify
 // and play them, rather than reusing a token issued to WebKit's network context.
 var nativePlayer=external&&await stoNativePlayerCapture(external,episode);
 if(nativePlayer)captures.unshift({data:nativePlayer,base:nativePlayer.playerPageURL});
 if(external && !__awCandidates(first,external||h.url).length){
  try{
   var second=await networkFetch(external,Object.assign({},options,{headers:{Referer:BASE_URL+"/"}}));
   __awLog(h.title+" redirected browser: "+stoCaptureSummary(second));
   if(second&&stoPlayerBlocked(second.html))blocked=true;
   else if(second&&second.success!==false)captures.unshift({data:second,base:__awPublic(second.mediaPageURL||second.originalUrl||second.url)?second.mediaPageURL||second.originalUrl||second.url:external});
  }catch(e){__awLog("hoster "+h.title+" second player failed")}
 }
 for(var i=0;i<captures.length;i++){
  var c=captures[i],urls=__awCandidates(c.data,c.base);
  __awLog(h.title+": "+urls.length+" candidate URLs");
  for(var j=0;j<Math.min(urls.length,4);j++){
   var verified=await __awVerify(urls[j],c.base);
   if(verified)return __shiroxDecorate({title:h.title,streamUrl:verified.streamUrl,headers:verified.headers},h,c.data.html,c.base);
  }
 }
 return blocked?{blockedReason:"website_verification_required"}:null;
}

function stoPlayerBlocked(html){
  // Return no stream when the site requires an interactive human verification.
  // Shirox's fetch bridge detects Cloudflare and exposes its user-initiated UI.
  // Avoid loading redirected player URLs while the initial page is challenged.
  return stoIsSecurityPage(html)||/(?:cf-mitigated|__cf_chl_|challenges\.cloudflare\.com)/i.test(String(html||""));
}
// Resolve independent mirrors together: a slow/challenged first hoster must
// not consume the whole Unified resolver deadline before other mirrors run.
// Native captures are bounded too; no failed mirror is retried in this load.
function stoResolveHosters(hosters, episode, budgetMs, graceMs) {
  budgetMs = budgetMs || 22000;
  graceMs = graceMs || 1500;
  return new Promise(function(resolve) {
    var streams = [], seen = {}, pending = Math.min(hosters.length, 4), done = false, grace;
    var deadline = setTimeout(finish, budgetMs);
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      if (grace) clearTimeout(grace);
      resolve(streams);
    }
    if (!pending) { finish(); return; }
    hosters.slice(0, 4).forEach(function(hoster) {
      Promise.resolve().then(function() { return stoCapture(hoster, episode); })
        .then(function(found) {
          if (done || !found) return;
          if (found.blockedReason) streams.blockedReason = found.blockedReason;
          if (!found.streamUrl || seen[found.streamUrl]) return;
          seen[found.streamUrl] = true;
          streams.push(found);
          if (streams.length >= 2) finish();
          else if (!grace) grace = setTimeout(finish, graceMs);
        }, function() { __awLog("Hoster " + hoster.title + " unavailable"); })
        .then(function() { if (--pending === 0) finish(); });
    });
  });
}
async function extractStreamUrl(url,options){
  stoVerificationRequired=false;
  try{
    var episode=stoCanon(url);
    var html=await __requestText(episode,{headers:{Accept:"text/html,application/xhtml+xml",Referer:BASE_URL+"/"}});
    if(!html){__awLog("Episode page empty or unavailable");return JSON.stringify({streams:[],subtitles:[]})}
    if(stoPlayerBlocked(html)){
      stoVerificationRequired=true;
      __awLog("Episode page requires website verification; stop instead of fetching hosters");
      return JSON.stringify({streams:[],subtitles:[],blockedReason:"website_verification_required"});
    }
    var hosters=stoHosters(html);
    __awLog("German hosters: "+hosters.length);
    // A source-session proof must finish before another mirror starts a new
    // challenge in the shared browser cookie store. Hoster media is still
    // preflight-verified; return the first working stream immediately.
    var streams=await __shiroxResolveLanguage(hosters,function(h){return stoSearchWithin(stoCapture(h,episode),15000,null)},
      Object.assign({},options||{},{sequentialCaptures:true,firstVerifiedOnly:true}));
    if(streams.length)return JSON.stringify({streams:streams,subtitles:[]});
  }catch(e){__awLog("Stream load failed: "+String(e).slice(0,145))}
  return JSON.stringify({streams:[],subtitles:[],blockedReason:(streams&&streams.blockedReason)||(stoVerificationRequired?"website_verification_required":undefined)});
}

return {searchResults:searchResults,extractDetails:extractDetails,extractEpisodes:extractEpisodes,extractStreamUrl:extractStreamUrl};
})();


// Official, freely published German South Park episodes. Uses the site's
// own catalogue and stitched HLS; does not strip ads or bypass geo/DRM rules.
var __UNIFIED_SOUTHPARK=(function(){
 var BASE="https://www.southpark.de",ROOT=BASE+"/seasons/south-park",cachedPage=null;
 async function read(url){
  if(!/^https:\/\/(?:www\.southpark\.de|topaz\.paramount\.tech|ns-stream\.paramount\.tech)(?:\/|$)/i.test(url))return "";
  var response=await __unifiedWithin(fetchv2(url,{Accept:"text/html,application/json,application/vnd.apple.mpegurl","Accept-Language":"de-DE,de;q=0.9"},"GET",null),5000,null,"South Park public request");
  if(!response||response.status&&Number(response.status)!==200)return "";
  return typeof response.text==="function"?await response.text():String(response);
 }
 function data(html){
  var text=String(html||""),m=/window\.__DATA__\s*=\s*/.exec(text);if(!m)return null;
  var start=m.index+m[0].length,quoted=false,escaped=false,depth=0;
  for(var i=start;i<Math.min(text.length,start+2000000);i++){
   var c=text.charAt(i);
   if(quoted){if(escaped)escaped=false;else if(c==="\\")escaped=true;else if(c==='"')quoted=false}
   else if(c==='"')quoted=true;else if(c==="{"||c==="[")depth++;else if(c==="}"||c==="]"){depth--;if(depth===0){try{return JSON.parse(text.slice(start,i+1))}catch(e){return null}}}
  }
  return null;
 }
 function visit(value,fn){if(!value||typeof value!=="object")return;fn(value);Object.keys(value).forEach(function(k){if(value[k]&&typeof value[k]==="object")visit(value[k],fn)})}
 function meta(html,key){var tags=String(html||"").match(/<meta\b[^>]*>/gi)||[];for(var i=0;i<tags.length;i++)if(__shiroxAttr(tags[i],"property")===key)return __shiroxAttr(tags[i],"content").replace(/&amp;/g,"&");return ""}
 async function page(){if(!cachedPage)cachedPage=read(ROOT);return cachedPage}
 async function search(keyword){
  if(!/^south\s*park$/i.test(String(keyword||"").trim()))return "[]";
  var html=await page();
  if(!/\/folgen\/[^/]+\/south-park-[^"'<>]+-staffel-\d+-ep-\d+/i.test(html))return "[]";
  return JSON.stringify([{title:"South Park",href:ROOT,image:meta(html,"og:image")}]);
 }
 async function details(){var html=await page();return JSON.stringify([{description:meta(html,"og:description"),image:meta(html,"og:image"),aliases:"South Park"}])}
 function seasonPaths(html){
  var paths={1:ROOT},d=data(html);
  visit(d,function(x){var m=String(x.url||"").match(/^\/seasons\/south-park\/[a-z0-9]+\/staffel-(\d+)$/i);if(m)paths[Number(m[1])]=BASE+x.url});
  return paths;
 }
 function collect(d,rows,seen){
  visit(d,function(x){
   if(x.itemType!=="episode")return;
   var path=String(x.url||""),m=path.match(/^\/folgen\/[a-z0-9]+\/south-park-[a-z0-9-]+-staffel-(\d+)-ep-(\d+)$/i);
   if(!m||seen[path])return;seen[path]=true;
   rows.push({season:Number(m[1]),local:Number(m[2]),href:BASE+path});
  });
 }
 async function seasonPage(url){
  var html=url===ROOT?await page():await read(url),d=data(html),rows=[],seen={},more="";
  collect(d,rows,seen);
  visit(d,function(x){if(x.isEpisodes&&x.loadMore)more=String(x.loadMore.url||"")});
  // Follow only the actual public pagination link and its published page size.
  var pagination=more.match(/^(\/api\/context\/mgid%3Aarc%3Aseason%3Asouthpark\.intl%3A[a-f0-9-]+\/episode\/)(\d+)(\/10)$/i);
  if(pagination)for(var pageNumber=Number(pagination[2]);pageNumber<10;pageNumber++){
   var extra;try{extra=JSON.parse(await read(BASE+pagination[1]+pageNumber+pagination[3]))}catch(e){break}
   var count=rows.length;collect(extra,rows,seen);if(rows.length-count<10)break;
  }
  return rows;
 }
 async function episodes(){
  var paths=seasonPaths(await page()),numbers=Object.keys(paths).map(Number).sort(function(a,b){return a-b}),rows=[];
  // Four bounded requests at a time; one missing season cannot hide the others.
  for(var i=0;i<numbers.length;i+=4){
   var batch=await Promise.all(numbers.slice(i,i+4).map(function(n){return seasonPage(paths[n]).catch(function(){return []})}));
   batch.forEach(function(group){rows=rows.concat(group)});
  }
  rows.sort(function(a,b){return a.season-b.season||a.local-b.local});
  return JSON.stringify(rows.map(function(row,i){return {number:i+1,href:row.href}}));
 }
 async function streams(url,options){
  var empty=JSON.stringify({streams:[],subtitles:[]});
  if(options&&Number(options.languagePriority)>0)return empty;
  if(!/^https:\/\/www\.southpark\.de\/folgen\/[a-z0-9]+\/south-park-[a-z0-9-]+-staffel-\d+-ep-\d+$/i.test(url))return empty;
  var d=data(await read(url)),service="";
  visit(d,function(x){if(typeof x.videoServiceUrl==="string"&&!service)service=x.videoServiceUrl});
  if(!/^https:\/\/topaz\.paramount\.tech\/topaz\/api\/mgid:arc:episode:shared\.southpark\.gsa\.de:[a-f0-9-]+\/mica\.json\?/i.test(service))return empty;
  service=service.replace(/\{clientPlatform\}/g,"desktop").replace(/\{[^}]+\}/g,"");
  var response;try{response=JSON.parse(await read(service))}catch(e){return empty}
  if(response.error||!response.stitchedstream||response.stitchedstream.manifesttype!=="hls")return empty;
  var expected=(service.match(/\/api\/(mgid:[^/]+)\//)||[])[1];
  if(!(response.content||[]).some(function(item){return item.id===expected}))return empty;
  var media=response.stitchedstream.source;
  if(!/^https:\/\/ns-stream\.paramount\.tech\//i.test(media))return empty;
  var manifest=await read(media);
  if(!/^#EXTM3U/.test(manifest)||!/#EXT-X-MEDIA:[^\n]*TYPE=AUDIO[^\n]*LANGUAGE="de"/i.test(manifest)||/METHOD=SAMPLE-AES/i.test(manifest))return empty;
  return JSON.stringify({streams:[{title:"South Park offiziell · Deutsch",streamUrl:media,audioLanguage:"de",headers:{Referer:url}}],subtitles:[]});
 }
 return {searchResults:search,extractDetails:details,extractEpisodes:episodes,extractStreamUrl:streams,parseData:data};
})();

var __UNIFIED_SOURCES=[
  {id:"aniworld",base:"https://aniworld.to",api:__UNIFIED_ANIWORLD},
  {id:"serienstream",base:"https://serienstream.to",api:__UNIFIED_SERIENSTREAM},
  {id:"southpark",base:"https://www.southpark.de",api:__UNIFIED_SOUTHPARK}
];

function __unifiedCatalogRows(html,kind){
  var source=kind==="anime"?__UNIFIED_SOURCES[0]:__UNIFIED_SOURCES[1],out=[],seen={};
  var text=String(html||""),regex=/<a\b[^>]*>[\s\S]*?<\/a>/gi,found;
  function clean(value){return String(value||"").replace(/<[^>]*>/g," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g," ").trim()}
  function pictureFrom(markup){
    var image=(markup.match(/<img\b[^>]*>/i)||[""])[0];
    var value=__shiroxAttr(image,"data-src")||__shiroxAttr(image,"data-lazy-src")||__shiroxAttr(image,"src");
    if(!value||/^data:/i.test(value))value=(__shiroxAttr(image,"data-srcset")||__shiroxAttr(image,"srcset")).trim().split(/[,\s]+/)[0];
    if(!value||/^data:/i.test(value)){
      var tags=markup.match(/<source\b[^>]*>/gi)||[];
      for(var i=0;i<tags.length&&!value;i++)value=(__shiroxAttr(tags[i],"data-srcset")||__shiroxAttr(tags[i],"srcset")).trim().split(/[,\s]+/)[0];
    }
    return !value||/^data:|^javascript:/i.test(value)?"":__unifiedAbsolute(source,value.replace(/&amp;/g,"&"));
  }
  while((found=regex.exec(text))!==null){
    var link=found[0],tag=(link.match(/^<a\b[^>]*>/i)||[""])[0],href=__unifiedAbsolute(source,__shiroxAttr(tag,"href"));
    var match=href.match(kind==="anime"?/^https:\/\/(?:www\.)?aniworld\.(?:to|cc)(\/anime\/stream\/[^/?#]+)/i:/^https:\/\/(?:www\.)?(?:serienstream\.(?:to|cx)|s\.to)(\/serie\/(?:stream\/)?[^/?#]+)/i);
    if(!match||/\/episode-\d+/i.test(href))continue;
    href=source.base+match[1];
    var heading=(link.match(/<(?:h3|h2|strong)\b[^>]*>([\s\S]*?)<\/(?:h3|h2|strong)>/i)||[])[1];
    var image=(link.match(/<img\b[^>]*>/i)||[""])[0];
    var title=clean(heading||__shiroxAttr(tag,"title")||__shiroxAttr(image,"alt")||link.replace(/^<a\b[^>]*>|<\/a>$/gi,""));
    var picture=pictureFrom(link),backdrop="",description="";
    // Current SerienStream hero pictures are siblings before the overlay link.
    // Scope them to this slide; never borrow the previous title's artwork.
    if(/home-hero-overlay/.test(tag)){
      var before=text.slice(Math.max(0,found.index-14000),found.index),start=before.lastIndexOf('class="home-hero-slide"');
      if(start>=0&&before.slice(start).indexOf("home-hero-overlay")<0){backdrop=pictureFrom(before.slice(start));if(!picture)picture=backdrop}
      description=clean((link.match(/<(?:p|div)\b[^>]*class=["'][^"']*home-hero-(?:description|desc)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div)>/i)||[])[1]);
    }
    if(!title||title.length>180)continue;
    var row={title:title,href:href,image:picture,backdrop:backdrop,description:description},index=seen[href];
    if(index!==undefined){
      // Navigation/hero links without a poster must not suppress later cards.
      var previous=out[index];
      if(picture&&(!previous.image||previous.image===previous.backdrop))previous.image=picture;
      if(backdrop)previous.backdrop=backdrop;
      if(description)previous.description=description;
    }else{seen[href]=out.length;out.push(row)}
  }
  return out.slice(0,100);
}
function __unifiedSourceFailure(error,html) {
  var text=String(html||"")+" "+String(error||"");
  return /cf-turnstile|cf-challenge|__cf_chl_|challenges\.cloudflare\.com|cf-mitigated|<title[^>]*>\s*just a moment|checking your browser|verify you are human|Bestätigung im Browser|website_verification_required/i.test(text)
    ? {items:[],blockedReason:"website_verification_required"}
    : {items:[],errorCode:"source_unavailable"};
}
async function extractCatalog(options){
  var kind=options&&options.kind;if(kind!=="anime"&&kind!=="series")return "[]";
  var source=kind==="anime"?__UNIFIED_SOURCES[0]:__UNIFIED_SOURCES[1],html="",problem=null,rows=[];
  try {
    var response=await __unifiedWithin(__shiroxSourceRequest(source.base+"/",{Accept:"text/html"},"GET",null),4000,null,"catalog HTTP");
    if(response) {
      html=typeof response.text==="function"?await response.text():String(response);
      if(!response.status||response.status===200)rows=__unifiedCatalogRows(html,kind);
      if(response.status&&response.status!==200)problem="HTTP "+response.status;
    } else problem="source timeout";
  } catch(e){problem=e}
  // HTTP failures must still reach the normal browser fallback.
  if(!rows.length&&typeof networkFetch==="function"){
    try {
      var page=await networkFetch(__shiroxSourceURL(source.base+"/"),{timeoutSeconds:8,returnHTML:true,returnCookies:false,
        waitForSelectors:[kind==="anime"?"a[href*='/anime/stream/']":"a[href*='/serie/']"],maxWaitTime:2});
      if(page){html+="\n"+String(page.html||"");if(page.success!==false)rows=__unifiedCatalogRows(page.html,kind)}
    } catch(e){problem=e}
  }
  if(kind==="series"){
    try{var official=JSON.parse(await __unifiedWithin(__UNIFIED_SOUTHPARK.searchResults("South Park"),6000,"[]","official catalogue"));rows=rows.concat(official)}catch(e){}
  }
  return JSON.stringify(rows.length?rows:__unifiedSourceFailure(problem,html));
}
/* All source requests are bounded. A blocked / unresponsive S.to response must
 * not prevent AniWorld results from rendering in the app. Timers are provided
 * by Shirox's native JSContext bridge, not by a remote service. */
var __UNIFIED_SEARCH_TIMEOUT_MS = 16000;
var __UNIFIED_EPISODES_TIMEOUT_MS = 22000;
var __UNIFIED_STREAMS_TIMEOUT_MS = 32000;
function __unifiedWithin(promise, timeoutMs, fallback, operation) {
  return new Promise(function(resolve) {
    var settled = false;
    var timer = setTimeout(function() {
      if (settled) return;
      settled = true;
      if (typeof console !== "undefined") console.warn("[Unified GER] " + operation + " timed out");
      resolve(fallback);
    }, timeoutMs);
    Promise.resolve(promise).then(function(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, function(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (typeof console !== "undefined") console.warn("[Unified GER] " + operation + ": " + String(error));
      resolve(fallback);
    });
  });
}
function __unifiedProvider(url){
  if(/^https:\/\/www\.southpark\.de\/(?:seasons\/south-park(?:\/|$)|folgen\/)/i.test(String(url||"")))return __UNIFIED_SOURCES[2];
  var value=String(url||"").toLowerCase();
  if(/^https?:\/\/(?:www\.)?aniworld\.(?:to|cc)(?:\/|$)/.test(value))return __UNIFIED_SOURCES[0];
  if(/^https?:\/\/(?:www\.)?(?:serienstream\.(?:to|cx)|s\.to)(?:\/|$)/.test(value))return __UNIFIED_SOURCES[1];
  return null;
}
function __unifiedJSON(value,fallback){
  if(typeof value==="string")return value;
  try{return JSON.stringify(value==null?fallback:value)}catch(e){return JSON.stringify(fallback)}
}
function __unifiedAbsolute(source,href){
  var h=String(href||"").trim();
  if(/^https?:\/\//i.test(h))return h;
  if(h.slice(0,2)==="//")return "https:"+h;
  if(h.charAt(0)==="/")return source.base+h;
  return source.base+"/"+h.replace(/^\/+/, "");
}
// Validated direct-title lookup for AniWorld: its public series page can be
// available while the AJAX search endpoint fails. Do not invent a search hit:
// validate the page's actual title and season navigation.
function __unifiedExactTitle(value){
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&amp;/gi,"&")
    .replace(/\s+/g," ").trim().toLowerCase();
}
async function __unifiedDirectAniWorld(keyword){
  var base=String(keyword || "").trim()
    .replace(/\s+(?:season|staffel)\s*\d{1,2}\s*$/i,"")
    .replace(/\s+s\d{1,2}\s*$/i,"").trim();
  if(base.length<3)return [];
  var slug=base.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"");
  if(slug.length<3)return [];
  var url="https://aniworld.to/anime/stream/"+slug;
  try{
    var response=await fetchv2(url,{"Accept":"text/html","Referer":"https://aniworld.to/"}, "GET", null);
    if(!response || (typeof response.status==="number" && response.status!==200))return [];
    var html=typeof response.text==="function"?await response.text():"";
    if(!/<h1\b/i.test(html)||!/\/staffel-\d+/i.test(html))return [];
    var heading=(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||"";
    var title=heading.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
    if(__unifiedExactTitle(title)!==__unifiedExactTitle(base))return [];
    return [{title:title,image:"",href:url}];
  }catch(e){
    if(typeof console!=="undefined")console.warn("[Unified GER] validated AniWorld lookup: "+String(e));
    return [];
  }
}
async function searchResults(keyword,options){
  // Run the verified public-page lookup alongside the two site APIs, not
  // after them. A blocked S.to request can now be safely timed out.
  var direct=__unifiedWithin(
    options&&options.kind!=="anime"?Promise.resolve([]):__unifiedDirectAniWorld(keyword), __UNIFIED_SEARCH_TIMEOUT_MS,
    [], "aniworld direct lookup"
  );
  var selectedSources=__UNIFIED_SOURCES.filter(function(source){return !options||!options.kind||(options.kind==="anime"?source.id==="aniworld":source.id!=="aniworld")});
  var sourceFailures=[];
  var batch=await Promise.all(selectedSources.map(async function(source){
    try{
      var raw=await __unifiedWithin(
        Promise.resolve().then(function(){return source.api.searchResults(keyword)}).catch(function(error){sourceFailures.push(__unifiedSourceFailure(error));return "[]"}), __UNIFIED_SEARCH_TIMEOUT_MS,
        "[]", source.id + " search"
      );
      var rows=typeof raw==="string"?JSON.parse(raw):raw;
      return Array.isArray(rows)?rows.map(function(row){
        var href=__unifiedAbsolute(source,row&&row.href);
        if(!row||!row.title||!row.href||!__unifiedProvider(href))return null;
        return {title:String(row.title),image:String(row.image||""),href:href};
      }).filter(Boolean):[];
    }catch(e){
      if(typeof console!=="undefined")console.warn("[Unified GER] "+source.id+" search: "+String(e));
      return [];
    }
  }));
  var directResults=await direct;
  if(Array.isArray(directResults)&&directResults.length)batch.unshift(directResults);
  var seen={},results=[];
  for(var i=0;i<batch.length;i++)for(var j=0;j<batch[i].length;j++){
    var row=batch[i][j],key=row.href.toLowerCase();
    if(seen[key])continue;
    seen[key]=true;results.push(row);
  }
  if(!results.length&&sourceFailures.length)return JSON.stringify(sourceFailures.filter(function(x){return x.blockedReason})[0]||sourceFailures[0]);
  return JSON.stringify(results.slice(0,60));
}
async function extractDetails(url){
  var source=__unifiedProvider(url);
  if(!source)return JSON.stringify({});
  try{return __unifiedJSON(await source.api.extractDetails(url),{})}
  catch(e){return JSON.stringify({})}
}
async function extractEpisodes(url,options){
  var source=__unifiedProvider(url);
  if(!source)return "[]";
  try{return __unifiedJSON(await __unifiedWithin(
    source.api.extractEpisodes(url,options), __UNIFIED_EPISODES_TIMEOUT_MS,
    "[]", source.id + " episodes"
  ),[])}
  catch(e){if(typeof console!=="undefined")console.warn("[Unified GER] episodes: "+String(e));return "[]"}
}
async function extractStreamUrl(url,options){
  var source=__unifiedProvider(url);
  if(!source)return JSON.stringify({streams:[],subtitles:[]});
  try{
    var value=await __unifiedWithin(
      source.api.extractStreamUrl(url,options), __UNIFIED_STREAMS_TIMEOUT_MS,
      JSON.stringify({streams:[],subtitles:[]}), source.id + " streams"
    );
    var data=typeof value==="string"?JSON.parse(value):value;
    if(!data||!Array.isArray(data.streams))return JSON.stringify({streams:[],subtitles:[]});
    var seen={},streams=[];
    for(var i=0;i<data.streams.length;i++){
      var stream=data.streams[i],link=stream&&(stream.streamUrl||stream.url);
      if(!link||!/^https?:\/\//i.test(link)||seen[link])continue;
      seen[link]=true;streams.push(stream);
    }
    return JSON.stringify({
      streams:streams,
      subtitles:data.subtitles||[],
      blockedReason:data.blockedReason==="website_verification_required"
        ?"website_verification_required":undefined
    });
  }catch(e){
    if(typeof console!=="undefined")console.warn("[Unified GER] streams: "+String(e));
    return JSON.stringify({streams:[],subtitles:[]});
  }
}
