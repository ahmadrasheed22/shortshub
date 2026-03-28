module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY || '',
    scope: 'user.info.basic,video.publish',
    response_type: 'code',
    redirect_uri: process.env.TIKTOK_REDIRECT_URI || '',
    state: Math.random().toString(36).substring(2),
  });
  res.status(200).json({
    authUrl: `https://www.tiktok.com/v2/auth/authorize/?${params}`
  });
};
