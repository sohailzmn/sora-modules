const V10_SCRIPT_URL = "https://raw.githubusercontent.com/sohailzmn/sora-modules/refs/heads/main/sToGerDub_Serienstream_v10.js?rev=20260913-1645";
const STO_BASE_V11 = "https://serienstream.to";

var __v11Loaded = false;
var __v11Loading = null;
var __v11 = {
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
  getCredentials: null,
  resolveHoster: null
};

async function __v11RawText(url) {
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
      console.log("[SerienStream v11] could not load v10:", e2);
      return "";
    }
  }
}

function __v11Attr(tag, name) {
  var re = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\\\"([^\\\"]*)\\\"|'([^']*)'|([^\\s>]+))", "i");
  var m = String(tag || "").match(re);
  return m ? (m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : (m[3] || ""))) : "";
}

function __v11CollectFormFields(html) {
  var fields = {};
  var re = /<input\b[^>]*>/gi;
  var m;
  while ((m = re.exec(String(html || ""))) !== null) {
    var tag = m[0];
    var name = __v11Attr(tag, "name");
    if (!name) continue;
    var type = __v11Attr(tag, "type").toLowerCase();
    if (type === "submit" || type === "button" || type === "image" || type === "file") continue;
    fields[name] = __v11Attr(tag, "value");
  }
  return fields;
}

function __v11LooksLoggedIn(html) {
  html = String(html || "");
  return /\/home\/logout|href=[\"'][^\"']*logout|\babmelden\b/i.test(html);
}

function __v11LooksLikeLoginPage(html) {
  html = String(html || "");
  return /name=[\"']password[\"']/i.test(html) && /name=[\"']email[\"']/i.test(html);
}

function __v11Diag(lines) {
  var cleaned = [];
  for (var i = 0; i < lines.length; i++) {
    if (lines[i]) cleaned.push(String(lines[i]).slice(0, 100));
  }
  while (cleaned.length < 2) cleaned.push("Keine weiteren Details");
  var sources = [];
  for (var j = 0; j < cleaned.length; j++) {
    sources.push({
      title: "DIAG " + (j + 1) + " • " + cleaned[j],
      streamUrl: "https://example.invalid/serienstream-diagnostic-" + (j + 1) + ".m3u8"
    });
  }
  return JSON.stringify({ streams: [], subtitles: [], sources: sources });
}

async function __v11Load() {
  if (__v11Loaded) return true;
  if (__v11Loading) return await __v11Loading;

  __v11Loading = (async function () {
    try {
      var source = await __v11RawText(V10_SCRIPT_URL);
      if (!source) return false;

      source = source.replace(/async\s+function\s+extractStreamUrl\s*\(/, "async function __v10LegacyStream(");
      source += "\n;__v11.search = (typeof searchResults === 'function') ? searchResults : null;";
      source += "\n;__v11.details = (typeof extractDetails === 'function') ? extractDetails : null;";
      source += "\n;__v11.episodes = (typeof extractEpisodes === 'function') ? extractEpisodes : null;";
      source += "\n;__v11.fetch = (typeof __v10 !== 'undefined' && __v10) ? __v10.fetch : null;";
      source += "\n;__v11.read = (typeof __v10 !== 'undefined' && __v10) ? __v10.read : null;";
      source += "\n;__v11.header = (typeof __v10 !== 'undefined' && __v10) ? __v10.header : null;";
      source += "\n;__v11.absolute = (typeof __v10 !== 'undefined' && __v10) ? __v10.absolute : null;";
      source += "\n;__v11.isSto = (typeof __v10 !== 'undefined' && __v10) ? __v10.isSto : null;";
      source += "\n;__v11.formEncode = (typeof __v10 !== 'undefined' && __v10) ? __v10.formEncode : null;";
      source += "\n;__v11.getCredentials = (typeof __v10 !== 'undefined' && __v10) ? __v10.getCredentials : null;";
      source += "\n;__v11.extractHosters = (typeof __v10 !== 'undefined' && __v10) ? __v10.extractHosters : null;";
      source += "\n;__v11.providerKey = (typeof __v10 !== 'undefined' && __v10) ? __v10.providerKey : null;";
      source += "\n;__v11.multi = (typeof __v10 !== 'undefined' && __v10) ? __v10.multi : null;";
      source += "\n;__v11.resolveHoster = (typeof __v10ResolveHoster === 'function') ? __v10ResolveHoster : null;";

      eval(source);

      if (typeof __v10Load === "function") await __v10Load();
      if (typeof __v10 !== "undefined" && __v10) {
        if (!__v11.fetch) __v11.fetch = __v10.fetch;
        if (!__v11.read) __v11.read = __v10.read;
        if (!__v11.header) __v11.header = __v10.header;
        if (!__v11.absolute) __v11.absolute = __v10.absolute;
        if (!__v11.isSto) __v11.isSto = __v10.isSto;
        if (!__v11.formEncode) __v11.formEncode = __v10.formEncode;
        if (!__v11.getCredentials) __v11.getCredentials = __v10.getCredentials;
        if (!__v11.extractHosters) __v11.extractHosters = __v10.extractHosters;
        if (!__v11.providerKey) __v11.providerKey = __v10.providerKey;
        if (!__v11.multi) __v11.multi = __v10.multi;
      }

      __v11Loaded = !!(
        __v11.search && __v11.details && __v11.episodes &&
        __v11.fetch && __v11.read && __v11.header && __v11.absolute &&
        __v11.formEncode && __v11.getCredentials && __v11.extractHosters &&
        __v11.providerKey && __v11.multi && __v11.resolveHoster
      );
      console.log("[SerienStream v11] loaded:", __v11Loaded);
      return __v11Loaded;
    } catch (error) {
      console.log("[SerienStream v11] load failed:", error);
      return false;
    } finally {
      __v11Loading = null;
    }
  })();

  return await __v11Loading;
}

async function __v11LoginDetailed() {
  var result = {
    ok: false,
    getStatus: 0,
    postStatus: 0,
    postLocation: "",
    verifyStatus: 0,
    fields: 0,
    reason: "unknown"
  };

  var creds = __v11.getCredentials ? __v11.getCredentials() : null;
  if (!creds || !creds.email || !creds.password || String(creds.email).indexOf("__PUT_") === 0) {
    result.reason = "credentials missing";
    return result;
  }

  try {
    var pageResponse = await __v11.fetch(
      STO_BASE_V11 + "/login",
      { "Accept": "text/html,application/xhtml+xml" },
      "GET",
      null,
      false
    );
    result.getStatus = Number((pageResponse && pageResponse.status) || 0);
    var pageHtml = await __v11.read(pageResponse);

    if (__v11LooksLoggedIn(pageHtml)) {
      result.ok = true;
      result.reason = "already logged in";
      return result;
    }

    var payload = __v11CollectFormFields(pageHtml);
    delete payload.email;
    delete payload.password;
    payload.email = creds.email;
    payload.password = creds.password;
    if (!Object.prototype.hasOwnProperty.call(payload, "autoLogin")) payload.autoLogin = "on";
    result.fields = Object.keys(payload).length;

    var loginResponse = await __v11.fetch(
      STO_BASE_V11 + "/login",
      {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml",
        "Origin": STO_BASE_V11,
        "Referer": STO_BASE_V11 + "/login"
      },
      "POST",
      __v11.formEncode(payload),
      false
    );

    result.postStatus = Number((loginResponse && loginResponse.status) || 0);
    result.postLocation = loginResponse ? (__v11.header(loginResponse.headers, "location") || "") : "";
    var loginHtml = await __v11.read(loginResponse);

    if (__v11LooksLoggedIn(loginHtml)) {
      result.ok = true;
      result.reason = "logout marker in POST response";
      return result;
    }

    var redirectedAwayFromLogin = false;
    if (result.postLocation && result.postStatus >= 300 && result.postStatus < 400) {
      var landing = __v11.absolute(result.postLocation, STO_BASE_V11 + "/login");
      redirectedAwayFromLogin = !/\/login(?:[?#/]|$)/i.test(landing);

      if (__v11.isSto && __v11.isSto(landing)) {
        var landingResponse = await __v11.fetch(
          landing,
          { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE_V11 + "/login" },
          "GET",
          null,
          false
        );
        var landingHtml = await __v11.read(landingResponse);
        if (__v11LooksLoggedIn(landingHtml)) {
          result.ok = true;
          result.reason = "redirect landing is authenticated";
          return result;
        }
      }
    }

    var verifyResponse = await __v11.fetch(
      STO_BASE_V11 + "/",
      { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE_V11 + "/login" },
      "GET",
      null,
      false
    );
    result.verifyStatus = Number((verifyResponse && verifyResponse.status) || 0);
    var verifyHtml = await __v11.read(verifyResponse);

    if (__v11LooksLoggedIn(verifyHtml)) {
      result.ok = true;
      result.reason = "homepage authenticated";
      return result;
    }

    if (redirectedAwayFromLogin && !__v11LooksLikeLoginPage(loginHtml)) {
      result.ok = true;
      result.reason = "POST redirected away from login";
      return result;
    }

    result.reason = __v11LooksLikeLoginPage(loginHtml) ? "login page returned again" : "no authenticated marker";
    return result;
  } catch (error) {
    result.reason = "exception: " + String(error);
    return result;
  }
}

async function searchResults(keyword) {
  if (!(await __v11Load())) return JSON.stringify([]);
  try { return await __v11.search(keyword); }
  catch (e) { return JSON.stringify([]); }
}

async function extractDetails(url) {
  if (!(await __v11Load())) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
  try { return await __v11.details(url); }
  catch (e) { return JSON.stringify([{ description: "", aliases: "", airdate: "" }]); }
}

async function extractEpisodes(url) {
  if (!(await __v11Load())) return JSON.stringify([]);
  try { return await __v11.episodes(url); }
  catch (e) { return JSON.stringify([]); }
}

async function extractStreamUrl(url) {
  try {
    if (!(await __v11Load())) {
      return __v11Diag(["LOAD FEHLER", "v10 konnte nicht geladen werden"]);
    }

    var login = await __v11LoginDetailed();
    console.log("[SerienStream v11] login:", JSON.stringify(login));

    var episodeUrl = String(url || "").replace(
      /^https?:\/\/(?:www\.)?(?:s\.to|186\.2\.175\.5)/i,
      STO_BASE_V11
    );

    var episodeResponse = await __v11.fetch(
      episodeUrl,
      { "Accept": "text/html,application/xhtml+xml", "Referer": STO_BASE_V11 + "/" },
      "GET",
      null,
      false
    );
    var episodeStatus = Number((episodeResponse && episodeResponse.status) || 0);
    var episodeHtml = await __v11.read(episodeResponse);

    if (!episodeHtml) {
      return __v11Diag([
        "LOGIN " + (login.ok ? "OK" : "FEHLER") + " • POST " + login.postStatus,
        "EPISODE HTTP " + episodeStatus + " • leer",
        "LOGIN-DETAIL: " + login.reason
      ]);
    }

    var hosters = __v11.extractHosters(episodeHtml) || [];
    var providerMap = {};
    var resolved = 0;

    for (var i = 0; i < hosters.length; i++) {
      var direct = await __v11.resolveHoster(hosters[i], episodeUrl);
      if (!direct) continue;
      resolved++;
      providerMap[direct] = __v11.providerKey(hosters[i].provider);
    }

    if (resolved > 0) {
      var streams = await __v11.multi(providerMap);
      if (Array.isArray(streams) && streams.length > 0) {
        return JSON.stringify({ streams: streams, subtitles: [] });
      }
    }

    var redirectText = login.postLocation ? String(login.postLocation).replace(STO_BASE_V11, "") : "keins";
    var blockHint = hosters.length > 0 && resolved === 0 ? "Provider blieb intern / Verifikation" : "keine Provider gefunden";

    return __v11Diag([
      "LOGIN " + (login.ok ? "OK ✅" : "FEHLER ❌") + " • GET " + login.getStatus + " POST " + login.postStatus,
      "LOGIN: " + login.reason + " • Redirect: " + redirectText,
      "EPISODE HTTP " + episodeStatus + " • Hoster " + hosters.length + " • resolved " + resolved,
      "ERGEBNIS: " + blockHint
    ]);
  } catch (error) {
    return __v11Diag(["EXCEPTION ❌", String(error)]);
  }
}
