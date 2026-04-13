import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const YT = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY;

type PlaylistItem = {
  contentDetails?: {
    videoId?: string;
  };
};

type PlaylistItemsResponse = {
  items?: PlaylistItem[];
};

type YouTubeVideo = {
  id?: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
      maxres?: { url?: string };
    };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
};

type VideosListResponse = {
  items?: YouTubeVideo[];
};

function parseDuration(iso: string | undefined) {
  const match = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const seconds = Number.parseInt(match[3] ?? "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId")?.trim() ?? "";

  if (!channelId || !channelId.startsWith("UC")) {
    return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY is missing" },
      { status: 500 }
    );
  }

  const uploadsPlaylistId = `UU${channelId.substring(2)}`;
  const seenIds = new Set<string>();
  let isFirstRun = true;

  const encoder = new TextEncoder();
  let checkInterval: ReturnType<typeof setInterval> | undefined;
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  let isClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const closeStream = () => {
        if (isClosed) return;
        isClosed = true;
        if (checkInterval) clearInterval(checkInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // Stream can already be closed during abrupt disconnects.
        }
      };

      const enqueue = (message: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          closeStream();
        }
      };

      const send = (payload: unknown) => {
        enqueue(`data: ${JSON.stringify(payload)}\n\n`);
      };

      const checkForNewShorts = async () => {
        try {
          const playlistResponse = await fetch(
            `${YT}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=10&key=${API_KEY}`,
            { cache: "no-store" }
          );

          if (!playlistResponse.ok) {
            throw new Error("playlist request failed");
          }

          const playlistData = (await playlistResponse.json()) as PlaylistItemsResponse;
          const videoIds = (playlistData.items ?? [])
            .map((item) => item.contentDetails?.videoId)
            .filter((id): id is string => Boolean(id));

          if (videoIds.length === 0) return;

          const videosResponse = await fetch(
            `${YT}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${API_KEY}`,
            { cache: "no-store" }
          );

          if (!videosResponse.ok) {
            throw new Error("videos request failed");
          }

          const videosData = (await videosResponse.json()) as VideosListResponse;
          const shorts = (videosData.items ?? []).filter((video) => {
            const duration = parseDuration(video.contentDetails?.duration);
            return duration > 0 && duration <= 180 && Boolean(video.id);
          }) as Array<YouTubeVideo & { id: string }>;

          if (isFirstRun) {
            shorts.forEach((video) => seenIds.add(video.id));
            isFirstRun = false;
            send({ type: "connected", message: "Live monitoring active" });
            return;
          }

          for (const video of shorts) {
            if (seenIds.has(video.id)) continue;
            seenIds.add(video.id);
            send({ type: "new_short", video });
          }
        } catch {
          send({ type: "error", message: "Check failed" });
        }
      };

      heartbeatInterval = setInterval(() => {
        enqueue(": heartbeat\n\n");
      }, 25000);

      await checkForNewShorts();
      checkInterval = setInterval(() => {
        void checkForNewShorts();
      }, 30000);

      request.signal.addEventListener("abort", () => {
        closeStream();
      });
    },
    cancel() {
      if (checkInterval) clearInterval(checkInterval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      isClosed = true;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
