const BASE_URL = "https://aniworld.to";
const SEARCH_URL = BASE_URL + "/ajax/seriesSearch";

async function soraFetch(url, options) {
    options = options || {};
    var headers = options.headers || {};

    if (!headers["User-Agent"]) {
        headers["User-Agent"] =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/120.0.0.0 Safari/537.36";
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
        } catch (error) {
            console.log("[AniWorld] Request failed:", url, error);
            return null;
        }
    }
}

async function readText(response) {
    if (!response) return "";
    if (typeof response === "string") return response;

    try {
        if (typeof response.text === "function") {
            return await response.text();
        }
    } catch (e) {
        console.log("[AniWorld] response.text() failed:", e);
    }

    try {
        return String(response);
    } catch (e2) {
        return "";
    }
}

function absoluteUrl(url) {
    if (!url) return "";

    url = String(url).trim();

    if (url.indexOf("https://") === 0 || url.indexOf("http://") === 0) {
        return url;
    }

    if (url.indexOf("//") === 0) {
        return "https:" + url;
    }

    if (url.charAt(0) === "/") {
        return BASE_URL + url;
    }

    return BASE_URL + "/" + url;
}

function decodeHtml(text) {
    if (!text) return "";

    return String(text)
        .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
            return String.fromCharCode(parseInt(hex, 16));
        })
        .replace(/&#([0-9]+);/g, function (_, dec) {
            return String.fromCharCode(parseInt(dec, 10));
        })
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&nbsp;/gi, " ");
}

function stripTags(text) {
    if (!text) return "";
    return String(text).replace(/<[^>]*>/g, " ");
}

function cleanText(text) {
    return decodeHtml(stripTags(text || ""))
        .replace(/\s+/g, " ")
        .trim();
}

function uniqueStrings(values) {
    var seen = {};
    var result = [];

    for (var i = 0; i < values.length; i++) {
        var value = values[i];
        if (!value || seen[value]) continue;
        seen[value] = true;
        result.push(value);
    }

    return result;
}

function getSeasonNumber(url) {
    var match = String(url || "").match(/\/staffel-(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
}

async function searchResults(keyword) {
    try {
        console.log("[AniWorld] Searching:", keyword);

        var response = await soraFetch(
            SEARCH_URL + "?keyword=" + encodeURIComponent(keyword),
            {
                headers: {
                    "Accept": "application/json",
                    "Referer": BASE_URL + "/search",
                    "Origin": BASE_URL
                }
            }
        );

        var text = await readText(response);
        if (!text) return JSON.stringify([]);

        var data;
        try {
            data = JSON.parse(text);
        } catch (jsonError) {
            console.log("[AniWorld] Search JSON parse error:", jsonError);
            return JSON.stringify([]);
        }

        if (!Array.isArray(data)) return JSON.stringify([]);

        var results = [];

        for (var i = 0; i < data.length; i++) {
            var item = data[i] || {};
            var title = cleanText(item.name || "");
            var href = absoluteUrl(item.link || "");
            var image = absoluteUrl(item.cover || "");

            if (!title || !href) continue;

            results.push({
                title: title,
                image: image,
                href: href
            });
        }

        console.log("[AniWorld] Results:", results.length);
        return JSON.stringify(results);
    } catch (error) {
        console.log("[AniWorld] searchResults error:", error);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        var response = await soraFetch(url, {
            headers: {
                "Accept": "text/html,application/xhtml+xml",
                "Referer": BASE_URL + "/"
            }
        });

        var html = await readText(response);
        if (!html) {
            return JSON.stringify([{
                description: "",
                aliases: "",
                airdate: ""
            }]);
        }

        var description = extractDescription(html);
        var aliases = extractAliases(html);
        var airdate = extractAirdate(html);

        return JSON.stringify([{
            description: description,
            aliases: aliases,
            airdate: airdate
        }]);
    } catch (error) {
        console.log("[AniWorld] extractDetails error:", error);
        return JSON.stringify([{
            description: "",
            aliases: "",
            airdate: ""
        }]);
    }
}

function extractDescription(html) {
    var match = html.match(
        /class=["'][^"']*\bseri_des\b[^"']*["'][^>]*data-full-description=["']([^"']*)["']/i
    );

    if (!match) {
        match = html.match(
            /data-full-description=["']([^"']*)["'][^>]*class=["'][^"']*\bseri_des\b[^"']*["']/i
        );
    }

    if (match && match[1]) {
        return cleanText(match[1]);
    }

    var fallback = html.match(
        /<p[^>]*class=["'][^"']*\bseri_des\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
    );

    return fallback ? cleanText(fallback[1]) : "";
}

function extractAliases(html) {
    var match = html.match(/data-alternativetitles=["']([^"']*)["']/i);
    return match ? cleanText(match[1]) : "";
}

function extractAirdate(html) {
    var start = "";
    var end = "";

    var startMatch = html.match(
        /itemprop=["']startDate["'][\s\S]{0,300}?>(?:[\s\S]{0,100}?)?(\d{4})(?:<|[\s])/i
    );

    if (!startMatch) {
        startMatch = html.match(
            /itemprop=["']startDate["'][\s\S]{0,300}?\/animes\/jahr\/(\d{4})/i
        );
    }

    var endMatch = html.match(
        /itemprop=["']endDate["'][\s\S]{0,300}?>(?:[\s\S]{0,100}?)?(\d{4})(?:<|[\s])/i
    );

    if (!endMatch) {
        endMatch = html.match(
            /itemprop=["']endDate["'][\s\S]{0,300}?\/animes\/jahr\/(\d{4})/i
        );
    }

    if (startMatch) start = startMatch[1];
    if (endMatch) end = endMatch[1];

    if (start && end && start !== end) return start + "-" + end;
    return start || end || "";
}

async function extractEpisodes(url) {
    try {
        var initialResponse = await soraFetch(url, {
            headers: {
                "Accept": "text/html,application/xhtml+xml",
                "Referer": BASE_URL + "/"
            }
        });

        var initialHtml = await readText(initialResponse);
        if (!initialHtml) return JSON.stringify([]);

        var seasonUrls = [];

        if (/\/staffel-\d+\/?$/i.test(url)) {
            seasonUrls.push(url);
        } else {
            seasonUrls = discoverSeasonUrls(initialHtml);

            if (seasonUrls.length === 0 &&
                /itemtype=["']http:\/\/schema\.org\/Episode["']/i.test(initialHtml)) {
                seasonUrls.push(url);
            }
        }

        seasonUrls = uniqueStrings(seasonUrls);

        seasonUrls.sort(function (a, b) {
            return getSeasonNumber(a) - getSeasonNumber(b);
        });

        var finalEpisodes = [];
        var numberOffset = 0;

        for (var i = 0; i < seasonUrls.length; i++) {
            var seasonUrl = seasonUrls[i];
            var seasonHtml;

            if (seasonUrl === url) {
                seasonHtml = initialHtml;
            } else {
                var seasonResponse = await soraFetch(seasonUrl, {
                    headers: {
                        "Accept": "text/html,application/xhtml+xml",
                        "Referer": url
                    }
                });

                seasonHtml = await readText(seasonResponse);
            }

            if (!seasonHtml) continue;

            var parsed = parseSeasonEpisodes(seasonHtml);

            for (var j = 0; j < parsed.episodes.length; j++) {
                var episode = parsed.episodes[j];

                finalEpisodes.push({
                    href: episode.href,
                    number: numberOffset + episode.number
                });
            }

            if (parsed.maxEpisodeNumber > 0) {
                numberOffset += parsed.maxEpisodeNumber;
            }
        }

        var deduped = [];
        var seenHref = {};

        for (var k = 0; k < finalEpisodes.length; k++) {
            var ep = finalEpisodes[k];
            if (!ep.href || seenHref[ep.href]) continue;
            seenHref[ep.href] = true;
            deduped.push(ep);
        }

        deduped.sort(function (a, b) {
            return a.number - b.number;
        });

        console.log(
            "[AniWorld] German-dub episodes:",
            deduped.length,
            "across",
            seasonUrls.length,
            "season(s)"
        );

        return JSON.stringify(deduped);
    } catch (error) {
        console.log("[AniWorld] extractEpisodes error:", error);
        return JSON.stringify([]);
    }
}

function discoverSeasonUrls(html) {
    var urls = [];
    var regex = /href=["']([^"']*\/staffel-(\d+)\/?[^"']*)["']/gi;
    var match;

    while ((match = regex.exec(html)) !== null) {
        var href = match[1];
        href = href.replace(/\/episode-\d+.*$/i, "");
        urls.push(absoluteUrl(href));
    }

    return uniqueStrings(urls);
}

function parseSeasonEpisodes(html) {
    var result = {
        episodes: [],
        maxEpisodeNumber: 0
    };

    var rowRegex = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
    var rowMatch;
    var seen = {};

    while ((rowMatch = rowRegex.exec(html)) !== null) {
        var row = rowMatch[0];

        if (!/\/episode-\d+/i.test(row)) continue;

        var number = extractEpisodeNumberFromRow(row);
        if (!number) continue;

        if (number > result.maxEpisodeNumber) {
            result.maxEpisodeNumber = number;
        }

        if (!rowHasGermanDub(row)) continue;

        var hrefMatch = row.match(
            /href=["']([^"']*\/episode-\d+[^"']*)["']/i
        );

        if (!hrefMatch) continue;

        var href = absoluteUrl(hrefMatch[1]);

        if (seen[href]) continue;
        seen[href] = true;

        result.episodes.push({
            href: href,
            number: number
        });
    }

    if (result.episodes.length === 0) {
        var linkRegex = /<a\b[^>]*href=["']([^"']*\/episode-(\d+)[^"']*)["'][^>]*>[\s\S]*?<\/a>/gi;
        var linkMatch;

        while ((linkMatch = linkRegex.exec(html)) !== null) {
            var linkHref = absoluteUrl(linkMatch[1]);
            var linkNumber = parseInt(linkMatch[2], 10);

            if (!linkNumber || seen[linkHref]) continue;

            var start = Math.max(0, linkMatch.index - 800);
            var end = Math.min(html.length, linkRegex.lastIndex + 1200);
            var nearby = html.substring(start, end);

            if (!rowHasGermanDub(nearby)) continue;

            seen[linkHref] = true;

            if (linkNumber > result.maxEpisodeNumber) {
                result.maxEpisodeNumber = linkNumber;
            }

            result.episodes.push({
                href: linkHref,
                number: linkNumber
            });
        }
    }

    result.episodes.sort(function (a, b) {
        return a.number - b.number;
    });

    return result;
}

function extractEpisodeNumberFromRow(row) {
    var metaMatch = row.match(
        /<meta\b[^>]*itemprop=["']episodeNumber["'][^>]*content=["'](\d+)["'][^>]*>/i
    );

    if (!metaMatch) {
        metaMatch = row.match(
            /<meta\b[^>]*content=["'](\d+)["'][^>]*itemprop=["']episodeNumber["'][^>]*>/i
        );
    }

    if (metaMatch) {
        return parseInt(metaMatch[1], 10);
    }

    var urlMatch = row.match(/\/episode-(\d+)/i);
    return urlMatch ? parseInt(urlMatch[1], 10) : 0;
}

function rowHasGermanDub(row) {
    if (/src=["'][^"']*\/german\.svg(?:\?[^"']*)?["']/i.test(row)) {
        return true;
    }

    if (/title=["'][^"']*(?:Deutsch\/German|Deutsche Sprache)[^"']*["']/i.test(row)) {
        return true;
    }

    return false;
}

async function extractStreamUrl(url) {
    try {
        console.log("[AniWorld] Resolving episode:", url);

        var episodePage = await fetchPageFollowingRedirects(url, {
            headers: {
                "Accept": "text/html,application/xhtml+xml",
                "Referer": BASE_URL + "/"
            }
        }, 4);

        if (!episodePage || !episodePage.html) {
            return emptyStreamResult();
        }

        var sources = [];

        appendMediaSources(
            sources,
            extractDirectPublicMediaUrls(episodePage.html, episodePage.finalUrl || url),
            "AniWorld",
            episodePage.finalUrl || url
        );

        var redirects = extractAniWorldRedirects(episodePage.html);

        console.log("[AniWorld] Provider redirects:", redirects.length);

        for (var i = 0; i < redirects.length; i++) {
            var provider = redirects[i];

            try {
                var providerPage = await fetchPageFollowingRedirects(
                    provider.url,
                    {
                        headers: {
                            "Accept": "text/html,application/xhtml+xml",
                            "Referer": url
                        }
                    },
                    5
                );

                if (!providerPage || !providerPage.html) continue;

                var media = extractDirectPublicMediaUrls(
                    providerPage.html,
                    providerPage.finalUrl || provider.url
                );

                appendMediaSources(
                    sources,
                    media,
                    provider.title || ("Hoster " + (i + 1)),
                    providerPage.finalUrl || provider.url
                );
            } catch (providerError) {
                console.log(
                    "[AniWorld] Provider failed:",
                    provider.title || provider.url,
                    providerError
                );
            }
        }

        sources = dedupeSources(sources);

        var streams = [];
        for (var s = 0; s < sources.length; s++) {
            streams.push(sources[s].streamUrl);
        }

        console.log("[AniWorld] Playable direct sources:", sources.length);

        return JSON.stringify({
            streams: streams,
            subtitles: [],
            sources: sources
        });
    } catch (error) {
        console.log("[AniWorld] extractStreamUrl error:", error);
        return emptyStreamResult();
    }
}

function emptyStreamResult() {
    return JSON.stringify({
        streams: [],
        subtitles: [],
        sources: []
    });
}

function appendMediaSources(target, urls, providerName, referer) {
    for (var i = 0; i < urls.length; i++) {
        var mediaUrl = urls[i];

        target.push({
            title: providerName,
            streamUrl: mediaUrl,
            headers: {
                "Referer": referer || BASE_URL + "/",
                "Origin": getOrigin(referer || BASE_URL)
            }
        });
    }
}

function dedupeSources(sources) {
    var result = [];
    var seen = {};

    for (var i = 0; i < sources.length; i++) {
        var source = sources[i];
        if (!source || !source.streamUrl || seen[source.streamUrl]) continue;

        seen[source.streamUrl] = true;
        result.push(source);
    }

    return result;
}

function extractAniWorldRedirects(html) {
    var result = [];
    var seen = {};
    var regex = /href=["']([^"']*\/redirect\/[^"']+)["']/gi;
    var match;

    while ((match = regex.exec(html)) !== null) {
        var raw = match[1];
        var url = resolveAgainst(raw, BASE_URL);

        if (!url || seen[url]) continue;
        seen[url] = true;

        var start = Math.max(0, match.index - 500);
        var end = Math.min(html.length, regex.lastIndex + 500);
        var nearby = html.substring(start, end);

        var title = "";

        var titleMatch = nearby.match(
            /(?:title|data-provider|data-hoster)=["']([^"']{2,40})["']/i
        );

        if (titleMatch) {
            title = cleanText(titleMatch[1]);
        }

        if (!title) {
            var iconMatch = nearby.match(
                /class=["'][^"']*\b(?:VOE|Vidmoly|Filemoon|Doodstream|Dood|Streamtape)\b[^"']*["']/i
            );

            if (iconMatch) {
                var nameMatch = iconMatch[0].match(
                    /\b(VOE|Vidmoly|Filemoon|Doodstream|Dood|Streamtape)\b/i
                );
                if (nameMatch) title = nameMatch[1];
            }
        }

        result.push({
            url: url,
            title: title || "AniWorld Hoster"
        });
    }

    return result;
}

async function fetchPageFollowingRedirects(url, options, maxHops) {
    var currentUrl = url;
    var hops = typeof maxHops === "number" ? maxHops : 4;
    var lastHtml = "";

    for (var i = 0; i <= hops; i++) {
        var response = await soraFetch(currentUrl, options || {});
        if (!response) {
            return {
                html: lastHtml,
                finalUrl: currentUrl
            };
        }

        var location = getHeaderValue(response.headers, "location");

        if (location) {
            currentUrl = resolveAgainst(location, currentUrl);
            continue;
        }

        var html = await readText(response);
        lastHtml = html;

        var responseUrl = "";
        try {
            if (response.url && typeof response.url === "string") {
                responseUrl = response.url;
            }
        } catch (e) {}

        if (responseUrl) {
            currentUrl = responseUrl;
        }

        var pageRedirect = extractSimplePageRedirect(html);
        if (pageRedirect) {
            var nextUrl = resolveAgainst(pageRedirect, currentUrl);

            if (nextUrl && nextUrl !== currentUrl) {
                currentUrl = nextUrl;
                continue;
            }
        }

        return {
            html: html,
            finalUrl: currentUrl
        };
    }

    return {
        html: lastHtml,
        finalUrl: currentUrl
    };
}

function getHeaderValue(headers, name) {
    if (!headers) return "";

    var wanted = String(name || "").toLowerCase();

    try {
        if (typeof headers.get === "function") {
            return headers.get(name) || headers.get(wanted) || "";
        }
    } catch (e) {}

    for (var key in headers) {
        if (
            Object.prototype.hasOwnProperty.call(headers, key) &&
            String(key).toLowerCase() === wanted
        ) {
            return String(headers[key] || "");
        }
    }

    return "";
}

function extractSimplePageRedirect(html) {
    if (!html) return "";

    var meta = html.match(
        /<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url\s*=\s*([^"'>\s]+)[^"']*["'][^>]*>/i
    );
    if (meta && meta[1]) return decodeHtml(meta[1]);

    var js = html.match(
        /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i
    );
    if (js && js[1]) return decodeHtml(js[1]);

    var replace = html.match(
        /location\.replace\(\s*["']([^"']+)["']\s*\)/i
    );
    if (replace && replace[1]) return decodeHtml(replace[1]);

    return "";
}

function extractDirectPublicMediaUrls(html, baseUrl) {
    if (!html) return [];

    var normalized = String(html)
        .replace(/\\\//g, "/")
        .replace(/\\u0026/gi, "&")
        .replace(/\\u003d/gi, "=")
        .replace(/&amp;/gi, "&");

    var candidates = [];
    var match;

    var absoluteRegex =
        /https?:\/\/[^"'\\\s<>]+?\.(?:m3u8|mp4)(?:\?[^"'\\\s<>]*)?/gi;

    while ((match = absoluteRegex.exec(normalized)) !== null) {
        candidates.push(match[0]);
    }

    var quotedMediaRegex =
        /["']([^"']+?\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/gi;

    while ((match = quotedMediaRegex.exec(normalized)) !== null) {
        var candidate = match[1];

        if (/^https?:\/\//i.test(candidate)) {
            candidates.push(candidate);
        } else {
            candidates.push(resolveAgainst(candidate, baseUrl || BASE_URL));
        }
    }

    candidates = uniqueStrings(candidates);

    var valid = [];

    for (var i = 0; i < candidates.length; i++) {
        if (validateStreamUrl(candidates[i])) {
            valid.push(candidates[i]);
        }
    }

    return valid;
}

function validateStreamUrl(url) {
    if (!url) return false;

    return /^https?:\/\//i.test(url) &&
        /\.(?:m3u8|mp4)(?:\?|$)/i.test(url);
}

function getOrigin(url) {
    var match = String(url || "").match(/^(https?:\/\/[^\/]+)/i);
    return match ? match[1] : BASE_URL;
}

function resolveAgainst(value, base) {
    if (!value) return "";

    value = decodeHtml(String(value).trim());
    base = String(base || BASE_URL);

    if (/^https?:\/\//i.test(value)) return value;

    if (value.indexOf("//") === 0) {
        var scheme = /^http:\/\//i.test(base) ? "http:" : "https:";
        return scheme + value;
    }

    var origin = getOrigin(base);

    if (value.charAt(0) === "/") {
        return origin + value;
    }

    var cleanBase = base.split("#")[0].split("?")[0];
    var slash = cleanBase.lastIndexOf("/");
    var directory =
        slash > cleanBase.indexOf("://") + 2
            ? cleanBase.substring(0, slash + 1)
            : cleanBase + "/";

    return directory + value;
}
