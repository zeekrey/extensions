import { showHUD, showToast, Toast } from "@raycast/api";
import { showError } from "./lib/feedback";
import { formatTrackForHUD, readCurrentTrack } from "./lib/icy";
import { lastStation } from "./lib/player";

export default async function Command() {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Getting current track…",
  });
  let title: string;
  try {
    const station = await lastStation();
    title = await readCurrentTrack(station.url);
  } catch (error) {
    await toast.hide();
    await showError("Could Not Get Current Track", error);
    return;
  }
  await toast.hide();
  await showHUD(formatTrackForHUD(title));
}
