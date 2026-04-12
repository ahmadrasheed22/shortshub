const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";

const CHANNEL_ID_REGEX = /^UC[\w-]{22}$/;
const VIDEO_ID_REGEX = /^[\w-]{11}$/;

const RESERVED_CHANNEL_PATHS = new Set([
  "watch",
  "shorts",
  "results",
  "feed",
  "playlist",
  "hashtag",
  "live",
  "clip",
]);

export class YouTubeApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "YouTubeApiError";
    this.status = status;
  }
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as JsonRecord;
}

function getYouTubeApiKey(): string {
  const key =
    process.env.YOUTUBE_API_KEY?.trim() ??
    process.env.NEXT_PUBLIC_YOUTUBE_API_KEY?.trim() ??
    "";

  if (!key) {
    throw new YouTubeApiError(
      "YouTube API key is missing. Add YOUTUBE_API_KEY to .env.local.",
      500
    );
  }

  return key;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function youtubeApiGet<T>(
  resource: string,
  params: Record<string, string | undefined>
): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/${resource}`);

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim().length > 0) {
      url.searchParams.set(key, value);
    }
  });

  url.searchParams.set("key", getYouTubeApiKey());

  const response = await fetch(url.toString(), { cache: "no-store" });
  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    const root = asRecord(payload);
    const error = asRecord(root?.error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "YouTube API request failed.";

    throw new YouTubeApiError(message, response.status);
  }

  return payload as T;
}

export function isChannelId(value: string): boolean {
  return CHANNEL_ID_REGEX.test(value);
}

export function isVideoId(value: string): boolean {
  return VIDEO_ID_REGEX.test(value);
}

export type ChannelLookupHint = {
  channelId?: string;
  handle?: string;
  username?: string;
  videoId?: string;
  searchText?: string;
};

function looksLikeYouTubeHost(hostname: string): boolean {
  return hostname === "youtu.be" || /(^|\.)youtube\.com$/i.test(hostname);
}

function parseMaybeUrl(input: string): URL | null {
  const withProtocol =
    /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(input) || input.startsWith("//")
      ? input
      : /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)/i.test(input)
        ? `https://${input}`
        : "";

  if (!withProtocol) {
    return null;
  }

  try {
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

export function parseChannelLookupInput(rawInput: string): ChannelLookupHint {
  const input = rawInput.trim();
  if (!input) {
    return {};
  }

  if (isChannelId(input)) {
    return { channelId: input };
  }

  if (input.startsWith("@") && input.length > 1) {
    return { handle: input };
  }

  const parsedUrl = parseMaybeUrl(input);
  if (!parsedUrl || !looksLikeYouTubeHost(parsedUrl.hostname.toLowerCase())) {
    return { searchText: input };
  }

  const channelIdParam = parsedUrl.searchParams.get("channel_id")?.trim();
  if (channelIdParam && isChannelId(channelIdParam)) {
    return { channelId: channelIdParam };
  }

  const watchVideoId = parsedUrl.searchParams.get("v")?.trim();
  if (watchVideoId && isVideoId(watchVideoId)) {
    return { videoId: watchVideoId };
  }

  const pathParts = parsedUrl.pathname
    .split("/")
    .map((segment) => decodeURIComponent(segment.trim()))
    .filter(Boolean);

  if (parsedUrl.hostname.toLowerCase() === "youtu.be") {
    const shortUrlVideoId = pathParts[0];
    if (shortUrlVideoId && isVideoId(shortUrlVideoId)) {
      return { videoId: shortUrlVideoId };
    }
  }

  const firstPart = pathParts[0];
  const secondPart = pathParts[1];

  if (!firstPart) {
    return { searchText: input };
  }

  if (firstPart === "channel" && secondPart && isChannelId(secondPart)) {
    return { channelId: secondPart };
  }

  if (firstPart === "user" && secondPart) {
    return { username: secondPart };
  }

  if (firstPart.startsWith("@")) {
    return { handle: firstPart };
  }

  if (firstPart === "shorts" && secondPart && isVideoId(secondPart)) {
    return { videoId: secondPart };
  }

  if (firstPart === "c" && secondPart) {
    return { searchText: secondPart };
  }

  if (!RESERVED_CHANNEL_PATHS.has(firstPart)) {
    return { searchText: firstPart };
  }

  return { searchText: input };
}
