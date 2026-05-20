const https = require('https');
require('dotenv').config();

const options = {
  hostname: 'api.vapi.ai',
  path: '/call?assistantId=a0eee2d3-de59-4c71-8900-1a6f71c7e816&limit=1',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
  }
};

https.get(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const calls = JSON.parse(data);
      if (calls && calls.length > 0) {
        console.log(JSON.stringify(calls[0], null, 2));
      } else {
        console.log("No calls found.");
      }
    } catch (e) {
      console.log(data);
    }
  });
}).on('error', e => console.error(e));
