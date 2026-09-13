const V7_SCRIPT_URL = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v7.js";
const STO_BASE = "https://serienstream.to";

// Fill these two values yourself. Do NOT commit credentials you care about.
const STO_LOGIN_EMAIL = "__PUT_EMAIL_HERE__";
const STO_LOGIN_PASSWORD = "__PUT_PASSWORD_HERE__";

var __v8Loaded = false;
var __v8Loading = null;
var __v8Cookie = "";
var __v8LoginAttempted = false;
var __v8 = {
  search: null,
  details: null,
  episodes: null,
  extractHosters: null,
  providerKey: null,
  multi: null
};

async function __v8ReadText(response) {
  if (!response) return "";
  if (typeof response === "string") return response;
  try { if (typeof response.text === "function") return await response.text(); } catch (e) {}
  try { return String(response); } catch (e2) { return ""; }
}

function __v8Header(headers, wanted) {
  if (!headers) return "";
  var lower = String(wanted || "").toLowerCase();
  try {
    if (typeof headers.get === "function") return headers.get(wanted) || headers.get(lower) || "";
  } catch (e) {}
  for (var k in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, k) && String(k).toLowerCase() === lower) {
      return String(headers[k] || "");
    }
  }
  return "";
}

function __v8MergeCookies(existing, setCookieHeader) {
  var jar = {};

  function addCookiePair(pair) {
    pair = String(pair || "").trim();
    if (!pair) return;
    var semi = pair.indexOf(";");
    if (semi !== -1) pair = pair.substring(0, semi);
    var eq = pair.indexOf("=");
    if (eq <= 0) return;
    var name = pair.substring(0, eq).trim();
    var value = pair.substring(eq + 1).trim();
    if (name) jar[name] = value;
  }

  String(existing || "").split(/;\s*/).forEach(addCookiePair);

  var raw = String(setCookieHeader || "");
  if (raw) {
    // Handles common collapsed Set-Cookie output while avoiding commas inside Expires=.
    var parts = raw.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g);
    for (var i = 0; i < parts.length; i++) addCookiePair(parts[i]);
  }

  var out = [];
  for (var key in jar) {
    if (Object.prototype.hasOwnProperty.call(jar, key)) out.push(key + "=" + jar[key]);
  }
  return out.join("; ");
}

function __v8CaptureCookies(response) {
  if (!response || typeof response === "string") return;
  var setCookie = __v8Header(response.headers, "set-cookie");
  if (setCookie) __v8Cookie = __v8MergeCookies(__v8Cookie, setCookie);
}

function __v8BaseHeaders(extra) {
  var headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    "Referer": STO_BASE + "/"
  };
  if (__v8Cookie) headers["Cookie"] = __v8Cookie;
  extra = extra || {};
  for (var k in extra) headers[k] = extra[k];
  return headers;
}

async function __v8Fetch(url, headers, method, body, followRedirects) {
  var finalHeaders = __v8BaseHeaders(headers || {});
  try {
    var response = await fetchv2(
      url,
      finalHeaders,
      method || "GET",
      body || null,
      followRedirects !== false
    );
    __v8CaptureCookies(response);
    return response;
  } catch (e) {
    try {
      var fallback = await fetch(url, {
        method: method || "GET",
        headers: finalHeaders,
        body: body || null
      });
      __v8CaptureCookies(fallback);
      return fallback;
    } catch (e2) {
      console.log("[SerienStream v8] request failed:", url, e2);
      return null;
    }
  }
}

function __v8FormEncode(obj) {
  var parts = [];
  for (var k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    if (obj[k] === null || obj[k] === undefined || obj[k] === "") continue;
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(obj[k])));
  }
  return parts.join("&");
}

function __v8HiddenValue(html, name) {
  var escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var a = new RegExp('<input\\b[^>]*name=["\\']' + escaped + '["\\'][^>]*value=["\\']([^"\\']*)["\\'][^>]*>', 'i');
  var b = new RegExp('<input\\b[^>]*value=["\\']([^"\\']*)["\\'][^>]*name=["\\']' + escaped + '["\\'][^>]*>', 'i');
  var m = String(html || "").match(a) || String(html || "").match(b);
  return m ? m[1] : "";
}

function __v8CredentialsConfigured() {
  return STO_LOGIN_EMAIL && STO_LOGIN_PASSWORD &&
    STO_LOGIN_EMAIL.indexOf("__PUT_") !== 0 &&
    STO_LOGIN_PASSWORD.indexOf("__PUT_") !== 0;
}

async function __v8Login() {
  if (__v8LoginAttempted) return !!__v8Cookie;
  __v8LoginAttempted = true;

  if (!__v8CredentialsConfigured()) {
    console.log("[SerienStream v8] login credentials not configured");
    return false;
  }

  try {
    var loginPageResponse = await __v8Fetch(
      STO_BASE + "/login",
      { "Accept": "text/html,application/xhtml+xml" },
      "GET",
      null,
      true
    );
    var loginHtml = await __v8ReadText(loginPageResponse);

    var payload = {
      email: STO_LOGIN_EMAIL,
      password: STO_LOGIN_PASSWORD,
      autoLogin: "on"
    };

    var tokenNames = ["_token", "csrf", "csrf_token", "_csrf"];
    for (var i = 0; i < tokenNames.length; i++) {
      var token = __v8HiddenValue(loginHtml, tokenNames[i]);
      if (token) payload[tokenNames[i]] = token;
    }

    var body = __v8FormEncode(payload);
    var loginResponse = await __v8Fetch(
      STO_BASE + "/login",
      {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml",
        "Origin": STO_BASE,
        "Referer": STO_BASE + "/login"
      },
      "POST",
      body,
      true
    );
    await __v8ReadText(loginResponse);

    // Verify with /account. Logged-in pages historically expose /home/logout.
    var accountResponse = await __v8Fetch(
      STO_BASE + "/account",
      { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE + "/" },
      "GET",
      null,
      true
    );
    var accountHtml = await __v8ReadText(accountResponse);
    var ok = /\/home\/logout|logout|abmelden/i.test(accountHtml);
    console.log("[SerienStream v8] login verified:", ok, "cookie chars:", __v8Cookie.length);
    return ok;
  } catch (error) {
    console.log("[SerienStream v8] login failed:", error);
    return false;
  }
}

function __v8Absolute(value, base) {
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

function __v8IsSto(url) {
  return /https?:\/\/(?:www\.)?(?:serienstream\.to|s\.to)(?:\/|$)/i.test(String(url || ""));
}

async function __v8ResolveHoster(hoster, episodeUrl) {
  var headers = {
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Referer": episodeUrl
  };

  // First request without redirects so a normal provider redirect is visible.
  var first = await __v8Fetch(hoster.href, headers, "GET", null, false);
  if (first && typeof first !== "string") {
    var status = Number(first.status || 0);
    var location = __v8Header(first.headers, "location");
    if (location && status >= 300 && status < 400) {
      var direct = __v8Absolute(location, hoster.href);
      if (!__v8IsSto(direct)) return direct;
    }
  }

  // Logged-in sessions may redirect normally only when redirects are followed.
  var followed = await __v8Fetch(hoster.href, headers, "GET", null, true);
  var html = await __v8ReadText(followed);

  var provider = String(hoster.provider || "").toLowerCase();
  var hints = [];
  if (provider.indexOf("voe") !== -1) hints = ["voe.", "voe.sx", "voe-unblock.com"];
  else if (provider.indexOf("vidmoly") !== -1) hints = ["vidmoly."];
  else if (provider.indexOf("dood") !== -1) hints = ["dood.", "doodstream.", "doodwatch.", "dood.to"];
  else if (provider.indexOf("filemoon") !== -1) hints = ["filemoon."];
  else if (provider.indexOf("vidoza") !== -1) hints = ["vidoza."];
  else if (provider.indexOf("speed") !== -1) hints = ["speedfiles.", "speedvideo."];
  else if (provider.indexOf("mp4upload") !== -1) hints = ["mp4upload."];

  var urls = String(html || "").match(/https?:\/\/[^"'<>\\s]+/gi) || [];
  for (var i = 0; i < urls.length; i++) {
    var candidate = urls[i].replace(/\\\//g, "/").replace(/&amp;/gi, "&");
    if (__v8IsSto(candidate)) continue;
    var lower = candidate.toLowerCase();
    for (var h = 0; h < hints.length; h++) {
      if (lower.indexOf(hints[h]) !== -1) return candidate;
    }
  }

  return "";
}

async function __v8Load() {
  if (__v8Loaded) return true;
  if (__v8Loading) return await __v8Loading;

  __v8Loading = (async function () {
    try {
      var sourceResponse = await __v8Fetch(V7_SCRIPT_URL, { "Accept": "text/plain" }, "GET", null, true);
      var source = await __v8ReadText(sourceResponse);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v7LegacyStream(");
      source += "\n;__v8.search = (typeof searchResults === 'function') ? searchResults : null;";
      source += "\n;__v8.details = (typeof extractDetails === 'function') ? extractDetails : null;";
      source += "\n;__v8.episodes = (typeof extractEpisodes === 'function') ? extractEpisodes : null;";
      source += "\n;__v8.extractHosters = (typeof __v7 !== 'undefined' && __v7) ? __v7.extractHosters : null;";
      source += "\n;__v8.providerKey = (typeof __v7 !== 'undefined' && __v7) ? __v7.providerKey : null;";
      source += "\n;__v8.multi = (typeof __v7 !== 'undefined' && __v7) ? __v7.multi : null;";
      eval(source);

      if (typeof __v7Load === "function") await __v7Load();
      if (typeof __v7 !== "undefined" && __v7) {
        if (!__v8.extractHosters) __v8.extractHosters = __v7.extractHosters;
        if (!__v8.providerKey) __v8.providerKey = __v7.providerKey;
        if (!__v8.multi) __v8.multi = __v7.multi;
      }

      __v8Loaded = !!(__v8.search && __v8.details && __v8.episodes && __v8.extractHosters && __v8.providerKey && __v8.multi);
      console.log("[SerienStream v8] loaded:", __v8Loaded);
      return __v8Loaded;
    } catch (error) {
      console.log("[SerienStream v8] load failed:", error);
      return false;
    } finally {
      __v8Loading = null;
    }
  })();

  return await __v8Loading;
}

async function searchResults(keyword) {
  if (!(await __v8Load())) return JSON.stringify([]);
  try { return await __v8.search(keyword); }
  catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v8Load())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  try { return await __v8.details(url); }
  catch (e) { return JSON.stringify([{ description: "", aliases: "", airdate: "" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v8Load())) return JSON.stringify([]);
  try { return await __v8.episodes(url); }
  catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  try {
    if (!(await __v8Load())) return JSON.stringify({ streams: [], subtitles: [] });

    await __v8Login();

    var episodeUrl = String(url || "").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i, STO_BASE);
    var episodeResponse = await __v8Fetch(
      episodeUrl,
      { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE + "/" },
      "GET",
      null,
      true
    );
    var html = await __v8ReadText(episodeResponse);
    if (!html) return JSON.stringify({ streams: [], subtitles: [] });

    var hosters = __v8.extractHosters(html) || [];
    if (!hosters.length) return JSON.stringify({ streams: [], subtitles: [] });

    var preferred = ["VOE", "SpeedFiles", "Vidmoly", "DoodStream", "Vidoza", "MP4Upload", "FileMoon"];
    hosters.sort(function (a, b) {
      var ai = preferred.indexOf(a.provider); if (ai < 0) ai = 999;
      var bi = preferred.indexOf(b.provider); if (bi < 0) bi = 999;
      return ai - bi;
    });

    var providerMap = {};
    for (var i = 0; i < hosters.length; i++) {
      var directUrl = await __v8ResolveHoster(hosters[i], episodeUrl);
      if (!directUrl) continue;
      providerMap[directUrl] = __v8.providerKey(hosters[i].provider);
    }

    if (!Object.keys(providerMap).length) {
      console.log("[SerienStream v8] login/session produced no external provider redirects");
      return JSON.stringify({ streams: [], subtitles: [] });
    }

    var streams = await __v8.multi(providerMap);
    if (Array.isArray(streams) && streams.length > 0) {
      return JSON.stringify({ streams: streams, subtitles: [] });
    }

    return JSON.stringify({ streams: [], subtitles: [] });
  } catch (error) {
    console.log("[SerienStream v8] stream failed:", error);
    return JSON.stringify({ streams: [], subtitles: [] });
  }
}
