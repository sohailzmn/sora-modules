const BASE_URL = "https://aniworld.to";
// v3.4.0: standalone, no runtime script downloader.

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
      console.log("[AniWorld v3.4.0] request failed:", url, e2);
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

    console.log("[AniWorld v3.4.0] search results:", results.length);
    return JSON.stringify(results);
  } catch (error) {
    console.log("[AniWorld v3.4.0] search error:", error);
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

async function extractEpisodes(url) {
  try {
    var initialHtml = await __requestText(url, {
      headers: { "Accept": "text/html,application/xhtml+xml", "Referer": BASE_URL + "/" }
    });
    if (!initialHtml) return JSON.stringify([]);

    var seasonUrls = [];
    var seasonRegex = /href=["']([^"']*\/staffel-(\d+)\/?[^"']*)["']/gi;
    var match;

    while ((match = seasonRegex.exec(initialHtml)) !== null) {
      var seasonHref = match[1].replace(/\/episode-\d+.*$/i, "");
      seasonUrls.push(__absolute(seasonHref));
    }

    if (seasonUrls.length === 0 && /\/staffel-\d+\/?$/i.test(url)) seasonUrls.push(url);
    seasonUrls = __unique(seasonUrls);
    seasonUrls.sort(function(a, b) { return __seasonNumber(a) - __seasonNumber(b); });

    var episodes = [];
    var seen = {};

    for (var i = 0; i < seasonUrls.length; i++) {
      var seasonUrl = seasonUrls[i];
      var html = seasonUrl === url ? initialHtml : await __requestText(seasonUrl, {
        headers: { "Accept": "text/html,application/xhtml+xml", "Referer": url }
      });
      if (!html) continue;

      var episodeRegex = /href=["']([^"']*\/staffel-\d+\/episode-(\d+)[^"']*)["']/gi;
      var epMatch;
      var seasonEpisodes = [];

      while ((epMatch = episodeRegex.exec(html)) !== null) {
        var href = __absolute(epMatch[1]);
        var number = parseInt(epMatch[2], 10);
        if (!number || seen[href]) continue;
        seen[href] = true;
        seasonEpisodes.push({ href: href, number: number });
      }

      seasonEpisodes.sort(function(a, b) { return a.number - b.number; });
      for (var j = 0; j < seasonEpisodes.length; j++) episodes.push(seasonEpisodes[j]);
    }

    console.log("[AniWorld v3.4.0] episodes:", episodes.length, "seasons:", seasonUrls.length);
    return JSON.stringify(episodes);
  } catch (error) {
    console.log("[AniWorld v3.4.0] episodes error:", error);
    return JSON.stringify([]);
  }
}


// v3.4.0: The episode exists but the old fetch-only resolver often sees no media
// in hoster pages. Shirox networkFetch observes real browser/player requests.
function __awLog(message) {
  if (typeof console !== "undefined" && typeof console.warn === "function") console.warn("[AniWorld v3.4.0] " + message);
  else if (typeof console !== "undefined" && typeof console.log === "function") console.log("[AniWorld v3.4.0] " + message);
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
    if (!/(deutsch|german|ger dub)/i.test(language) || /(untertitel|sub)/i.test(language)) continue;
    var link = (li.match(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/i) || [])[1];
    var url = __awAbsolute(link, BASE_URL + "/");
    if (!url || !/^https:\/\/aniworld\.to\/redirect\//i.test(url) || seen[url]) continue;
    seen[url] = true;
    var hoster = (li.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i) || [])[1] || "Video";
    hoster = hoster.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    out.push({ url: url, title: hoster });
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
    if (!url || !__awPublic(url) || !__awMediaKind(url) || /doubleclick|googlesyndication|\/preroll\//i.test(url) || seen[url]) continue;
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
  var variants=__awParseVariants(verified.playlist,verified.url);
  if(!variants.length)return[main];
  variants.sort(function(a,b){return a.height-b.height||a.bandwidth-b.bandwidth});
  var preferred=variants.filter(function(x){return x.height<=480});
  var fast=preferred.length?preferred[preferred.length-1]:variants[0];
  var hd=variants.filter(function(x){return x.height<=720&&x.height>fast.height});
  hd=hd.length?hd[hd.length-1]:null;
  var list=[],choices=[fast];
  if(hd && hd.url!==fast.url)choices.push(hd);
  for(var i=0;i<choices.length;i++){
    var variant=await __awVerify(choices[i].url,page);
    if(!variant)continue;
    list.push({title:String(choices[i].height)+"p · "+providerName+(i===0?" (Schnell)":""),streamUrl:variant.url,headers:variant.headers});
  }
  if(list.length)list.push(main); // Explicit adaptive fallback if fixed renditions buffer.
  else list=[main]; // Do not return dead or unverified variants.
  __awLog("Selected video options: "+list.map(function(x){return x.title}).join(", "));
  return list;
}


async function __awCapture(provider) {
  if(typeof networkFetch!=="function")return null;
  var result=await networkFetch(provider.url,{
    timeoutSeconds:10,returnHTML:true,returnCookies:false,
    headers:{Referer:BASE_URL+"/"},waitForSelectors:["video","source"],
    clickSelectors:[".vjs-big-play-button",".jw-icon-display","button[aria-label='Play']",".art-icon-play[aria-label='Play']"],
    maxWaitTime:3
  });
  if(!result||result.success===false){__awLog(provider.title+" web player failed");return null}
  var requests=Array.isArray(result.requests)?result.requests:[],page=provider.url;
  for(var j=0;j<requests.length;j++){
    var link=typeof requests[j]==="string"?requests[j]:requests[j]&&(requests[j].url||requests[j].requestUrl);
    if(link&&__awPublic(link)&&!/^https:\/\/aniworld\.to\//i.test(link)&&
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
    if(checked)return await __awQualityOptions(checked,page,provider.title);
  }
  return null;
}


async function extractStreamUrl(url){
  try{
    var html=await __requestText(url,{headers:{Accept:"text/html,application/xhtml+xml",Referer:BASE_URL+"/"}});
    if(!html){__awLog("episode page is empty");return JSON.stringify({streams:[],subtitles:[]})}
    var hosters=__awHosters(html);
    __awLog("German hosters: "+hosters.map(function(x){return x.title}).join(", "));
    if(typeof networkFetch!=="function")__awLog("browser fetch is unavailable");
    for(var i=0;i<Math.min(3,hosters.length);i++){
      try{
        var result=await __awCapture(hosters[i]);
        if(result&&result.length)return JSON.stringify({streams:result,subtitles:[]});
      }catch(e){__awLog(hosters[i].title+" failed: "+String(e).slice(0,120))}
    }
    __awLog("No working stream from checked German hosters");
  }catch(e){__awLog("stream lookup failed: "+String(e).slice(0,140))}
  return JSON.stringify({streams:[],subtitles:[]});
}
