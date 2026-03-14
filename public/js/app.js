/**
 * ShortsHub v2.0 — Frontend Application
 *
 * Features:
 *   - Smart channel search (ID, @handle, URL, name)
 *   - Shorts grid with infinite scroll
 *   - Real-time polling every 30 seconds
 *   - YouTube IFrame embed playback (no raw streams)
 *   - Download via yt-dlp backend
 *   - Toast notifications for all errors
 */

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  channel: null,
  shorts: [],
  knownIds: new Set(),
  nextPageToken: null,
  isLoading: false,
  isLoadingMore: false,
  pollingTimer: null,
  activeVideoId: null,
  activeVideoTitle: '',
};

// ─── DOM Elements ───────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const searchSection = $('#search-section');
const channelSection = $('#channel-section');
const searchForm = $('#search-form');
const searchInput = $('#search-input');
const searchError = $('#search-error');
const loadingOverlay = $('#loading-overlay');
const channelBanner = $('#channel-banner');
const channelAvatar = $('#channel-avatar');
const channelName = $('#channel-name');
const channelHandle = $('#channel-handle');
const channelSubs = $('#channel-subs');
const channelVids = $('#channel-vids');
const channelDesc = $('#channel-desc');
const shortsGrid = $('#shorts-grid');
const shortsEmpty = $('#shorts-empty');
const shortsCount = $('#shorts-count');
const loadMoreSpinner = $('#load-more-spinner');
const scrollSentinel = $('#scroll-sentinel');
const videoModal = $('#video-modal');
const modalPlayer = $('#modal-player');
const modalCloseBtn = $('#modal-close-btn');
const modalDownloadBtn = $('#modal-download-btn');
const backBtn = $('#back-btn');
const toastContainer = $('#toast-container');

// ─── Event Listeners ────────────────────────────────────────────────────────
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q) searchChannel(q);
});

backBtn.addEventListener('click', goBack);
modalCloseBtn.addEventListener('click', closePlayer);
modalDownloadBtn.addEventListener('click', () => {
  if (state.activeVideoId) downloadVideo(state.activeVideoId, state.activeVideoTitle);
});
$('.modal-backdrop').addEventListener('click', closePlayer);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !videoModal.classList.contains('hidden')) closePlayer();
});

// Infinite scroll via IntersectionObserver
const scrollObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && state.nextPageToken && !state.isLoadingMore && !state.isLoading) {
    loadMoreShorts();
  }
}, { rootMargin: '200px' });
scrollObserver.observe(scrollSentinel);

// ─── Search Channel ─────────────────────────────────────────────────────────
async function searchChannel(query) {
  searchError.classList.add('hidden');
  loadingOverlay.classList.remove('hidden');

  try {
    const res = await fetch(`/api/channel?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Channel not found.');
    }

    state.channel = data;
    displayChannel(data);
    await fetchShorts(data.id);
    startPolling(data.id);
  } catch (err) {
    searchError.textContent = err.message;
    searchError.classList.remove('hidden');
  } finally {
    loadingOverlay.classList.add('hidden');
  }
}

// ─── Display Channel ────────────────────────────────────────────────────────
function displayChannel(ch) {
  searchSection.classList.add('hidden');
  channelSection.classList.remove('hidden');

  // Banner
  if (ch.banner) {
    channelBanner.style.backgroundImage = `url(${ch.banner}=w2120)`;
  } else {
    channelBanner.style.backgroundImage = 'none';
    channelBanner.style.background = 'linear-gradient(135deg, #111 0%, #0a0a0a 100%)';
  }

  // Info
  channelAvatar.src = ch.thumbnail;
  channelAvatar.alt = ch.title;
  channelName.textContent = ch.title;
  channelHandle.textContent = ch.customUrl || '';
  channelSubs.textContent = formatCount(ch.subscriberCount) + ' subscribers';
  channelVids.textContent = formatCount(ch.videoCount) + ' videos';
  channelDesc.textContent = ch.description;

  // Scroll to top
  window.scrollTo({ top: 0 });
}

// ─── Fetch Shorts ───────────────────────────────────────────────────────────
async function fetchShorts(channelId, pageToken) {
  if (state.isLoading) return;
  state.isLoading = true;

  // Show skeletons on first load
  if (!pageToken) {
    shortsGrid.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      shortsGrid.appendChild(createSkeleton());
    }
  }

  try {
    let url = `/api/shorts/${channelId}`;
    if (pageToken) url += `?pageToken=${pageToken}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to fetch Shorts.');

    // Clear skeletons on first load
    if (!pageToken) shortsGrid.innerHTML = '';

    if (data.items.length === 0 && state.shorts.length === 0) {
      shortsEmpty.classList.remove('hidden');
    } else {
      shortsEmpty.classList.add('hidden');
      data.items.forEach((video) => {
        if (!state.knownIds.has(video.id)) {
          state.shorts.push(video);
          state.knownIds.add(video.id);
          shortsGrid.appendChild(createCard(video, false));
        }
      });
      updateShortsCount();
    }

    state.nextPageToken = data.nextPageToken;
  } catch (err) {
    showToast(err.message, 'error');
    if (state.shorts.length === 0) {
      shortsGrid.innerHTML = '';
      shortsEmpty.classList.remove('hidden');
    }
  } finally {
    state.isLoading = false;
  }
}

// ─── Load More (Infinite Scroll) ────────────────────────────────────────────
async function loadMoreShorts() {
  if (!state.nextPageToken || state.isLoadingMore || !state.channel) return;
  state.isLoadingMore = true;
  loadMoreSpinner.classList.remove('hidden');

  try {
    const res = await fetch(`/api/shorts/${state.channel.id}?pageToken=${state.nextPageToken}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    data.items.forEach((video) => {
      if (!state.knownIds.has(video.id)) {
        state.shorts.push(video);
        state.knownIds.add(video.id);
        shortsGrid.appendChild(createCard(video, false));
      }
    });

    state.nextPageToken = data.nextPageToken;
    updateShortsCount();
  } catch (err) {
    showToast('Failed to load more Shorts.', 'error');
  } finally {
    state.isLoadingMore = false;
    loadMoreSpinner.classList.add('hidden');
  }
}

// ─── Polling Engine (30s) ───────────────────────────────────────────────────
function startPolling(channelId) {
  stopPolling();
  state.pollingTimer = setInterval(() => checkForNewShorts(channelId), 30000);
}

function stopPolling() {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
}

async function checkForNewShorts(channelId) {
  try {
    const res = await fetch(`/api/shorts/${channelId}`);
    if (!res.ok) return;
    const data = await res.json();

    const newShorts = data.items.filter((v) => !state.knownIds.has(v.id));

    if (newShorts.length > 0) {
      // Prepend new shorts to the top with animation
      newShorts.reverse().forEach((video) => {
        state.shorts.unshift(video);
        state.knownIds.add(video.id);
        const card = createCard(video, true);
        shortsGrid.prepend(card);
      });

      updateShortsCount();
      showToast(`${newShorts.length} new Short${newShorts.length > 1 ? 's' : ''} detected!`, 'success');

      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('ShortsHub', {
          body: `${newShorts.length} new Short${newShorts.length > 1 ? 's' : ''} from ${state.channel.title}`,
          icon: state.channel.thumbnail,
        });
      }
    }
  } catch (_) {
    // Silent fail for polling — don't spam the user
  }
}

// ─── Create Short Card ──────────────────────────────────────────────────────
function createCard(video, isNew) {
  const card = document.createElement('div');
  card.className = `short-card${isNew ? ' new-card' : ''}`;
  card.style.animationDelay = `${Math.random() * 0.15}s`;

  const videoId = video.id;
  const title = video.snippet.title;
  const thumb = video.snippet.thumbnails?.maxres?.url
    || video.snippet.thumbnails?.high?.url
    || video.snippet.thumbnails?.medium?.url
    || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const views = formatCount(video.statistics?.viewCount || '0');
  const timeAgo = formatTimeAgo(video.snippet.publishedAt);

  card.innerHTML = `
    <div class="card-thumb" data-video-id="${videoId}" data-title="${escapeAttr(title)}">
      ${isNew ? '<div class="new-badge"><span class="new-badge-dot"></span>NEW</div>' : ''}
      <img src="${thumb}" alt="${escapeAttr(title)}" loading="lazy">
      <div class="card-thumb-overlay">
        <div class="play-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="6 3 20 12 6 21 6 3"/></svg>
        </div>
      </div>
      <div class="card-views-overlay">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        ${views}
      </div>
    </div>
    <div class="card-body">
      <p class="card-title">${escapeHtml(title)}</p>
      <p class="card-meta">${timeAgo}</p>
      <button class="card-download-btn" data-video-id="${videoId}" data-title="${escapeAttr(title)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download
      </button>
    </div>
  `;

  // Play on thumbnail click
  card.querySelector('.card-thumb').addEventListener('click', () => openPlayer(videoId, title));

  // Download button
  card.querySelector('.card-download-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    downloadVideo(videoId, title);
  });

  // Remove "NEW" glow after 30 seconds
  if (isNew) {
    setTimeout(() => card.classList.remove('new-card'), 30000);
  }

  return card;
}

function createSkeleton() {
  const el = document.createElement('div');
  el.className = 'skeleton-card';
  el.innerHTML = `
    <div class="skeleton-thumb"></div>
    <div class="skeleton-body">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
  `;
  return el;
}

// ─── Video Player (YouTube IFrame Embed — NO raw streams) ───────────────────
function openPlayer(videoId, title) {
  state.activeVideoId = videoId;
  state.activeVideoTitle = title;
  // Use official YouTube embed URL — never raw stream URLs
  modalPlayer.innerHTML = `<iframe
    src="https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&rel=0&modestbranding=1"
    allow="autoplay; encrypted-media; picture-in-picture"
    allowfullscreen
  ></iframe>`;
  videoModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePlayer() {
  videoModal.classList.add('hidden');
  modalPlayer.innerHTML = '';
  state.activeVideoId = null;
  state.activeVideoTitle = '';
  document.body.style.overflow = '';
}

// ─── Download ───────────────────────────────────────────────────────────────
async function downloadVideo(videoId, title) {
  // Find and disable the download button on the card
  const btn = document.querySelector(`.card-download-btn[data-video-id="${videoId}"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="dl-spinner"></span> Downloading...`;
  }

  showToast('Starting download — this may take a moment...', 'info');

  try {
    const res = await fetch(`/api/download/${videoId}?title=${encodeURIComponent(title)}`);

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || 'Download failed.');
    }

    // Create a blob and trigger the download
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w\s-]/g, '').trim().substring(0, 80) || 'ShortsHub-Video'}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Download complete!', 'success');
  } catch (err) {
    showToast(err.message || 'Download failed, please try again.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download
      `;
    }
  }
}

// ─── Go Back ────────────────────────────────────────────────────────────────
function goBack() {
  stopPolling();
  state.channel = null;
  state.shorts = [];
  state.knownIds.clear();
  state.nextPageToken = null;

  channelSection.classList.add('hidden');
  searchSection.classList.remove('hidden');
  shortsGrid.innerHTML = '';
  shortsEmpty.classList.add('hidden');
  searchInput.value = '';
  searchInput.focus();
}

// ─── Toast Notifications ────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = {
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span>${escapeHtml(message)}`;
  toastContainer.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, 4000);
}

// ─── Utility Functions ──────────────────────────────────────────────────────
function formatCount(num) {
  const n = parseInt(num) || 0;
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

function updateShortsCount() {
  const count = state.shorts.length;
  if (count > 0) {
    shortsCount.textContent = count;
    shortsCount.classList.remove('hidden');
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Request notification permission on first interaction ───────────────────
document.addEventListener('click', () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}, { once: true });
