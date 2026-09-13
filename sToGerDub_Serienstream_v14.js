const V13_SCRIPT_URL = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v13.js?rev=20260913-1717";

var __v14Loaded = false;
var __v14Loading = null;
var __v14 = { search: null, details: null, episodes: null, streamCore: null };

async function __v14Text(url) {
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

function __v14Diagnostic(message) {
  return JSON.stringify({
    streams: [
      {
        title: "DIAG • " + String(message || "Unbekannter Fehler").slice(0, 120),
        streamUrl: "https://example.com/serienstream-v14-diag.m3u8"
      },
      {
        title: "DIAG • v14 wrapper aktiv",
        streamUrl: "https://example.com/serienstream-v14-diag-2.m3u8"
      }
    ],
    subtitles: []
  });
}

async function __v14Load() {
  if (__v14Loaded) return true;
  if (__v14Loading) return await __v14Loading;

  __v14Loading = (async function () {
    try {
      var source = await __v14Text(V13_SCRIPT_URL);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v13StreamCoreV14(");
      source += "\n;__v14.search = (typeof searchResults === 'function') ? searchResults : null;";
      source += "\n;__v14.details = (typeof extractDetails === 'function') ? extractDetails : null;";
      source += "\n;__v14.episodes = (typeof extractEpisodes === 'function') ? extractEpisodes : null;";
      source += "\n;__v14.streamCore = (typeof __v13StreamCoreV14 === 'function') ? __v13StreamCoreV14 : null;";
      eval(source);

      __v14Loaded = !!(__v14.search && __v14.details && __v14.episodes && __v14.streamCore);
      console.log("[SerienStream v14] loaded:", __v14Loaded);
      return __v14Loaded;
    } catch (e) {
      console.log("[SerienStream v14] load failed:", e);
      return false;
    } finally {
      __v14Loading = null;
    }
  })();

  return await __v14Loading;
}

async function searchResults(keyword) {
  if (!(await __v14Load())) return JSON.stringify([]);
  try { return await __v14.search(keyword); } catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v14Load())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  try { return await __v14.details(url); } catch (e) { return JSON.stringify([{ description: "", aliases: "", airdate: "" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v14Load())) return JSON.stringify([]);
  try { return await __v14.episodes(url); } catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  if (!(await __v14Load())) return __v14Diagnostic("V14 LOAD FEHLER");

  try {
    var raw = await __v14.streamCore(url);
    var obj = raw;
    if (typeof raw === "string") {
      try { obj = JSON.parse(raw); }
      catch (e) { return __v14Diagnostic("V13 JSON PARSE FEHLER"); }
    }

    if (!obj || typeof obj !== "object") {
      return __v14Diagnostic("V13 lieferte kein Objekt");
    }

    // SoraCore/Luna interprets object-based streams only when they are
    // under the `streams` key. A separate `sources` key is ignored by
    // parseStreamResult, which caused v1.7.5 to show No Streams Found.
    if (Array.isArray(obj.sources) && obj.sources.length) {
      return JSON.stringify({
        streams: obj.sources,
        subtitles: Array.isArray(obj.subtitles) ? obj.subtitles : []
      });
    }

    // Preserve ordinary alternating string streams if v13 returned them.
    if (Array.isArray(obj.streams) && obj.streams.length) {
      return JSON.stringify({ streams: obj.streams, subtitles: obj.subtitles || [] });
    }

    return __v14Diagnostic("V13 lieferte weder sources noch streams");
  } catch (e) {
    return __v14Diagnostic("V14 EXCEPTION: " + String(e));
  }
}
