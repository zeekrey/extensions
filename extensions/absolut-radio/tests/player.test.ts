import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";

test(
  "macOS playback helper starts an AVPlayer",
  { skip: process.platform !== "darwin", timeout: 15000 },
  async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "absolut-player-test-"));
    const audioPath = path.join(dir, "silence.wav");
    const statusPath = path.join(dir, "status.json");
    // A local 30-second PCM file avoids depending on a radio server or the network.
    const sampleRate = 44100;
    const dataLength = sampleRate * 2 * 30;
    const wav = Buffer.alloc(44 + dataLength);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(36 + dataLength, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(dataLength, 40);
    await writeFile(audioPath, wav);

    const child = spawn(
      "/usr/bin/osascript",
      [
        "-l",
        "JavaScript",
        path.resolve("assets/player.js"),
        pathToFileURL(audioPath).href,
        statusPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const exited = new Promise<void>((resolve) =>
      child.once("exit", () => resolve()),
    );
    try {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const content = await readFile(statusPath, "utf8").catch(
          () => undefined,
        );
        if (content) {
          const status = JSON.parse(content) as {
            state: string;
            message: string;
          };
          assert.equal(status.state, "playing", status.message);
          return;
        }
        assert.equal(
          child.exitCode,
          null,
          `Helper exited unexpectedly: ${stderr}`,
        );
        await delay(100);
      }
      assert.fail(`Helper did not start in time: ${stderr}`);
    } finally {
      child.kill();
      await exited;
      await rm(dir, { recursive: true, force: true });
    }
  },
);
