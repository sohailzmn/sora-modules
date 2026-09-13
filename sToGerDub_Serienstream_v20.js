const V17_SCRIPT_URL_V20 = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v17.js?rev=20260913-2338";

var __v20Loaded = false;
var __v20Loading = null;
var __v20 = { search:null, details:null, episodes:null, stream:null };

async function __v20Text(url) {
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

async function __v20Load() {
  if (__v20Loaded) return true;
  if (__v20Loading) return await __v20Loading;
  __v20Loading = (async function () {
    try {
      var source = await __v20Text(V17_SCRIPT_URL_V20);
      if (!source) return false;
      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v17LegacyStreamV20(");
      source += "\n;__v20.search=(typeof searchResults==='function')?searchResults:null;";
      source += "\n;__v20.details=(typeof extractDetails==='function')?extractDetails:null;";
      source += "\n;__v20.episodes=(typeof extractEpisodes==='function')?extractEpisodes:null;";
      source += "\n;__v20.stream=(typeof __v17LegacyStreamV20==='function')?__v17LegacyStreamV20:null;";
      eval(source);
      __v20Loaded = !!(__v20.search && __v20.details && __v20.episodes && __v20.stream && typeof networkFetch === "function");
      return __v20Loaded;
    } catch (e) {
      console.log("[SerienStream v20] load failed", e);
      return false;
    } finally {
      __v20Loading = null;
    }
  })();
  return await __v20Loading;
}

async function searchResults(keyword) {
  if (!(await __v20Load())) return JSON.stringify([]);
  try { return await __v20.search(keyword); } catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v20Load())) return JSON.stringify([{description:"",aliases:"",airdate:""}]);
  try { return await __v20.details(url); } catch (e) { return JSON.stringify([{description:"",aliases:"",airdate:""}]); }
}

async function extractEpisodes(url) {
  if (!(await __v20Load())) return JSON.stringify([]);
  try { return await __v20.episodes(url); } catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  if (!(await __v20Load())) return JSON.stringify({streams:[],subtitles:[]});

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
        options = Object.assign({}, options, { headers: headers });
      }
    } catch (e) {}
    return await originalNetworkFetch(target, options);
  };

  try {
    return await __v20.stream(url);
  } finally {
    networkFetch = originalNetworkFetch;
  }
}
