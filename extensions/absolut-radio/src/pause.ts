import { showHUD } from "@raycast/api";
import { pausePlayback } from "./lib/player";
import { showError } from "./lib/feedback";

export default async function Command() {
  try {
    await pausePlayback();
    await showHUD("Absolut Radio paused");
  } catch (error) {
    await showError("Could Not Pause Playback", error);
  }
}
