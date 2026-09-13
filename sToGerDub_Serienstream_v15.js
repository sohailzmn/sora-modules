const V13_SCRIPT_URL_V15 = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v13.js?rev=20260913-1735";
const STO_BASE_V15 = "https://serienstream.to";
const STO_UA_V15 = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

var __v15Loaded = false;
var __v15Loading = null;
var __v15CookieJar = {};
var __v15 = {
  search: null,
  details: null,
  episodes: null,
  extractHosters: null,
  providerKey: null,
  multi: null,
  getCredentials: null
};

async function __v15Read(response) {
  if (!response) return "";
  if (typeof response === "string") return response;
  try { if (typeof response.text === "function") return await response.text(); } catch (e) {}
  try { return String(response || ""); } catch (e2) { return ""; }
}

function __v15Header(headers, wanted) {
  if (!headers) return "";
  var target = String(wanted || "").toLowerCase();
  try {
    if (typeof headers.get === "function") return headers.get(wanted) || headers.get(target) || "";
  } catch (e) {}
  for (var k in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, k) && String(k).toLowerCase() === target) {
      return String(headers[k] || "");
    }
  }
  return "";
}

function __v15CaptureCookies(response) {
  if (!response || typeof response === "string") return;
  var raw = __v15Header(response.headers, "set-cookie");
  if (!raw) return;

  var parts = String(raw).split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/g);
  for (var i = 0; i < parts.length; i++) {
    var first = String(parts[i] || "").split(";")[0].trim();
    var eq = first.indexOf("=");
    if (eq <= 0) continue;
    var name = first.substring(0, eq).trim();
    var value = first.substring(eq + 1).trim();
    if (!name) continue;
    if (value === "" || /^deleted$/i.test(value)) delete __v15CookieJar[name];
    else __v15CookieJar[name] = value;
  }
}

function __v15CookieHeader() {
  var out = [];
  for (var k in __v15CookieJar) {
    if (Object.prototype.hasOwnProperty.call(__v15CookieJar, k)) out.push(k + "=" + __v15CookieJar[k]);
  }
  return out.join("; ");
}

function __v15CookieNames() {
  var names = Object.keys(__v15CookieJar || {});
  return names.length ? names.join(",") : "keine";
}

async function __v15Request(url, headers, method, body, followRedirects) {
  var finalHeaders = {
    "User-Agent": STO_UA_V15,
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8"
  };
  headers = headers || {};
  for (var k in headers) finalHeaders[k] = headers[k];
  var cookie = __v15CookieHeader();
  if (cookie) finalHeaders["Cookie"] = cookie;

  try {
    var r = await fetchv2(
      url,
      finalHeaders,
      method || "GET",
      body === undefined ? null : body,
      followRedirects === true
    );
    __v15CaptureCookies(r);
    return r;
  } catch (e) {
    console.log("[SerienStream v15] request failed:", url, e);
    return null;
  }
}

function __v15Absolute(value, base) {
  value = String(value || "").trim().replace(/&amp;/gi, "&");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.indexOf("//") === 0) return "https:" + value;
  var origin = (String(base || STO_BASE_V15).match(/^(https?:\/\/[^\/]+)/i) || [])[1] || STO_BASE_V15;
  if (value.charAt(0) === "/") return origin + value;
  var clean = String(base || origin + "/").split("#")[0].split("?")[0];
  var slash = clean.lastIndexOf("/");
  var dir = slash > clean.indexOf("://") + 2 ? clean.substring(0, slash + 1) : clean + "/";
  return dir + value;
}

function __v15IsSto(url) {
  return /^https?:\/\/(?:www\.)?(?:serienstream\.(?:to|cx)|s\.to)(?:\/|$)/i.test(String(url || ""));
}

function __v15Attr(tag, name) {
  var re = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\\\"([^\\\"]*)\\\"|'([^']*)'|([^\\s>]+))", "i");
  var m = String(tag || "").match(re);
  return m ? (m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : (m[3] || ""))) : "";
}

function __v15LoginForm(html) {
  html = String(html || "");
  var formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  var m;
  var chosenAttrs = "";
  var chosenBody = "";
  while ((m = formRe.exec(html)) !== null) {
    if (/name\s*=\s*["']email["']/i.test(m[2]) && /name\s*=\s*["']password["']/i.test(m[2])) {
      chosenAttrs = m[1] || "";
      chosenBody = m[2] || "";
      break;
    }
  }
  if (!chosenBody) chosenBody = html;

  var fields = {};
  var inputRe = /<input\b[^>]*>/gi;
  while ((m = inputRe.exec(chosenBody)) !== null) {
    var tag = m[0];
    var name = __v15Attr(tag, "name");
    if (!name) continue;
    var type = __v15Attr(tag, "type").toLowerCase();
    if (type === "submit" || type === "button" || type === "image" || type === "file") continue;
    if ((type === "checkbox" || type === "radio") && !/\schecked(?:\s|=|>)/i.test(tag)) continue;
    fields[name] = __v15Attr(tag, "value");
  }

  var action = __v15Attr(chosenAttrs, "action") || "/login";
  return { action: action, fields: fields };
}

function __v15FormEncode(obj) {
  var out = [];
  for (var k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    if (obj[k] === undefined || obj[k] === null) continue;
    out.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(obj[k])));
  }
  return out.join("&");
}

function __v15LooksLikeLogin(html) {
  html = String(html || "");
  return /name\s*=\s*["']email["']/i.test(html) && /name\s*=\s*["']password["']/i.test(html);
}

function __v15LoggedMarker(html) {
  html = String(html || "");
  if (__v15LooksLikeLogin(html)) return false;
  return /\/home\/logout|href\s*=\s*["'][^"']*logout|\babmelden\b|href\s*=\s*["'][^"']*\/account(?:[?#/"'])/i.test(html);
}

function __v15PathOnly(url) {
  return String(url || "").replace(/^https?:\/\/[^\/]+/i, "").slice(0, 100) || "/";
}

function __v15ExternalFromHtml(html, provider) {
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

  var candidates = [];
  var patterns = [
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,
    /location\.href\s*=\s*["']([^"']+)["']/gi,
    /location\.replace\(\s*["']([^"']+)["']\s*\)/gi,
    /<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url\s*=\s*([^"'>\s]+)[^"']*["'][^>]*>/gi,
    /<iframe\b[^>]*src=["']([^"']+)["']/gi
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m;
    while ((m = patterns[i].exec(html)) !== null) candidates.push(m[1]);
  }
  var abs = /https?:\/\/[^"'<>\\s]+/gi;
  var a;
  while ((a = abs.exec(html)) !== null) candidates.push(a[0]);

  for (var c = 0; c < candidates.length; c++) {
    var candidate = String(candidates[c] || "").replace(/\\\//g, "/").replace(/&amp;/gi, "&");
    if (!/^https?:\/\//i.test(candidate) || __v15IsSto(candidate)) continue;
    if (!hints.length) return candidate;
    var lower = candidate.toLowerCase();
    for (var h = 0; h < hints.length; h++) {
      if (lower.indexOf(hints[h]) !== -1) return candidate;
    }
  }
  return "";
}

function __v15ModalHint(html) {
  html = String(html || "").toLowerCase();
  return /cf-turnstile|turnstile|captcha|video wird vorbereitet|dein video wird vorbereitet|challenge-platform/.test(html);
}

async function __v15Load() {
  if (__v15Loaded) return true;
  if (__v15Loading) return await __v15Loading;

  __v15Loading = (async function () {
    try {
      var r = await fetchv2(V13_SCRIPT_URL_V15, { "Accept": "text/plain", "User-Agent": STO_UA_V15 }, "GET", null, true);
      var source = await __v15Read(r);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v13LegacyStreamV15(");
      source += "\n;__v15.search = (typeof searchResults === 'function') ? searchResults : null;";
      source += "\n;__v15.details = (typeof extractDetails === 'function') ? extractDetails : null;";
      source += "\n;__v15.episodes = (typeof extractEpisodes === 'function') ? extractEpisodes : null;";
      eval(source);

      if (typeof __v13Load === "function") await __v13Load();
      if (typeof __v13 !== "undefined" && __v13) {
        __v15.extractHosters = __v13.extractHosters || null;
        __v15.providerKey = __v13.providerKey || null;
        __v15.multi = __v13.multi || null;
      }
      if (typeof __v11 !== "undefined" && __v11 && __v11.getCredentials) {
        __v15.getCredentials = __v11.getCredentials;
      }

      __v15Loaded = !!(__v15.search && __v15.details && __v15.episodes && __v15.extractHosters && __v15.providerKey && __v15.multi && __v15.getCredentials);
      console.log("[SerienStream v15] loaded:", __v15Loaded);
      return __v15Loaded;
    } catch (e) {
      console.log("[SerienStream v15] load failed:", e);
      return false;
    } finally {
      __v15Loading = null;
    }
  })();

  return await __v15Loading;
}

async function __v15Login() {
  var result = {
    ok: false,
    reason: "unknown",
    getStatus: 0,
    postStatus: 0,
    accountStatus: 0,
    homeStatus: 0,
    postLocation: "",
    accountLocation: "",
    formAction: "/login",
    fieldNames: []
  };

  var creds = __v15.getCredentials ? __v15.getCredentials() : null;
  if (!creds || !creds.email || !creds.password || String(creds.email).indexOf("__PUT_") === 0) {
    result.reason = "credentials missing";
    return result;
  }

  var loginPage = await __v15Request(
    STO_BASE_V15 + "/login",
    { "Accept": "text/html,application/xhtml+xml" },
    "GET",
    null,
    false
  );
  result.getStatus = Number((loginPage && loginPage.status) || 0);
  var loginHtml = await __v15Read(loginPage);

  var form = __v15LoginForm(loginHtml);
  result.formAction = form.action || "/login";
  var payload = form.fields || {};
  payload.email = creds.email;
  payload.password = creds.password;
  payload.autoLogin = "on";
  result.fieldNames = Object.keys(payload).filter(function (x) { return x !== "email" && x !== "password"; });

  var postUrl = __v15Absolute(result.formAction, STO_BASE_V15 + "/login");
  var post = await __v15Request(
    postUrl,
    {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "text/html,application/xhtml+xml",
      "Origin": STO_BASE_V15,
      "Referer": STO_BASE_V15 + "/login"
    },
    "POST",
    __v15FormEncode(payload),
    false
  );
  result.postStatus = Number((post && post.status) || 0);
  result.postLocation = post ? (__v15Header(post.headers, "location") || "") : "";
  var postHtml = await __v15Read(post);

  if (__v15LoggedMarker(postHtml)) {
    result.ok = true;
    result.reason = "POST authenticated marker";
    return result;
  }

  if (result.postLocation && result.postStatus >= 300 && result.postStatus < 400) {
    var landing = __v15Absolute(result.postLocation, postUrl);
    if (__v15IsSto(landing)) {
      var landingResp = await __v15Request(landing, { "Accept": "text/html,application/xhtml+xml", "Referer": postUrl }, "GET", null, false);
      var landingHtml = await __v15Read(landingResp);
      if (__v15LoggedMarker(landingHtml)) {
        result.ok = true;
        result.reason = "redirect authenticated marker";
        return result;
      }
    }
  }

  var account = await __v15Request(
    STO_BASE_V15 + "/account",
    { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE_V15 + "/" },
    "GET",
    null,
    false
  );
  result.accountStatus = Number((account && account.status) || 0);
  result.accountLocation = account ? (__v15Header(account.headers, "location") || "") : "";
  var accountHtml = await __v15Read(account);

  if (result.accountStatus === 200 && !__v15LooksLikeLogin(accountHtml)) {
    result.ok = true;
    result.reason = __v15LoggedMarker(accountHtml) ? "account authenticated marker" : "account HTTP 200 without login form";
    return result;
  }

  var home = await __v15Request(
    STO_BASE_V15 + "/",
    { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE_V15 + "/login" },
    "GET",
    null,
    false
  );
  result.homeStatus = Number((home && home.status) || 0);
  var homeHtml = await __v15Read(home);
  if (__v15LoggedMarker(homeHtml)) {
    result.ok = true;
    result.reason = "homepage authenticated marker";
    return result;
  }

  if (result.accountLocation && /\/login(?:[?#/]|$)/i.test(__v15Absolute(result.accountLocation, STO_BASE_V15 + "/account"))) {
    result.reason = "account redirected to login";
  } else if (__v15LooksLikeLogin(postHtml)) {
    result.reason = "login form returned after POST";
  } else if (__v15ModalHint(postHtml) || __v15ModalHint(accountHtml)) {
    result.reason = "verification/challenge during login";
  } else {
    result.reason = "no authenticated session";
  }
  return result;
}

async function __v15ResolveHoster(hoster, episodeUrl) {
  var current = hoster.href;
  var referer = episodeUrl;
  var lastHtml = "";
  var lastStatus = 0;

  for (var i = 0; i < 6; i++) {
    var r = await __v15Request(
      current,
      { "Accept": "text/html,application/xhtml+xml,*/*", "Referer": referer },
      "GET",
      null,
      false
    );
    if (!r) return { url: "", status: 0, modal: false };
    lastStatus = Number(r.status || 0);
    var location = __v15Header(r.headers, "location");
    lastHtml = await __v15Read(r);

    if (location && lastStatus >= 300 && lastStatus < 400) {
      var next = __v15Absolute(location, current);
      if (!__v15IsSto(next)) return { url: next, status: lastStatus, modal: false };
      referer = current;
      current = next;
      continue;
    }

    var inferred = __v15ExternalFromHtml(lastHtml, hoster.provider);
    if (inferred) return { url: inferred, status: lastStatus, modal: false };
    return { url: "", status: lastStatus, modal: __v15ModalHint(lastHtml) };
  }

  return { url: "", status: lastStatus, modal: __v15ModalHint(lastHtml) };
}

function __v15NormalizeMulti(result) {
  if (typeof result === "string") {
    try { result = JSON.parse(result); } catch (e) {}
  }
  if (result && !Array.isArray(result) && Array.isArray(result.streams)) result = result.streams;
  if (!Array.isArray(result)) return [];

  var out = [];
  for (var i = 0; i < result.length; i++) {
    var cur = String(result[i] || "").trim();
    if (/^https?:\/\//i.test(cur)) {
      out.push({ label: "", url: cur });
    } else if (i + 1 < result.length && /^https?:\/\//i.test(String(result[i + 1] || "").trim())) {
      out.push({ label: cur, url: String(result[i + 1]).trim() });
      i++;
    }
  }
  return out;
}

function __v15Diag(lines) {
  var streams = [];
  for (var i = 0; i < lines.length; i++) {
    streams.push({
      title: "DIAG " + (i + 1) + " • " + String(lines[i] || "").slice(0, 120),
      streamUrl: "https://example.com/serienstream-v15-diag-" + (i + 1) + ".m3u8"
    });
  }
  if (streams.length < 2) streams.push({ title: "DIAG • v15 aktiv", streamUrl: "https://example.com/serienstream-v15-diag-extra.m3u8" });
  return JSON.stringify({ streams: streams, subtitles: [] });
}

async function searchResults(keyword) {
  if (!(await __v15Load())) return JSON.stringify([]);
  try { return await __v15.search(keyword); } catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v15Load())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  try { return await __v15.details(url); } catch (e) { return JSON.stringify([{ description: "", aliases: "", airdate: "" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v15Load())) return JSON.stringify([]);
  try { return await __v15.episodes(url); } catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  try {
    if (!(await __v15Load())) return __v15Diag(["V15 LOAD FEHLER"]);

    __v15CookieJar = {};
    var login = await __v15Login();
    var episodeUrl = String(url || "").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5|serienstream\.cx)/i, STO_BASE_V15);

    var episodeResp = await __v15Request(
      episodeUrl,
      { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE_V15 + "/" },
      "GET",
      null,
      false
    );
    var episodeStatus = Number((episodeResp && episodeResp.status) || 0);
    var episodeHtml = await __v15Read(episodeResp);
    var hosters = episodeHtml ? (__v15.extractHosters(episodeHtml) || []) : [];

    var resolved = 0;
    var modalCount = 0;
    var sources = [];
    var seen = {};

    for (var i = 0; i < hosters.length; i++) {
      var hoster = hosters[i];
      var resolvedInfo = await __v15ResolveHoster(hoster, episodeUrl);
      if (resolvedInfo.modal) modalCount++;
      if (!resolvedInfo.url) continue;
      resolved++;

      var map = {};
      map[resolvedInfo.url] = __v15.providerKey(hoster.provider);
      var extracted = null;
      try { extracted = await __v15.multi(map); } catch (e2) { extracted = null; }
      var normalized = __v15NormalizeMulti(extracted);

      for (var j = 0; j < normalized.length; j++) {
        var media = normalized[j].url;
        if (!/^https?:\/\//i.test(media) || seen[media]) continue;
        seen[media] = true;
        var title = String(hoster.provider || normalized[j].label || "Stream");
        if (normalized.length > 1) title += " " + (j + 1);
        sources.push({
          title: title,
          streamUrl: media,
          headers: {
            "User-Agent": STO_UA_V15,
            "Referer": resolvedInfo.url
          }
        });
      }
    }

    if (sources.length) return JSON.stringify({ streams: sources, subtitles: [] });

    var extraFields = login.fieldNames && login.fieldNames.length ? login.fieldNames.join(",") : "keine";
    return __v15Diag([
      "LOGIN " + (login.ok ? "OK ✅" : "FEHLER ❌") + " • GET " + login.getStatus + " POST " + login.postStatus + " ACCOUNT " + login.accountStatus,
      "LOGIN: " + login.reason + " • Redirect " + __v15PathOnly(login.postLocation) + " • Cookies " + __v15CookieNames(),
      "FORM action " + __v15PathOnly(login.formAction) + " • Extras " + extraFields,
      "EPISODE HTTP " + episodeStatus + " • Hoster " + hosters.length + " • resolved " + resolved + " • modal " + modalCount
    ]);
  } catch (e) {
    return __v15Diag(["V15 EXCEPTION", String(e)]);
  }
}
