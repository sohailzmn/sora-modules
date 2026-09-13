const V5_SCRIPT_URL = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v5.js";
const SERIENSTREAM_BASE = "https://serienstream.to";

var __v6Loaded = false;
var __v6Loading = null;
var __v6 = {
  search: null,
  details: null,
  episodes: null,
  ensureBase: null,
  extractHosters: null,
  providerKey: null,
  multi: null,
  legacyStream: null
};

async function __v6Text(url, headers, followRedirects) {
  try {
    var response = await fetchv2(
      url,
      headers || {},
      "GET",
      null,
      followRedirects !== false
    );
    if (!response) return "";
    if (typeof response === "string") return response;
    if (typeof response.text === "function") return await response.text();
    return String(response || "");
  } catch (error) {
    try {
      var fallback = await fetch(url, { headers: headers || {} });
      if (typeof fallback === "string") return fallback;
      if (fallback && typeof fallback.text === "function") return await fallback.text();
      return String(fallback || "");
    } catch (error2) {
      console.log("[SerienStream v6] text fetch failed:", url, error2);
      return "";
    }
  }
}

function __v6Header(headers, wanted) {
  if (!headers) return "";
  var lower = String(wanted || "").toLowerCase();

  try {
    if (typeof headers.get === "function") {
      return headers.get(wanted) || headers.get(lower) || "";
    }
  } catch (e) {}

  for (var key in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, key) && String(key).toLowerCase() === lower) {
      return String(headers[key] || "");
    }
  }
  return "";
}

function __v6Absolute(url, base) {
  if (!url) return "";
  url = String(url).trim();
  base = base || SERIENSTREAM_BASE;

  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf("//") === 0) return "https:" + url;

  var originMatch = String(base).match(/^(https?:\/\/[^\/]+)/i);
  var origin = originMatch ? originMatch[1] : SERIENSTREAM_BASE;

  if (url.charAt(0) === "/") return origin + url;

  var cleanBase = String(base).split("#")[0].split("?")[0];
  var slash = cleanBase.lastIndexOf("/");
  var dir = slash > cleanBase.indexOf("://") + 2 ? cleanBase.substring(0, slash + 1) : cleanBase + "/";
  return dir + url;
}

function __v6ExternalUrlFromHtml(html, provider) {
  if (!html) return "";

  var candidates = [];
  var patterns = [
    /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
    /<meta\b[^>]*(?:property|name)=["'](?:og:url|twitter:url)["'][^>]*content=["']([^"']+)["']/i,
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
    /location\.replace\(\s*["']([^"']+)["']\s*\)/i
  ];

  for (var i = 0; i < patterns.length; i++) {
    var m = String(html).match(patterns[i]);
    if (m && m[1]) candidates.push(m[1]);
  }

  var absRegex = /https?:\/\/[^"'<>\s]+/gi;
  var absMatch;
  while ((absMatch = absRegex.exec(String(html))) !== null) {
    candidates.push(absMatch[0].replace(/&amp;/gi, "&"));
  }

  var p = String(provider || "").toLowerCase();
  var hints = [];
  if (p.indexOf("voe") !== -1) hints = ["voe."];
  else if (p.indexOf("vidmoly") !== -1) hints = ["vidmoly."];
  else if (p.indexOf("dood") !== -1) hints = ["dood.", "doodstream.", "doodwatch.", "doodstream.com", "dood.to"];
  else if (p.indexOf("filemoon") !== -1) hints = ["filemoon."];
  else if (p.indexOf("vidoza") !== -1) hints = ["vidoza."];
  else if (p.indexOf("speed") !== -1) hints = ["speedfiles.", "speedvideo."];
  else if (p.indexOf("mp4upload") !== -1) hints = ["mp4upload."];

  for (var c = 0; c < candidates.length; c++) {
    var value = candidates[c];
    if (!/^https?:\/\//i.test(value)) continue;
    if (/serienstream\.to/i.test(value)) continue;

    if (hints.length === 0) return value;
    var lower = value.toLowerCase();
    for (var h = 0; h < hints.length; h++) {
      if (lower.indexOf(hints[h]) !== -1) return value;
    }
  }

  return "";
}

async function __v6ResolveHoster(hoster, episodeUrl) {
  var headers = {
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Referer": episodeUrl || (SERIENSTREAM_BASE + "/"),
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
  };

  // Critical difference to v5: do NOT follow the first redirect. SoraCore's
  // fetchv2 exposes the Location response header, but does not expose finalURL.
  try {
    var first = await fetchv2(hoster.href, headers, "GET", null, false);
    if (first && typeof first !== "string") {
      var status = Number(first.status || 0);
      var location = __v6Header(first.headers, "location");
      if (location && status >= 300 && status < 400) {
        var direct = __v6Absolute(location, hoster.href);
        console.log("[SerienStream v6] redirect:", hoster.provider, direct);
        return direct;
      }

      var firstBody = "";
      try { if (typeof first.text === "function") firstBody = await first.text(); } catch (e1) {}
      var inferredFirst = __v6ExternalUrlFromHtml(firstBody, hoster.provider);
      if (inferredFirst) return inferredFirst;
    }
  } catch (error) {
    console.log("[SerienStream v6] no-follow request failed:", hoster.provider, error);
  }

  // Some endpoints use a normal redirect chain. Follow it, then infer the
  // provider URL from canonical/og:url/window.location if available.
  try {
    var followed = await fetchv2(hoster.href, headers, "GET", null, true);
    if (followed && typeof followed !== "string") {
      var body = "";
      try { if (typeof followed.text === "function") body = await followed.text(); } catch (e2) {}
      var inferred = __v6ExternalUrlFromHtml(body, hoster.provider);
      if (inferred) return inferred;
    } else if (typeof followed === "string") {
      var inferredString = __v6ExternalUrlFromHtml(followed, hoster.provider);
      if (inferredString) return inferredString;
    }
  } catch (error2) {
    console.log("[SerienStream v6] followed request failed:", hoster.provider, error2);
  }

  return "";
}

async function __v6Load() {
  if (__v6Loaded) return true;
  if (__v6Loading) return await __v6Loading;

  __v6Loading = (async function () {
    try {
      var source = await __v6Text(V5_SCRIPT_URL, { "Accept": "text/plain" }, true);
      if (!source) return false;

      source = source.replace(
        /async\s+function\s+extractStreamUrl\s*\(/,
        "async function __v5ExtractStreamUrl("
      );

      source += "\n;__v6.search = (typeof searchResults === 'function') ? searchResults : null;";
      source += "\n;__v6.details = (typeof extractDetails === 'function') ? extractDetails : null;";
      source += "\n;__v6.episodes = (typeof extractEpisodes === 'function') ? extractEpisodes : null;";
      source += "\n;__v6.ensureBase = (typeof __stoEnsureBase === 'function') ? __stoEnsureBase : null;";
      source += "\n;__v6.extractHosters = (typeof __stoExtractHosters === 'function') ? __stoExtractHosters : null;";
      source += "\n;__v6.providerKey = (typeof __stoProviderKey === 'function') ? __stoProviderKey : null;";
      source += "\n;__v6.multi = (typeof __stoExports !== 'undefined' && __stoExports) ? __stoExports.multi : null;";
      source += "\n;__v6.legacyStream = (typeof __v5ExtractStreamUrl === 'function') ? __v5ExtractStreamUrl : null;";

      eval(source);

      if (__v6.ensureBase) await __v6.ensureBase();
      if (!__v6.multi && typeof __stoExports !== "undefined" && __stoExports) {
        __v6.multi = __stoExports.multi;
      }

      __v6Loaded = !!(__v6.search && __v6.details && __v6.episodes && __v6.extractHosters && __v6.multi);
      console.log("[SerienStream v6] loaded:", __v6Loaded);
      return __v6Loaded;
    } catch (error) {
      console.log("[SerienStream v6] load failed:", error);
      return false;
    } finally {
      __v6Loading = null;
    }
  })();

  return await __v6Loading;
}

async function searchResults(keyword) {
  if (!(await __v6Load())) return JSON.stringify([]);
  try { return await __v6.search(keyword); }
  catch (e) { console.log("[SerienStream v6] search failed:", e); return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v6Load())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  try { return await __v6.details(url); }
  catch (e) { console.log("[SerienStream v6] details failed:", e); return JSON.stringify([{ description: "", aliases: "", airdate: "" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v6Load())) return JSON.stringify([]);
  try { return await __v6.episodes(url); }
  catch (e) { console.log("[SerienStream v6] episodes failed:", e); return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  try {
    if (!(await __v6Load())) return JSON.stringify({ streams: [], subtitles: [] });

    var episodeUrl = String(url || "").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i, SERIENSTREAM_BASE);
    var html = await __v6Text(episodeUrl, {
      "Accept": "text/html,application/xhtml+xml",
      "Referer": SERIENSTREAM_BASE + "/"
    }, true);

    if (!html) return JSON.stringify({ streams: [], subtitles: [] });

    var hosters = __v6.extractHosters(html) || [];
    console.log("[SerienStream v6] German hosters:", hosters.length);
    if (!hosters.length) {
      return JSON.stringify({ streams: [], subtitles: [] });
    }

    var preferred = ["VOE", "SpeedFiles", "Vidmoly", "DoodStream", "Vidoza", "MP4Upload", "FileMoon"];
    hosters.sort(function (a, b) {
      var ai = preferred.indexOf(a.provider); if (ai < 0) ai = 999;
      var bi = preferred.indexOf(b.provider); if (bi < 0) bi = 999;
      return ai - bi;
    });

    var providerMap = {};
    for (var i = 0; i < hosters.length; i++) {
      var hoster = hosters[i];
      var directUrl = await __v6ResolveHoster(hoster, episodeUrl);
      if (!directUrl) {
        console.log("[SerienStream v6] unresolved hoster:", hoster.provider);
        continue;
      }
      providerMap[directUrl] = __v6.providerKey(hoster.provider);
    }

    console.log("[SerienStream v6] direct provider map:", JSON.stringify(providerMap));

    if (Object.keys(providerMap).length === 0) {
      return JSON.stringify({ streams: [], subtitles: [] });
    }

    var streams = await __v6.multi(providerMap);
    if (Array.isArray(streams) && streams.length > 0) {
      return JSON.stringify({ streams: streams, subtitles: [] });
    }

    return JSON.stringify({ streams: [], subtitles: [] });
  } catch (error) {
    console.log("[SerienStream v6] stream failed:", error);
    return JSON.stringify({ streams: [], subtitles: [] });
  }
}
