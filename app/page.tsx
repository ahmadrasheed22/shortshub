'use client';

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, use, useCallback, useEffect, useRef, useState } from "react";
import LiveMonitor from "@/components/LiveMonitor";
import RecentlyViewed, { type StoredChannel } from "@/components/RecentlyViewed";
import VideoCard, { VideoItem, formatCount } from "@/components/VideoCard";
import VideoModal from "@/components/VideoModal";

type ChannelInfo = {
  id: string;
  title: string;
  customUrl: string;
  thumbnail: string;
  subscriberCount: string | number;
  videoCount: string | number;
  viewCount: string | number;
};

type ShortsResponse = {
  videos: VideoItem[];
  nextPageToken: string | null;
};

type HomePageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type LiveStatus = "idle" | "connecting" | "live" | "reconnecting" | "error";

function readStoredChannels(key: string): StoredChannel[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(key);
    if (!saved) return [];

    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is StoredChannel =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as StoredChannel).id === "string" &&
        typeof (item as StoredChannel).title === "string"
    );
  } catch {
    return [];
  }
}

function toStoredChannel(channel: ChannelInfo): StoredChannel {
  return {
    id: channel.id,
    title: channel.title,
    thumbnail: channel.thumbnail,
    customUrl: channel.customUrl,
    subscriberCount: channel.subscriberCount,
  };
}

function cleanApiErrorMessage(message: string) {
  return message
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function mapChannelErrorToUi(message: string) {
  const cleaned = cleanApiErrorMessage(message);
  const normalized = cleaned.toLowerCase();

  if (normalized.includes("quota")) {
    return "YouTube API quota exceeded for today. Please try again later or switch to a new API key.";
  }

  if (normalized.includes("api key") || normalized.includes("forbidden") || normalized.includes("permission")) {
    return "YouTube API key is invalid or restricted. Update YOUTUBE_API_KEY and try again.";
  }

  if (normalized.includes("not found") || normalized.includes("channel")) {
    return "Unable to find that channel. Try a channel name, @handle, or URL.";
  }

  return cleaned || "Unable to load channel right now. Please try again.";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeHandle(rawHandle: string) {
  if (!rawHandle) return "@unknown";

  const trimmed = rawHandle.trim();
  if (trimmed.startsWith("@")) return trimmed;

  const noDomain = trimmed
    .replace(/^https?:\/\/(www\.)?youtube\.com\//i, "")
    .replace(/^channel\//i, "")
    .replace(/^c\//i, "")
    .replace(/^user\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");

  if (!noDomain) return "@unknown";
  if (noDomain.startsWith("@")) return noDomain;
  return `@${noDomain}`;
}

function normalizeChannelResponse(payload: unknown): ChannelInfo | null {
  const root = asRecord(payload);
  if (!root) return null;

  const source = asRecord(root.channel) ?? asRecord(root.data) ?? root;
  const snippet = asRecord(source.snippet);
  const statistics = asRecord(source.statistics);

  const thumbnailRoot = asRecord(source.thumbnails) ?? asRecord(snippet?.thumbnails);
  const highThumb = asRecord(thumbnailRoot?.high);
  const mediumThumb = asRecord(thumbnailRoot?.medium);
  const defaultThumb = asRecord(thumbnailRoot?.default);

  const id = source.id ?? source.channelId ?? snippet?.channelId;
  const title = source.title ?? snippet?.title;

  if (!id || !title) return null;

  const customUrl =
    source.customUrl ??
    source.custom_url ??
    source.handle ??
    snippet?.customUrl ??
    "";

  const thumbnail =
    source.thumbnail ??
    highThumb?.url ??
    mediumThumb?.url ??
    defaultThumb?.url ??
    "";

  return {
    id: String(id),
    title: String(title),
    customUrl: String(customUrl),
    thumbnail: String(thumbnail),
    subscriberCount: (source.subscriberCount ?? statistics?.subscriberCount ?? "0") as
      | string
      | number,
    videoCount: (source.videoCount ?? statistics?.videoCount ?? "0") as
      | string
      | number,
    viewCount: (source.viewCount ?? statistics?.viewCount ?? "0") as
      | string
      | number,
  };
}

function normalizeShortItem(item: unknown): VideoItem | null {
  const source = asRecord(item);
  if (!source) return null;

  const idData = asRecord(source.id);
  const snippet = asRecord(source.snippet);
  const statistics = asRecord(source.statistics);
  const contentDetails = asRecord(source.contentDetails);

  const snippetThumbs = asRecord(snippet?.thumbnails);
  const highThumb = asRecord(snippetThumbs?.high);
  const mediumThumb = asRecord(snippetThumbs?.medium);
  const defaultThumb = asRecord(snippetThumbs?.default);

  const videoIdRaw =
    source.videoId ?? idData?.videoId ?? source.id ?? contentDetails?.videoId;

  if (!videoIdRaw) return null;

  const titleRaw = source.title ?? snippet?.title ?? "Untitled Short";
  const publishedAtRaw = source.publishedAt ?? snippet?.publishedAt;
  const durationRaw = source.duration ?? contentDetails?.duration ?? "";
  const thumbnailRaw =
    source.thumbnail ?? highThumb?.url ?? mediumThumb?.url ?? defaultThumb?.url;

  return {
    videoId: String(videoIdRaw),
    title: String(titleRaw),
    publishedAt: typeof publishedAtRaw === "string" ? publishedAtRaw : undefined,
    viewCount: (source.viewCount ?? statistics?.viewCount ?? "0") as string | number,
    likeCount: (source.likeCount ?? statistics?.likeCount ?? "0") as string | number,
    duration: String(durationRaw),
    thumbnail: thumbnailRaw ? String(thumbnailRaw) : undefined,
  };
}

function normalizeShortsResponse(payload: unknown): ShortsResponse {
  const root = asRecord(payload);
  if (!root) return { videos: [], nextPageToken: null };

  const sourceList = root.videos ?? root.shorts ?? root.items;
  const videos = Array.isArray(sourceList)
    ? sourceList
        .map((item) => normalizeShortItem(item))
        .filter((item): item is VideoItem => item !== null)
    : [];

  const tokenRaw = root.nextPageToken ?? root.nextToken ?? root.pageToken;

  return {
    videos,
    nextPageToken:
      typeof tokenRaw === "string" && tokenRaw.trim() ? tokenRaw : null,
  };
}

export default function HomePage({ searchParams }: HomePageProps) {
  const router = useRouter();
  const resolvedSearchParams = use(searchParams);
  const queryParamValue = resolvedSearchParams.q;
  const queryFromUrl =
    typeof queryParamValue === "string"
      ? queryParamValue
      : Array.isArray(queryParamValue)
        ? queryParamValue[0] ?? ""
        : "";
  const normalizedUrlQuery = queryFromUrl.trim();
  const hasUrlQuery = normalizedUrlQuery.length > 0;
  const lastLoadedQueryRef = useRef("");

  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [recentChannels, setRecentChannels] = useState<StoredChannel[]>([]);
  const [shorts, setShorts] = useState<VideoItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [searchError, setSearchError] = useState("");
  const [shortsError, setShortsError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingShorts, setIsLoadingShorts] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasRequestedShorts, setHasRequestedShorts] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [newShortsQueue, setNewShortsQueue] = useState<VideoItem[]>([]);
  const [modalVideo, setModalVideo] = useState<{ videoId: string; title: string } | null>(null);

  const showHero = !channel && (!hasUrlQuery || Boolean(searchError));
  const showUrlLoading = !channel && hasUrlQuery && !searchError;

  useEffect(() => {
    setRecentChannels(readStoredChannels("trueclip-recent"));
  }, []);

  const resetToHero = useCallback(() => {
    setQuery("");
    setChannel(null);
    setIsFavorite(false);
    setShorts([]);
    setNextPageToken(null);
    setSearchError("");
    setShortsError("");
    setIsSearching(false);
    setIsLoadingShorts(false);
    setIsLoadingMore(false);
    setHasRequestedShorts(false);
    setLiveStatus("idle");
    setNewShortsQueue([]);
    setModalVideo(null);
  }, []);

  const fetchShorts = useCallback(
    async (pageToken?: string, channelId?: string) => {
      const id = channelId ?? channel?.id;
      if (!id) return;

      setHasRequestedShorts(true);
      if (pageToken) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingShorts(true);
      }

      if (!pageToken) {
        setShortsError("");
      }

      try {
        const params = new URLSearchParams({ channelId: id });
        if (pageToken) params.set("pageToken", pageToken);

        const response = await fetch(`/api/shorts?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Shorts fetch failed");
        }

        const payload = await response.json();
        const normalized = normalizeShortsResponse(payload);

        setShorts((prev) =>
          pageToken ? [...prev, ...normalized.videos] : normalized.videos
        );
        setNextPageToken(normalized.nextPageToken);
      } catch {
        setShortsError("Unable to load shorts right now. Please try again.");
      } finally {
        setIsLoadingShorts(false);
        setIsLoadingMore(false);
      }
    },
    [channel?.id]
  );

  const checkFavorite = useCallback((channelId: string) => {
    const favorites = readStoredChannels("trueclip-favorites");
    return favorites.some((channelItem) => channelItem.id === channelId);
  }, []);

  const saveToRecent = useCallback((currentChannel: ChannelInfo) => {
    const entry = toStoredChannel(currentChannel);
    let recent = readStoredChannels("trueclip-recent");

    recent = recent.filter((channelItem) => channelItem.id !== entry.id);
    recent.unshift(entry);
    recent = recent.slice(0, 6);

    localStorage.setItem("trueclip-recent", JSON.stringify(recent));
    setRecentChannels(recent);
  }, []);

  const removeRecentChannel = useCallback((channelId: string) => {
    const updated = readStoredChannels("trueclip-recent").filter(
      (channelItem) => channelItem.id !== channelId
    );
    localStorage.setItem("trueclip-recent", JSON.stringify(updated));
    setRecentChannels(updated);
  }, []);

  const toggleFavorite = useCallback(() => {
    if (!channel) return;

    const entry = toStoredChannel(channel);
    let favorites = readStoredChannels("trueclip-favorites");

    if (isFavorite) {
      favorites = favorites.filter((channelItem) => channelItem.id !== entry.id);
      setIsFavorite(false);
    } else {
      favorites = favorites.filter((channelItem) => channelItem.id !== entry.id);
      favorites.unshift(entry);
      setIsFavorite(true);
    }

    localStorage.setItem("trueclip-favorites", JSON.stringify(favorites));
    window.dispatchEvent(new Event("trueclip-favorites-updated"));
  }, [channel, isFavorite]);

  const loadChannelByQuery = useCallback(
    async (searchValue: string) => {
      setIsSearching(true);
      setSearchError("");
      setShortsError("");
      setShorts([]);
      setNextPageToken(null);
      setHasRequestedShorts(false);
      setLiveStatus("idle");
      setNewShortsQueue([]);
      setIsFavorite(false);

      try {
        const response = await fetch(`/api/channel?q=${encodeURIComponent(searchValue)}`);
        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(errorPayload?.error ?? "Channel fetch failed");
        }

        const payload = await response.json();
        const normalized = normalizeChannelResponse(payload);

        if (!normalized) {
          throw new Error("No channel data returned");
        }

        setChannel(normalized);
        setIsFavorite(checkFavorite(normalized.id));
        saveToRecent(normalized);
        await fetchShorts(undefined, normalized.id);
      } catch (error) {
        setChannel(null);
        setIsFavorite(false);
        const message = error instanceof Error ? error.message : "";
        setSearchError(mapChannelErrorToUi(message));
      } finally {
        setIsSearching(false);
      }
    },
    [checkFavorite, fetchShorts, saveToRecent]
  );

  const handleSelectChannel = useCallback(
    (channelBasic: StoredChannel) => {
      const targetQuery = channelBasic.id;
      setQuery(targetQuery);

      if (targetQuery === normalizedUrlQuery) {
        lastLoadedQueryRef.current = targetQuery;
        void loadChannelByQuery(targetQuery);
        return;
      }

      router.push(`/?q=${encodeURIComponent(targetQuery)}`);
    },
    [loadChannelByQuery, normalizedUrlQuery, router]
  );

  const handleIncomingShort = useCallback((video: unknown) => {
    const normalized = normalizeShortItem(video);
    if (!normalized) return;

    setShorts((prev) => {
      const exists = prev.some((item) => item.videoId === normalized.videoId);
      if (exists) return prev;
      return [normalized, ...prev];
    });

    setNewShortsQueue((prev) => [...prev, normalized]);

    window.setTimeout(() => {
      setNewShortsQueue((prev) => prev.slice(1));
    }, 5000);
  }, []);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const searchValue = query.trim();

    if (!searchValue) return;

    if (searchValue === normalizedUrlQuery) {
      lastLoadedQueryRef.current = searchValue;
      void loadChannelByQuery(searchValue);
      return;
    }

    router.push(`/?q=${encodeURIComponent(searchValue)}`);
  };

  const handleBackToSearch = () => {
    lastLoadedQueryRef.current = "";
    router.push("/");
  };

  useEffect(() => {
    setQuery((prev) => (prev === normalizedUrlQuery ? prev : normalizedUrlQuery));

    if (!normalizedUrlQuery) {
      lastLoadedQueryRef.current = "";
      resetToHero();
      return;
    }

    if (lastLoadedQueryRef.current === normalizedUrlQuery) {
      return;
    }

    lastLoadedQueryRef.current = normalizedUrlQuery;
    void loadChannelByQuery(normalizedUrlQuery);
  }, [loadChannelByQuery, normalizedUrlQuery, resetToHero]);

  useEffect(() => {
    if (!channel) return;
    setIsFavorite(checkFavorite(channel.id));
  }, [channel, checkFavorite]);

  return (
    <main className="page-root">
      {newShortsQueue.length > 0 ? (
        <div
          style={{
            position: "fixed",
            top: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#22c55e",
            color: "white",
            padding: "12px 24px",
            borderRadius: "99px",
            fontSize: "14px",
            fontWeight: "600",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
            animation: "slideDown 0.3s ease",
          }}
        >
          {`\u{1F3AC} New Short just uploaded - "${
            (newShortsQueue[0]?.title ?? "Untitled Short").substring(0, 40)
          }..."`}
        </div>
      ) : null}

      <div className="page-container">
        {showHero ? (
          <section className="hero-section">
            <p className="hero-eyebrow">YouTube Shorts Tracker</p>

            <h1 className="hero-title heading-font">
              Find Any Channel&apos;s <span>Shorts.</span>
            </h1>

            <p className="hero-subtitle">
              Paste a channel name, @handle, or URL {"\u2014"} instantly browse
              and download their Shorts in MP4.
            </p>

            <form className="hero-search" onSubmit={handleSearch}>
              <svg
                className="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="16.65" y1="16.65" x2="21" y2="21" />
              </svg>

              <input
                className="hero-input"
                type="text"
                placeholder="Search @MrBeast, channel name or URL..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search channel"
              />

              <button
                type="submit"
                className="hero-button"
                disabled={isSearching || !query.trim()}
              >
                {isSearching ? (
                  <span className="button-spinner" aria-hidden="true" />
                ) : (
                  "Search"
                )}
              </button>
            </form>

            <RecentlyViewed
              channels={recentChannels}
              onSelectChannel={handleSelectChannel}
              onRemoveChannel={removeRecentChannel}
            />

            {searchError ? <p className="inline-error">{searchError}</p> : null}
          </section>
        ) : showUrlLoading ? (
          <section className="channel-view">
            <p className="info-text">Loading current channel...</p>
          </section>
        ) : channel ? (
          <section className="channel-view">
            <button type="button" className="back-link" onClick={handleBackToSearch}>
              {"\u2190 Back to search"}
            </button>

            <div className="channel-header">
              {channel.thumbnail ? (
                <Image
                  className="channel-avatar"
                  src={channel.thumbnail}
                  alt={`${channel.title} avatar`}
                  width={88}
                  height={88}
                />
              ) : (
                <div className="channel-avatar" aria-hidden="true" />
              )}

              <div className="channel-info">
                <h1 className="channel-title heading-font">{channel.title}</h1>
                <p className="channel-handle">{normalizeHandle(channel.customUrl)}</p>

                <div className="channel-stats">
                  <span className="stat-pill">
                    {"\u{1F465}"} {formatCount(channel.subscriberCount)} subscribers
                  </span>
                  <span className="stat-pill">
                    {"\u{1F3AC}"} {formatCount(channel.videoCount)} videos
                  </span>
                  <span className="stat-pill">
                    {"\u{1F441}"} {formatCount(channel.viewCount)} views
                  </span>
                </div>

                <div className="channel-actions">
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    className={`favorite-btn ${isFavorite ? "active" : ""}`}
                  >
                    {isFavorite ? "\u2605 Favorited" : "\u2606 Add to Favorites"}
                  </button>
                </div>
              </div>


            </div>

            <LiveMonitor
              channelId={channel.id}
              onNewShort={handleIncomingShort}
              onStatusChange={setLiveStatus}
            />

            <hr className="section-divider" />

            {hasRequestedShorts ? (
              <section className="shorts-section">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    margin: "36px 0 20px",
                  }}
                >
                  <h2 style={{ fontSize: "18px", fontWeight: "700" }}>
                    Shorts {"\u2014"} {shorts.length} videos
                  </h2>

                  {liveStatus === "live" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#22c55e",
                          boxShadow: "0 0 6px #22c55e",
                          animation: "pulse 1.5s infinite",
                        }}
                      />
                      <span style={{ fontSize: "12px", color: "#22c55e", fontWeight: "600" }}>
                        LIVE
                      </span>
                    </div>
                  ) : null}

                  {liveStatus === "connecting" ? (
                    <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      Connecting...
                    </span>
                  ) : null}

                  {liveStatus === "reconnecting" ? (
                    <span style={{ fontSize: "12px", color: "#f59e0b" }}>
                      Reconnecting...
                    </span>
                  ) : null}
                </div>

                {shortsError ? <p className="error-text">{shortsError}</p> : null}

                {isLoadingShorts && shorts.length === 0 ? (
                  <p className="info-text">Loading shorts...</p>
                ) : null}

                {!isLoadingShorts && !shortsError && shorts.length === 0 ? (
                  <p className="info-text">No shorts found for this channel yet.</p>
                ) : null}

                {shorts.length > 0 ? (
                  <div className="shorts-grid">
                    {shorts.map((video) => (
                      <VideoCard
                        key={`${video.videoId}-${video.title}`}
                        video={video}
                        onPlay={() => setModalVideo({ videoId: video.videoId, title: video.title })}
                      />
                    ))}
                  </div>
                ) : null}

                {nextPageToken ? (
                  <button
                    type="button"
                    className="load-more-btn"
                    onClick={() => fetchShorts(nextPageToken)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? "Loading..." : "Load More"}
                  </button>
                ) : null}
              </section>
            ) : null}
          </section>
        ) : null}
      </div>

      {modalVideo && (
        <VideoModal
          videoId={modalVideo.videoId}
          title={modalVideo.title}
          onClose={() => setModalVideo(null)}
        />
      )}
    </main>
  );
}
