const V17_SCRIPT_URL_V22 = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v17.js?rev=20260914-0926";

var __v22Loaded = false;
var __v22Loading = null;
var __v22 = { search:null, details:null, episodes:null, stream:null };

async function __v22Text(url) {
  try {
    var r = await fetchv2(url, {"Accept":"text/plain"}, "GET", null, true);
    if (!r) return "";
    if (typeof r === "string") return r;
    if (typeof r.text === "function") return await r.text();
    return String(r || "");
  } catch (e) {
    return "";
  }
}

async function __v22Load() {
  if (__v22Loaded) return true;
  if (__v22Loading) return await __v22Loading;

  __v22Loading = (async function () {
    try {
      var source = await __v22Text(V17_SCRIPT_URL_V22);
      if (!source) return false;

      // Keep the proven v17 search/details/episode/provider logic, but stop doing a full
      // SerienStream login WebView round-trip on every single episode. The patched Shirox
      // WebView now owns the persistent SerienStream session/cookies and reuses them.
      source = source.replace(
        "var login = await __v17BrowserLogin();",
        "var login = {ok:true,reason:'persistent Shirox session',loginRequests:0,postRequests:0,accountRequests:0,cookies:0,fields:0};"
      );

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v17LegacyStreamV22(");
      source += "\n;__v22.search=(typeof searchResults==='function')?searchResults:null;";
      source += "\n;__v22.details=(typeof extractDetails==='function')?extractDetails:null;";
      source += "\n;__v22.episodes=(typeof extractEpisodes==='function')?extractEpisodes:null;";
      source += "\n;__v22.stream=(typeof __v17LegacyStreamV22==='function')?__v17LegacyStreamV22:null;";
      eval(source);

      __v22Loaded = !!(__v22.search && __v22.details && __v22.episodes && __v22.stream && typeof networkFetch === "function");
      return __v22Loaded;
    } catch (e) {
      console.log("[SerienStream v22] load failed", e);
      return false;
    } finally {
      __v22Loading = null;
    }
  })();

  return await __v22Loading;
}

async function searchResults(keyword) {
  if (!(await __v22Load())) return JSON.stringify([]);
  try { return await __v22.search(keyword); } catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v22Load())) return JSON.stringify([{description:"",aliases:"",airdate:""}]);
  try { return await __v22.details(url); } catch (e) { return JSON.stringify([{description:"",aliases:"",airdate:""}]); }
}

async function extractEpisodes(url) {
  if (!(await __v22Load())) return JSON.stringify([]);
  try { return await __v22.episodes(url); } catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  if (!(await __v22Load())) return JSON.stringify({streams:[],subtitles:[]});

  var episodeUrl = String(url || "").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i, "https://serienstream.to");
  var originalNetworkFetch = networkFetch;

  networkFetch = async function(target, options) {
    options = options || {};
    try {
      var u = new URL(String(target || ""));
      if ((u.hostname === "serienstream.to" || u.hostname === "www.serienstream.to" || u.hostname === "s.to") && u.pathname === "/r") {
        var headers = {};
        var existing = options.headers || {};
        for (var k in existing) headers[k] = existing[k];
        headers["Referer"] = episodeUrl;
        headers["X-Shirox-SerienStream-Episode"] = episodeUrl;
        options = Object.assign({}, options, { headers: headers });
      }
    } catch (e) {}
    return await originalNetworkFetch(target, options);
  };

  try {
    return await __v22.stream(url);
  } finally {
    networkFetch = originalNetworkFetch;
  }
}
