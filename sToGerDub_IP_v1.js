const TARGET_BASE = "http://186.2.175.5";
const ORIGINAL_SCRIPT_URL = "https://git.luna-app.eu/Cufiy/sora-modules/raw/branch/main/modules/s.to/js/s.to_GER.js";

var __stoLoaded = false;
var __stoLoading = null;
var __stoExports = {
  search: null,
  details: null,
  episodes: null,
  stream: null
};

async function __stoRequestText(url, options) {
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
    response = await fetchv2(
      url,
      headers,
      options.method || "GET",
      options.body || null
    );
  } catch (e) {
    try {
      response = await fetch(url, options);
    } catch (e2) {
      console.log("[s.to IP] request failed:", url, e2);
      return "";
    }
  }

  if (!response) return "";
  if (typeof response === "string") return response;

  try {
    if (typeof response.text === "function") {
      return await response.text();
    }
  } catch (e3) {}

  try {
    return String(response);
  } catch (e4) {
    return "";
  }
}

function __stoPatchText(value) {
  if (value === null || value === undefined) return value;

  var text = typeof value === "string" ? value : JSON.stringify(value);

  return text
    .replace(/https:\/\/www\.s\.to/gi, TARGET_BASE)
    .replace(/http:\/\/www\.s\.to/gi, TARGET_BASE)
    .replace(/https:\/\/s\.to/gi, TARGET_BASE)
    .replace(/http:\/\/s\.to/gi, TARGET_BASE)
    .replace(/https:\/\/www\.serienstream\.to/gi, TARGET_BASE)
    .replace(/http:\/\/www\.serienstream\.to/gi, TARGET_BASE)
    .replace(/https:\/\/serienstream\.to/gi, TARGET_BASE)
    .replace(/http:\/\/serienstream\.to/gi, TARGET_BASE);
}

function __stoRenameExport(source, name, replacement) {
  source = source.replace(
    new RegExp("async\\s+function\\s+" + name + "\\s*\\("),
    "async function " + replacement + "("
  );

  source = source.replace(
    new RegExp("function\\s+" + name + "\\s*\\("),
    "function " + replacement + "("
  );

  return source;
}

async function __stoEnsureBase() {
  if (__stoLoaded) return true;
  if (__stoLoading) return await __stoLoading;

  __stoLoading = (async function () {
    try {
      var source = await __stoRequestText(ORIGINAL_SCRIPT_URL, {
        headers: { "Accept": "text/plain" }
      });

      if (!source) {
        console.log("[s.to IP] original script could not be loaded");
        return false;
      }

      // Keep the original module logic, only redirect requests away from the dead s.to domain.
      source = __stoPatchText(source);

      source = __stoRenameExport(source, "searchResults", "__stoBaseSearchResults");
      source = __stoRenameExport(source, "extractDetails", "__stoBaseExtractDetails");
      source = __stoRenameExport(source, "extractEpisodes", "__stoBaseExtractEpisodes");
      source = __stoRenameExport(source, "extractStreamUrl", "__stoBaseExtractStreamUrl");

      source += "\n;__stoExports.search = (typeof __stoBaseSearchResults === 'function') ? __stoBaseSearchResults : null;";
      source += "\n;__stoExports.details = (typeof __stoBaseExtractDetails === 'function') ? __stoBaseExtractDetails : null;";
      source += "\n;__stoExports.episodes = (typeof __stoBaseExtractEpisodes === 'function') ? __stoBaseExtractEpisodes : null;";
      source += "\n;__stoExports.stream = (typeof __stoBaseExtractStreamUrl === 'function') ? __stoBaseExtractStreamUrl : null;";

      eval(source);

      __stoLoaded = !!(
        __stoExports.search &&
        __stoExports.details &&
        __stoExports.episodes &&
        __stoExports.stream
      );

      console.log("[s.to IP] original module loaded:", __stoLoaded);
      return __stoLoaded;
    } catch (error) {
      console.log("[s.to IP] load error:", error);
      return false;
    } finally {
      __stoLoading = null;
    }
  })();

  return await __stoLoading;
}

async function searchResults(keyword) {
  try {
    if (!(await __stoEnsureBase())) return JSON.stringify([]);
    var result = await __stoExports.search(keyword);
    return __stoPatchText(result);
  } catch (error) {
    console.log("[s.to IP] search error:", error);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    if (!(await __stoEnsureBase())) {
      return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
    }

    var result = await __stoExports.details(__stoPatchText(url));
    return __stoPatchText(result);
  } catch (error) {
    console.log("[s.to IP] details error:", error);
    return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  }
}

async function extractEpisodes(url) {
  try {
    if (!(await __stoEnsureBase())) return JSON.stringify([]);
    var result = await __stoExports.episodes(__stoPatchText(url));
    return __stoPatchText(result);
  } catch (error) {
    console.log("[s.to IP] episodes error:", error);
    return JSON.stringify([]);
  }
}

// The original s.to module uses streamAsyncJS=false, so Luna passes the episode HTML here.
// By the time playback starts, search/episodes have already loaded the original module.
function extractStreamUrl(html) {
  try {
    if (!__stoLoaded || !__stoExports.stream) {
      console.log("[s.to IP] stream resolver not loaded yet");
      return JSON.stringify([]);
    }

    var result = __stoExports.stream(__stoPatchText(html));

    // The original stream resolver is expected to be synchronous.
    if (result && typeof result.then === "function") {
      console.log("[s.to IP] unexpected async stream resolver");
      return JSON.stringify([]);
    }

    return __stoPatchText(result);
  } catch (error) {
    console.log("[s.to IP] stream error:", error);
    return JSON.stringify([]);
  }
}
