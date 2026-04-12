import { NextRequest, NextResponse } from "next/server";
import {
  parseChannelLookupInput,
  youtubeApiGet,
  YouTubeApiError,
} from "@/lib/youtube";

export const dynamic = "force-dynamic";

type YouTubeThumbnail = {
  url?: string;
};

type YouTubeChannel = {
  id?: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    thumbnails?: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
    };
  };
  statistics?: {
    subscriberCount?: string;
    videoCount?: string;
    viewCount?: string;
  };
};

type ChannelsListResponse = {
  items?: YouTubeChannel[];
};

type SearchListResponse = {
  items?: Array<{
    id?: {
      channelId?: string;
    };
  }>;
};

type VideosListResponse = {
  items?: Array<{
    snippet?: {
      channelId?: string;
    };
  }>;
};

async function fetchChannelById(channelId: string): Promise<YouTubeChannel | null> {
  const data = await youtubeApiGet<ChannelsListResponse>("channels", {
    part: "snippet,statistics",
    id: channelId,
    maxResults: "1",
  });

  return data.items?.[0] ?? null;
}

async function fetchChannelByHandle(handleInput: string): Promise<YouTubeChannel | null> {
  const handle = handleInput.startsWith("@") ? handleInput : `@${handleInput}`;
  const variants = [handle, handle.slice(1)].filter(Boolean);

  for (const variant of variants) {
    const data = await youtubeApiGet<ChannelsListResponse>("channels", {
      part: "snippet,statistics",
      forHandle: variant,
      maxResults: "1",
    });

    if (data.items && data.items.length > 0) {
      return data.items[0];
    }
  }

  return null;
}

async function fetchChannelByUsername(username: string): Promise<YouTubeChannel | null> {
  const data = await youtubeApiGet<ChannelsListResponse>("channels", {
    part: "snippet,statistics",
    forUsername: username,
    maxResults: "1",
  });

  return data.items?.[0] ?? null;
}

async function fetchChannelIdFromVideo(videoId: string): Promise<string | null> {
  const data = await youtubeApiGet<VideosListResponse>("videos", {
    part: "snippet",
    id: videoId,
    maxResults: "1",
  });

  return data.items?.[0]?.snippet?.channelId ?? null;
}

async function searchChannelByText(searchText: string): Promise<YouTubeChannel | null> {
  const data = await youtubeApiGet<SearchListResponse>("search", {
    part: "snippet",
    q: searchText,
    type: "channel",
    maxResults: "1",
  });

  const channelId = data.items?.[0]?.id?.channelId;
  if (!channelId) {
    return null;
  }

  return fetchChannelById(channelId);
}

async function resolveChannel(input: string): Promise<YouTubeChannel | null> {
  const hint = parseChannelLookupInput(input);

  if (hint.channelId) {
    const channel = await fetchChannelById(hint.channelId);
    if (channel) {
      return channel;
    }
  }

  if (hint.handle) {
    const channel = await fetchChannelByHandle(hint.handle);
    if (channel) {
      return channel;
    }
  }

  if (hint.username) {
    const channel = await fetchChannelByUsername(hint.username);
    if (channel) {
      return channel;
    }
  }

  if (hint.videoId) {
    const channelId = await fetchChannelIdFromVideo(hint.videoId);
    if (channelId) {
      const channel = await fetchChannelById(channelId);
      if (channel) {
        return channel;
      }
    }
  }

  const fallbackSearches = [hint.searchText, input.trim()].filter(
    (value, index, all) => Boolean(value) && all.indexOf(value) === index
  ) as string[];

  for (const fallback of fallbackSearches) {
    const channel = await searchChannelByText(fallback);
    if (channel) {
      return channel;
    }
  }

  return null;
}

function normalizeChannel(channel: YouTubeChannel) {
  const snippet = channel.snippet ?? {};
  const statistics = channel.statistics ?? {};
  const thumbnails = snippet.thumbnails ?? {};

  return {
    id: String(channel.id ?? ""),
    title: String(snippet.title ?? ""),
    customUrl: String(snippet.customUrl ?? ""),
    thumbnail:
      thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? "",
    subscriberCount: statistics.subscriberCount ?? "0",
    videoCount: statistics.videoCount ?? "0",
    viewCount: statistics.viewCount ?? "0",
  };
}

function toErrorResponse(error: unknown) {
  if (error instanceof YouTubeApiError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(
    { error: "Unable to resolve channel at the moment." },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter q." }, { status: 400 });
  }

  try {
    const channel = await resolveChannel(query);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found." }, { status: 404 });
    }

    return NextResponse.json(normalizeChannel(channel));
  } catch (error) {
    return toErrorResponse(error);
  }
}
