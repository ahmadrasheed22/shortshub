import { NextRequest, NextResponse } from "next/server";
import { isVideoId, YouTubeApiError, youtubeApiGet } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const STATS_CACHE_TTL_MS = 10 * 60 * 1000;

type CachedStats = {
  expiresAt: number;
  payload: {
    viewCount: string;
    likeCount: string;
    publishedAt: string;
  };
};

const statsCache = new Map<string, CachedStats>();

type VideoStats = {
  statistics?: {
    viewCount?: string;
    likeCount?: string;
  };
  snippet?: {
    publishedAt?: string;
  };
};

type VideosListResponse = {
  items?: VideoStats[];
};

function toErrorResponse(error: unknown) {
  if (error instanceof YouTubeApiError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")?.trim() ?? "";

  if (!videoId || !isVideoId(videoId)) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  const cached = statsCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  try {
    const data = await youtubeApiGet<VideosListResponse>("videos", {
      part: "statistics,snippet",
      id: videoId,
      maxResults: "1",
    });

    const item = data.items?.[0];

    if (!item) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const payload = {
      viewCount: item.statistics?.viewCount ?? "0",
      likeCount: item.statistics?.likeCount ?? "0",
      publishedAt: item.snippet?.publishedAt ?? "",
    };

    statsCache.set(videoId, {
      payload,
      expiresAt: Date.now() + STATS_CACHE_TTL_MS,
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (cached) {
      return NextResponse.json(cached.payload);
    }

    return toErrorResponse(error);
  }
}
