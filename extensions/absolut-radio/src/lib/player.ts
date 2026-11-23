import { environment, LocalStorage } from "@raycast/api";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { findStation, Station } from "./stations";
import {
  PlaybackSnapshot,
  PlayerState,
  readPlayerState,
  readPlayerStatus,
  summarizePlayback,
} from "./player-state";

const execute = promisify(execFile);
const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const statePath = path.join(environment.supportPath, "player.json");
const lockPath = path.join(environment.supportPath, "player.lock");
const scriptPath = path.join(environment.assetsPath, "player.js");
const LAST_STATION = "last-station";

export async function lastStation(): Promise<Station> {
  return findStation(await LocalStorage.getItem<string>(LAST_STATION));
}

async function readState(): Promise<PlayerState | undefined> {
  return readPlayerState(statePath, environment.supportPath);
}

async function isOwnedProcess(state: PlayerState): Promise<boolean> {
  try {
    const { stdout } = await execute(
      "/bin/ps",
      ["-ww", "-p", String(state.pid), "-o", "command="],
      { timeout: 2000 },
    );
    // Never kill a process merely because a stored PID exists: PIDs can be reused.
    return (
      stdout.includes("osascript") &&
      stdout.includes(scriptPath) &&
      stdout.includes(state.statusPath)
    );
  } catch (error) {
    // ps exits with code 1 when the process no longer exists. Other failures
    // must not be mistaken for a successfully stopped player.
    if ((error as { code?: string | number }).code === 1) return false;
    throw new Error("Could not verify the audio helper process. Try again.");
  }
}

export async function playbackSnapshot(): Promise<PlaybackSnapshot> {
  const state = await readState();
  if (!state) return {};
  const status = await readPlayerStatus(state.statusPath);
  const owned = status?.state === "playing" && (await isOwnedProcess(state));
  const snapshot = summarizePlayback(state, status, owned);
  if (snapshot.error) {
    // Ignore an error from a player that another command has already replaced.
    const current = await readState();
    if (!current || current.statusPath !== state.statusPath) return {};
  }
  return snapshot;
}

async function stop(state: PlayerState | undefined): Promise<void> {
  if (state) {
    if (await isOwnedProcess(state)) {
      try {
        process.kill(state.pid, "SIGTERM");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
      // Wait for exit so switching stations never leaves two streams playing.
      for (
        let attempt = 0;
        attempt < 15 && (await isOwnedProcess(state));
        attempt++
      )
        await delay(100);
      if (await isOwnedProcess(state))
        throw new Error("The previous player did not stop. Try Pause again.");
    }
    await rm(state.statusPath, { force: true });
  }
  await rm(statePath, { force: true });
}

async function withLock<T>(action: () => Promise<T>): Promise<T> {
  await mkdir(environment.supportPath, { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try {
      await mkdir(lockPath, { mode: 0o700 });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // Recover from a Raycast command that crashed while holding the lock.
      const info = await stat(lockPath).catch(() => undefined);
      if (info && Date.now() - info.mtimeMs > 60000)
        await rm(lockPath, { recursive: true, force: true });
      if (attempt >= 150)
        throw new Error(
          "Another playback command is still running. Try again shortly.",
        );
      await delay(200);
    }
  }
  try {
    return await action();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

export async function playStation(station: Station): Promise<void> {
  if (process.platform !== "darwin")
    throw new Error("Playback requires macOS.");
  await withLock(async () => {
    const previous = await readState();
    if (
      previous?.stationId === station.id &&
      (await readPlayerStatus(previous.statusPath))?.state === "playing" &&
      (await isOwnedProcess(previous))
    ) {
      await LocalStorage.setItem(LAST_STATION, station.id);
      return;
    }
    await stop(previous);
    const statusPath = path.join(
      environment.supportPath,
      `playback-${randomUUID()}.json`,
    );
    const child = spawn(
      "/usr/bin/osascript",
      ["-l", "JavaScript", scriptPath, station.url, statusPath],
      {
        detached: true,
        stdio: "ignore",
      },
    );
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.unref();
    const next: PlayerState = {
      pid: child.pid!,
      statusPath,
      stationId: station.id,
    };
    try {
      await writeFile(statePath, JSON.stringify(next), { mode: 0o600 });
      const deadline = Date.now() + 25000;
      while (Date.now() < deadline) {
        const current = await readPlayerStatus(next.statusPath);
        if (current?.state === "error")
          throw new Error(current.message || "The stream could not be played.");
        if (current?.state === "playing") {
          await LocalStorage.setItem(LAST_STATION, station.id);
          return;
        }
        if (!(await isOwnedProcess(next)))
          throw new Error(
            "The macOS audio helper stopped unexpectedly. Try again.",
          );
        await delay(200);
      }
      throw new Error(
        "The stream took too long to start. Check your connection and try again.",
      );
    } catch (error) {
      await stop(next);
      throw error;
    }
  });
}

export async function pausePlayback(): Promise<void> {
  await withLock(async () => stop(await readState()));
}
