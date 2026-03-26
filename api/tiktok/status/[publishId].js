import axios from 'axios';

export default async function handler(req, res) {
  const { publishId } = req.query;
  const { access_token } = req.headers.authorization ? { access_token: req.headers.authorization.split(' ')[1] } : req.query;

  if (!publishId || !access_token) return res.status(400).json({ error: 'Missing logic data' });

  try {
    const response = await axios.get('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      params: { 
        publish_id: publishId
      },
      headers: { 
        'Authorization': `Bearer ${access_token}`
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
