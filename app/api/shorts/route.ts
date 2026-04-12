import { NextRequest, NextResponse } from "next/server";
import { isChannelId, youtubeApiGet, YouTubeApiError } from "@/lib/youtube";

export const dynamic = "force-dynamic";

type SearchResult = {
  id?: {
    videoId?: string;
  };
};

type SearchListResponse = {
  nextPageToken?: string;
  items?: SearchResult[];
};

type YouTubeVideo = {
  id?: string;
  snippet?: {
    title?: string;
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

function durationToSeconds(duration: string | undefined): number {
  if (!duration) {
    return 0;
  }

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return 0;
  }

  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const seconds = Number.parseInt(match[3] ?? "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

function isLikelyShort(video: YouTubeVideo): boolean {
  const seconds = durationToSeconds(video.contentDetails?.duration);
  if (seconds <= 0) {
    return false;
  }

  return seconds <= 185;
}

function normalizeVideo(video: YouTubeVideo) {
  const snippet = video.snippet ?? {};
  const statistics = video.statistics ?? {};
  const contentDetails = video.contentDetails ?? {};
  const thumbs = snippet.thumbnails ?? {};

  return {
    videoId: String(video.id ?? ""),
    title: String(snippet.title ?? "Untitled Short"),
    viewCount: statistics.viewCount ?? "0",
    likeCount: statistics.likeCount ?? "0",
    duration: String(contentDetails.duration ?? ""),
    thumbnail:
      thumbs.maxres?.url ?? thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url,
  };
}

function toErrorResponse(error: unknown) {
  if (error instanceof YouTubeApiError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(
    { error: "Unable to load channel shorts right now." },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId")?.trim() ?? "";
  const pageToken = request.nextUrl.searchParams.get("pageToken")?.trim() ?? "";

  if (!channelId) {
    return NextResponse.json(
      { error: "Missing channelId query parameter." },
      { status: 400 }
    );
  }

  if (!isChannelId(channelId)) {
    return NextResponse.json({ error: "Invalid channelId format." }, { status: 400 });
  }

  try {
    const searchData = await youtubeApiGet<SearchListResponse>("search", {
      part: "snippet",
      channelId,
      type: "video",
      order: "date",
      videoDuration: "short",
      maxResults: "24",
      pageToken,
    });

    const orderedVideoIds = (searchData.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((videoId): videoId is string => Boolean(videoId));

    if (orderedVideoIds.length === 0) {
      return NextResponse.json({ videos: [], nextPageToken: null });
    }

    const videosData = await youtubeApiGet<VideosListResponse>("videos", {
      part: "snippet,statistics,contentDetails",
      id: orderedVideoIds.join(","),
      maxResults: String(orderedVideoIds.length),
    });

    const lookup = new Map<string, YouTubeVideo>();
    for (const video of videosData.items ?? []) {
      if (video.id) {
        lookup.set(video.id, video);
      }
    }

    const videos = orderedVideoIds
      .map((id) => lookup.get(id))
      .filter((video): video is YouTubeVideo => Boolean(video))
      .filter((video) => isLikelyShort(video))
      .map((video) => normalizeVideo(video));

    return NextResponse.json({
      videos,
      nextPageToken: searchData.nextPageToken ?? null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
