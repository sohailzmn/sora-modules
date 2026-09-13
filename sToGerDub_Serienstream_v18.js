const V17_SCRIPT_URL_V18 = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v17.js?rev=20260913-2230";
const STO_BASE_V18 = "https://serienstream.to";
const STO_UA_V18 = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

var __v18Loaded = false;
var __v18Loading = null;
var __v18 = {
  search: null,
  details: null,
  episodes: null,
  browserLogin: null,
  resolveBrowser: null,
  extractHosters: null,
  providerKey: null,
  multi: null
};

async function __v18Text(url) {
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

function __v18IsHttp(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function __v18Origin(url) {
  var m = String(url || "").match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : "";
}

function __v18NormalizeMulti(result) {
  if (typeof result === "string") {
    try { result = JSON.parse(result); } catch (e) {}
  }
  if (result && !Array.isArray(result) && Array.isArray(result.streams)) result = result.streams;
  if (!Array.isArray(result)) return [];

  var out = [];
  for (var i = 0; i < result.length; i++) {
    var current = String(result[i] || "").trim();
    if (__v18IsHttp(current)) {
      out.push({ label: "", url: current });
      continue;
    }
    if (i + 1 < result.length && __v18IsHttp(result[i + 1])) {
      out.push({ label: current, url: String(result[i + 1]).trim() });
      i++;
    }
  }
  return out;
}

function __v18MediaFromRequests(requests) {
  if (!Array.isArray(requests)) return [];
  var out = [];
  var seen = {};
  for (var i = 0; i < requests.length; i++) {
    var u = String(requests[i] || "").trim();
    if (!__v18IsHttp(u)) continue;
    if (!(/\.m3u8(?:[?#]|$)/i.test(u) || /\.mp4(?:[?#]|$)/i.test(u) || /\.webm(?:[?#]|$)/i.test(u))) continue;
    if (/serienstream\.(?:to|cx)/i.test(u)) continue;
    if (seen[u]) continue;
    seen[u] = true;
    out.push(u);
  }
  return out;
}

function __v18Diag(lines) {
  var streams = [];
  for (var i = 0; i < lines.length; i++) {
    streams.push({
      title: "DIAG " + (i + 1) + " • " + String(lines[i] || "").slice(0, 120),
      streamUrl: "https://example.com/serienstream-v18-diag-" + (i + 1) + ".m3u8"
    });
  }
  return JSON.stringify({ streams: streams, subtitles: [] });
}

async function __v18Load() {
  if (__v18Loaded) return true;
  if (__v18Loading) return await __v18Loading;

  __v18Loading = (async function () {
    try {
      var source = await __v18Text(V17_SCRIPT_URL_V18);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v17LegacyStreamV18(");
      source += "\n;__v18.search=(typeof searchResults==='function')?searchResults:null;";
      source += "\n;__v18.details=(typeof extractDetails==='function')?extractDetails:null;";
      source += "\n;__v18.episodes=(typeof extractEpisodes==='function')?extractEpisodes:null;";
      source += "\n;__v18.browserLogin=(typeof __v17BrowserLogin==='function')?__v17BrowserLogin:null;";
      source += "\n;__v18.resolveBrowser=(typeof __v17ResolveBrowser==='function')?__v17ResolveBrowser:null;";
      source += "\n;__v18.extractHosters=(typeof __v17!=='undefined'&&__v17)?__v17.extractHosters:null;";
      source += "\n;__v18.providerKey=(typeof __v17!=='undefined'&&__v17)?__v17.providerKey:null;";
      source += "\n;__v18.multi=(typeof __v17!=='undefined'&&__v17)?__v17.multi:null;";
      eval(source);

      if (typeof __v17Load === "function") await __v17Load();
      if (typeof __v17 !== "undefined" && __v17) {
        if (!__v18.extractHosters) __v18.extractHosters = __v17.extractHosters;
        if (!__v18.providerKey) __v18.providerKey = __v17.providerKey;
        if (!__v18.multi) __v18.multi = __v17.multi;
      }

      __v18Loaded = !!(
        __v18.search && __v18.details && __v18.episodes &&
        __v18.browserLogin && __v18.resolveBrowser &&
        __v18.extractHosters && __v18.providerKey && __v18.multi
      );
      return __v18Loaded;
    } catch (e) {
      console.log("[SerienStream v18] load failed:", e);
      return false;
    } finally {
      __v18Loading = null;
    }
  })();

  return await __v18Loading;
}

async function searchResults(keyword) {
  if (!(await __v18Load())) return JSON.stringify([]);
  try { return await __v18.search(keyword); } catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v18Load())) return JSON.stringify([{ description:"", aliases:"", airdate:"" }]);
  try { return await __v18.details(url); } catch (e) { return JSON.stringify([{ description:"", aliases:"", airdate:"" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v18Load())) return JSON.stringify([]);
  try { return await __v18.episodes(url); } catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  try {
    if (!(await __v18Load())) return __v18Diag(["V18 LOAD FEHLER"]);

    var login = await __v18.browserLogin();
    var episodeUrl = String(url || "").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i, STO_BASE_V18);

    var ep = await fetchv2(
      episodeUrl,
      { "Accept":"text/html,application/xhtml+xml", "Referer":STO_BASE_V18 + "/", "User-Agent":STO_UA_V18 },
      "GET",
      null,
      true
    );
    var epStatus = Number(ep && ep.status || 0);
    var epHtml = ep && typeof ep.text === "function" ? await ep.text() : "";
    var hosters = __v18.extractHosters(epHtml) || [];

    var streams = [];
    var seen = {};
    var states = [];
    var externalPages = 0;

    for (var i = 0; i < hosters.length; i++) {
      var hoster = hosters[i];
      var rr = await __v18.resolveBrowser(hoster);
      var providerName = String(hoster.provider || "Stream");

      if (!rr || !rr.url || !__v18IsHttp(rr.url)) {
        states.push(providerName + ":intern");
        continue;
      }

      externalPages++;
      var providerPage = String(rr.url);
      var normalized = [];

      try {
        var singleMap = {};
        singleMap[providerPage] = __v18.providerKey(providerName);
        normalized = __v18NormalizeMulti(await __v18.multi(singleMap));
      } catch (e) {
        normalized = [];
      }

      if (!normalized.length && typeof networkFetch === "function") {
        try {
          var web = await networkFetch(providerPage, {
            timeoutSeconds: 10,
            returnHTML: true,
            returnCookies: true,
            headers: { "Referer": episodeUrl }
          });
          var mediaReqs = __v18MediaFromRequests(web && web.requests);
          for (var mr = 0; mr < mediaReqs.length; mr++) {
            normalized.push({ label:"", url:mediaReqs[mr] });
          }
        } catch (e2) {}
      }

      states.push(providerName + ":extern x" + normalized.length);

      for (var j = 0; j < normalized.length; j++) {
        var mediaUrl = String(normalized[j].url || "").trim();
        if (!__v18IsHttp(mediaUrl) || seen[mediaUrl]) continue;
        if (/serienstream\.(?:to|cx)/i.test(mediaUrl)) continue;
        seen[mediaUrl] = true;

        var title = providerName;
        if (normalized.length > 1) title += " " + (j + 1);

        var headers = {
          "User-Agent": STO_UA_V18,
          "Referer": providerPage
        };
        var origin = __v18Origin(providerPage);
        if (origin) headers["Origin"] = origin;

        streams.push({
          title: title,
          streamUrl: mediaUrl,
          headers: headers
        });
      }
    }

    if (streams.length) {
      return JSON.stringify({ streams: streams, subtitles: [] });
    }

    return __v18Diag([
      "WEBKIT LOGIN " + (login && login.ok ? "OK ✅" : "FEHLER ❌") + " • " + ((login && login.reason) || "unbekannt"),
      "EPISODE HTTP " + epStatus + " • Hoster " + hosters.length + " • extern " + externalPages,
      "HOSTER: " + (states.join(" | ") || "keine"),
      "Keine validen Media-URLs; Fake-Streams werden nicht mehr angezeigt"
    ]);
  } catch (e) {
    return __v18Diag(["V18 EXCEPTION", String(e)]);
  }
}
