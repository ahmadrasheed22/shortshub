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
  statsTimer: null,
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
  const searchBtn = $('#search-btn');
  const originalSearchText = searchBtn.innerHTML;
  searchBtn.disabled = true;
  searchBtn.innerHTML = '<span class="dl-spinner" style="width: 14px; height: 14px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; display: inline-block; animation: spin 0.6s linear infinite; margin-right: 5px;"></span> Searching...';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('/api/channel?q=' + encodeURIComponent(query), { signal: controller.signal });
    clearTimeout(timer);
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) searchError.textContent = 'YouTube API quota exceeded. Try again tomorrow.';
      else if (res.status === 404) searchError.textContent = 'Channel not found. Check the name or URL.';
      else searchError.textContent = 'Something went wrong. Please try again.';
      searchError.classList.remove('hidden');
      return;
    }
    
    const data = await res.json();
    state.channel = data;
    displayChannel(data);
    await fetchShorts(data.id);
    startPolling(data.id);
    ShortsNotifier.init();

    // Push channel to URL so refresh restores this page
    history.pushState({ channelId: data.id, channelQuery: query }, '', `/?channel=${encodeURIComponent(query)}`);
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      searchError.textContent = 'Request timed out. Please try again.';
    } else {
      searchError.textContent = 'Server is offline. Please try again later.';
    }
    searchError.classList.remove('hidden');
  } finally {
    loadingOverlay.classList.add('hidden');
    searchBtn.disabled = false;
    searchBtn.innerHTML = originalSearchText;
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
    channelBanner.style.background = 'linear-gradient(135deg, #111118 0%, #0A0A0F 100%)';
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    let url = '/api/shorts/' + channelId;
    if (pageToken) url += '?pageToken=' + pageToken;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error('YouTube API quota exceeded. Try again tomorrow.');
      else throw new Error('Something went wrong. Please try again.');
    }
    
    const data = await res.json();

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
        // Notify for every item — dedup is handled inside ShortsNotifier
        ShortsNotifier.notifyNewShort({
          id:          video.id,
          title:       video.snippet?.title || 'New Short',
          channelName: video.snippet?.channelTitle || 'YouTube',
          url:         `https://www.youtube.com/shorts/${video.id}`,
          thumbnail:   video.snippet?.thumbnails?.high?.url ||
                       video.snippet?.thumbnails?.medium?.url || '',
        });
      });
      updateShortsCount();
    }

    state.nextPageToken = data.nextPageToken;
  } catch (err) {
    clearTimeout(timer);
    let errMsg = '';
    if (err.name === 'AbortError') {
      errMsg = 'Request timed out. Please try again.';
    } else if (err.message.includes('quota')) {
      errMsg = err.message;
    } else {
      errMsg = 'Server is offline. Please try again later.';
    }
    showToast(errMsg, 'error');
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('/api/shorts/' + state.channel.id + '?pageToken=' + state.nextPageToken, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      if (res.status === 403) throw new Error('YouTube API quota exceeded. Try again tomorrow.');
      else throw new Error('Something went wrong. Please try again.');
    }
    
    const data = await res.json();

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
    clearTimeout(timer);
    let errMsg = '';
    if (err.name === 'AbortError') {
      errMsg = 'Request timed out. Please try again.';
    } else {
      errMsg = 'Server is offline. Please try again later.';
    }
    showToast(errMsg, 'error');
  } finally {
    state.isLoadingMore = false;
    loadMoreSpinner.classList.add('hidden');
  }
}

// ─── Polling Engine (30s) ───────────────────────────────────────────────────
function startPolling(channelId) {
  stopPolling();
  state.pollingTimer = setInterval(() => checkForNewShorts(channelId), 30000);
  state.statsTimer = setInterval(() => refreshAllCardStats(), 30000);
}

function stopPolling() {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
  if (state.statsTimer) {
    clearInterval(state.statsTimer);
    state.statsTimer = null;
  }
}

async function checkForNewShorts(channelId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('/api/shorts/' + channelId, { signal: controller.signal });
    clearTimeout(timer);
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
    }

    // Notify for every item in the response — dedup inside ShortsNotifier
    data.items.forEach((video) => {
      ShortsNotifier.notifyNewShort({
        id:          video.id,
        title:       video.snippet?.title || 'New Short',
        channelName: video.snippet?.channelTitle || 'YouTube',
        url:         `https://www.youtube.com/shorts/${video.id}`,
        thumbnail:   video.snippet?.thumbnails?.high?.url ||
                     video.snippet?.thumbnails?.medium?.url || '',
      });
    });
  } catch (_) {
    clearTimeout(timer);
  }
}

// ─── Create Short Card ──────────────────────────────────────────────────────
function createCard(video, isNew) {
  const card = document.createElement('div');
  card.className = `short-card${isNew ? ' new-card' : ''}`;
  card.style.animationDelay = `${Math.random() * 0.15}s`;

  const videoId = video.id;
  card.dataset.videoId = videoId;
  const title = video.snippet.title;
  const thumb = video.snippet.thumbnails?.maxres?.url
    || video.snippet.thumbnails?.high?.url
    || video.snippet.thumbnails?.medium?.url
    || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const views = formatCount(video.statistics?.viewCount || '0');
  const likes = formatCount(video.statistics?.likeCount || '0');
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
      <div class="card-stats">
        <span class="card-stat">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${views}
        </span>
        <span class="card-stat">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          ${likes}
        </span>
        <span class="card-stat">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${timeAgo}
        </span>
      </div>
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
  
  // Update modal stats
  const video = state.shorts.find(v => v.id === videoId);
  if (video) {
    const views = formatCount(video.statistics?.viewCount || '0');
    const likes = formatCount(video.statistics?.likeCount || '0');
    document.getElementById('modal-views-count').textContent = views;
    document.getElementById('modal-likes-count').textContent = likes;
  }

  // Use official YouTube embed URL — include parameters for high quality
  modalPlayer.innerHTML = `<iframe
    src="https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&rel=0&modestbranding=1&vq=hd1080"
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
  // Find and disable the download buttons (both grid card and modal)
  const gridBtn = document.querySelector(`.card-download-btn[data-video-id="${videoId}"]`);
  const modalBtn = document.getElementById('modal-download-btn');
  
  if (gridBtn) {
    gridBtn.disabled = true;
    gridBtn.innerHTML = `<span class="dl-spinner"></span> Downloading...`;
  }
  if (modalBtn && state.activeVideoId === videoId) {
    modalBtn.disabled = true;
    modalBtn.querySelector('.action-icon').style.opacity = '0.5';
  }

  showToast('Starting download — this may take a moment...', 'info');

  const performDownload = async (isRetry = false) => {
    // Ping health check before starting download
    try {
      const healthRes = await fetch('/health', { method: 'GET' });
      if (!healthRes.ok) throw new Error('Offline');
    } catch (_) {
      throw new Error('Server is offline. Please try again later.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch('/api/download/' + videoId + '?title=' + encodeURIComponent(title), {
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 504) throw new Error('Download timed out. Please try again.');
        else throw new Error('Something went wrong. Please try again.');
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
      clearTimeout(timer);
      
      // Handle network errors (Failed to fetch) separately to allow a retry
      if (err.name === 'TypeError' || err.message === 'Failed to fetch' || err.message.includes('NetworkError') || err.message === 'Load failed') {
        if (!isRetry) {
          showToast('Network error, retrying download...', 'info');
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              performDownload(true).then(resolve).catch(reject);
            }, 4000);
          });
        }
        throw new Error('Server is offline. Please try again later.');
      }

      let errorMsg = '';
      if (err.name === 'AbortError' || err.message.includes('timed out')) {
        errorMsg = 'Download timed out. Please try again.';
      } else {
        errorMsg = err.message || 'Something went wrong. Please try again.';
      }
      
      throw new Error(errorMsg);
    }
  };

  try {
    await performDownload();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (gridBtn) {
      gridBtn.disabled = false;
      gridBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download
      `;
    }
    if (modalBtn) {
      modalBtn.disabled = false;
      modalBtn.querySelector('.action-icon').style.opacity = '1';
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

  // Reset URL to home
  history.pushState(null, '', '/');
}

// ─── Toast Notifications ────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = {
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4466" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6C63FF" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
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

// Notification permission is now handled by ShortsNotifier.init()

// ─── Live Stats Refresh ─────────────────────────────────────────────────────
async function refreshAllCardStats() {
  if (!state.channel) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('/api/shorts/' + state.channel.id, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const data = await res.json();

    data.items.forEach((video) => {
      // Update state data for live stats sync
      const stateIdx = state.shorts.findIndex(s => s.id === video.id);
      if (stateIdx !== -1) {
        state.shorts[stateIdx].statistics = video.statistics;
      }

      // Update Modal if this video is currently playing
      if (state.activeVideoId === video.id) {
        const viewsStr = formatCount(video.statistics?.viewCount || '0');
        const likesStr = formatCount(video.statistics?.likeCount || '0');
        const mViews = document.getElementById('modal-views-count');
        const mLikes = document.getElementById('modal-likes-count');
        if (mViews) mViews.textContent = viewsStr;
        if (mLikes) mLikes.textContent = likesStr;
      }

      const card = document.querySelector(`.short-card[data-video-id="${video.id}"]`);
      if (!card) return;

      const views = formatCount(video.statistics?.viewCount || '0');
      const likes = formatCount(video.statistics?.likeCount || '0');
      const timeAgo = formatTimeAgo(video.snippet.publishedAt);

      const statsEl = card.querySelector('.card-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          <span class="card-stat">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ${views}
          </span>
          <span class="card-stat">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            ${likes}
          </span>
          <span class="card-stat">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${timeAgo}
          </span>
        `;
      }
    });
  } catch (_) {
    // Silent fail — stats refresh is non-critical
  }
}

// ─── History API — popstate (browser back/forward) ──────────────────────────
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.channelQuery) {
    searchChannel(event.state.channelQuery);
  } else {
    goBack();
  }
});

// ─── Restore channel from URL on page load ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.position = 'fixed';
  banner.style.top = '0';
  banner.style.left = '0';
  banner.style.width = '100%';
  banner.style.background = '#FF4466';
  banner.style.color = 'white';
  banner.style.padding = '12px';
  banner.style.textAlign = 'center';
  banner.style.zIndex = '9999';
  banner.style.fontWeight = '600';
  banner.style.display = 'none';
  banner.textContent = '⚠️ Service is temporarily offline. Please try again later.';
  document.body.prepend(banner);

  let isOffline = false;

  const showOfflineBanner = () => {
    isOffline = true;
    banner.style.display = 'block';
  };

  const hideBanner = () => {
    if (isOffline) {
      showToast('✅ Service restored', 'success');
      isOffline = false;
    }
    banner.style.display = 'none';
  };

  async function checkServerHealth() {
    const dot = document.getElementById('server-status-dot');
    const text = document.getElementById('server-status-text');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const ping = await fetch('/health', { signal: controller.signal });
      clearTimeout(timeout);
      if (ping.ok) {
        const data = await ping.json();
        if (data.status === 'ok') {
          if (dot) { dot.style.background = '#00FF88'; dot.style.boxShadow = '0 0 10px #00FF88'; }
          if (text) text.textContent = 'Online';
          hideBanner();
          return;
        }
      }
      throw new Error('not ok');
    } catch {
      if (dot) { dot.style.background = '#FF4466'; dot.style.boxShadow = '0 0 10px #FF4466'; }
      if (text) text.textContent = 'Offline';
      showOfflineBanner();
    }
  }

  // Run immediately after 1 second, then every 30 seconds
  setTimeout(checkServerHealth, 1000);
  setInterval(checkServerHealth, 30000);

  const params = new URLSearchParams(window.location.search);
  const channelQuery = params.get('channel');
  if (channelQuery) {
    searchChannel(channelQuery);
  }
});
