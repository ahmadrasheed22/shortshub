'use client';

import Image from "next/image";
import { FormEvent, useState } from "react";
import VideoCard, { VideoItem, formatCount } from "@/components/VideoCard";

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
  const durationRaw = source.duration ?? contentDetails?.duration ?? "";
  const thumbnailRaw =
    source.thumbnail ?? highThumb?.url ?? mediumThumb?.url ?? defaultThumb?.url;

  return {
    videoId: String(videoIdRaw),
    title: String(titleRaw),
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

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [shorts, setShorts] = useState<VideoItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [searchError, setSearchError] = useState("");
  const [shortsError, setShortsError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingShorts, setIsLoadingShorts] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasRequestedShorts, setHasRequestedShorts] = useState(false);

  const resetToHero = () => {
    setChannel(null);
    setShorts([]);
    setNextPageToken(null);
    setSearchError("");
    setShortsError("");
    setHasRequestedShorts(false);
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const searchValue = query.trim();

    if (!searchValue) return;

    setIsSearching(true);
    setSearchError("");
    setShortsError("");
    setShorts([]);
    setNextPageToken(null);
    setHasRequestedShorts(false);

    try {
      const response = await fetch(`/api/channel?q=${encodeURIComponent(searchValue)}`);
      if (!response.ok) {
        throw new Error("Channel fetch failed");
      }

      const payload = await response.json();
      const normalized = normalizeChannelResponse(payload);

      if (!normalized) {
        throw new Error("No channel data returned");
      }

      setChannel(normalized);
    } catch {
      setChannel(null);
      setSearchError(
        "Unable to find that channel. Try a channel name, @handle, or URL."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const fetchShorts = async (pageToken?: string) => {
    if (!channel?.id) return;

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
      const params = new URLSearchParams({ channelId: channel.id });
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
  };

  return (
    <main className="page-root">
      <div className="page-container">
        {!channel ? (
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

            {searchError ? <p className="inline-error">{searchError}</p> : null}
          </section>
        ) : (
          <section className="channel-view">
            <button type="button" className="back-link" onClick={resetToHero}>
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
              </div>

              <button
                type="button"
                className="load-shorts-btn"
                onClick={() => fetchShorts()}
                disabled={isLoadingShorts}
              >
                {isLoadingShorts ? "Loading..." : "Load Shorts \u2193"}
              </button>
            </div>

            <hr className="section-divider" />

            {hasRequestedShorts ? (
              <section className="shorts-section">
                <h2 className="shorts-title">
                  Shorts {"\u2014"} {shorts.length} videos
                </h2>

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
                      <VideoCard key={`${video.videoId}-${video.title}`} video={video} />
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
        )}
      </div>
    </main>
  );
}
