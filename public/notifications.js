/**
 * ShortsHub v2.0 — Browser Push Notifications Module
 *
 * Uses the Web Notifications API (no Service Worker required).
 * Provides deduplication via localStorage so each Short
 * only triggers one notification ever.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'shortshub_seen_ids';
  const MAX_SEEN = 200;

  // ─── Seen-ID Persistence ────────────────────────────────────────────────

  /** @returns {Set<string>} Video IDs that have already been notified */
  function getSeenIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  /**
   * Add a video ID to the seen set and persist it.
   * Keeps only the last MAX_SEEN entries to avoid bloat.
   */
  function markAsSeen(videoId) {
    const seen = getSeenIds();
    seen.add(videoId);

    // Trim to the last MAX_SEEN entries
    const arr = [...seen];
    const trimmed = arr.length > MAX_SEEN ? arr.slice(arr.length - MAX_SEEN) : arr;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Storage full — silently ignore
    }
  }

  // ─── In-Page Banner ─────────────────────────────────────────────────────

  const BANNER_ID = 'shortshub-notif-banner';

  /**
   * Show a fixed-position banner at the top of the viewport.
   * @param {string} message   — Text to display
   * @param {'success'|'info'|'warning'} type — Controls background colour
   * @param {string} [linkUrl] — Optional URL to link the message to
   */
  function showInPageBanner(message, type, linkUrl) {
    // Remove any existing banner first
    const existing = document.getElementById(BANNER_ID);
    if (existing) existing.remove();

    const colors = {
      success: { bg: '#14532d', border: '#22c55e' },
      info:    { bg: '#1e3a5f', border: '#3b82f6' },
      warning: { bg: '#78350f', border: '#f59e0b' },
    };
    const scheme = colors[type] || colors.info;

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    Object.assign(banner.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      zIndex: '99999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      padding: '12px 20px',
      background: scheme.bg,
      borderBottom: `2px solid ${scheme.border}`,
      color: '#fff',
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
      fontWeight: '500',
      lineHeight: '1.4',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      opacity: '0',
      transform: 'translateY(-100%)',
    });

    // Message text (optionally as a link)
    const msgEl = document.createElement(linkUrl ? 'a' : 'span');
    msgEl.textContent = message;
    if (linkUrl) {
      msgEl.href = linkUrl;
      msgEl.target = '_blank';
      msgEl.rel = 'noopener noreferrer';
      Object.assign(msgEl.style, { color: '#fff', textDecoration: 'underline' });
    }
    banner.appendChild(msgEl);

    // Close (✕) button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      color: '#fff',
      fontSize: '16px',
      cursor: 'pointer',
      padding: '0 0 0 12px',
      lineHeight: '1',
      opacity: '0.7',
    });
    closeBtn.addEventListener('mouseenter', () => (closeBtn.style.opacity = '1'));
    closeBtn.addEventListener('mouseleave', () => (closeBtn.style.opacity = '0.7'));
    closeBtn.addEventListener('click', () => dismissBanner(banner));
    banner.appendChild(closeBtn);

    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(() => {
      banner.style.opacity = '1';
      banner.style.transform = 'translateY(0)';
    });

    // Auto-dismiss success & info after 6 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => dismissBanner(banner), 6000);
    }
  }

  function dismissBanner(banner) {
    if (!banner || !banner.parentNode) return;
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(-100%)';
    setTimeout(() => banner.remove(), 300);
  }

  // ─── Permission & Initialisation ────────────────────────────────────────

  /**
   * Request notification permission if not yet decided.
   * Called once when the user starts monitoring a channel.
   */
  async function init() {
    if (!('Notification' in window)) {
      showInPageBanner(
        'Your browser does not support desktop notifications. In-page alerts will be used instead.',
        'warning'
      );
      return;
    }

    if (Notification.permission === 'granted') {
      // Already good — no need to disturb the user
      return;
    }

    if (Notification.permission === 'denied') {
      showInPageBanner(
        'Notifications are blocked. To enable them, click the lock icon in your address bar → Site Settings → Allow Notifications.',
        'warning'
      );
      return;
    }

    // permission === 'default' → ask the user
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        showInPageBanner('🔔 Notifications enabled — you\'ll be alerted when new Shorts drop!', 'success');
      } else {
        showInPageBanner(
          'Notifications were declined. You can enable them later in your browser settings.',
          'warning'
        );
      }
    } catch {
      // Some browsers throw on requestPermission — fall back silently
    }
  }

  // ─── Fire a Notification ────────────────────────────────────────────────

  /**
   * Notify the user about a new Short.
   * Deduplicates via localStorage so each Short only triggers once.
   *
   * @param {{ id: string, title: string, channelName: string, url: string, thumbnail: string }} short
   */
  function notifyNewShort(short) {
    const seen = getSeenIds();
    if (seen.has(short.id)) return; // Already notified — skip

    markAsSeen(short.id);

    const canNotify =
      'Notification' in window && Notification.permission === 'granted';

    if (canNotify) {
      try {
        const notif = new Notification(`New Short from ${short.channelName}`, {
          body: short.title,
          icon: short.thumbnail || 'https://www.youtube.com/favicon.ico',
          tag: `shortshub-${short.id}`,
          renotify: false,
        });

        notif.onclick = function () {
          window.open(short.url, '_blank');
          notif.close();
        };

        // Auto-close after 8 seconds
        setTimeout(() => {
          try { notif.close(); } catch { /* already closed */ }
        }, 8000);
      } catch {
        // Notification constructor failed — fall back to banner
        showInPageBanner(
          `New Short from ${short.channelName}: ${short.title}`,
          'info',
          short.url
        );
      }
    } else {
      // Permission not granted — use in-page banner
      showInPageBanner(
        `New Short from ${short.channelName}: ${short.title}`,
        'info',
        short.url
      );
    }
  }

  // ─── Export as global ───────────────────────────────────────────────────

  window.ShortsNotifier = {
    init,
    notifyNewShort,
    requestPermission: init, // alias — spec says "requestPermission"
    showInPageBanner,
  };
})();
