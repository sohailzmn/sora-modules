const V11_SCRIPT_URL = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v11.js?rev=20260913-1708";

var __v12Loaded = false;
var __v12Loading = null;
var __v12 = { search: null, details: null, episodes: null, streamCore: null };

async function __v12Text(url) {
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

function __v12DiagStreams(lines) {
  var out = [];
  var safe = [];
  for (var i = 0; i < lines.length; i++) {
    if (lines[i]) safe.push(String(lines[i]).slice(0, 120));
  }
  if (!safe.length) safe.push("Keine Diagnose erhalten");
  while (safe.length < 2) safe.push("Weitere Diagnose nicht verfügbar");
  for (var j = 0; j < safe.length; j++) {
    out.push("DIAG " + (j + 1) + " • " + safe[j]);
    out.push("https://example.com/diagnostic-" + (j + 1) + ".m3u8");
  }
  return JSON.stringify({ streams: out, subtitles: [] });
}

async function __v12Load() {
  if (__v12Loaded) return true;
  if (__v12Loading) return await __v12Loading;

  __v12Loading = (async function () {
    try {
      var source = await __v12Text(V11_SCRIPT_URL);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v11StreamCore(");
      source += "\n;__v12.search = (typeof searchResults === 'function') ? searchResults : null;";
      source += "\n;__v12.details = (typeof extractDetails === 'function') ? extractDetails : null;";
      source += "\n;__v12.episodes = (typeof extractEpisodes === 'function') ? extractEpisodes : null;";
      source += "\n;__v12.streamCore = (typeof __v11StreamCore === 'function') ? __v11StreamCore : null;";
      eval(source);

      __v12Loaded = !!(__v12.search && __v12.details && __v12.episodes && __v12.streamCore);
      console.log("[SerienStream v12] loaded:", __v12Loaded);
      return __v12Loaded;
    } catch (e) {
      console.log("[SerienStream v12] load failed:", e);
      return false;
    } finally {
      __v12Loading = null;
    }
  })();

  return await __v12Loading;
}

async function searchResults(keyword) {
  if (!(await __v12Load())) return JSON.stringify([]);
  try { return await __v12.search(keyword); }
  catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v12Load())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  try { return await __v12.details(url); }
  catch (e) { return JSON.stringify([{ description: "", aliases: "", airdate: "" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v12Load())) return JSON.stringify([]);
  try { return await __v12.episodes(url); }
  catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  if (!(await __v12Load())) {
    return __v12DiagStreams(["V12 LOAD FEHLER", "v11 konnte nicht geladen werden"]);
  }

  try {
    var raw = await __v12.streamCore(url);
    var obj = null;

    if (typeof raw === "string") {
      try { obj = JSON.parse(raw); } catch (e) {}
    } else if (raw && typeof raw === "object") {
      obj = raw;
    }

    if (!obj) {
      return __v12DiagStreams(["V11 RESULT PARSE FEHLER", String(raw || "leer").slice(0, 80)]);
    }

    if (Array.isArray(obj.streams) && obj.streams.length > 1) {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj.sources) && obj.sources.length) {
      var converted = [];
      for (var i = 0; i < obj.sources.length; i++) {
        var s = obj.sources[i] || {};
        var title = s.title || ("DIAG " + (i + 1));
        var streamUrl = s.streamUrl || s.url || ("https://example.com/diagnostic-" + (i + 1) + ".m3u8");
        converted.push(String(title));
        converted.push(String(streamUrl));
      }
      if (converted.length > 1) {
        return JSON.stringify({ streams: converted, subtitles: obj.subtitles || [] });
      }
    }

    return __v12DiagStreams(["V11 GAB KEINE STREAMS/SOURCES ZURÜCK", "extractStreamUrl wurde ausgeführt"]);
  } catch (e) {
    return __v12DiagStreams(["V12 EXCEPTION", String(e)]);
  }
}
