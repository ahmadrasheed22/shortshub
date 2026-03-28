const axios = require('axios');

const YT = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY;

function friendlyError(error) {
  const status = error.response?.status;
  const msg = error.response?.data?.error?.message || error.message || '';
  if (status === 403 || msg.toLowerCase().includes('quota')) {
    return { status: 403, error: 'YouTube API quota exceeded. Try again tomorrow.' };
  }
  if (msg.includes('API key not valid')) {
    return { status: 403, error: 'Invalid API key.' };
  }
  if (status === 404 || msg.includes('NotFound')) {
    return { status: 404, error: 'Channel not found.' };
  }
  return { status: 500, error: 'Something went wrong. Please try again.' };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Please enter a channel name or URL.' });

  try {
    let channel = null;

    if (q.startsWith('UC') && q.length === 24) {
      const r = await axios.get(`${YT}/channels`, {
        params: { part: 'snippet,statistics,brandingSettings', id: q, key: API_KEY }
      });
      channel = r.data.items?.[0];
    }

    if (!channel && q.startsWith('@')) {
      const r = await axios.get(`${YT}/channels`, {
        params: { part: 'snippet,statistics,brandingSettings', forHandle: q.substring(1), key: API_KEY }
      });
      channel = r.data.items?.[0];
    }

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
      return res.status(404).json({ error: 'Channel not found. Check the name or URL.' });
    }

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
    const e = friendlyError(error);
    res.status(e.status).json({ error: e.error });
  }
};
