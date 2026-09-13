const TARGET_BASE = "http://186.2.175.5";
const ORIGINAL_SCRIPT_URL = "https://git.luna-app.eu/Cufiy/sora-modules/raw/branch/main/modules/s.to/js/s.to_GER.js";

var __stoLoaded = false;
var __stoLoading = null;
var __stoExports = { details: null, episodes: null, stream: null };

async function __stoRequestText(url, options) {
  options = options || {};
  var headers = options.headers || {};
  if (!headers["User-Agent"]) headers["User-Agent"] = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
  if (!headers["Accept-Language"]) headers["Accept-Language"] = "de-DE,de;q=0.9,en;q=0.8";

  var response = null;
  try {
    response = await fetchv2(url, headers, options.method || "GET", options.body || null);
  } catch (e) {
    try {
      response = await fetch(url, { method: options.method || "GET", headers: headers, body: options.body || null });
    } catch (e2) {
      console.log("[s.to IP v3] request failed:", url, e2);
      return "";
    }
  }

  if (!response) return "";
  if (typeof response === "string") return response;
  try { if (typeof response.text === "function") return await response.text(); } catch (e3) {}
  try { return String(response); } catch (e4) { return ""; }
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

function __stoAbsolute(url) {
  if (!url) return "";
  url = String(url).trim();
  if (/^https?:\/\//i.test(url)) return __stoPatchText(url);
  if (url.indexOf("//") === 0) return "http:" + url;
  if (url.charAt(0) === "/") return TARGET_BASE + url;
  return TARGET_BASE + "/" + url;
}

function __stoSeriesHref(link) {
  if (!link) return "";
  link = String(link).trim();
  if (/^https?:\/\//i.test(link)) return __stoPatchText(link);
  if (link.indexOf("/serie/") === 0) return TARGET_BASE + link;
  if (link.indexOf("serie/") === 0) return TARGET_BASE + "/" + link;
  return TARGET_BASE + "/serie/" + link.replace(/^\/+/, "");
}

function __stoCleanText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&auml;/gi, "ä")
    .replace(/&ouml;/gi, "ö")
    .replace(/&uuml;/gi, "ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/gi, "ß")
    .replace(/\s+/g, " ")
    .trim();
}

function __stoGetAttr(tag, name) {
  var re = new RegExp(name + "=[\\\"']([^\\\"']*)[\\\"']", "i");
  var m = String(tag || "").match(re);
  return m ? m[1] : "";
}

function __stoRenameExport(source, name, replacement) {
  source = source.replace(new RegExp("async\\s+function\\s+" + name + "\\s*\\("), "async function " + replacement + "(");
  source = source.replace(new RegExp("function\\s+" + name + "\\s*\\("), "function " + replacement + "(");
  return source;
}

async function __stoEnsureBase() {
  if (__stoLoaded) return true;
  if (__stoLoading) return await __stoLoading;

  __stoLoading = (async function () {
    try {
      var source = await __stoRequestText(ORIGINAL_SCRIPT_URL, { headers: { "Accept": "text/plain" } });
      if (!source) return false;

      source = __stoPatchText(source);
      source = __stoRenameExport(source, "searchResults", "__stoUnusedSearchResults");
      source = __stoRenameExport(source, "extractDetails", "__stoBaseExtractDetails");
      source = __stoRenameExport(source, "extractEpisodes", "__stoBaseExtractEpisodes");
      source = __stoRenameExport(source, "extractStreamUrl", "__stoBaseExtractStreamUrl");
      source += "\n;__stoExports.details = (typeof __stoBaseExtractDetails === 'function') ? __stoBaseExtractDetails : null;";
      source += "\n;__stoExports.episodes = (typeof __stoBaseExtractEpisodes === 'function') ? __stoBaseExtractEpisodes : null;";
      source += "\n;__stoExports.stream = (typeof __stoBaseExtractStreamUrl === 'function') ? __stoBaseExtractStreamUrl : null;";

      eval(source);
      __stoLoaded = !!(__stoExports.details && __stoExports.episodes && __stoExports.stream);
      console.log("[s.to IP v3] original module loaded:", __stoLoaded);
      return __stoLoaded;
    } catch (error) {
      console.log("[s.to IP v3] base load error:", error);
      return false;
    } finally {
      __stoLoading = null;
    }
  })();

  return await __stoLoading;
}

async function searchResults(keyword) {
  try {
    console.log("[s.to IP v3] searching:", keyword);

    var html = await __stoRequestText(
      TARGET_BASE + "/suche?term=" + encodeURIComponent(keyword) + "&tab=shows",
      {
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "Referer": TARGET_BASE + "/"
        }
      }
    );

    if (!html) return JSON.stringify([]);

    var results = [];
    var seen = {};
    var anchorRegex = /<a\b([^>]*)href=["']([^"']*\/serie\/[^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
    var match;

    while ((match = anchorRegex.exec(html)) !== null) {
      var hrefRaw = match[2];
      var pathMatch = hrefRaw.match(/\/serie\/([^\/?#]+)\/?(?:[?#].*)?$/i);
      if (!pathMatch) continue;

      var slug = pathMatch[1];
      var href = TARGET_BASE + "/serie/" + slug;
      if (seen[href]) continue;

      var attrs = (match[1] || "") + " " + (match[3] || "");
      var inner = match[4] || "";

      var title = "";
      var hMatch = inner.match(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>/i);
      if (hMatch) title = __stoCleanText(hMatch[1]);
      if (!title) title = __stoCleanText(__stoGetAttr(attrs, "title"));

      var imgMatch = inner.match(/<img\b([^>]*)>/i);
      var image = "";
      if (imgMatch) {
        image = __stoGetAttr(imgMatch[1], "data-src") || __stoGetAttr(imgMatch[1], "src") || "";
        if (!title) title = __stoCleanText(__stoGetAttr(imgMatch[1], "alt"));
      }

      if (!title) title = __stoCleanText(inner);
      if (!title) title = slug.replace(/-/g, " ");

      seen[href] = true;
      results.push({
        title: title,
        image: image ? __stoAbsolute(image) : "",
        href: href
      });
    }

    console.log("[s.to IP v3] search results:", results.length);
    return JSON.stringify(results);
  } catch (error) {
    console.log("[s.to IP v3] search error:", error);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    if (!(await __stoEnsureBase())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
    return __stoPatchText(await __stoExports.details(__stoPatchText(url)));
  } catch (error) {
    console.log("[s.to IP v3] details error:", error);
    return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  }
}

async function extractEpisodes(url) {
  try {
    if (!(await __stoEnsureBase())) return JSON.stringify([]);
    return __stoPatchText(await __stoExports.episodes(__stoPatchText(url)));
  } catch (error) {
    console.log("[s.to IP v3] episodes error:", error);
    return JSON.stringify([]);
  }
}

function extractStreamUrl(html) {
  try {
    if (!__stoLoaded || !__stoExports.stream) return JSON.stringify([]);
    var result = __stoExports.stream(__stoPatchText(html));
    if (result && typeof result.then === "function") return JSON.stringify([]);
    return __stoPatchText(result);
  } catch (error) {
    console.log("[s.to IP v3] stream error:", error);
    return JSON.stringify([]);
  }
}
