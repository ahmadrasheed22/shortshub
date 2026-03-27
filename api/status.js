module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    online: true, 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
};
