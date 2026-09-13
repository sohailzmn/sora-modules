const V9_SCRIPT_URL = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v9.js?rev=20260913-1639";
const STO_BASE_V10 = "https://serienstream.to";

var __v10Loaded = false;
var __v10Loading = null;
var __v10LoggedIn = false;
var __v10 = {
  search: null,
  details: null,
  episodes: null,
  extractHosters: null,
  providerKey: null,
  multi: null,
  fetch: null,
  read: null,
  header: null,
  absolute: null,
  isSto: null,
  formEncode: null,
  hiddenValue: null,
  getCredentials: null
};

async function __v10RawText(url) {
  try {
    var response = await fetchv2(url, { "Accept": "text/plain" }, "GET", null, true);
    if (!response) return "";
    if (typeof response === "string") return response;
    if (typeof response.text === "function") return await response.text();
    return String(response || "");
  } catch (e) {
    try {
      var fallback = await fetch(url, { "Accept": "text/plain" });
      if (typeof fallback === "string") return fallback;
      if (fallback && typeof fallback.text === "function") return await fallback.text();
      return String(fallback || "");
    } catch (e2) {
      console.log("[SerienStream v10] could not load v9:", e2);
      return "";
    }
  }
}

function __v10LooksLoggedIn(html) {
  return /\/home\/logout|\blogout\b|\babmelden\b|\/account(?:\/|[\"'])/i.test(String(html || ""));
}

function __v10ExternalFromHtml(html, provider) {
  html = String(html || "");
  var p = String(provider || "").toLowerCase();
  var hints = [];
  if (p.indexOf("voe") !== -1) hints = ["voe.", "voe.sx", "voe-unblock.com"];
  else if (p.indexOf("vidmoly") !== -1) hints = ["vidmoly."];
  else if (p.indexOf("dood") !== -1) hints = ["dood.", "doodstream.", "doodwatch.", "dood.to"];
  else if (p.indexOf("filemoon") !== -1) hints = ["filemoon."];
  else if (p.indexOf("vidoza") !== -1) hints = ["vidoza."];
  else if (p.indexOf("speed") !== -1) hints = ["speedfiles.", "speedvideo."];
  else if (p.indexOf("mp4upload") !== -1) hints = ["mp4upload."];

  var patterns = [
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,
    /location\.href\s*=\s*["']([^"']+)["']/gi,
    /location\.replace\(\s*["']([^"']+)["']\s*\)/gi,
    /<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url\s*=\s*([^"'>\s]+)[^"']*["'][^>]*>/gi,
    /<iframe\b[^>]*src=["']([^"']+)["']/gi
  ];

  var candidates = [];
  for (var i = 0; i < patterns.length; i++) {
    var m;
    while ((m = patterns[i].exec(html)) !== null) candidates.push(m[1]);
  }
  var abs = /https?:\/\/[^"'<>\\s]+/gi;
  var a;
  while ((a = abs.exec(html)) !== null) candidates.push(a[0]);

  for (var c = 0; c < candidates.length; c++) {
    var candidate = String(candidates[c] || "").replace(/\\\//g, "/").replace(/&amp;/gi, "&");
    if (!/^https?:\/\//i.test(candidate)) continue;
    if (__v10.isSto && __v10.isSto(candidate)) continue;
    var lower = candidate.toLowerCase();
    for (var h = 0; h < hints.length; h++) {
      if (lower.indexOf(hints[h]) !== -1) return candidate;
    }
  }
  return "";
}

async function __v10Load() {
  if (__v10Loaded) return true;
  if (__v10Loading) return await __v10Loading;

  __v10Loading = (async function () {
    try {
      var source = await __v10RawText(V9_SCRIPT_URL);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v9LegacyStream(");
      source += "\n;__v10.search = (typeof searchResults === 'function') ? searchResults : null;";
      source += "\n;__v10.details = (typeof extractDetails === 'function') ? extractDetails : null;";
      source += "\n;__v10.episodes = (typeof extractEpisodes === 'function') ? extractEpisodes : null;";
      source += "\n;__v10.fetch = (typeof __v9Fetch === 'function') ? __v9Fetch : null;";
      source += "\n;__v10.read = (typeof __v9ReadText === 'function') ? __v9ReadText : null;";
      source += "\n;__v10.header = (typeof __v9Header === 'function') ? __v9Header : null;";
      source += "\n;__v10.absolute = (typeof __v9Absolute === 'function') ? __v9Absolute : null;";
      source += "\n;__v10.isSto = (typeof __v9IsSto === 'function') ? __v9IsSto : null;";
      source += "\n;__v10.formEncode = (typeof __v9FormEncode === 'function') ? __v9FormEncode : null;";
      source += "\n;__v10.hiddenValue = (typeof __v9HiddenValue === 'function') ? __v9HiddenValue : null;";
      source += "\n;__v10.getCredentials = function(){ return { email: STO_LOGIN_EMAIL, password: STO_LOGIN_PASSWORD }; };";
      source += "\n;__v10.extractHosters = (typeof __v9 !== 'undefined' && __v9) ? __v9.extractHosters : null;";
      source += "\n;__v10.providerKey = (typeof __v9 !== 'undefined' && __v9) ? __v9.providerKey : null;";
      source += "\n;__v10.multi = (typeof __v9 !== 'undefined' && __v9) ? __v9.multi : null;";

      eval(source);

      if (typeof __v9Load === "function") await __v9Load();
      if (typeof __v9 !== "undefined" && __v9) {
        if (!__v10.extractHosters) __v10.extractHosters = __v9.extractHosters;
        if (!__v10.providerKey) __v10.providerKey = __v9.providerKey;
        if (!__v10.multi) __v10.multi = __v9.multi;
      }

      __v10Loaded = !!(
        __v10.search && __v10.details && __v10.episodes &&
        __v10.extractHosters && __v10.providerKey && __v10.multi &&
        __v10.fetch && __v10.read && __v10.header && __v10.absolute &&
        __v10.formEncode && __v10.hiddenValue && __v10.getCredentials
      );
      console.log("[SerienStream v10] loaded:", __v10Loaded);
      return __v10Loaded;
    } catch (error) {
      console.log("[SerienStream v10] load failed:", error);
      return false;
    } finally {
      __v10Loading = null;
    }
  })();

  return await __v10Loading;
}

async function __v10FollowInternalRedirects(startUrl, referer, maxHops) {
  var current = startUrl;
  var lastHtml = "";

  for (var i = 0; i < (maxHops || 5); i++) {
    var response = await __v10.fetch(
      current,
      { "Accept": "text/html,application/xhtml+xml,*/*", "Referer": referer || STO_BASE_V10 + "/" },
      "GET",
      null,
      false
    );
    if (!response) return { external: "", html: lastHtml, url: current, status: 0 };

    var status = Number(response.status || 0);
    var location = __v10.header(response.headers, "location");
    lastHtml = await __v10.read(response);

    if (location && status >= 300 && status < 400) {
      var next = __v10.absolute(location, current);
      if (!(__v10.isSto && __v10.isSto(next))) {
        return { external: next, html: lastHtml, url: current, status: status };
      }
      referer = current;
      current = next;
      continue;
    }

    return { external: "", html: lastHtml, url: current, status: status };
  }

  return { external: "", html: lastHtml, url: current, status: 0 };
}

async function __v10Login() {
  if (__v10LoggedIn) return true;
  var creds = __v10.getCredentials ? __v10.getCredentials() : null;
  if (!creds || !creds.email || !creds.password || String(creds.email).indexOf("__PUT_") === 0) {
    console.log("[SerienStream v10] credentials missing in v9");
    return false;
  }

  try {
    var pageResponse = await __v10.fetch(
      STO_BASE_V10 + "/login",
      { "Accept": "text/html,application/xhtml+xml" },
      "GET",
      null,
      false
    );
    var pageHtml = await __v10.read(pageResponse);
    if (__v10LooksLoggedIn(pageHtml)) {
      __v10LoggedIn = true;
      return true;
    }

    var payload = {
      email: creds.email,
      password: creds.password,
      autoLogin: "on"
    };
    var tokenNames = ["_token", "csrf", "csrf_token", "_csrf"];
    for (var i = 0; i < tokenNames.length; i++) {
      var token = __v10.hiddenValue(pageHtml, tokenNames[i]);
      if (token) payload[tokenNames[i]] = token;
    }

    var loginResponse = await __v10.fetch(
      STO_BASE_V10 + "/login",
      {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml",
        "Origin": STO_BASE_V10,
        "Referer": STO_BASE_V10 + "/login"
      },
      "POST",
      __v10.formEncode(payload),
      false
    );

    var loginStatus = Number((loginResponse && loginResponse.status) || 0);
    var loginLocation = loginResponse ? __v10.header(loginResponse.headers, "location") : "";
    var loginHtml = await __v10.read(loginResponse);

    if (__v10LooksLoggedIn(loginHtml)) {
      __v10LoggedIn = true;
      return true;
    }

    if (loginLocation && loginStatus >= 300 && loginStatus < 400) {
      var landing = __v10.absolute(loginLocation, STO_BASE_V10 + "/login");
      if (__v10.isSto && __v10.isSto(landing)) {
        var landingResult = await __v10FollowInternalRedirects(landing, STO_BASE_V10 + "/login", 4);
        if (__v10LooksLoggedIn(landingResult.html)) {
          __v10LoggedIn = true;
          return true;
        }
      }
    }

    var verify = await __v10.fetch(
      STO_BASE_V10 + "/account",
      { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE_V10 + "/" },
      "GET",
      null,
      false
    );
    var verifyStatus = Number((verify && verify.status) || 0);
    var verifyLocation = verify ? __v10.header(verify.headers, "location") : "";
    var verifyHtml = await __v10.read(verify);

    __v10LoggedIn = __v10LooksLoggedIn(verifyHtml) ||
      (verifyStatus === 200 && !(verifyLocation && /\/login(?:\?|$)/i.test(verifyLocation)));

    console.log("[SerienStream v10] login status:", __v10LoggedIn, "http:", loginStatus, "verify:", verifyStatus);
    return __v10LoggedIn;
  } catch (error) {
    console.log("[SerienStream v10] login failed:", error);
    return false;
  }
}

async function __v10ResolveHoster(hoster, episodeUrl) {
  try {
    var chain = await __v10FollowInternalRedirects(hoster.href, episodeUrl, 6);
    if (chain.external) return chain.external;

    var inferred = __v10ExternalFromHtml(chain.html, hoster.provider);
    if (inferred) return inferred;

    console.log("[SerienStream v10] provider stayed internal:", hoster.provider, "status:", chain.status);
    return "";
  } catch (error) {
    console.log("[SerienStream v10] provider resolve failed:", hoster.provider, error);
    return "";
  }
}

async function searchResults(keyword) {
  if (!(await __v10Load())) return JSON.stringify([]);
  try { return await __v10.search(keyword); }
  catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v10Load())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  try { return await __v10.details(url); }
  catch (e) { return JSON.stringify([{ description: "", aliases: "", airdate: "" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v10Load())) return JSON.stringify([]);
  try { return await __v10.episodes(url); }
  catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  try {
    if (!(await __v10Load())) return JSON.stringify({ streams: [], subtitles: [] });

    var loggedIn = await __v10Login();
    console.log("[SerienStream v10] authenticated:", loggedIn);

    var episodeUrl = String(url || "").replace(
      /^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i,
      STO_BASE_V10
    );

    var episodeResponse = await __v10.fetch(
      episodeUrl,
      { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE_V10 + "/" },
      "GET",
      null,
      false
    );

    var episodeStatus = Number((episodeResponse && episodeResponse.status) || 0);
    var episodeLocation = episodeResponse ? __v10.header(episodeResponse.headers, "location") : "";
    if (episodeLocation && episodeStatus >= 300 && episodeStatus < 400) {
      var nextEpisode = __v10.absolute(episodeLocation, episodeUrl);
      if (__v10.isSto && __v10.isSto(nextEpisode)) {
        episodeResponse = await __v10.fetch(
          nextEpisode,
          { "Accept": "text/html,application/xhtml+xml", "Referer": episodeUrl },
          "GET",
          null,
          false
        );
      }
    }

    var html = await __v10.read(episodeResponse);
    if (!html) return JSON.stringify({ streams: [], subtitles: [] });

    var hosters = __v10.extractHosters(html) || [];
    console.log("[SerienStream v10] German hosters:", hosters.length);
    if (!hosters.length) return JSON.stringify({ streams: [], subtitles: [] });

    var preferred = ["VOE", "SpeedFiles", "Vidmoly", "DoodStream", "Vidoza", "MP4Upload", "FileMoon"];
    hosters.sort(function (a, b) {
      var ai = preferred.indexOf(a.provider); if (ai < 0) ai = 999;
      var bi = preferred.indexOf(b.provider); if (bi < 0) bi = 999;
      return ai - bi;
    });

    var providerMap = {};
    for (var i = 0; i < hosters.length; i++) {
      var directUrl = await __v10ResolveHoster(hosters[i], episodeUrl);
      if (!directUrl) continue;
      providerMap[directUrl] = __v10.providerKey(hosters[i].provider);
    }

    console.log("[SerienStream v10] external providers:", Object.keys(providerMap).length);
    if (!Object.keys(providerMap).length) {
      return JSON.stringify({ streams: [], subtitles: [] });
    }

    var streams = await __v10.multi(providerMap);
    if (Array.isArray(streams) && streams.length > 0) {
      return JSON.stringify({ streams: streams, subtitles: [] });
    }

    return JSON.stringify({ streams: [], subtitles: [] });
  } catch (error) {
    console.log("[SerienStream v10] stream failed:", error);
    return JSON.stringify({ streams: [], subtitles: [] });
  }
}
