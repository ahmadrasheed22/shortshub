"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type FavoriteChannel = {
  id: string;
  title: string;
  thumbnail?: string;
  customUrl?: string;
  subscriberCount?: string | number;
};

function readFavorites(): FavoriteChannel[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem("trueclip-favorites");
    if (!saved) return [];

    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is FavoriteChannel =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as FavoriteChannel).id === "string" &&
        typeof (item as FavoriteChannel).title === "string"
    );
  } catch {
    return [];
  }
}

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteChannel[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const timerId = window.setTimeout(() => {
      setFavorites(readFavorites());
      setFavoritesOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isOpen]);

  useEffect(() => {
    const syncFavorites = () => {
      if (isOpen) {
        setFavorites(readFavorites());
      }
    };

    window.addEventListener("trueclip-favorites-updated", syncFavorites);

    return () => {
      window.removeEventListener("trueclip-favorites-updated", syncFavorites);
    };
  }, [isOpen]);

  const closeSidebar = () => {
    setFavoritesOpen(false);
    onClose();
  };

  const openFavoriteChannel = (channelId: string) => {
    router.push(`/?q=${encodeURIComponent(channelId)}`);
    closeSidebar();
  };

  const removeFavorite = (channelId: string) => {
    const updated = favorites.filter((channel) => channel.id !== channelId);
    localStorage.setItem("trueclip-favorites", JSON.stringify(updated));
    setFavorites(updated);
    window.dispatchEvent(new Event("trueclip-favorites-updated"));
  };

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-label="Close sidebar overlay"
        />
      ) : null}

      <aside className={`sidebar-panel ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
        <div className="sidebar-head">
          <div>
            <p className="sidebar-kicker">Library</p>
            <span className="sidebar-title">Your Menu</span>
          </div>
          <button type="button" className="sidebar-close" onClick={closeSidebar}>
            Close
          </button>
        </div>

        <div className="sidebar-body">
          <button
            type="button"
            className={`sidebar-nav-item ${favoritesOpen ? "active" : ""}`}
            onClick={() => setFavoritesOpen((prev) => !prev)}
            aria-expanded={favoritesOpen}
          >
            <span className="sidebar-nav-title">Favorite Channels</span>
            <span className="sidebar-nav-count">{favorites.length}</span>
            <span className="sidebar-nav-chevron">{favoritesOpen ? "v" : ">"}</span>
          </button>

          {favoritesOpen ? (
            <div className="sidebar-list-shell">
              {favorites.length === 0 ? (
                <div className="sidebar-empty">
                  <p>No favorite channels yet. Search a channel and click Add to Favorites.</p>
                </div>
              ) : (
                <div className="sidebar-list">
                  {favorites.map((channel) => (
                    <div key={channel.id} className="sidebar-channel-row">
                      <button
                        type="button"
                        className="sidebar-channel-main"
                        onClick={() => openFavoriteChannel(channel.id)}
                      >
                        {channel.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={channel.thumbnail} alt={channel.title} className="sidebar-channel-avatar" />
                        ) : (
                          <span aria-hidden="true" className="sidebar-channel-avatar sidebar-avatar-fallback" />
                        )}

                        <span className="sidebar-channel-meta">
                          <span className="sidebar-channel-name">{channel.title}</span>
                          <span className="sidebar-channel-handle">{channel.customUrl || "@unknown"}</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        className="sidebar-remove"
                        onClick={() => removeFavorite(channel.id)}
                        aria-label={`Remove ${channel.title} from favorites`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="sidebar-hint">Open Favorite Channels to view and launch saved channels.</p>
          )}
        </div>

        <div className="sidebar-footer">
          {favorites.length} channel{favorites.length !== 1 ? "s" : ""} saved
        </div>
      </aside>
    </>
  );
}
