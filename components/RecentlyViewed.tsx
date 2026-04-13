"use client";

import Image from "next/image";

export type StoredChannel = {
  id: string;
  title: string;
  thumbnail: string;
  customUrl: string;
  subscriberCount?: string | number;
};

type RecentlyViewedProps = {
  channels: StoredChannel[];
  onSelectChannel: (channel: StoredChannel) => void;
  onRemoveChannel: (channelId: string) => void;
};

export default function RecentlyViewed({
  channels,
  onSelectChannel,
  onRemoveChannel,
}: RecentlyViewedProps) {
  if (!channels.length) return null;

  return (
    <section className="recent-strip" aria-label="Recently viewed channels">
      <div className="recent-strip-head">
        <p className="recent-strip-label">Recently Viewed</p>
        <p className="recent-strip-note">Quick open</p>
      </div>

      <div className="recent-strip-row">
        {channels.map((channel) => (
          <div key={channel.id} className="recent-card">
            <button
              type="button"
              className="recent-card-open"
              onClick={() => {
                onSelectChannel(channel);
              }}
            >
              {channel.thumbnail ? (
                <Image
                  src={channel.thumbnail}
                  alt={channel.title}
                  width={40}
                  height={40}
                  className="recent-card-avatar"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="recent-card-avatar recent-card-avatar-fallback"
                />
              )}

              <span className="recent-card-copy">
                <span className="recent-card-title">{channel.title}</span>
                <span className="recent-card-handle">{channel.customUrl || "@unknown"}</span>
              </span>

              <span className="recent-card-arrow" aria-hidden="true">
                &gt;
              </span>
            </button>

            <button
              type="button"
              className="recent-card-remove"
              onClick={() => {
                onRemoveChannel(channel.id);
              }}
              aria-label={`Remove ${channel.title} from recently viewed`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
