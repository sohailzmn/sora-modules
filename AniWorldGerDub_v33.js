const BASE_URL = "https://aniworld.to";
const BASE_SCRIPT_URL = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/AniWorldGerDub_v32.js";

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
      console.log("[AniWorld v3.3] request failed:", url, e2);
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
    console.log("[AniWorld v3.3] base script could not be loaded");
    return false;
  }

  try {
    source = source
      .replace(/async\s+function\s+searchResults\s*\(/, "async function __v32_searchResults(")
      .replace(/async\s+function\s+extractDetails\s*\(/, "async function __v32_extractDetails(")
      .replace(/async\s+function\s+extractEpisodes\s*\(/, "async function __v32_extractEpisodes(")
      .replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v32_extractStreamUrl(");

    eval(source);

    if (typeof __v32_extractDetails === "function") __baseDetails = __v32_extractDetails;
    if (typeof __v32_extractStreamUrl === "function") __baseStream = __v32_extractStreamUrl;

    __baseLoaded = !!(__baseDetails && __baseStream);
    return __baseLoaded;
  } catch (error) {
    console.log("[AniWorld v3.3] base eval failed:", error);
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

    console.log("[AniWorld v3.3] search results:", results.length);
    return JSON.stringify(results);
  } catch (error) {
    console.log("[AniWorld v3.3] search error:", error);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    if (await __ensureBase()) return await __baseDetails(url);
  } catch (error) {
    console.log("[AniWorld v3.3] details error:", error);
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

    console.log("[AniWorld v3.3] episodes:", episodes.length, "seasons:", seasonUrls.length);
    return JSON.stringify(episodes);
  } catch (error) {
    console.log("[AniWorld v3.3] episodes error:", error);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  try {
    if (await __ensureBase()) return await __baseStream(url);
  } catch (error) {
    console.log("[AniWorld v3.3] stream error:", error);
  }
  return JSON.stringify({ streams: [], subtitles: [] });
}
