export interface Station {
  id: string;
  name: string;
  description: string;
  kind: "station" | "stream";
  url: string;
  website: string;
  artwork: string;
}

// Verified against https://absolutradio.de/sender-entdecken and its web player.
// Keep the broadcaster's stream URLs (including their existing attribution) intact.
const definitions = [
  [
    "hot",
    "Absolut Hot",
    "Current charts and modern hits",
    "station",
    "top",
    "hot",
  ],
  [
    "germany",
    "Absolut Germany",
    "German pop, urban, and rap",
    "station",
    "germany",
    "germany",
  ],
  [
    "top",
    "Absolut Top 2000er",
    "The best hits of the 2000s",
    "station",
    "top",
    "top",
  ],
  [
    "relax",
    "Absolut relax",
    "Relaxed favorites throughout the day",
    "station",
    "relax",
    "relax",
  ],
  [
    "oldies",
    "Absolut Classics",
    "Greatest pop and rock classics",
    "station",
    "oldieclassics",
    "oldieclassics",
  ],
  [
    "bella",
    "Absolut Bella",
    "German Schlager and international oldies",
    "station",
    "bella",
    "bella",
  ],
  [
    "80er",
    "Absolut 80er",
    "Pop and rock icons of the 80s",
    "stream",
    "80er",
    "80er",
  ],
  [
    "clubnight",
    "Absolut Top Clubnight",
    "Club sounds for your weekend",
    "stream",
    "clubnight",
    "clubnight",
  ],
  [
    "rock",
    "Absolut Rock",
    "Rock from the 90s and 2000s",
    "stream",
    "rock",
    "rock",
  ],
  [
    "lovesongs",
    "Absolut Lovesongs",
    "Love songs and ballads",
    "stream",
    "lovesongs",
    "lovesongs",
  ],
  ["ai", "Absolut Radio AI", "AI-hosted radio", "stream", "ai", "ai"],
  [
    "coffeemusic",
    "Absolut Coffeemusic",
    "Chillout sounds all day",
    "stream",
    "coffeemusic",
    "coffeemusic",
  ],
  [
    "christmas_time",
    "Absolut Christmas Time",
    "Christmas favorites",
    "stream",
    "christmastime",
    "christmastime",
  ],
  [
    "musicxl",
    "Absolut musicXL",
    "An alternative to the charts",
    "stream",
    "musicxl",
    "musicxl",
  ],
] as const;

export const STATIONS: Station[] = definitions.map(
  ([id, name, description, kind, host, mount]) => ({
    id,
    name,
    description,
    kind,
    url: `https://absolut-${host}.live-sm.absolutradio.de/absolut-${mount}/stream/aacp?${id === "christmas_time" ? "" : "maxvbr=3&"}aggregator=website`,
    website: `https://absolutradio.de/${kind === "stream" ? "stream" : "sender"}/${id}`,
    artwork: `stations/${id}.png`,
  }),
);

export function findStation(id: string | undefined): Station {
  return STATIONS.find((station) => station.id === id) ?? STATIONS[0];
}
