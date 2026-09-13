const V7_SCRIPT_URL = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v7.js";
const STO_BASE = "https://serienstream.to";

// Intentionally left blank in the public repository.
// If you choose to use a throwaway account, fill these yourself.
const STO_LOGIN_EMAIL = "__PUT_EMAIL_HERE__";
const STO_LOGIN_PASSWORD = "__PUT_PASSWORD_HERE__";

var __v9Loaded = false;
var __v9Loading = null;
var __v9Cookie = "";
var __v9LoginAttempted = false;
var __v9 = {
  search: null,
  details: null,
  episodes: null,
  extractHosters: null,
  providerKey: null,
  multi: null
};

async function __v9ReadText(response) {
  if (!response) return "";
  if (typeof response === "string") return response;
  try {
    if (typeof response.text === "function") return await response.text();
  } catch (e) {}
  try { return String(response); } catch (e2) { return ""; }
}

function __v9Header(headers, wanted) {
  if (!headers) return "";
  var lower = String(wanted || "").toLowerCase();
  try {
    if (typeof headers.get === "function") {
      return headers.get(wanted) || headers.get(lower) || "";
    }
  } catch (e) {}

  for (var key in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, key) && String(key).toLowerCase() === lower) {
      return String(headers[key] || "");
    }
  }
  return "";
}

function __v9MergeCookies(existing, setCookieHeader) {
  var jar = {};

  function add(pair) {
    pair = String(pair || "").trim();
    if (!pair) return;
    var semi = pair.indexOf(";");
    if (semi >= 0) pair = pair.substring(0, semi);
    var eq = pair.indexOf("=");
    if (eq <= 0) return;
    jar[pair.substring(0, eq).trim()] = pair.substring(eq + 1).trim();
  }

  String(existing || "").split(/;\s*/).forEach(add);

  var raw = String(setCookieHeader || "");
  if (raw) {
    var pieces = raw.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g);
    for (var i = 0; i < pieces.length; i++) add(pieces[i]);
  }

  var out = [];
  for (var name in jar) {
    if (Object.prototype.hasOwnProperty.call(jar, name)) out.push(name + "=" + jar[name]);
  }
  return out.join("; ");
}

function __v9CaptureCookies(response) {
  if (!response || typeof response === "string") return;
  var setCookie = __v9Header(response.headers, "set-cookie");
  if (setCookie) __v9Cookie = __v9MergeCookies(__v9Cookie, setCookie);
}

function __v9Headers(extra) {
  var headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    "Referer": STO_BASE + "/"
  };
  if (__v9Cookie) headers["Cookie"] = __v9Cookie;

  extra = extra || {};
  for (var key in extra) headers[key] = extra[key];
  return headers;
}

async function __v9Fetch(url, headers, method, body, followRedirects) {
  var finalHeaders = __v9Headers(headers || {});
  try {
    var response = await fetchv2(
      url,
      finalHeaders,
      method || "GET",
      body || null,
      followRedirects !== false
    );
    __v9CaptureCookies(response);
    return response;
  } catch (e) {
    try {
      var fallback = await fetch(url, {
        method: method || "GET",
        headers: finalHeaders,
        body: body || null
      });
      __v9CaptureCookies(fallback);
      return fallback;
    } catch (e2) {
      console.log("[SerienStream v9] request failed:", url, e2);
      return null;
    }
  }
}

function __v9FormEncode(obj) {
  var parts = [];
  for (var key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    if (obj[key] === null || obj[key] === undefined || obj[key] === "") continue;
    parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(obj[key])));
  }
  return parts.join("&");
}

function __v9HiddenValue(html, name) {
  var escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var q = "[\\\"']";
  var patternA = "<input\\b[^>]*name=" + q + escaped + q + "[^>]*value=" + q + "([^\\\"']*)" + q + "[^>]*>";
  var patternB = "<input\\b[^>]*value=" + q + "([^\\\"']*)" + q + "[^>]*name=" + q + escaped + q + "[^>]*>";
  var m = String(html || "").match(new RegExp(patternA, "i")) || String(html || "").match(new RegExp(patternB, "i"));
  return m ? m[1] : "";
}

function __v9CredentialsConfigured() {
  return !!(
    STO_LOGIN_EMAIL &&
    STO_LOGIN_PASSWORD &&
    STO_LOGIN_EMAIL.indexOf("__PUT_") !== 0 &&
    STO_LOGIN_PASSWORD.indexOf("__PUT_") !== 0
  );
}

async function __v9Login() {
  if (__v9LoginAttempted) return !!__v9Cookie;
  __v9LoginAttempted = true;

  if (!__v9CredentialsConfigured()) {
    console.log("[SerienStream v9] credentials not configured");
    return false;
  }

  try {
    var pageResponse = await __v9Fetch(
      STO_BASE + "/login",
      { "Accept": "text/html,application/xhtml+xml" },
      "GET",
      null,
      true
    );
    var pageHtml = await __v9ReadText(pageResponse);

    var payload = {
      email: STO_LOGIN_EMAIL,
      password: STO_LOGIN_PASSWORD,
      autoLogin: "on"
    };

    var tokenNames = ["_token", "csrf", "csrf_token", "_csrf"];
    for (var i = 0; i < tokenNames.length; i++) {
      var token = __v9HiddenValue(pageHtml, tokenNames[i]);
      if (token) payload[tokenNames[i]] = token;
    }

    var loginResponse = await __v9Fetch(
      STO_BASE + "/login",
      {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml",
        "Origin": STO_BASE,
        "Referer": STO_BASE + "/login"
      },
      "POST",
      __v9FormEncode(payload),
      true
    );
    await __v9ReadText(loginResponse);

    var verifyResponse = await __v9Fetch(
      STO_BASE + "/account",
      { "Accept": "text/html,application/xhtml+xml" },
      "GET",
      null,
      true
    );
    var verifyHtml = await __v9ReadText(verifyResponse);
    var ok = /\/home\/logout|logout|abmelden/i.test(verifyHtml);
    console.log("[SerienStream v9] login verified:", ok, "cookie chars:", __v9Cookie.length);
    return ok;
  } catch (error) {
    console.log("[SerienStream v9] login failed:", error);
    return false;
  }
}

function __v9Absolute(value, base) {
  if (!value) return "";
  value = String(value).trim().replace(/&amp;/gi, "&");
  base = base || STO_BASE;

  if (/^https?:\/\//i.test(value)) return value;
  if (value.indexOf("//") === 0) return "https:" + value;

  var originMatch = String(base).match(/^(https?:\/\/[^\/]+)/i);
  var origin = originMatch ? originMatch[1] : STO_BASE;
  if (value.charAt(0) === "/") return origin + value;

  var clean = String(base).split("#")[0].split("?")[0];
  var slash = clean.lastIndexOf("/");
  var dir = slash > clean.indexOf("://") + 2 ? clean.substring(0, slash + 1) : clean + "/";
  return dir + value;
}

function __v9IsSto(url) {
  return /https?:\/\/(?:www\.)?(?:serienstream\.to|s\.to)(?:\/|$)/i.test(String(url || ""));
}

async function __v9ResolveHoster(hoster, episodeUrl) {
  var headers = {
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Referer": episodeUrl
  };

  var first = await __v9Fetch(hoster.href, headers, "GET", null, false);
  if (first && typeof first !== "string") {
    var status = Number(first.status || 0);
    var location = __v9Header(first.headers, "location");
    if (location && status >= 300 && status < 400) {
      var direct = __v9Absolute(location, hoster.href);
      if (!__v9IsSto(direct)) return direct;
    }
  }

  var followed = await __v9Fetch(hoster.href, headers, "GET", null, true);
  var html = await __v9ReadText(followed);

  var provider = String(hoster.provider || "").toLowerCase();
  var hints = [];
  if (provider.indexOf("voe") !== -1) hints = ["voe.", "voe.sx", "voe-unblock.com"];
  else if (provider.indexOf("vidmoly") !== -1) hints = ["vidmoly."];
  else if (provider.indexOf("dood") !== -1) hints = ["dood.", "doodstream.", "doodwatch.", "dood.to"];
  else if (provider.indexOf("filemoon") !== -1) hints = ["filemoon."];
  else if (provider.indexOf("vidoza") !== -1) hints = ["vidoza."];
  else if (provider.indexOf("speed") !== -1) hints = ["speedfiles.", "speedvideo."];
  else if (provider.indexOf("mp4upload") !== -1) hints = ["mp4upload."];

  var urls = String(html || "").match(/https?:\/\/[^\"'<>\\s]+/gi) || [];
  for (var j = 0; j < urls.length; j++) {
    var candidate = urls[j].replace(/\\\//g, "/").replace(/&amp;/gi, "&");
    if (__v9IsSto(candidate)) continue;
    var lower = candidate.toLowerCase();
    for (var h = 0; h < hints.length; h++) {
      if (lower.indexOf(hints[h]) !== -1) return candidate;
    }
  }

  return "";
}

async function __v9Load() {
  if (__v9Loaded) return true;
  if (__v9Loading) return await __v9Loading;

  __v9Loading = (async function () {
    try {
      var sourceResponse = await __v9Fetch(V7_SCRIPT_URL, { "Accept": "text/plain" }, "GET", null, true);
      var source = await __v9ReadText(sourceResponse);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v7LegacyStream(");
      source += "\n;__v9.search = (typeof searchResults === 'function') ? searchResults : null;";
      source += "\n;__v9.details = (typeof extractDetails === 'function') ? extractDetails : null;";
      source += "\n;__v9.episodes = (typeof extractEpisodes === 'function') ? extractEpisodes : null;";
      source += "\n;__v9.extractHosters = (typeof __v7 !== 'undefined' && __v7) ? __v7.extractHosters : null;";
      source += "\n;__v9.providerKey = (typeof __v7 !== 'undefined' && __v7) ? __v7.providerKey : null;";
      source += "\n;__v9.multi = (typeof __v7 !== 'undefined' && __v7) ? __v7.multi : null;";
      eval(source);

      if (typeof __v7Load === "function") await __v7Load();
      if (typeof __v7 !== "undefined" && __v7) {
        if (!__v9.extractHosters) __v9.extractHosters = __v7.extractHosters;
        if (!__v9.providerKey) __v9.providerKey = __v7.providerKey;
        if (!__v9.multi) __v9.multi = __v7.multi;
      }

      __v9Loaded = !!(__v9.search && __v9.details && __v9.episodes && __v9.extractHosters && __v9.providerKey && __v9.multi);
      console.log("[SerienStream v9] loaded:", __v9Loaded);
      return __v9Loaded;
    } catch (error) {
      console.log("[SerienStream v9] load failed:", error);
      return false;
    } finally {
      __v9Loading = null;
    }
  })();

  return await __v9Loading;
}

async function searchResults(keyword) {
  if (!(await __v9Load())) return JSON.stringify([]);
  try { return await __v9.search(keyword); }
  catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v9Load())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  try { return await __v9.details(url); }
  catch (e) { return JSON.stringify([{ description: "", aliases: "", airdate: "" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v9Load())) return JSON.stringify([]);
  try { return await __v9.episodes(url); }
  catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  try {
    if (!(await __v9Load())) return JSON.stringify({ streams: [], subtitles: [] });

    await __v9Login();

    var episodeUrl = String(url || "").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i, STO_BASE);
    var episodeResponse = await __v9Fetch(
      episodeUrl,
      { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE + "/" },
      "GET",
      null,
      true
    );
    var html = await __v9ReadText(episodeResponse);
    if (!html) return JSON.stringify({ streams: [], subtitles: [] });

    var hosters = __v9.extractHosters(html) || [];
    if (!hosters.length) return JSON.stringify({ streams: [], subtitles: [] });

    var preferred = ["VOE", "SpeedFiles", "Vidmoly", "DoodStream", "Vidoza", "MP4Upload", "FileMoon"];
    hosters.sort(function (a, b) {
      var ai = preferred.indexOf(a.provider); if (ai < 0) ai = 999;
      var bi = preferred.indexOf(b.provider); if (bi < 0) bi = 999;
      return ai - bi;
    });

    var providerMap = {};
    for (var i = 0; i < hosters.length; i++) {
      var directUrl = await __v9ResolveHoster(hosters[i], episodeUrl);
      if (!directUrl) continue;
      providerMap[directUrl] = __v9.providerKey(hosters[i].provider);
    }

    if (!Object.keys(providerMap).length) {
      console.log("[SerienStream v9] login/session produced no external provider redirects");
      return JSON.stringify({ streams: [], subtitles: [] });
    }

    var streams = await __v9.multi(providerMap);
    if (Array.isArray(streams) && streams.length > 0) {
      return JSON.stringify({ streams: streams, subtitles: [] });
    }

    return JSON.stringify({ streams: [], subtitles: [] });
  } catch (error) {
    console.log("[SerienStream v9] stream failed:", error);
    return JSON.stringify({ streams: [], subtitles: [] });
  }
}
