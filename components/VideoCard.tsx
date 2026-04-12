'use client';

import { useState } from "react";

export type VideoItem = {
  videoId: string;
  title: string;
  viewCount?: string | number;
  likeCount?: string | number;
  duration?: string;
  thumbnail?: string;
};

type VideoCardProps = {
  video: VideoItem;
};

export function formatCount(n: string | number | undefined | null) {
  const num = parseInt(String(n ?? 0), 10);
  if (Number.isNaN(num)) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export function formatDuration(iso: string | undefined | null) {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "0:00";
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  if (h > 0) {
    return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${min}:${String(s).padStart(2, "0")}`;
}

export default function VideoCard({ video }: VideoCardProps) {
  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const thumbnail = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;

  const handleDownload = () => {
    if (downloadState === "loading") return;

    try {
      setDownloadState("loading");
      const a = document.createElement("a");
      a.href = `/api/download?videoId=${encodeURIComponent(video.videoId)}&title=${encodeURIComponent(video.title)}`;
      a.download = `${video.title}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadState("success");
    } catch {
      setDownloadState("error");
    } finally {
      window.setTimeout(() => setDownloadState("idle"), 2000);
    }
  };

  let buttonText = "\u2193 Download MP4";
  if (downloadState === "loading") buttonText = "Downloading...";
  if (downloadState === "success") buttonText = "\u2713 Saved!";
  if (downloadState === "error") buttonText = "\u2717 Failed";

  const buttonClassName = [
    "download-btn",
    downloadState === "success" ? "success" : "",
    downloadState === "error" ? "error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className="video-card">
      <div className="video-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="video-image" src={thumbnail} alt={video.title} loading="lazy" />
        <span className="duration-badge">{formatDuration(video.duration)}</span>
      </div>

      <div className="video-body">
        <h3 className="video-title">{video.title}</h3>
        <div className="video-stats">
          <span>{"\u{1F441}"} {formatCount(video.viewCount)}</span>
          <span>{"\u{2764}\u{FE0F}"} {formatCount(video.likeCount)}</span>
        </div>

        <button type="button" className={buttonClassName} onClick={handleDownload} disabled={downloadState === "loading"}>
          {buttonText}
        </button>
      </div>
    </article>
  );
}
