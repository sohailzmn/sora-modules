const TARGET_BASE = "https://serienstream.to";
const ORIGINAL_SCRIPT_URL = "https://git.luna-app.eu/Cufiy/sora-modules/raw/branch/main/modules/s.to/js/s.to_GER.js";

var __stoLoaded = false;
var __stoLoading = null;
var __stoExports = {
  details: null,
  episodes: null,
  legacyStream: null,
  multi: null
};

async function __stoRequest(url, options) {
  options = options || {};
  var headers = options.headers || {};

  if (!headers["User-Agent"]) {
    headers["User-Agent"] = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
  }
  if (!headers["Accept-Language"]) {
    headers["Accept-Language"] = "de-DE,de;q=0.9,en;q=0.8";
  }

  try {
    return await fetchv2(
      url,
      headers,
      options.method || "GET",
      options.body || null
    );
  } catch (e) {
    try {
      return await fetch(url, {
        method: options.method || "GET",
        headers: headers,
        body: options.body || null
      });
    } catch (e2) {
      console.log("[SerienStream v5] request failed:", url, e2);
      return null;
    }
  }
}

async function __stoReadText(response) {
  if (!response) return "";
  if (typeof response === "string") return response;

  try {
    if (typeof response.text === "function") {
      return await response.text();
    }
  } catch (e) {}

  try {
    return String(response);
  } catch (e2) {
    return "";
  }
}

async function __stoRequestText(url, options) {
  return await __stoReadText(await __stoRequest(url, options));
}

async function __stoFetchPage(url, options) {
  var response = await __stoRequest(url, options);
  if (!response) return { text: "", finalUrl: url };

  var finalUrl = url;

  if (typeof response !== "string") {
    try {
      if (response.url && typeof response.url === "string") {
        finalUrl = response.url;
      }
    } catch (e) {}
  }

  return {
    text: await __stoReadText(response),
    finalUrl: finalUrl
  };
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
    .replace(/http:\/\/186\.2\.175\.5/gi, TARGET_BASE)
    .replace(/https:\/\/186\.2\.175\.5/gi, TARGET_BASE);
}

function __stoAbsolute(url) {
  if (!url) return "";

  url = String(url).trim();

  if (/^https?:\/\//i.test(url)) return __stoPatchText(url);
  if (url.indexOf("//") === 0) return "https:" + url;
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
  var match = String(tag || "").match(re);
  return match ? match[1] : "";
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
        console.log("[SerienStream v5] original module could not be loaded");
        return false;
      }

      source = __stoPatchText(source);

      source = __stoRenameExport(source, "searchResults", "__stoUnusedSearchResults");
      source = __stoRenameExport(source, "extractDetails", "__stoBaseExtractDetails");
      source = __stoRenameExport(source, "extractEpisodes", "__stoBaseExtractEpisodes");
      source = __stoRenameExport(source, "extractStreamUrl", "__stoBaseExtractStreamUrl");

      source += "\n;__stoExports.details = (typeof __stoBaseExtractDetails === 'function') ? __stoBaseExtractDetails : null;";
      source += "\n;__stoExports.episodes = (typeof __stoBaseExtractEpisodes === 'function') ? __stoBaseExtractEpisodes : null;";
      source += "\n;__stoExports.legacyStream = (typeof __stoBaseExtractStreamUrl === 'function') ? __stoBaseExtractStreamUrl : null;";
      source += "\n;__stoExports.multi = (typeof multiExtractor === 'function') ? multiExtractor : null;";

      eval(source);

      __stoLoaded = !!(
        __stoExports.details &&
        __stoExports.episodes &&
        __stoExports.multi
      );

      console.log("[SerienStream v5] legacy helpers loaded:", __stoLoaded);
      return __stoLoaded;
    } catch (error) {
      console.log("[SerienStream v5] base load error:", error);
      return false;
    } finally {
      __stoLoading = null;
    }
  })();

  return await __stoLoading;
}

async function searchResults(keyword) {
  try {
    var html = await __stoRequestText(
      TARGET_BASE + "/suche?term=" + encodeURIComponent(keyword),
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

      var image = "";
      var imgMatch = inner.match(/<img\b([^>]*)>/i);
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

    return JSON.stringify(results);
  } catch (error) {
    console.log("[SerienStream v5] search error:", error);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    if (await __stoEnsureBase()) {
      return __stoPatchText(await __stoExports.details(__stoPatchText(url)));
    }
  } catch (error) {
    console.log("[SerienStream v5] details error:", error);
  }

  return JSON.stringify([{
    description: "",
    aliases: "",
    airdate: ""
  }]);
}

async function extractEpisodes(url) {
  try {
    if (await __stoEnsureBase()) {
      return __stoPatchText(await __stoExports.episodes(__stoPatchText(url)));
    }
  } catch (error) {
    console.log("[SerienStream v5] episodes error:", error);
  }

  return JSON.stringify([]);
}

function __stoExtractHosters(html) {
  var hosters = [];
  var seen = {};

  // Current SerienStream markup (2026):
  // data-play-url="/r?t=..."
  // data-provider-name="VOE"
  // data-language-label="Deutsch"
  var tagRegex = /<[^>]+data-play-url=["'][^"']+["'][^>]*>/gi;
  var match;

  while ((match = tagRegex.exec(html)) !== null) {
    var tag = match[0];
    var playUrl = __stoGetAttr(tag, "data-play-url");
    var provider = __stoGetAttr(tag, "data-provider-name") || __stoGetAttr(tag, "title") || "Hoster";
    var language = __stoGetAttr(tag, "data-language-label");

    if (!playUrl) continue;

    var normalizedLanguage = String(language || "").toLowerCase();
    if (
      normalizedLanguage &&
      normalizedLanguage.indexOf("deutsch") === -1 &&
      normalizedLanguage.indexOf("german") === -1
    ) {
      continue;
    }

    var absolute = __stoAbsolute(playUrl);
    var key = provider.toLowerCase() + "|" + absolute;
    if (seen[key]) continue;
    seen[key] = true;

    hosters.push({
      provider: provider,
      href: absolute,
      language: language || "Deutsch"
    });
  }

  return hosters;
}

function __stoExtractSimpleRedirect(html) {
  if (!html) return "";

  var patterns = [
    /window\.location\.href\s*=\s*["']([^"']+)["']/i,
    /location\.href\s*=\s*["']([^"']+)["']/i,
    /window\.location\s*=\s*["']([^"']+)["']/i,
    /location\.replace\(\s*["']([^"']+)["']\s*\)/i,
    /document\.location\.href\s*=\s*["']([^"']+)["']/i,
    /<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url\s*=\s*([^"'>\s]+)[^"']*["'][^>]*>/i
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = html.match(patterns[i]);
    if (match && match[1]) return match[1];
  }

  return "";
}

function __stoIsSerienStreamUrl(url) {
  return /https?:\/\/(?:www\.)?serienstream\.to(?:\/|$)/i.test(String(url || ""));
}

async function __stoResolveProviderRedirect(hoster) {
  try {
    var page = await __stoFetchPage(hoster.href, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,*/*",
        "Referer": TARGET_BASE + "/"
      }
    });

    if (page.finalUrl && !__stoIsSerienStreamUrl(page.finalUrl)) {
      return page.finalUrl;
    }

    var simpleRedirect = __stoExtractSimpleRedirect(page.text);
    if (simpleRedirect) {
      if (/^https?:\/\//i.test(simpleRedirect)) return simpleRedirect;
      if (simpleRedirect.indexOf("//") === 0) return "https:" + simpleRedirect;
      return __stoAbsolute(simpleRedirect);
    }

    // Keep the /r?t= URL as fallback. The legacy provider extractor may
    // still be able to follow the ordinary HTTP redirect itself.
    return hoster.href;
  } catch (error) {
    console.log("[SerienStream v5] redirect resolution failed:", hoster.provider, error);
    return hoster.href;
  }
}

function __stoProviderKey(name) {
  var value = String(name || "").trim().toLowerCase();

  if (value === "doodstream") return "doodstream";
  if (value === "filemoon") return "filemoon";
  if (value === "speedfiles") return "speedfiles";
  if (value === "mp4upload") return "mp4upload";
  if (value === "vidmoly") return "vidmoly";
  if (value === "vidoza") return "vidoza";
  if (value === "voe") return "voe";

  return value;
}

async function extractStreamUrl(url) {
  try {
    if (!(await __stoEnsureBase())) {
      return JSON.stringify({ streams: [], subtitles: [] });
    }

    var episodeUrl = __stoPatchText(url);
    var html = await __stoRequestText(episodeUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "Referer": TARGET_BASE + "/"
      }
    });

    if (!html) {
      return JSON.stringify({ streams: [], subtitles: [] });
    }

    var hosters = __stoExtractHosters(html);
    console.log("[SerienStream v5] German hosters:", hosters.length);

    if (hosters.length === 0) {
      // Last compatibility fallback to the original resolver.
      if (__stoExports.legacyStream) {
        try {
          return __stoPatchText(await __stoExports.legacyStream(episodeUrl));
        } catch (legacyError) {
          console.log("[SerienStream v5] legacy stream fallback failed:", legacyError);
        }
      }
      return JSON.stringify({ streams: [], subtitles: [] });
    }

    var preferred = ["VOE", "SpeedFiles", "Vidmoly", "DoodStream", "Vidoza", "MP4Upload", "FileMoon"];
    hosters.sort(function (a, b) {
      var ai = preferred.indexOf(a.provider);
      var bi = preferred.indexOf(b.provider);
      if (ai < 0) ai = 999;
      if (bi < 0) bi = 999;
      return ai - bi;
    });

    var providerMap = {};

    for (var i = 0; i < hosters.length; i++) {
      var hoster = hosters[i];
      var providerUrl = await __stoResolveProviderRedirect(hoster);
      if (!providerUrl) continue;

      providerMap[providerUrl] = __stoProviderKey(hoster.provider);
    }

    console.log("[SerienStream v5] provider map:", JSON.stringify(providerMap));

    var streams = await __stoExports.multi(providerMap);

    if (Array.isArray(streams) && streams.length > 0) {
      console.log("[SerienStream v5] playable streams:", streams.length);
      return JSON.stringify({
        streams: streams,
        subtitles: []
      });
    }

    console.log("[SerienStream v5] no playable streams resolved");
    return JSON.stringify({ streams: [], subtitles: [] });
  } catch (error) {
    console.log("[SerienStream v5] stream error:", error);
    return JSON.stringify({ streams: [], subtitles: [] });
  }
}
