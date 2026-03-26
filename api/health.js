export default function handler(req, res) {
  res.status(200).json({ status: 'ok', server: 'Vercel Serverless', time: new Date().toISOString() });
}
