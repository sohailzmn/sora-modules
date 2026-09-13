const V11_SCRIPT_URL_V13 = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v11.js?rev=20260913-1716";
const STO_BASE_V13 = "https://serienstream.to";

var __v13Loaded = false;
var __v13Loading = null;
var __v13 = {
  search: null,
  details: null,
  episodes: null,
  fetch: null,
  read: null,
  extractHosters: null,
  resolveHoster: null,
  providerKey: null,
  multi: null,
  loginDetailed: null
};

async function __v13Text(url) {
  try {
    var r = await fetchv2(url, { "Accept": "text/plain" }, "GET", null, true);
    if (!r) return "";
    if (typeof r === "string") return r;
    if (typeof r.text === "function") return await r.text();
    return String(r || "");
  } catch (e) {
    try {
      var f = await fetch(url, { "Accept": "text/plain" });
      if (typeof f === "string") return f;
      if (f && typeof f.text === "function") return await f.text();
      return String(f || "");
    } catch (e2) { return ""; }
  }
}

function __v13IsHttp(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function __v13Origin(url) {
  var m = String(url || "").match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : "";
}

function __v13NormalizeMulti(result) {
  if (typeof result === "string") {
    try { result = JSON.parse(result); } catch (e) {}
  }
  if (result && !Array.isArray(result) && Array.isArray(result.streams)) result = result.streams;
  if (!Array.isArray(result)) return [];

  var out = [];
  for (var i = 0; i < result.length; i++) {
    var current = String(result[i] || "").trim();
    if (__v13IsHttp(current)) {
      out.push({ label: "", url: current });
      continue;
    }
    if (i + 1 < result.length && __v13IsHttp(result[i + 1])) {
      out.push({ label: current, url: String(result[i + 1]).trim() });
      i++;
    }
  }
  return out;
}

function __v13Diag(lines) {
  var sources = [];
  for (var i = 0; i < lines.length; i++) {
    sources.push({
      title: "DIAG " + (i + 1) + " • " + String(lines[i] || "").slice(0, 110),
      streamUrl: "https://example.com/serienstream-diag-" + (i + 1) + ".m3u8"
    });
  }
  return JSON.stringify({ streams: [], subtitles: [], sources: sources });
}

async function __v13Load() {
  if (__v13Loaded) return true;
  if (__v13Loading) return await __v13Loading;

  __v13Loading = (async function () {
    try {
      var source = await __v13Text(V11_SCRIPT_URL_V13);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v11LegacyStreamV13(");
      source += "\n;__v13.search = (typeof searchResults === 'function') ? searchResults : null;";
      source += "\n;__v13.details = (typeof extractDetails === 'function') ? extractDetails : null;";
      source += "\n;__v13.episodes = (typeof extractEpisodes === 'function') ? extractEpisodes : null;";
      source += "\n;__v13.loginDetailed = (typeof __v11LoginDetailed === 'function') ? __v11LoginDetailed : null;";
      source += "\n;__v13.fetch = (typeof __v11 !== 'undefined' && __v11) ? __v11.fetch : null;";
      source += "\n;__v13.read = (typeof __v11 !== 'undefined' && __v11) ? __v11.read : null;";
      source += "\n;__v13.extractHosters = (typeof __v11 !== 'undefined' && __v11) ? __v11.extractHosters : null;";
      source += "\n;__v13.resolveHoster = (typeof __v11 !== 'undefined' && __v11) ? __v11.resolveHoster : null;";
      source += "\n;__v13.providerKey = (typeof __v11 !== 'undefined' && __v11) ? __v11.providerKey : null;";
      source += "\n;__v13.multi = (typeof __v11 !== 'undefined' && __v11) ? __v11.multi : null;";
      eval(source);

      if (typeof __v11Load === "function") await __v11Load();
      if (typeof __v11 !== "undefined" && __v11) {
        if (!__v13.fetch) __v13.fetch = __v11.fetch;
        if (!__v13.read) __v13.read = __v11.read;
        if (!__v13.extractHosters) __v13.extractHosters = __v11.extractHosters;
        if (!__v13.resolveHoster) __v13.resolveHoster = __v11.resolveHoster;
        if (!__v13.providerKey) __v13.providerKey = __v11.providerKey;
        if (!__v13.multi) __v13.multi = __v11.multi;
      }

      __v13Loaded = !!(
        __v13.search && __v13.details && __v13.episodes && __v13.loginDetailed &&
        __v13.fetch && __v13.read && __v13.extractHosters && __v13.resolveHoster &&
        __v13.providerKey && __v13.multi
      );
      console.log("[SerienStream v13] loaded:", __v13Loaded);
      return __v13Loaded;
    } catch (e) {
      console.log("[SerienStream v13] load failed:", e);
      return false;
    } finally {
      __v13Loading = null;
    }
  })();

  return await __v13Loading;
}

async function searchResults(keyword) {
  if (!(await __v13Load())) return JSON.stringify([]);
  try { return await __v13.search(keyword); } catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v13Load())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  try { return await __v13.details(url); } catch (e) { return JSON.stringify([{ description: "", aliases: "", airdate: "" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v13Load())) return JSON.stringify([]);
  try { return await __v13.episodes(url); } catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  try {
    if (!(await __v13Load())) return __v13Diag(["V13 LOAD FEHLER"]);

    var login = await __v13.loginDetailed();
    var episodeUrl = String(url || "").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i, STO_BASE_V13);

    var episodeResponse = await __v13.fetch(
      episodeUrl,
      { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE_V13 + "/" },
      "GET",
      null,
      false
    );
    var episodeStatus = Number((episodeResponse && episodeResponse.status) || 0);
    var episodeHtml = await __v13.read(episodeResponse);
    if (!episodeHtml) {
      return __v13Diag([
        "LOGIN " + (login && login.ok ? "OK" : "FEHLER") + " • " + ((login && login.reason) || "unbekannt"),
        "EPISODE HTTP " + episodeStatus + " • leer"
      ]);
    }

    var hosters = __v13.extractHosters(episodeHtml) || [];
    if (!hosters.length) {
      return __v13Diag([
        "LOGIN " + (login && login.ok ? "OK" : "FEHLER") + " • " + ((login && login.reason) || "unbekannt"),
        "EPISODE HTTP " + episodeStatus + " • 0 Hoster"
      ]);
    }

    var sources = [];
    var seen = {};
    var resolvedHosters = 0;

    for (var i = 0; i < hosters.length; i++) {
      var hoster = hosters[i];
      var providerPage = await __v13.resolveHoster(hoster, episodeUrl);
      if (!providerPage || !__v13IsHttp(providerPage)) continue;
      resolvedHosters++;

      var singleMap = {};
      singleMap[providerPage] = __v13.providerKey(hoster.provider);

      var extracted = null;
      try { extracted = await __v13.multi(singleMap); } catch (multiError) { extracted = null; }
      var normalized = __v13NormalizeMulti(extracted);

      for (var j = 0; j < normalized.length; j++) {
        var mediaUrl = normalized[j].url;
        if (!__v13IsHttp(mediaUrl) || seen[mediaUrl]) continue;
        seen[mediaUrl] = true;

        var title = String(hoster.provider || normalized[j].label || "Stream");
        if (normalized.length > 1) title += " " + (j + 1);

        var headers = {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
          "Referer": providerPage
        };
        var origin = __v13Origin(providerPage);
        if (origin) headers["Origin"] = origin;

        sources.push({
          title: title,
          streamUrl: mediaUrl,
          headers: headers
        });
      }
    }

    if (sources.length) {
      console.log("[SerienStream v13] playable candidates:", sources.length, "login:", !!(login && login.ok));
      return JSON.stringify({ streams: [], subtitles: [], sources: sources });
    }

    return __v13Diag([
      "LOGIN " + (login && login.ok ? "OK" : "FEHLER") + " • " + ((login && login.reason) || "unbekannt"),
      "EPISODE HTTP " + episodeStatus + " • Hoster " + hosters.length + " • resolved " + resolvedHosters,
      "Extractor lieferte keine Media-URLs"
    ]);
  } catch (e) {
    return __v13Diag(["V13 EXCEPTION", String(e)]);
  }
}
