const BASE_URL = "https://aniworld.to";
const BASE_SCRIPT_URL = "https://raw.githubusercontent.com/sohailzmn/sora-modules/main/AniWorldGerDub_v32.js";

var __baseLoaded = false;
var __baseDetails = null;
var __baseStream = null;

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

async function __ensureBase() {
  if (__baseLoaded) return true;

  var source = await __requestText(BASE_SCRIPT_URL, { headers: { "Accept": "text/plain" } });
  if (!source) {
    console.log("[AniWorld v3.3.2] original resolver script could not be loaded");
    return false;
  }

  try {
    source = source
      .replace(/async\s+function\s+searchResults\s*\(/, "async function __legacy_searchResults(")
      .replace(/async\s+function\s+extractDetails\s*\(/, "async function __legacy_extractDetails(")
      .replace(/async\s+function\s+extractEpisodes\s*\(/, "async function __legacy_extractEpisodes(")
      .replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __legacy_extractStreamUrl(");

    eval(source);

    if (typeof __legacy_extractDetails === "function") __baseDetails = __legacy_extractDetails;
    if (typeof __legacy_extractStreamUrl === "function") __baseStream = __legacy_extractStreamUrl;

    __baseLoaded = !!(__baseDetails && __baseStream);
    return __baseLoaded;
  } catch (error) {
    console.log("[AniWorld v3.3.2] legacy resolver eval failed:", error);
    return false;
  }
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

    console.log("[AniWorld v3.3.2] search results:", results.length);
    return JSON.stringify(results);
  } catch (error) {
    console.log("[AniWorld v3.3.2] search error:", error);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    if (await __ensureBase()) return await __baseDetails(url);
  } catch (error) {
    console.log("[AniWorld v3.3.2] details error:", error);
  }
  return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
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

    console.log("[AniWorld v3.3.2] episodes:", episodes.length, "seasons:", seasonUrls.length);
    return JSON.stringify(episodes);
  } catch (error) {
    console.log("[AniWorld v3.3.2] episodes error:", error);
    return JSON.stringify([]);
  }
}


// v3.3.4: The episode exists but the old fetch-only resolver often sees no media
// in hoster pages. Shirox networkFetch observes real browser/player requests.
function __awLog(message) {
  if (typeof console !== "undefined" && typeof console.warn === "function") console.warn("[AniWorld v3.3.4] " + message);
  else if (typeof console !== "undefined" && typeof console.log === "function") console.log("[AniWorld v3.3.4] " + message);
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
async function __awCapture(provider) {
  if (typeof networkFetch !== "function") return null;
  // The module only navigates an AniWorld link that was listed for German audio.
  var result = await networkFetch(provider.url, {
    timeoutSeconds: 14, returnHTML: true, returnCookies: false,
    headers: { Referer: BASE_URL + "/" },
    waitForSelectors: ["video", "source"],
    clickSelectors: [".vjs-big-play-button", ".jw-icon-display", "button[aria-label='Play']", ".art-icon-play[aria-label='Play']"],
    maxWaitTime: 4
  });
  if (!result || result.success === false) {
    __awLog("Web player failed: " + provider.title);
    return null;
  }
  // Shirox's networkFetch returns the ORIGINAL URL, not the final redirected URL.
  // Infer the video host from captured navigation requests for correct media Referer.
  var requests = Array.isArray(result.requests) ? result.requests : [];
  var page = provider.url;
  for (var p = 0; p < requests.length; p++) {
    var seen = typeof requests[p] === "string" ? requests[p] : requests[p] && (requests[p].url || requests[p].requestUrl);
    if (seen && __awPublic(seen) && !/^https:\/\/aniworld\.to\//i.test(seen) &&
        /(voe|vidmoly|filemoon|loadx|luluvdo)/i.test(__awOrigin(seen)) && !__awMediaKind(seen)) {
      page = seen;
      break;
    }
  }
  var urls = __awCandidates(result, page);
  __awLog(provider.title + " player yielded " + urls.length + " media URL candidates");
  for (var i = 0; i < Math.min(urls.length, 4); i++) {
    var verified = await __awVerify(urls[i], page);
    if (verified) { verified.title = provider.title + " · GER DUB"; return verified; }
  }
  return null;
}
async function extractStreamUrl(url) {
  var fallback = null;
  try {
    var page = await __requestText(url, {
      headers: { Accept: "text/html,application/xhtml+xml", Referer: BASE_URL + "/" }
    });
    if (page) {
      var providers = __awHosters(page);
      __awLog("German hosters: " + providers.map(function(x) { return x.title; }).join(", "));
      if (typeof networkFetch === "function") {
        for (var i = 0; i < Math.min(providers.length, 4); i++) {
          try {
            var stream = await __awCapture(providers[i]);
            if (stream) return JSON.stringify({ streams: [stream], subtitles: [] });
          } catch (error) { __awLog("Hoster " + providers[i].title + " failed: " + String(error).slice(0, 130)); }
        }
      } else __awLog("No browser capture bridge; trying legacy direct-media lookup.");
    } else __awLog("Episode page returned no usable HTML");
    if (await __ensureBase()) {
      fallback = await __baseStream(url);
      if (fallback) {
        try {
          var parsed = typeof fallback === "string" ? JSON.parse(fallback) : fallback;
          if (parsed && Array.isArray(parsed.streams) && parsed.streams.length > 0) return typeof fallback === "string" ? fallback : JSON.stringify(fallback);
        } catch (error) { __awLog("Legacy stream response invalid"); }
      }
    }
  } catch (error) { __awLog("Stream lookup failed: " + String(error).slice(0, 150)); }
  __awLog("No playable German stream captured for this episode");
  // Keep module operation nonfatal for Sora's older runtime.
  return JSON.stringify({ streams: [], subtitles: [] });
}
