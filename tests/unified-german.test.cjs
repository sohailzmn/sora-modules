"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "UnifiedGerman_v1.js"), "utf8");
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
