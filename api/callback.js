module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { code, error } = req.query;

  if (error) {
    return res.redirect(
      'https://shortshub-six.vercel.app/?tiktok_error=' + 
      encodeURIComponent(error)
    );
  }

  if (!code) {
    return res.redirect(
      'https://shortshub-six.vercel.app/?tiktok_error=no_code'
    );
  }

  try {
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.TIKTOK_REDIRECT_URI,
    });

    const response = await fetch(
      'https://open.tiktokapis.com/v2/oauth/token/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: body.toString(),
      }
    );

    const data = await response.json();

    if (data.access_token) {
      return res.redirect(
        'https://shortshub-six.vercel.app/?tiktok_token=' +
        encodeURIComponent(data.access_token) +
        '&tiktok_user=' +
        encodeURIComponent(data.open_id || '')
      );
    } else {
      return res.redirect(
        'https://shortshub-six.vercel.app/?tiktok_error=' +
        encodeURIComponent(JSON.stringify(data))
      );
    }
  } catch (err) {
    return res.redirect(
      'https://shortshub-six.vercel.app/?tiktok_error=' +
      encodeURIComponent(err.message)
    );
  }
};
