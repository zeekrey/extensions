import {
  Action,
  ActionPanel,
  Grid,
  Icon,
  LaunchType,
  launchCommand,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { STATIONS, Station } from "./lib/stations";
import { pausePlayback, playbackSnapshot, playStation } from "./lib/player";
import { errorMessage, showError } from "./lib/feedback";

export default function Command() {
  const [playingId, setPlayingId] = useState<string>();
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const reportedErrors = useRef(new Set<string>());

  useEffect(() => {
    if (busy) return;
    let active = true;
    let polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      try {
        const snapshot = await playbackSnapshot();
        if (!active) return;
        setPlayingId(snapshot.stationId);
        if (snapshot.error && !reportedErrors.current.has(snapshot.error.id)) {
          reportedErrors.current.add(snapshot.error.id);
          await showError("Playback Stopped", snapshot.error.message);
        }
      } catch (error) {
        if (!active) return;
        setPlayingId(undefined);
        const id = `state:${errorMessage(error)}`;
        if (!reportedErrors.current.has(id)) {
          reportedErrors.current.add(id);
          await showError("Could Not Check Playback", error);
        }
      } finally {
        polling = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [busy]);

  async function play(station: Station) {
    if (busy) return;
    setBusy(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Connecting to ${station.name}…`,
    });
    try {
      await playStation(station);
      setPlayingId(station.id);
      toast.style = Toast.Style.Success;
      toast.title = `Playing ${station.name}`;
    } catch (error) {
      await toast.hide();
      reportedErrors.current.add(`state:${errorMessage(error)}`);
      await showError("Could Not Play Station", error);
      setPlayingId(undefined);
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (busy) return;
    setBusy(true);
    try {
      await pausePlayback();
      setPlayingId(undefined);
      await showToast({ style: Toast.Style.Success, title: "Playback Paused" });
    } catch (error) {
      reportedErrors.current.add(`state:${errorMessage(error)}`);
      await showError("Could Not Pause Playback", error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Grid
      columns={3}
      aspectRatio="3/2"
      fit={Grid.Fit.Contain}
      isLoading={busy}
      searchBarPlaceholder="Search stations, genres, or moods…"
      searchBarAccessory={
        <Grid.Dropdown
          tooltip="Filter Stations"
          value={filter}
          onChange={setFilter}
        >
          <Grid.Dropdown.Item title="All Stations & Streams" value="all" />
          <Grid.Dropdown.Item title="Broadcast Stations" value="station" />
          <Grid.Dropdown.Item title="Online Streams" value="stream" />
        </Grid.Dropdown>
      }
    >
      <Grid.EmptyView
        title="No Matching Stations"
        description="Try another station name, genre, or mood."
        icon={Icon.MagnifyingGlass}
      />
      {STATIONS.filter(
        (station) => filter === "all" || station.kind === filter,
      ).map((station) => (
        <Grid.Item
          key={station.id}
          id={station.id}
          content={station.artwork}
          title={station.name}
          subtitle={
            playingId === station.id ? "▶ Playing" : station.description
          }
          keywords={[station.description, station.kind]}
          actions={
            <ActionPanel>
              <Action
                title="Play Station"
                icon={Icon.Play}
                onAction={() => play(station)}
              />
              <Action
                title="Pause Playback"
                icon={Icon.Pause}
                shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
                onAction={pause}
              />
              <Action
                title="Show Current Track"
                icon={Icon.Music}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
                onAction={() =>
                  launchCommand({
                    name: "current-track",
                    type: LaunchType.UserInitiated,
                  })
                }
              />
              <ActionPanel.Section>
                <Action.OpenInBrowser
                  title="Open Station Website"
                  url={station.website}
                />
                <Action.CopyToClipboard
                  title="Copy Stream URL"
                  content={station.url}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </Grid>
  );
}
