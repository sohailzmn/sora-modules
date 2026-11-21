"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "UnifiedGerman_v1.js"), "utf8");
function seriesInstance() {
  const ctx = instance();
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "sToGerDub_Serienstream_v32.js"), "utf8"), ctx);
  return ctx;
}

test("a stalled first mirror cannot hide a working alternative", async () => {
  const ctx = seriesInstance();
  const calls = [];
  ctx.stoCapture = async hoster => {
    calls.push(hoster.title);
    if (hoster.title === "stalled") return new Promise(() => {});
    return {streamUrl:"https://media.example/working.m3u8",title:hoster.title};
  };
  const streams = await ctx.stoResolveHosters([
    {title:"stalled"}, {title:"working"}
  ], "episode", 100, 5);
  assert.equal(streams.length, 1);
  assert.deepEqual(calls, ["stalled", "working"]);
});

test("mirror resolution is bounded and never retries a failed hoster", async () => {
  const ctx = seriesInstance();
  let calls = 0;
  ctx.stoCapture = async () => { calls++; throw new Error("blocked"); };
  assert.equal((await ctx.stoResolveHosters(Array.from({length:8}, () => ({title:"dead"})), "episode", 50, 5)).length, 0);
  assert.equal(calls, 4);
  ctx.stoCapture = () => new Promise(() => {});
  assert.equal((await ctx.stoResolveHosters([{title:"hung"}], "episode", 10, 5)).length, 0);
});

test("series metadata reads Open Graph regardless of attribute order", async () => {
  const ctx = seriesInstance();
  ctx.__requestText = async () => '<h1>Dexter</h1>' +
    '<meta content="A real series synopsis" property="og:description">' +
    '<meta content="/cover/dexter.jpg" property="og:image">';
  const details = JSON.parse(await ctx.extractDetails("https://serienstream.to/serie/dexter"))[0];
  assert.equal(details.description, "A real series synopsis");
  assert.equal(details.image, "https://serienstream.to/cover/dexter.jpg");
});

test("unified playback automatically uses an available hoster when the first stalls", async () => {
  const ctx = instance();
  const episode = "https://serienstream.to/serie/dexter-wiedererwachen/staffel-2/episode-6";
  const visited = [];
  ctx.fetchv2 = async url => ({status:200, text:async()=>url===episode ?
    '<button data-play-url="/r?t=stalled" data-provider-name="VOE" data-language-id="1"></button>' +
    '<button data-play-url="/r?t=working" data-provider-name="Vidmoly" data-language-id="1"></button>' :
    '#EXTM3U\n#EXTINF:10,\nsegment.ts'});
  ctx.networkFetch = async url => {
    visited.push(url);
    if(url.includes("stalled"))return new Promise(()=>{});
    return {success:true,requests:["https://media.example/video.m3u8"],html:""};
  };
  const result = JSON.parse(await ctx.extractStreamUrl(episode));
  assert.equal(result.streams[0].streamUrl,"https://media.example/video.m3u8");
  assert.equal(visited.length,2);
  assert.equal(result.blockedReason,undefined);
});
function instance() {
  const context = vm.createContext({
    console: { warn() {}, log() {} },
    setTimeout, clearTimeout,
    fetchv2: async () => { throw new Error("No network in fixture tests"); },
    networkFetch: async () => { throw new Error("No network in fixture tests"); },
    fetch: async () => { throw new Error("No network in fixture tests"); }
  });
  vm.runInContext(source, context, { timeout: 3000 });
  return context;
}

test("a ten-second browser result survives the surrounding resolver deadline", async () => {
  const ctx = instance();
  // Scale all module timers together. Previously the 8-second outer timer
  // discarded the 10-second networkFetch result before it could be inspected.
  ctx.setTimeout = (callback, ms) => setTimeout(callback, ms / 100);
  const streams = await ctx.__shiroxResolveLanguage(
    [{language:{languagePriority:0}}],
    () => new Promise(resolve => ctx.setTimeout(() => resolve({streamUrl:"https://media.example/episode.m3u8",audioLanguage:"de"}),10000)),
    {languagePriority:0});
  assert.equal(streams.length,1);
});

test("failed first three hosters do not prevent a fourth valid hoster", async () => {
  const ctx = instance();
  const visited = [];
  const streams = await ctx.__shiroxResolveLanguage(
    [0,1,2,3].map(id => ({id,language:{languagePriority:0}})),
    async hoster => { visited.push(hoster.id); return hoster.id===3 ? {streamUrl:"https://media.example/fourth.m3u8",audioLanguage:"de"} : null; },
    {languagePriority:0});
  assert.equal(streams.length,1);
  assert.ok(visited.includes(3));
});

test("source shelves keep anime and series separate and remove episode promotions", () => {
  const ctx=instance();
  const html='<a href="/anime/stream/spy-x-family"><img data-src="/poster.jpg"><h3>Spy x Family</h3></a>' +
    '<a href="/anime/stream/spy-x-family/staffel-1/episode-1"><h3>Episode promotion</h3></a>'+
    '<a href="https://serienstream.cx/serie/dexter"><h3>Dexter</h3></a>';
  assert.equal(ctx.__unifiedCatalogRows(html,"anime").length,1);
  assert.equal(ctx.__unifiedCatalogRows(html,"anime")[0].title,"Spy x Family");
  assert.equal(ctx.__unifiedCatalogRows(html,"series")[0].href,"https://serienstream.to/serie/dexter");
  assert.equal(ctx.__unifiedProvider("https://serienstream.cx/serie/dexter").id,"serienstream");
  assert.equal(ctx.__unifiedProvider("https://aniworld.cc/anime/stream/spy-x-family").id,"aniworld");
});

test("normal domain failure retries the published alternative without changing TLS", async () => {
  const ctx=instance(),visited=[];
  ctx.fetchv2=async url => {visited.push(url);if(url.includes("serienstream.to"))throw Error("DNS");return {status:200};};
  assert.equal((await ctx.__shiroxSourceRequest("https://serienstream.to/serie/dexter",{},"GET",null)).status,200);
  assert.deepEqual(visited,["https://serienstream.to/serie/dexter","https://serienstream.cx/serie/dexter"]);
});
test("all bundled JavaScript parses in the module runtime", () => {
  assert.ok(instance().__UNIFIED_SOURCES.length === 2);
});
test("catalogues are searched together, with unambiguous source URLs", async () => {
  const ctx = instance();
  ctx.__UNIFIED_SOURCES[0].api.searchResults = async () => JSON.stringify([
    { title: "One Piece", image: "poster", href: "/anime/stream/one-piece" }
  ]);
  ctx.__UNIFIED_SOURCES[1].api.searchResults = async () => JSON.stringify([
    { title: "One Piece", image: "poster", href: "/serie/one-piece" }
  ]);
  const results = JSON.parse(await ctx.searchResults("One Piece"));
  assert.equal(results.length, 2);
  assert.match(results[0].href, /^https:\/\/aniworld\.to\//);
  assert.match(results[1].href, /^https:\/\/serienstream\.to\//);
});
test("one provider failure doesn't hide the other provider's results", async () => {
  const ctx = instance();
  ctx.__UNIFIED_SOURCES[0].api.searchResults = async () => { throw new Error("offline"); };
  ctx.__UNIFIED_SOURCES[1].api.searchResults = async () => JSON.stringify([
    { title: "Dexter", image: "", href: "https://serienstream.to/serie/dexter" }
  ]);
  assert.equal(JSON.parse(await ctx.searchResults("Dexter")).length, 1);
});
test("episodes route exclusively to their matching catalogue", async () => {
  const ctx = instance();
  let calls = [0, 0];
  ctx.__UNIFIED_SOURCES[0].api.extractEpisodes = async () => {
    calls[0]++; return JSON.stringify([{ number: 1, href: "/episode-1" }]);
  };
  ctx.__UNIFIED_SOURCES[1].api.extractEpisodes = async () => {
    calls[1]++; return JSON.stringify([{ number: 2, href: "/episode-2" }]);
  };
  assert.equal(JSON.parse(await ctx.extractEpisodes("https://serienstream.to/serie/dexter")).length, 1);
  assert.equal(calls[0], 0);
  assert.equal(calls[1], 1);
  assert.equal(await ctx.extractEpisodes("https://untrusted.example/movie"), "[]");
});
test("stream URLs are deduplicated and invalid URLs are discarded", async () => {
  const ctx = instance();
  ctx.__UNIFIED_SOURCES[0].api.extractStreamUrl = async () => JSON.stringify({
    streams: [
      { title: "VOE", streamUrl: "https://media.example/a.m3u8" },
      { title: "VOE duplicate", streamUrl: "https://media.example/a.m3u8" },
      { title: "Filemoon", streamUrl: "https://media.example/b.m3u8" },
      { title: "bad", streamUrl: "not-an-url" }
    ]
  });
  const result = JSON.parse(await ctx.extractStreamUrl("https://aniworld.to/anime/stream/one-piece/staffel-1/episode-1"));
  assert.deepEqual(result.streams.map(s => s.title), ["VOE", "Filemoon"]);
});


test("AniWorld v2 provider buttons identify German dub", () => {
  const context = vm.createContext({console:{warn(){},log(){}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "AniWorldGerDub_v341.js"), "utf8"), context);
  const html = '<button data-play-url="/r?t=de1" data-provider-name="VOE" data-language-id="1"></button>' +
               '<button data-play-url="/r?t=en1" data-provider-name="VOE" data-language-id="2"></button>';
  const hosts = context.__awHosters(html);
  assert.equal(hosts.length, 1);
  assert.match(hosts[0].url, /^https:\/\/aniworld\.to\/r\?/);
});
test("SerienStream v2 provider buttons recognise German language id", () => {
  const context = vm.createContext({console:{warn(){},log(){}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "sToGerDub_Serienstream_v32.js"), "utf8"), context);
  const html = '<button data-play-url="/r?t=de1" data-provider-name="VOE" data-language-id="1"></button>' +
               '<button data-play-url="/r?t=en1" data-provider-name="VOE" data-language-id="2"></button>';
  const hosts = context.stoHosters(html);
  assert.equal(hosts.length, 1);
  assert.match(hosts[0].url, /^https:\/\/serienstream\.to\/r\?/);
});

test("blocked catalogue cannot hold another catalogue's results hostage", async () => {
  const ctx=instance();
  ctx.__UNIFIED_SEARCH_TIMEOUT_MS=15;
  ctx.__UNIFIED_SOURCES[0].api.searchResults=async()=>JSON.stringify([
    {title:"Kusuriya no Hitorigoto",image:"poster",href:"/anime/stream/kusuriya-no-hitorigoto"}
  ]);
  ctx.__UNIFIED_SOURCES[1].api.searchResults=()=>new Promise(()=>{});
  const began=Date.now();
  const result=JSON.parse(await ctx.searchResults("Kusuriya no Hitorigoto"));
  assert.equal(result.length,1);
  assert.ok(Date.now()-began<1000,"blocked S.to must not hang AniWorld");
});
test("stalled episode and stream lookups return bounded empty results", async () => {
  const ctx=instance();
  ctx.__UNIFIED_EPISODES_TIMEOUT_MS=15;
  ctx.__UNIFIED_STREAMS_TIMEOUT_MS=15;
  ctx.__UNIFIED_SOURCES[0].api.extractEpisodes=()=>new Promise(()=>{});
  ctx.__UNIFIED_SOURCES[0].api.extractStreamUrl=()=>new Promise(()=>{});
  const href="https://aniworld.to/anime/stream/example";
  assert.equal(await ctx.extractEpisodes(href),"[]");
  const streams=JSON.parse(await ctx.extractStreamUrl(href));
  assert.equal(streams.streams.length,0);
});

test("unified source finds validated The Apothecary Diaries S3 when AJAX is blocked", async()=>{
  const ctx=instance();
  ctx.__UNIFIED_SEARCH_TIMEOUT_MS=20;
  ctx.__UNIFIED_SOURCES[0].api.searchResults=()=>new Promise(()=>{});
  ctx.__UNIFIED_SOURCES[1].api.searchResults=async()=>JSON.stringify([]);
  ctx.fetchv2=async()=>({
    status:200,
    text:async()=>'<html><h1>The Apothecary Diaries</h1><a href="/anime/stream/the-apothecary-diaries/staffel-3/episode-1">Ep 1</a></html>'
  });
  const result=JSON.parse(await ctx.searchResults("The Apothecary Diaries Season 3"));
  assert.equal(result.length,1);
  assert.equal(result[0].href,"https://aniworld.to/anime/stream/the-apothecary-diaries");
});
test("unified direct lookup refuses a wrong title despite HTTP 200",async()=>{
  const ctx=instance();
  ctx.__UNIFIED_SOURCES[0].api.searchResults=async()=>JSON.stringify([]);
  ctx.__UNIFIED_SOURCES[1].api.searchResults=async()=>JSON.stringify([]);
  ctx.fetchv2=async()=>({
    status:200,
    text:async()=>'<html><h1>Unrelated Show</h1><a href="/staffel-3/episode-1">Ep 1</a></html>'
  });
  assert.equal(JSON.parse(await ctx.searchResults("The Apothecary Diaries Season 3")).length,0);
});

test("S.to fast search validates German alias for Dexter: Resurrection",async()=>{
 const context=vm.createContext({console:{warn(){},log(){}},setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync(path.join(__dirname,"..","sToGerDub_Serienstream_v32.js"),"utf8"),context);
 context.__requestText=async(url)=>{
  if(url.includes("/serie/dexter-wiedererwachen"))
   return '<html><h1>Dexter: Wiedererwachen</h1><a href="/serie/dexter-wiedererwachen/staffel-2">Staffel 2</a></html>';
  return '<html><h1>SerienStream</h1></html>';
 };
 const results=JSON.parse(await context.searchResults("Dexter: Resurrection"));
 assert.equal(results.length,1);
 assert.equal(results[0].href,"https://serienstream.to/serie/dexter-wiedererwachen");
});
test("S.to discovers newer season from published latest-episode marker",()=>{
 const context=vm.createContext({console:{warn(){},log(){}},setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync(path.join(__dirname,"..","sToGerDub_Serienstream_v32.js"),"utf8"),context);
 const html='<h1>Dexter: Wiedererwachen</h1> Kommende Episode S02E04 startet am Freitag';
 assert.deepEqual(Array.from(context.stoSeasonNumbers(html,"https://serienstream.to/serie/dexter-wiedererwachen")),[2]);
 assert.ok(context.stoIsPublishedEpisode('<h2>S02E04: Junges Blut</h2><p>Deutsch VOE</p>',2,4));
 assert.equal(context.stoIsPublishedEpisode('<h2>S02E05: Soon</h2><p>Coming soon</p>',2,5),false);
});
test("S.to episode list includes validated recent episode when S2 index is empty",async()=>{
 const context=vm.createContext({console:{warn(){},log(){}},setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync(path.join(__dirname,"..","sToGerDub_Serienstream_v32.js"),"utf8"),context);
 context.__requestText=async(url)=>{
  if(url.endsWith("/serie/dexter-wiedererwachen"))
   return '<h1>Dexter: Wiedererwachen</h1> Kommende Episode S02E04 startet am Freitag <table><tr><td>1</td><td>Episode 1</td></tr></table>';
  if(url.endsWith("/staffel-2/episode-4"))
   return '<h1>Dexter: Wiedererwachen</h1><h2>S02E04: Junges Blut</h2><p>Deutsch VOE</p>';
  return '';
 };
 const episodes=JSON.parse(await context.extractEpisodes("https://serienstream.to/serie/dexter-wiedererwachen"));
 assert.ok(episodes.some(e=>e.href.endsWith("/staffel-2/episode-4")),"most recent verified S2 episode must be present");
 assert.ok(!episodes.some(e=>e.href.endsWith("/staffel-2/episode-5")),"unpublished episode must not be synthesized");
});

test("unified source reports an access challenge rather than a missing video", async () => {
  const ctx = instance();
  ctx.__UNIFIED_SOURCES[1].api.extractStreamUrl = async () => JSON.stringify({
    streams: [], subtitles: [], blockedReason: "website_verification_required"
  });
  const result = JSON.parse(await ctx.extractStreamUrl(
    "https://serienstream.to/serie/example/staffel-2/episode-6"
  ));
  assert.equal(result.blockedReason, "website_verification_required");
  assert.deepEqual(result.streams, []);
});
test("ordinary empty stream result is not mislabeled as a website challenge", async () => {
  const ctx = instance();
  ctx.__UNIFIED_SOURCES[1].api.extractStreamUrl = async () => JSON.stringify({
    streams: [], subtitles: []
  });
  const result = JSON.parse(await ctx.extractStreamUrl(
    "https://serienstream.to/serie/example/staffel-2/episode-6"
  ));
  assert.equal(result.blockedReason, undefined);
});

test("language contract distinguishes dubbing from German and English subtitles", () => {
  const ctx=instance();
  assert.equal(ctx.__shiroxLanguage("Deutsch").audioLanguage,"de");
  assert.equal(ctx.__shiroxLanguage("Deutsch Untertitel").languagePriority,1);
  assert.equal(ctx.__shiroxLanguage("English Sub").languagePriority,2);
  assert.equal(ctx.__shiroxLanguage("English").audioLanguage,"en");
  assert.equal(ctx.__shiroxLanguage(""),null);
});

test("German subtitle hosters are retained with their real language metadata",()=>{
 const ctx=seriesInstance();
 const hosters=ctx.stoHosters('<button data-play-url="/r?t=sub" data-provider-name="VOE" data-language-label="Deutsch Sub"></button>');
 assert.equal(hosters.length,1);
 assert.equal(hosters[0].language.audioLanguage,"und");
 assert.equal(hosters[0].language.subtitleLanguage,"de");
 assert.equal(hosters[0].language.isHardsub,true);
});

test("soft subtitle URLs and language labels are extracted from real player tracks",()=>{
 const ctx=instance();
 const tracks=ctx.__shiroxTracks('<track kind="subtitles" srclang="de" label="Deutsch" src="/subs/de.vtt">'+
   '<track kind="subtitles" srclang="en" label="English" src="/subs/en.vtt">',"https://player.example/embed/123");
 assert.equal(tracks.length,2);
 assert.equal(tracks[0].url,"https://player.example/subs/de.vtt");
 assert.equal(tracks[0].lang,"de");
});

test("each language stage only returns candidates matching that stage",async()=>{
 const ctx=instance();
 const hosters=[{language:ctx.__shiroxLanguage("Deutsch")},{language:ctx.__shiroxLanguage("Deutsch Sub")},{language:ctx.__shiroxLanguage("English Sub")}];
 const capture=async h=>({streamUrl:"https://media.example/"+h.language.languagePriority+".m3u8",...h.language});
 for(let priority=0;priority<3;priority++){
  const results=await ctx.__shiroxResolveLanguage(hosters,capture,{languagePriority:priority});
  assert.equal(results.length,1);
  assert.match(results[0].streamUrl,new RegExp(priority+"\\.m3u8$"));
 }
});

test("English remains eligible when a hoster exposes both German and English soft subtitles",async()=>{
 const ctx=instance();
 const hosters=[{language:ctx.__shiroxLanguage("English")}];
 const capture=async()=>({streamUrl:"https://media.example/v.m3u8",audioLanguage:"en",allSubtitles:[{lang:"de"},{lang:"en"}]});
 assert.equal((await ctx.__shiroxResolveLanguage(hosters,capture,{languagePriority:2})).length,1);
});

test("a series lookup does not wait for the unrelated anime catalogue",async()=>{
 const ctx=instance();
 let animeCalls=0;
 ctx.__UNIFIED_SOURCES[0].api.searchResults=async()=>{animeCalls++;return new Promise(()=>{})};
 ctx.__UNIFIED_SOURCES[1].api.searchResults=async()=>JSON.stringify([{title:"Dexter",href:"/serie/dexter",image:""}]);
 const results=JSON.parse(await ctx.searchResults("Dexter",{kind:"series"}));
 assert.equal(animeCalls,0);
 assert.equal(results.length,1);
});

test("targeted season lookup does not fetch unrelated seasons",async()=>{
 const ctx=seriesInstance();
 const visited=[];
 ctx.__requestText=async url=>{
  visited.push(url);
  if(url.endsWith("/serie/dexter"))return '<h1>Dexter</h1><a href="/serie/dexter/staffel-1">Staffel 1</a><a href="/serie/dexter/staffel-2">Staffel 2</a>';
  if(url.endsWith("/staffel-2"))return '<a href="/serie/dexter/staffel-2/episode-6">Folge 6</a>';
  throw new Error("Unrelated season must not be requested");
 };
 const episodes=JSON.parse(await ctx.extractEpisodes("https://serienstream.to/serie/dexter",{season:2}));
 assert.equal(episodes.length,1);
 assert.equal(episodes[0].href,"https://serienstream.to/serie/dexter/staffel-2/episode-6");
 assert.ok(!visited.some(url=>url.endsWith("/staffel-1")));
});
