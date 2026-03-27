export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { TIKTOK_CLIENT_KEY, TIKTOK_REDIRECT_URI } = process.env;
  const state = Math.random().toString(36).substring(2);
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    scope: 'user.info.basic,video.publish',
    response_type: 'code',
    redirect_uri: TIKTOK_REDIRECT_URI,
    state: state,
  });
  res.status(200).json({
    authUrl: `https://www.tiktok.com/v2/auth/authorize/?${params}`
  });
}
