export default function handler(req, res) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) return res.status(500).json({ error: 'Missing TIKTOK_CLIENT_KEY in environment variables.' });

  const redirectUri = encodeURIComponent(`https://${req.headers.host}/api/tiktok/callback`);
  const state = Math.random().toString(36).substring(7);
  const scope = 'user.info.basic,video.upload,video.publish';

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;

  res.redirect(authUrl);
}
