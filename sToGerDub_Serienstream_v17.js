const V16_SCRIPT_URL_V17 = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v16.js?rev=20260913-1808";
const STO_BASE_V17 = "https://serienstream.to";

var __v17Loaded = false;
var __v17Loading = null;
var __v17 = {
  search: null,
  details: null,
  episodes: null,
  extractHosters: null,
  providerKey: null,
  multi: null,
  getCredentials: null,
  collectFields: null,
  looksLoggedIn: null,
  externalFromHtml: null
};

async function __v17Text(url) {
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

function __v17Esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function __v17LoginAction(html) {
  html = String(html || "");
  var formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  var m;
  while ((m = formRe.exec(html)) !== null) {
    var body = m[2] || "";
    if (!/name\s*=\s*["']email["']/i.test(body) || !/name\s*=\s*["']password["']/i.test(body)) continue;
    var attrs = m[1] || "";
    var am = attrs.match(/\baction\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    var action = am ? (am[1] || am[2] || am[3] || "") : "";
    if (!action) return STO_BASE_V17 + "/login";
    if (/^https?:\/\//i.test(action)) return action;
    if (action.charAt(0) === "/") return STO_BASE_V17 + action;
    return STO_BASE_V17 + "/" + action.replace(/^\/+/, "");
  }
  return STO_BASE_V17 + "/login";
}

function __v17BuildPostHtml(action, fields) {
  var inputs = [];
  for (var k in fields) {
    if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
    inputs.push('<input type="hidden" name="' + __v17Esc(k) + '" value="' + __v17Esc(fields[k]) + '">');
  }
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' +
    '<form id="f" method="post" action="' + __v17Esc(action) + '">' + inputs.join("") + '</form>' +
    '<script>document.getElementById("f").submit();<\/script></body></html>';
}

function __v17Hint(provider) {
  var p = String(provider || "").toLowerCase();
  if (p.indexOf("voe") !== -1) return "voe";
  if (p.indexOf("dood") !== -1) return "dood";
  if (p.indexOf("vidmoly") !== -1) return "vidmoly";
  if (p.indexOf("filemoon") !== -1) return "filemoon";
  if (p.indexOf("vidoza") !== -1) return "vidoza";
  if (p.indexOf("speed") !== -1) return "speed";
  if (p.indexOf("mp4upload") !== -1) return "mp4upload";
  return "";
}

function __v17IsSto(url) {
  return /^https?:\/\/(?:www\.)?(?:serienstream\.(?:to|cx)|s\.to)(?:\/|$)/i.test(String(url || ""));
}

function __v17ExternalFromRequests(requests, provider) {
  if (!Array.isArray(requests)) return "";
  var hint = __v17Hint(provider);
  for (var i = requests.length - 1; i >= 0; i--) {
    var u = String(requests[i] || "");
    if (!/^https?:\/\//i.test(u) || __v17IsSto(u)) continue;
    if (!hint || u.toLowerCase().indexOf(hint) !== -1) return u;
  }
  return "";
}

function __v17Diag(lines) {
  var streams = [];
  for (var i = 0; i < lines.length; i++) {
    streams.push({
      title: "DIAG " + (i + 1) + " • " + String(lines[i] || "").slice(0, 120),
      streamUrl: "https://example.com/serienstream-v17-diag-" + (i + 1) + ".m3u8"
    });
  }
  return JSON.stringify({ streams: streams, subtitles: [] });
}

async function __v17Load() {
  if (__v17Loaded) return true;
  if (__v17Loading) return await __v17Loading;

  __v17Loading = (async function () {
    try {
      var source = await __v17Text(V16_SCRIPT_URL_V17);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v16LegacyStreamV17(");
      source += "\n;__v17.search=(typeof searchResults==='function')?searchResults:null;";
      source += "\n;__v17.details=(typeof extractDetails==='function')?extractDetails:null;";
      source += "\n;__v17.episodes=(typeof extractEpisodes==='function')?extractEpisodes:null;";
      source += "\n;__v17.extractHosters=(typeof __v16!=='undefined'&&__v16)?__v16.extractHosters:null;";
      source += "\n;__v17.providerKey=(typeof __v16!=='undefined'&&__v16)?__v16.providerKey:null;";
      source += "\n;__v17.multi=(typeof __v16!=='undefined'&&__v16)?__v16.multi:null;";
      source += "\n;__v17.getCredentials=(typeof __v16!=='undefined'&&__v16)?__v16.getCredentials:null;";
      source += "\n;__v17.collectFields=(typeof __v16CollectFields==='function')?__v16CollectFields:null;";
      source += "\n;__v17.looksLoggedIn=(typeof __v16LooksLoggedIn==='function')?__v16LooksLoggedIn:null;";
      source += "\n;__v17.externalFromHtml=(typeof __v16ExternalFromHtml==='function')?__v16ExternalFromHtml:null;";
      eval(source);

      if (typeof __v16Load === "function") await __v16Load();
      if (typeof __v16 !== "undefined" && __v16) {
        if (!__v17.extractHosters) __v17.extractHosters = __v16.extractHosters;
        if (!__v17.providerKey) __v17.providerKey = __v16.providerKey;
        if (!__v17.multi) __v17.multi = __v16.multi;
        if (!__v17.getCredentials) __v17.getCredentials = __v16.getCredentials;
      }

      __v17Loaded = !!(
        __v17.search && __v17.details && __v17.episodes &&
        __v17.extractHosters && __v17.providerKey && __v17.multi &&
        __v17.getCredentials && __v17.collectFields && __v17.looksLoggedIn &&
        typeof networkFetch === "function" && typeof networkFetchFromHTML === "function"
      );
      console.log("[SerienStream v17] loaded:", __v17Loaded);
      return __v17Loaded;
    } catch (e) {
      console.log("[SerienStream v17] load failed:", e);
      return false;
    } finally {
      __v17Loading = null;
    }
  })();

  return await __v17Loading;
}

async function __v17BrowserLogin() {
  var out = { ok:false, reason:"unknown", loginRequests:0, postRequests:0, accountRequests:0, cookies:0, fields:0 };
  var creds = __v17.getCredentials ? __v17.getCredentials() : null;
  if (!creds || !creds.email || !creds.password || String(creds.email).indexOf("__PUT_") === 0) {
    out.reason = "credentials missing";
    return out;
  }

  try {
    var loginPage = await networkFetch(STO_BASE_V17 + "/login", {
      timeoutSeconds: 8,
      returnHTML: true,
      returnCookies: true
    });
    out.loginRequests = Number(loginPage && loginPage.totalRequests || 0);
    var loginHtml = String(loginPage && loginPage.html || "");
    if (__v17.looksLoggedIn(loginHtml)) {
      out.ok = true;
      out.reason = "WebKit already authenticated";
      out.cookies = loginPage && loginPage.cookies ? Object.keys(loginPage.cookies).length : 0;
      return out;
    }

    var fields = __v17.collectFields(loginHtml) || {};
    fields.email = creds.email;
    fields.password = creds.password;
    fields.autoLogin = "on";
    out.fields = Object.keys(fields).length;

    var action = __v17LoginAction(loginHtml);
    var html = __v17BuildPostHtml(action, fields);
    var post = await networkFetchFromHTML(html, {
      timeoutSeconds: 10,
      returnHTML: true,
      returnCookies: true
    });
    out.postRequests = Number(post && post.totalRequests || 0);
    out.cookies = post && post.cookies ? Object.keys(post.cookies).length : 0;
    var postHtml = String(post && post.html || "");
    if (__v17.looksLoggedIn(postHtml)) {
      out.ok = true;
      out.reason = "WebKit POST authenticated";
      return out;
    }

    var account = await networkFetch(STO_BASE_V17 + "/account", {
      timeoutSeconds: 8,
      returnHTML: true,
      returnCookies: true
    });
    out.accountRequests = Number(account && account.totalRequests || 0);
    var accountHtml = String(account && account.html || "");
    if (__v17.looksLoggedIn(accountHtml)) {
      out.ok = true;
      out.reason = "WebKit account authenticated";
      out.cookies = account && account.cookies ? Object.keys(account.cookies).length : out.cookies;
      return out;
    }

    out.reason = "WebKit login marker missing";
    return out;
  } catch (e) {
    out.reason = "WebKit login exception: " + String(e);
    return out;
  }
}

async function __v17ResolveBrowser(hoster) {
  try {
    var hint = __v17Hint(hoster.provider);
    var res = await networkFetch(hoster.href, {
      timeoutSeconds: 10,
      returnHTML: true,
      returnCookies: true,
      cutoff: hint || null
    });

    var url = "";
    if (res && res.cutoffTriggered && res.cutoffUrl && !__v17IsSto(res.cutoffUrl)) {
      url = String(res.cutoffUrl);
    }
    if (!url) url = __v17ExternalFromRequests(res && res.requests, hoster.provider);
    if (!url && __v17.externalFromHtml) url = __v17.externalFromHtml(String(res && res.html || ""), hoster.provider) || "";

    return {
      url: url,
      requests: Number(res && res.totalRequests || 0),
      cutoff: !!(res && res.cutoffTriggered),
      success: !!(res && res.success),
      html: String(res && res.html || "")
    };
  } catch (e) {
    return { url:"", requests:0, cutoff:false, success:false, html:"" };
  }
}

async function searchResults(keyword) {
  if (!(await __v17Load())) return JSON.stringify([]);
  try { return await __v17.search(keyword); } catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v17Load())) return JSON.stringify([{ description:"", aliases:"", airdate:"" }]);
  try { return await __v17.details(url); } catch (e) { return JSON.stringify([{ description:"", aliases:"", airdate:"" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v17Load())) return JSON.stringify([]);
  try { return await __v17.episodes(url); } catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  try {
    if (!(await __v17Load())) return __v17Diag(["V17 LOAD FEHLER oder networkFetch nicht verfügbar"]);

    var login = await __v17BrowserLogin();
    var episodeUrl = String(url || "").replace(/^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i, STO_BASE_V17);

    var ep = await fetchv2(episodeUrl, { "Accept":"text/html,application/xhtml+xml", "Referer":STO_BASE_V17 + "/" }, "GET", null, true);
    var epStatus = Number(ep && ep.status || 0);
    var epHtml = ep && typeof ep.text === "function" ? await ep.text() : "";
    var hosters = __v17.extractHosters(epHtml) || [];

    var providerMap = {};
    var resolved = 0;
    var states = [];

    for (var i = 0; i < hosters.length; i++) {
      var rr = await __v17ResolveBrowser(hosters[i]);
      states.push(String(hosters[i].provider || "?") + ":web" + rr.requests + (rr.url ? "→extern" : "→intern"));
      if (!rr.url) continue;
      resolved++;
      providerMap[rr.url] = __v17.providerKey(hosters[i].provider);
    }

    if (resolved > 0) {
      var streams = await __v17.multi(providerMap);
      if (Array.isArray(streams) && streams.length > 0) return JSON.stringify({ streams:streams, subtitles:[] });
      if (typeof streams === "string") {
        try {
          var parsed = JSON.parse(streams);
          if (parsed && Array.isArray(parsed.streams) && parsed.streams.length > 0) {
            return JSON.stringify({ streams:parsed.streams, subtitles:parsed.subtitles || [] });
          }
        } catch (e) {}
      }
    }

    return __v17Diag([
      "WEBKIT LOGIN " + (login.ok ? "OK ✅" : "FEHLER ❌") + " • " + login.reason,
      "LOGIN requests " + login.loginRequests + "/" + login.postRequests + "/" + login.accountRequests + " • cookies " + login.cookies + " • fields " + login.fields,
      "EPISODE HTTP " + epStatus + " • Hoster " + hosters.length + " • resolved " + resolved,
      "WEBKIT: " + (states.join(" | ") || "keine Hoster")
    ]);
  } catch (e) {
    return __v17Diag(["V17 EXCEPTION", String(e)]);
  }
}
