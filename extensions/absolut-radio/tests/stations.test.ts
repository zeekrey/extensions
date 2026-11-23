import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { findStation, STATIONS } from "../src/lib/stations";

test("includes all six broadcast stations and eight online streams", () => {
  assert.equal(STATIONS.length, 14);
  assert.equal(STATIONS.filter((s) => s.kind === "station").length, 6);
  assert.equal(STATIONS.filter((s) => s.kind === "stream").length, 8);
  assert.equal(new Set(STATIONS.map((s) => s.id)).size, STATIONS.length);
});

test("every station has local artwork and HTTPS broadcaster URLs", () => {
  for (const station of STATIONS) {
    assert.ok(existsSync(`assets/${station.artwork}`), station.artwork);
    const stream = new URL(station.url);
    assert.equal(stream.protocol, "https:");
    assert.ok(stream.hostname.endsWith(".live-sm.absolutradio.de"));
    assert.equal(new URL(station.website).hostname, "absolutradio.de");
  }
});

test("remembers IDs and defaults missing or retired stations to Hot", () => {
  assert.equal(findStation("rock").name, "Absolut Rock");
  assert.equal(findStation(undefined).id, "hot");
  assert.equal(findStation("retired").id, "hot");
});
