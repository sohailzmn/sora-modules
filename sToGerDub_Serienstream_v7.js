const V6_SCRIPT_URL = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v6.js";
const STO_BASE = "https://serienstream.to";

var __v7Loaded = false;
var __v7Loading = null;
var __v7 = {
  search: null,
  details: null,
  episodes: null,
  extractHosters: null,
  providerKey: null,
  multi: null
};

async function __v7ReadText(response) {
  if (!response) return "";
  if (typeof response === "string") return response;
  try { if (typeof response.text === "function") return await response.text(); } catch (e) {}
  try { return String(response); } catch (e2) { return ""; }
}

async function __v7Fetch(url, headers, followRedirects) {
  try {
    return await fetchv2(url, headers || {}, "GET", null, followRedirects !== false);
  } catch (e) {
    try { return await fetch(url, { headers: headers || {} }); }
    catch (e2) { return null; }
  }
}

function __v7Header(headers, wanted) {
  if (!headers) return "";
  var lower = String(wanted || "").toLowerCase();
  try {
    if (typeof headers.get === "function") return headers.get(wanted) || headers.get(lower) || "";
  } catch (e) {}
  for (var k in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, k) && String(k).toLowerCase() === lower) {
      return String(headers[k] || "");
    }
  }
  return "";
}

function __v7Absolute(value, base) {
  if (!value) return "";
  value = String(value).trim().replace(/&amp;/gi, "&");
  base = base || STO_BASE;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.indexOf("//") === 0) return "https:" + value;
  var originMatch = String(base).match(/^(https?:\/\/[^\/]+)/i);
  var origin = originMatch ? originMatch[1] : STO_BASE;
  if (value.charAt(0) === "/") return origin + value;
  var clean = String(base).split("#")[0].split("?")[0];
  var slash = clean.lastIndexOf("/");
  var dir = slash > clean.indexOf("://") + 2 ? clean.substring(0, slash + 1) : clean + "/";
  return dir + value;
}

function __v7IsSto(url) {
  return /https?:\/\/(?:www\.)?(?:serienstream\.to|s\.to)(?:\/|$)/i.test(String(url || ""));
}

function __v7IsNoise(url) {
  var s = String(url || "").toLowerCase();
  return !s ||
    s.indexOf("cloudflare.com") !== -1 ||
    s.indexOf("challenges.cloudflare.com") !== -1 ||
    s.indexOf("google.com/recaptcha") !== -1 ||
    s.indexOf("gstatic.com/recaptcha") !== -1 ||
    s.indexOf("fonts.googleapis.com") !== -1 ||
    s.indexOf("fonts.gstatic.com") !== -1 ||
    s.indexOf("doubleclick.net") !== -1 ||
    s.indexOf("googletagmanager.com") !== -1;
}

function __v7ProviderHints(provider) {
  var p = String(provider || "").toLowerCase();
  if (p.indexOf("voe") !== -1) return ["voe.", "voe.sx", "voe-unblock.com"];
  if (p.indexOf("vidmoly") !== -1) return ["vidmoly."];
  if (p.indexOf("dood") !== -1) return ["dood.", "doodstream.", "doodwatch.", "dood.to"];
  if (p.indexOf("filemoon") !== -1) return ["filemoon."];
  if (p.indexOf("vidoza") !== -1) return ["vidoza."];
  if (p.indexOf("speed") !== -1) return ["speedfiles.", "speedvideo."];
  if (p.indexOf("mp4upload") !== -1) return ["mp4upload."];
  return [];
}

function __v7CollectCandidates(html, baseUrl) {
  html = String(html || "");
  var out = [];
  function add(v) {
    if (!v) return;
    v = String(v).replace(/\\\//g, "/").replace(/&amp;/gi, "&").trim();
    if (!v || v === "#" || /^javascript:/i.test(v)) return;
    var abs = __v7Absolute(v, baseUrl);
    if (out.indexOf(abs) === -1) out.push(abs);
  }

  var patterns = [
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,
    /location\.href\s*=\s*["']([^"']+)["']/gi,
    /location\.replace\(\s*["']([^"']+)["']\s*\)/gi,
    /document\.location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,
    /<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url\s*=\s*([^"'>\s]+)[^"']*["'][^>]*>/gi,
    /<form\b[^>]*action=["']([^"']+)["']/gi,
    /<(?:a|button|div|span)\b[^>]*(?:data-url|data-href|data-link|data-redirect|data-target|data-destination|href)=["']([^"']+)["'][^>]*>/gi,
    /<iframe\b[^>]*src=["']([^"']+)["']/gi,
    /(?:redirectUrl|redirect_url|targetUrl|target_url|providerUrl|provider_url|destination|continueUrl|continue_url)\s*[:=]\s*["']([^"']+)["']/gi
  ];

  for (var i = 0; i < patterns.length; i++) {
    var m;
    while ((m = patterns[i].exec(html)) !== null) add(m[1]);
  }

  var abs = /https?:\/\/[^"'<>\\s]+/gi;
  var a;
  while ((a = abs.exec(html)) !== null) add(a[0]);

  return out;
}

function __v7PickExternal(candidates, provider) {
  var hints = __v7ProviderHints(provider);
  var fallback = "";

  for (var i = 0; i < candidates.length; i++) {
    var url = candidates[i];
    if (!/^https?:\/\//i.test(url)) continue;
    if (__v7IsSto(url) || __v7IsNoise(url)) continue;

    var lower = url.toLowerCase();
    for (var h = 0; h < hints.length; h++) {
      if (lower.indexOf(hints[h]) !== -1) return url;
    }

    if (!fallback) fallback = url;
  }

  return hints.length === 0 ? fallback : "";
}

async function __v7ResolveHoster(hoster, episodeUrl) {
  var headers = {
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Referer": episodeUrl || (STO_BASE + "/"),
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
  };

  try {
    var first = await __v7Fetch(hoster.href, headers, false);
    if (first) {
      if (typeof first !== "string") {
        var status = Number(first.status || 0);
        var location = __v7Header(first.headers, "location");
        if (location && status >= 300 && status < 400) {
          var direct = __v7Absolute(location, hoster.href);
          if (!__v7IsSto(direct) && !__v7IsNoise(direct)) return direct;
        }
      }

      var firstHtml = await __v7ReadText(first);
      var firstCandidates = __v7CollectCandidates(firstHtml, hoster.href);
      var pickedFirst = __v7PickExternal(firstCandidates, hoster.provider);
      if (pickedFirst) return pickedFirst;
    }
  } catch (e1) {
    console.log("[SerienStream v7] first-stage parse failed:", hoster.provider, e1);
  }

  try {
    var followed = await __v7Fetch(hoster.href, headers, true);
    var followedHtml = await __v7ReadText(followed);
    var candidates = __v7CollectCandidates(followedHtml, hoster.href);
    var picked = __v7PickExternal(candidates, hoster.provider);
    if (picked) return picked;
  } catch (e2) {
    console.log("[SerienStream v7] followed-stage parse failed:", hoster.provider, e2);
  }

  return "";
}

async function __v7Load() {
  if (__v7Loaded) return true;
  if (__v7Loading) return await __v7Loading;

  __v7Loading = (async function () {
    try {
      var response = await __v7Fetch(V6_SCRIPT_URL, { "Accept": "text/plain" }, true);
      var source = await __v7ReadText(response);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v6LegacyStream(");
      source += "\n;__v7.search = (typeof searchResults === 'function') ? searchResults : null;";
      source += "\n;__v7.details = (typeof extractDetails === 'function') ? extractDetails : null;";
      source += "\n;__v7.episodes = (typeof extractEpisodes === 'function') ? extractEpisodes : null;";
      source += "\n;__v7.extractHosters = (typeof __v6 !== 'undefined' && __v6 && __v6.extractHosters) ? __v6.extractHosters : null;";
      source += "\n;__v7.providerKey = (typeof __v6 !== 'undefined' && __v6 && __v6.providerKey) ? __v6.providerKey : null;";
      source += "\n;__v7.multi = (typeof __v6 !== 'undefined' && __v6 && __v6.multi) ? __v6.multi : null;";

      eval(source);

      if (typeof __v6Load === "function") await __v6Load();
      if (typeof __v6 !== "undefined" && __v6) {
        if (!__v7.extractHosters) __v7.extractHosters = __v6.extractHosters;
        if (!__v7.providerKey) __v7.providerKey = __v6.providerKey;
        if (!__v7.multi) __v7.multi = __v6.multi;
      }

      __v7Loaded = !!(__v7.search && __v7.details && __v7.episodes && __v7.extractHosters && __v7.providerKey && __v7.multi);
      console.log("[SerienStream v7] loaded:", __v7Loaded);
      return __v7Loaded;
    } catch (error) {
      console.log("[SerienStream v7] load failed:", error);
      return false;
    } finally {
      __v7Loading = null;
    }
  })();

  return await __v7Loading;
}

async function searchResults(keyword) {
  if (!(await __v7Load())) return JSON.stringify([]);
  try { return await __v7.search(keyword); }
  catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v7Load())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  try { return await __v7.details(url); }
  catch (e) { return JSON.stringify([{ description: "", aliases: "", airdate: "" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v7Load())) return JSON.stringify([]);
  try { return await __v7.episodes(url); }
  catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  try {
    if (!(await __v7Load())) return JSON.stringify({ streams: [], subtitles: [] });

    var episodeUrl = String(url || "").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i, STO_BASE);
    var episodeResponse = await __v7Fetch(episodeUrl, {
      "Accept": "text/html,application/xhtml+xml",
      "Referer": STO_BASE + "/"
    }, true);
    var html = await __v7ReadText(episodeResponse);
    if (!html) return JSON.stringify({ streams: [], subtitles: [] });

    var hosters = __v7.extractHosters(html) || [];
    console.log("[SerienStream v7] German hosters:", hosters.length);
    if (!hosters.length) return JSON.stringify({ streams: [], subtitles: [] });

    var preferred = ["VOE", "SpeedFiles", "Vidmoly", "DoodStream", "Vidoza", "MP4Upload", "FileMoon"];
    hosters.sort(function (a, b) {
      var ai = preferred.indexOf(a.provider); if (ai < 0) ai = 999;
      var bi = preferred.indexOf(b.provider); if (bi < 0) bi = 999;
      return ai - bi;
    });

    var providerMap = {};
    for (var i = 0; i < hosters.length; i++) {
      var hoster = hosters[i];
      var directUrl = await __v7ResolveHoster(hoster, episodeUrl);
      if (!directUrl) {
        console.log("[SerienStream v7] no public external URL in interstitial for:", hoster.provider);
        continue;
      }
      providerMap[directUrl] = __v7.providerKey(hoster.provider);
    }

    if (Object.keys(providerMap).length === 0) {
      console.log("[SerienStream v7] interstitial exposed no provider URLs");
      return JSON.stringify({ streams: [], subtitles: [] });
    }

    var streams = await __v7.multi(providerMap);
    if (Array.isArray(streams) && streams.length > 0) {
      return JSON.stringify({ streams: streams, subtitles: [] });
    }

    return JSON.stringify({ streams: [], subtitles: [] });
  } catch (error) {
    console.log("[SerienStream v7] stream failed:", error);
    return JSON.stringify({ streams: [], subtitles: [] });
  }
}
