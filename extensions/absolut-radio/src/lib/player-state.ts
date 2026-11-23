import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PlayerState {
  pid: number;
  statusPath: string;
  stationId: string;
}

export interface PlayerStatus {
  state: "playing" | "error";
  message: string;
}

export interface PlaybackSnapshot {
  stationId?: string;
  error?: { id: string; message: string };
}

function stateError(statePath: string): Error {
  return new Error(
    `Player state is unreadable or invalid. Stop any Absolut Radio audio helper before removing ${statePath}, then try again.`,
  );
}

export async function readPlayerState(
  statePath: string,
  supportPath: string,
): Promise<PlayerState | undefined> {
  let content: string;
  try {
    content = await readFile(statePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw stateError(statePath);
  }
  try {
    const state = JSON.parse(content) as PlayerState | null;
    if (
      !state ||
      !Number.isSafeInteger(state.pid) ||
      state.pid <= 0 ||
      typeof state.statusPath !== "string" ||
      path.dirname(state.statusPath) !== supportPath ||
      !/^playback-[a-f0-9-]+\.json$/.test(path.basename(state.statusPath)) ||
      typeof state.stationId !== "string" ||
      !state.stationId
    )
      throw stateError(statePath);
    return state;
  } catch {
    throw stateError(statePath);
  }
}

export async function readPlayerStatus(
  statusPath: string,
): Promise<PlayerStatus | undefined> {
  let content: string;
  try {
    content = await readFile(statusPath, "utf8");
  } catch (error) {
    // The helper creates this file after it starts, so it may not exist yet.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error("Could not read the audio helper status. Try again.");
  }
  try {
    const result = JSON.parse(content) as PlayerStatus | null;
    if (
      !result ||
      (result.state !== "playing" && result.state !== "error") ||
      typeof result.message !== "string"
    )
      throw new Error();
    return result;
  } catch {
    throw new Error("The audio helper returned an invalid status. Try again.");
  }
}

export function summarizePlayback(
  state: PlayerState,
  status: PlayerStatus | undefined,
  owned: boolean,
): PlaybackSnapshot {
  if (status?.state === "error") {
    return {
      error: {
        id: state.statusPath,
        message: status.message || "The stream stopped. Run Play to reconnect.",
      },
    };
  }
  if (status?.state === "playing") {
    return owned
      ? { stationId: state.stationId }
      : {
          error: {
            id: state.statusPath,
            message:
              "The audio helper stopped unexpectedly. Run Play to reconnect.",
          },
        };
  }
  return {};
}
