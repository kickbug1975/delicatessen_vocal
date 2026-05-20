const https = require('https');
require('dotenv').config();

const data = JSON.stringify({
  serverUrl: 'https://delicatessen-dashboard-dimitri-2026.netlify.app/api/vapi/webhook'
});

const options = {
  hostname: 'api.vapi.ai',
  path: '/assistant/a0eee2d3-de59-4c71-8900-1a6f71c7e816',
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  let resData = '';
  res.on('data', d => resData += d);
  res.on('end', () => console.log('Response:', resData));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
