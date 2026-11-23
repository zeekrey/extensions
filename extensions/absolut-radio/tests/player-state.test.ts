import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readPlayerState,
  readPlayerStatus,
  summarizePlayback,
} from "../src/lib/player-state";

test("player state distinguishes a missing file from unreadable or invalid state", async (context) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "absolut-state-test-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const statePath = path.join(dir, "player.json");
  const state = {
    pid: 123,
    statusPath: path.join(dir, "playback-123abc.json"),
    stationId: "hot",
  };
  assert.equal(await readPlayerState(statePath, dir), undefined);
  await writeFile(statePath, JSON.stringify(state));
  assert.deepEqual(await readPlayerState(statePath, dir), state);
  for (const invalid of [
    "{",
    "null",
    JSON.stringify({ ...state, pid: -1 }),
    JSON.stringify({ ...state, statusPath: "/tmp/playback-123.json" }),
  ]) {
    await writeFile(statePath, invalid);
    await assert.rejects(
      readPlayerState(statePath, dir),
      /Player state is unreadable or invalid/,
    );
  }
  await assert.rejects(
    readPlayerState(dir, dir),
    /Player state is unreadable or invalid/,
  );
});

test("status errors and unexpected exits are surfaced, without misreporting startup as failure", async (context) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "absolut-status-test-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const statusPath = path.join(dir, "playback-123abc.json");
  const state = { pid: 123, statusPath, stationId: "hot" };
  assert.equal(await readPlayerStatus(statusPath), undefined);
  assert.deepEqual(summarizePlayback(state, undefined, false), {});
  await writeFile(
    statusPath,
    JSON.stringify({ state: "playing", message: "" }),
  );
  const playing = await readPlayerStatus(statusPath);
  assert.deepEqual(summarizePlayback(state, playing, true), {
    stationId: "hot",
  });
  assert.match(
    summarizePlayback(state, playing, false).error?.message ?? "",
    /stopped unexpectedly/,
  );
  await writeFile(
    statusPath,
    JSON.stringify({ state: "error", message: "The connection stalled." }),
  );
  assert.deepEqual(
    summarizePlayback(state, await readPlayerStatus(statusPath), false),
    {
      error: { id: statusPath, message: "The connection stalled." },
    },
  );
  await writeFile(statusPath, "not json");
  await assert.rejects(readPlayerStatus(statusPath), /invalid status/);
  await assert.rejects(readPlayerStatus(dir), /Could not read/);
});
