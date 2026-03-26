import axios from 'axios';

export default async function handler(req, res) {
  const { access_token } = req.query; // Ideally passed as a header in production
  
  if (!access_token) return res.status(400).json({ error: 'Missing access_token' });

  try {
    const response = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      params: { 
        fields: 'open_id,union_id,avatar_url,display_name,bio_description,is_verified'
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
