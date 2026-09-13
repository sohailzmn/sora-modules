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

/* -------------------------------------------------------------------------- */
/* SEARCH                                                                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* DETAILS                                                                    */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* EPISODES                                                                   */
/* -------------------------------------------------------------------------- */

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

        // Only keep actual season pages, not episode links.
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

    var rowRegex =
        /<tr\b[^>]*itemtype=["']http:\/\/schema\.org\/Episode["'][^>]*>[\s\S]*?<\/tr>/gi;

    var rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
        var row = rowMatch[0];

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

        result.episodes.push({
            href: absoluteUrl(hrefMatch[1]),
            number: number
        });
    }

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
    // AniWorld uses /public/img/german.svg for German audio.
    // Do NOT confuse it with japanese-german.svg, which represents German subtitles.
    if (/src=["'][^"']*\/german\.svg(?:\?[^"']*)?["']/i.test(row)) {
        return true;
    }

    if (/title=["'][^"']*(?:Deutsch\/German|Deutsche Sprache)[^"']*["']/i.test(row)) {
        return true;
    }

    return false;
}

/* -------------------------------------------------------------------------- */
/* STREAM                                                                     */
/* -------------------------------------------------------------------------- */

async function extractStreamUrl(url) {
    try {
        var response = await soraFetch(url, {
            headers: {
                "Accept": "text/html,application/xhtml+xml",
                "Referer": BASE_URL + "/"
            }
        });

        var html = await readText(response);
        if (!html) {
            return JSON.stringify({ streams: [] });
        }

        var candidates = extractDirectPublicMediaUrls(html);
        var streams = [];

        for (var i = 0; i < candidates.length; i++) {
            var streamUrl = candidates[i];

            streams.push({
                title: streamUrl.indexOf(".m3u8") !== -1
                    ? "HLS • German Dub"
                    : "MP4 • German Dub",
                streamUrl: streamUrl,
                headers: {
                    "Referer": url,
                    "Origin": BASE_URL
                }
            });
        }

        console.log("[AniWorld] Direct media streams:", streams.length);

        return JSON.stringify({
            streams: streams
        });
    } catch (error) {
        console.log("[AniWorld] extractStreamUrl error:", error);
        return JSON.stringify({ streams: [] });
    }
}

function extractDirectPublicMediaUrls(html) {
    if (!html) return [];

    var normalized = String(html)
        .replace(/\\\//g, "/")
        .replace(/\\u0026/gi, "&")
        .replace(/&amp;/gi, "&");

    var candidates = [];

    var absoluteRegex =
        /https?:\/\/[^"'\\\s<>]+?\.(?:m3u8|mp4)(?:\?[^"'\\\s<>]*)?/gi;

    var match;

    while ((match = absoluteRegex.exec(normalized)) !== null) {
        candidates.push(match[0]);
    }

    var relativeRegex =
        /["'](\/[^"'\\\s<>]+?\.(?:m3u8|mp4)(?:\?[^"'\\\s<>]*)?)["']/gi;

    while ((match = relativeRegex.exec(normalized)) !== null) {
        candidates.push(absoluteUrl(match[1]));
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
