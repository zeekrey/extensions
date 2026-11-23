import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatTrackForHUD,
  IcyParser,
  parseStreamTitle,
  readCurrentTrack,
} from "../src/lib/icy";

function frame(title: string, interval = 7): Buffer {
  const data = Buffer.from(`StreamTitle='${title}';StreamUrl='';`, "utf8");
  const blocks = Math.ceil(data.length / 16);
  const padded = Buffer.alloc(blocks * 16);
  data.copy(padded);
  return Buffer.concat([
    Buffer.alloc(interval, 42),
    Buffer.from([blocks]),
    padded,
  ]);
}

test("parses metadata across every possible chunk boundary", () => {
  const bytes = frame("Beyoncé - Halo");
  for (let split = 0; split <= bytes.length; split++) {
    const parser = new IcyParser(7);
    assert.deepEqual(
      [
        ...parser.push(bytes.subarray(0, split)),
        ...parser.push(bytes.subarray(split)),
      ],
      ["Beyoncé - Halo"],
    );
  }
});

test("parses byte-by-byte chunks, empty frames, and multiple frames", () => {
  const bytes = Buffer.concat([
    Buffer.alloc(7),
    Buffer.from([0]),
    frame("Artist - First"),
    frame("Artist - Second"),
  ]);
  const parser = new IcyParser(7);
  const titles = [...bytes].flatMap((byte) => parser.push(Buffer.from([byte])));
  assert.deepEqual(titles, ["Artist - First", "Artist - Second"]);
});

test("handles apostrophes, Latin-1, and empty or malformed metadata", () => {
  assert.equal(
    parseStreamTitle(Buffer.from("StreamTitle='Guns N' Roses - Don't Cry';")),
    "Guns N' Roses - Don't Cry",
  );
  assert.equal(
    parseStreamTitle(Buffer.from("StreamTitle='Björk - Jóga';", "latin1")),
    "Björk - Jóga",
  );
  assert.equal(parseStreamTitle(Buffer.from("StreamTitle='';")), undefined);
  assert.equal(parseStreamTitle(Buffer.from("not metadata")), undefined);
});

test("handles extra ICY fields without copying them and ignores advertisements", () => {
  assert.equal(
    parseStreamTitle(
      Buffer.from("StreamTitle='Artist - Song';OtherField='value';"),
    ),
    "Artist - Song",
  );
  assert.equal(
    parseStreamTitle(
      Buffer.from(
        "StreamTitle='Absolut HOT';AdCreativeId='123';AdTitle='In-Stream Audio';Advertiser='example.com';",
      ),
    ),
    undefined,
  );
});

test("formats the first artist-title separator for the HUD without altering other titles", () => {
  assert.equal(formatTrackForHUD("Beyoncé - Halo"), "Beyoncé ‧ Halo");
  assert.equal(
    formatTrackForHUD("Artist - Part 1 - Part 2"),
    "Artist ‧ Part 1 - Part 2",
  );
  assert.equal(formatTrackForHUD("AC-DC"), "AC-DC");
  assert.equal(
    formatTrackForHUD("Station announcement"),
    "Station announcement",
  );
});

test("rejects missing, invalid, or excessive metadata intervals", () => {
  for (const interval of [0, -1, NaN, Infinity, 0.5, 32 * 1024 * 1024])
    assert.throws(() => new IcyParser(interval));
});

test("fetches track metadata and closes the audio connection after reading", async (context) => {
  let canceled = false;
  context.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      assert.equal(
        (options.headers as Record<string, string>)["Icy-MetaData"],
        "1",
      );
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(frame("Artist - Song"));
          },
          cancel() {
            canceled = true;
          },
        }),
        { headers: { "icy-metaint": "7" } },
      );
    },
  );
  assert.equal(
    await readCurrentTrack("https://example.com/radio"),
    "Artist - Song",
  );
  assert.equal(canceled, true);
});

test("handles station HTTP failures without returning a false track", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 503 }),
  );
  await assert.rejects(
    readCurrentTrack("https://example.com/radio"),
    /HTTP 503/,
  );
});

test("handles streams without metadata and closes their connection", async (context) => {
  let canceled = false;
  context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          cancel() {
            canceled = true;
          },
        }),
      ),
  );
  await assert.rejects(
    readCurrentTrack("https://example.com/radio"),
    /valid live track metadata/,
  );
  assert.equal(canceled, true);
});

test("passes command cancellation to the stream request", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      if (options.signal?.aborted)
        throw new DOMException("Aborted", "AbortError");
      throw new Error("Expected an aborted signal");
    },
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    readCurrentTrack("https://example.com/radio", controller.signal),
    /Aborted/,
  );
});
