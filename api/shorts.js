const axios = require('axios');

const YT = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY;

function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const channelId = req.query.channelId || '';
  const { pageToken } = req.query;

  if (!channelId || !channelId.startsWith('UC')) {
    return res.status(400).json({ error: 'Invalid channel ID.' });
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
      const dur = parseDuration(v.contentDetails?.duration || '');
      return dur > 0 && dur <= 180;
    });

    res.json({
      items: shorts,
      nextPageToken: plRes.data.nextPageToken || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shorts.' });
  }
};
