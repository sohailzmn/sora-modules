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
