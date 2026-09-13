const V17_SCRIPT_URL_V21 = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v17.js?rev=20260914-0008";

var __v21Loaded = false;
var __v21Loading = null;
var __v21 = { search:null, details:null, episodes:null, stream:null };

async function __v21Text(url) {
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

async function __v21Load() {
  if (__v21Loaded) return true;
  if (__v21Loading) return await __v21Loading;
  __v21Loading = (async function () {
    try {
      var source = await __v21Text(V17_SCRIPT_URL_V21);
      if (!source) return false;
      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v17LegacyStreamV21(");
      source += "\n;__v21.search=(typeof searchResults==='function')?searchResults:null;";
      source += "\n;__v21.details=(typeof extractDetails==='function')?extractDetails:null;";
      source += "\n;__v21.episodes=(typeof extractEpisodes==='function')?extractEpisodes:null;";
      source += "\n;__v21.stream=(typeof __v17LegacyStreamV21==='function')?__v17LegacyStreamV21:null;";
      eval(source);
      __v21Loaded = !!(__v21.search && __v21.details && __v21.episodes && __v21.stream && typeof networkFetch === "function");
      return __v21Loaded;
    } catch (e) {
      console.log("[SerienStream v21] load failed", e);
      return false;
    } finally {
      __v21Loading = null;
    }
  })();
  return await __v21Loading;
}

async function searchResults(keyword) {
  if (!(await __v21Load())) return JSON.stringify([]);
  try { return await __v21.search(keyword); } catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v21Load())) return JSON.stringify([{description:"",aliases:"",airdate:""}]);
  try { return await __v21.details(url); } catch (e) { return JSON.stringify([{description:"",aliases:"",airdate:""}]); }
}

async function extractEpisodes(url) {
  if (!(await __v21Load())) return JSON.stringify([]);
  try { return await __v21.episodes(url); } catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  if (!(await __v21Load())) return JSON.stringify({streams:[],subtitles:[]});

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
    return await __v21.stream(url);
  } finally {
    networkFetch = originalNetworkFetch;
  }
}
