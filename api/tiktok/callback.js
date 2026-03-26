import axios from 'axios';

export default async function handler(req, res) {
  const { code } = req.query;
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const response = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', 
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `https://${req.headers.host}/api/tiktok/callback`
      }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
