import axios from 'axios';

export default async function handler(req, res) {
  const { channelId } = req.query;
  const { pageToken } = req.query;

  if (!channelId || !channelId.startsWith('UC')) {
    return res.status(400).json({ error: 'Invalid channel ID.' });
  }

  const API_KEY = process.env.YOUTUBE_API_KEY;
  const YT = 'https://www.googleapis.com/youtube/v3';

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
  }

  try {
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

    const vRes = await axios.get(`${YT}/videos`, {
      params: {
        part: 'snippet,statistics,contentDetails',
        id: videoIds.join(','),
        key: API_KEY,
      },
    });

    const shorts = (vRes.data.items || []).filter(v => {
      const dur = v.contentDetails?.duration || '';
      // Parse ISO8601 duration
      const match = dur.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return false;
      const mins = parseInt(match[1] || '0');
      const secs = parseInt(match[2] || '0');
      const totalSecs = (mins * 60) + secs;
      return totalSecs > 0 && totalSecs <= 180;
    });

    res.status(200).json({
      items: shorts,
      nextPageToken: plRes.data.nextPageToken || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Shorts API error' });
  }
}
