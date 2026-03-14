/**
 * ShortsHub v2.0 — Express Backend Server
 *
 * Routes:
 *   GET /api/channel?q=<query>     — Resolve YouTube channel (handle, ID, URL, or name)
 *   GET /api/shorts/:channelId     — Fetch Shorts via uploads playlist (quota-efficient)
 *   GET /api/download/:videoId     — Download video via yt-dlp (never ytdl-core)
 *
 * Static files served from /public
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API_KEY;
const YT = 'https://www.googleapis.com/youtube/v3';

// ─── Static Files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helper: Parse ISO 8601 Duration → seconds ─────────────────────────────
function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

// ─── Helper: Map API errors to friendly messages ───────────────────────────
function friendlyError(error) {
  const status = error.response?.status;
  const msg = error.response?.data?.error?.message || error.message || '';
  if (status === 403 || msg.toLowerCase().includes('quota')) {
    return { status: 403, error: 'YouTube API quota exceeded. Please try again tomorrow.' };
  }
  if (msg.includes('API key not valid')) {
    return { status: 403, error: 'Invalid API key. Check your .env file.' };
  }
  if (status === 404 || msg.includes('NotFound')) {
    return { status: 404, error: 'Channel or video not found.' };
  }
  return { status: 500, error: 'Something went wrong. Please try again.' };
}

// ─── API: Resolve Channel ──────────────────────────────────────────────────
app.get('/api/channel', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Please enter a channel name or URL.' });

  try {
    let channel = null;

    // 1) Direct channel ID (UC...)
    if (q.startsWith('UC') && q.length === 24) {
      const r = await axios.get(`${YT}/channels`, {
        params: { part: 'snippet,statistics,brandingSettings', id: q, key: API_KEY }
      });
      channel = r.data.items?.[0];
    }

    // 2) @handle
    if (!channel && q.startsWith('@')) {
      const r = await axios.get(`${YT}/channels`, {
        params: { part: 'snippet,statistics,brandingSettings', forHandle: q.substring(1), key: API_KEY }
      });
      channel = r.data.items?.[0];
    }

    // 3) Extract from URL
    if (!channel) {
      const handleMatch = q.match(/youtube\.com\/(@[\w-]+)/);
      if (handleMatch) {
        const r = await axios.get(`${YT}/channels`, {
          params: { part: 'snippet,statistics,brandingSettings', forHandle: handleMatch[1].substring(1), key: API_KEY }
        });
        channel = r.data.items?.[0];
      }
    }
    if (!channel) {
      const idMatch = q.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
      if (idMatch) {
        const r = await axios.get(`${YT}/channels`, {
          params: { part: 'snippet,statistics,brandingSettings', id: idMatch[1], key: API_KEY }
        });
        channel = r.data.items?.[0];
      }
    }

    // 4) Search by name (last resort — 100 units)
    if (!channel) {
      const sr = await axios.get(`${YT}/search`, {
        params: { part: 'snippet', q, type: 'channel', maxResults: 1, key: API_KEY }
      });
      const cid = sr.data.items?.[0]?.snippet?.channelId;
      if (cid) {
        const r = await axios.get(`${YT}/channels`, {
          params: { part: 'snippet,statistics,brandingSettings', id: cid, key: API_KEY }
        });
        channel = r.data.items?.[0];
      }
    }

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found. Check the name or URL and try again.' });
    }

    // Return a clean, flat object
    res.json({
      id: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description || '',
      customUrl: channel.snippet.customUrl || '',
      thumbnail: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.medium?.url || '',
      banner: channel.brandingSettings?.image?.bannerExternalUrl || '',
      subscriberCount: channel.statistics?.subscriberCount || '0',
      videoCount: channel.statistics?.videoCount || '0',
      viewCount: channel.statistics?.viewCount || '0',
    });
  } catch (error) {
    console.error('Channel API error:', error.response?.data?.error?.message || error.message);
    const e = friendlyError(error);
    res.status(e.status).json({ error: e.error });
  }
});

// ─── API: Fetch Shorts ────────────────────────────────────────────────────
// Uses playlistItems (1 unit) + videos.list (1 unit) = 2 units per call
// Much cheaper than search.list (100 units)
app.get('/api/shorts/:channelId', async (req, res) => {
  const { channelId } = req.params;
  const { pageToken } = req.query;

  if (!channelId || !channelId.startsWith('UC')) {
    return res.status(400).json({ error: 'Invalid channel ID.' });
  }

  try {
    // Convert UC → UU for the uploads playlist
    const uploadsPlaylistId = 'UU' + channelId.substring(2);

    const plRes = await axios.get(`${YT}/playlistItems`, {
      params: {
        part: 'contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        ...(pageToken && { pageToken }),
        key: API_KEY,
      },
    });

    const videoIds = (plRes.data.items || [])
      .map(i => i.contentDetails?.videoId)
      .filter(Boolean);

    if (videoIds.length === 0) {
      return res.json({ items: [], nextPageToken: null });
    }

    // Get full details for each video
    const vRes = await axios.get(`${YT}/videos`, {
      params: {
        part: 'snippet,statistics,contentDetails',
        id: videoIds.join(','),
        key: API_KEY,
      },
    });

    // Filter to Shorts only (duration ≤ 60 seconds)
    const shorts = (vRes.data.items || []).filter(v => {
      const dur = parseDuration(v.contentDetails?.duration || '');
      return dur > 0 && dur <= 60;
    });

    res.json({
      items: shorts,
      nextPageToken: plRes.data.nextPageToken || null,
    });
  } catch (error) {
    console.error('Shorts API error:', error.response?.data?.error?.message || error.message);
    const e = friendlyError(error);
    res.status(e.status).json({ error: e.error });
  }
});

// ─── API: Download via yt-dlp ──────────────────────────────────────────────
app.get('/api/download/:videoId', (req, res) => {
  const { videoId } = req.params;
  const requestedTitle = req.query.title || '';

  // Validate video ID format
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID.' });
  }

  const videoUrl = `https://www.youtube.com/shorts/${videoId}`;
  const tempDir = path.join(os.tmpdir(), 'shortshub-downloads');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, `${videoId}.mp4`);

  // If file is cached and recent (< 1 hour), serve it directly
  if (fs.existsSync(tempFile)) {
    try {
      const stat = fs.statSync(tempFile);
      if (stat.size > 0 && (Date.now() - stat.mtimeMs) < 3600000) {
        return serveFile(res, tempFile, requestedTitle || videoId);
      }
    } catch (_) { /* proceed to download */ }
  }

  // Download with yt-dlp
  const ytdlp = spawn('yt-dlp', [
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '-o', tempFile,
    '--force-overwrites',
    '--no-warnings',
    '--no-playlist',
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    videoUrl,
  ]);

  let stderrLog = '';
  ytdlp.stderr.on('data', d => { stderrLog += d.toString(); });

  ytdlp.on('error', err => {
    console.error('yt-dlp spawn error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'yt-dlp is not installed. Please install it: https://github.com/yt-dlp/yt-dlp' });
    }
  });

  ytdlp.on('close', code => {
    if (code === 0 && fs.existsSync(tempFile)) {
      serveFile(res, tempFile, requestedTitle || videoId);
    } else {
      console.error('yt-dlp failed (code ' + code + '):', stderrLog);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed. Please try again.' });
      }
    }
  });

  // Abort download if client disconnects
  req.on('close', () => { if (!ytdlp.killed) ytdlp.kill(); });
});

function serveFile(res, filepath, title) {
  const clean = String(title).replace(/[^\w\s-]/g, '').trim().substring(0, 80) || 'ShortsHub-Video';
  const stat = fs.statSync(filepath);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(clean)}.mp4"`);
  fs.createReadStream(filepath).pipe(res);
}

// ─── Fallback: serve index.html ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  🎬 ShortsHub v2.0');
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → API Key: ${API_KEY ? '✓ Loaded' : '✗ MISSING — set YOUTUBE_API_KEY in .env'}`);
  console.log('');
});
