// ICY metadata is interleaved with audio: metaint audio bytes, one length byte,
// then length * 16 metadata bytes. Chunks can end anywhere in this sequence.
export class IcyParser {
  private audioRemaining: number;
  private metadataRemaining = 0;
  private metadata: Buffer[] = [];

  constructor(private readonly interval: number) {
    if (
      !Number.isSafeInteger(interval) ||
      interval <= 0 ||
      interval > 16 * 1024 * 1024
    ) {
      throw new Error(
        "This station does not provide valid live track metadata.",
      );
    }
    this.audioRemaining = interval;
  }

  push(chunk: Uint8Array): string[] {
    const buffer = Buffer.from(chunk);
    const titles: string[] = [];
    let offset = 0;
    while (offset < buffer.length) {
      if (this.audioRemaining > 0) {
        const length = Math.min(this.audioRemaining, buffer.length - offset);
        this.audioRemaining -= length;
        offset += length;
      } else if (this.metadataRemaining > 0) {
        const length = Math.min(this.metadataRemaining, buffer.length - offset);
        this.metadata.push(buffer.subarray(offset, offset + length));
        this.metadataRemaining -= length;
        offset += length;
        if (this.metadataRemaining === 0) {
          const title = parseStreamTitle(Buffer.concat(this.metadata));
          if (title) titles.push(title);
          this.metadata = [];
          this.audioRemaining = this.interval;
        }
      } else {
        this.metadataRemaining = buffer[offset++] * 16;
        if (this.metadataRemaining === 0) this.audioRemaining = this.interval;
      }
    }
    return titles;
  }
}

export function parseStreamTitle(bytes: Buffer): string | undefined {
  const utf8 = bytes.toString("utf8");
  const text = utf8.includes("\uFFFD") ? bytes.toString("latin1") : utf8;
  // Advertising frames describe an ad, not the song currently on air.
  if (/AdCreativeId='[^']+'/.test(text) || /Advertiser='[^']+'/.test(text))
    return undefined;
  const match = /StreamTitle='([\s\S]*?)';(?=[A-Za-z][A-Za-z0-9]*=|\0|$)/.exec(
    text.replace(/\0+$/, ""),
  );
  const title = match?.[1]
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .trim();
  return title || undefined;
}

// ICY provides one free-form title, normally "Artist - Title", not separate fields.
export function formatTrackForHUD(title: string): string {
  return title.replace(/\s+-\s+/, " ‧ ");
}

export async function readCurrentTrack(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(url, {
      headers: { "Icy-MetaData": "1" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok)
      throw new Error(
        `The station returned HTTP ${response.status}. Try again shortly.`,
      );
    if (!response.body)
      throw new Error("The station returned an empty stream.");
    reader = response.body.getReader();
    const parser = new IcyParser(Number(response.headers.get("icy-metaint")));
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const title = parser.push(chunk.value)[0];
      if (title) return title;
    }
    throw new Error(
      "No track information is available right now. There may be an ad or a station announcement.",
    );
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new Error(
        "No track information arrived within 25 seconds. Try again after the ad or announcement.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    controller.abort();
    await reader?.cancel().catch(() => undefined);
  }
}
