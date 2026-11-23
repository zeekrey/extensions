import { showHUD, showToast, Toast } from "@raycast/api";
import { lastStation, playStation } from "./lib/player";
import { showError } from "./lib/feedback";

export default async function Command() {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Connecting to Absolut Radio…",
  });
  try {
    const station = await lastStation();
    await playStation(station);
    await toast.hide();
    await showHUD(`Playing ${station.name}`);
  } catch (error) {
    await toast.hide();
    await showError("Could Not Play Station", error);
  }
}
