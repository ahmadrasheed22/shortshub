import axios from 'axios';

export default async function handler(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Please enter a channel name or URL.' });

  const API_KEY = process.env.YOUTUBE_API_KEY;
  const YT = 'https://www.googleapis.com/youtube/v3';

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
  }

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

    // 4) Search by name
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
      return res.status(404).json({ error: 'Channel not found.' });
    }

    res.status(200).json({
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
    res.status(500).json({ error: 'YouTube API Error' });
  }
}
