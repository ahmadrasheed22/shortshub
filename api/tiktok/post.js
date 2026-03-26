import axios from 'axios';

export default async function handler(req, res) {
  const { video_url, title, access_token } = req.body || req.query;

  if (!video_url || !access_token) return res.status(400).json({ error: 'Missing logic data' });

  try {
    const response = await axios.post('https://open.tiktokapis.com/v2/post/publish/video/init/', 
      {
        post_info: {
          title: title || 'New Short',
          privacy_level: 'PUBLIC',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_ad_tag: false
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: video_url
        }
      }, {
      headers: { 
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
