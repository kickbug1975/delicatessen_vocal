const https = require('https');

const data = JSON.stringify({
  message: { type: 'assistant-request' }
});

const options = {
  hostname: 'delicatessen-dashboard-dimitri-2026.netlify.app',
  path: '/api/vapi/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  let resData = '';
  console.log(`Status: ${res.statusCode}`);
  res.on('data', d => resData += d);
  res.on('end', () => console.log('Response:', resData));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
