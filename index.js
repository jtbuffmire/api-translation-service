const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Function to transform the payload
const transformPayload = (payload, target) => {
  console.log(`Transforming payload for target: ${target}`);
  // Add your transformation logic here
  let transformedPayload;
  switch (target) {
    case 'prod-app':
      transformedPayload = { /* transformation logic for prod-app */ };
    case 'dev-app':
      transformedPayload = { /* transformation logic for dev-app */ };
      break;
    case 'mappers':
      transformedPayload = { 
        decoded: {
          payload: {
            accuracy: payload.accuracy,
            altitude: payload.altitude,
            latitude: payload.latitude,
            longitude: payload.longitude
          }
        }
       };
      break;
    case 'supabase':
      transformedPayload = { /* transformation logic for Supabase */ };
      break;
    default:
      transformedPayload = payload;
      }
  console.log(`Transformed payload: ${JSON.stringify(transformedPayload)}`); 
  return transformedPayload;
};

// Function to forward the payload to the target API
const forwardPayload = async (url, payload) => {
  try {
    console.log(`Forwarding payload to URL: ${url}`);
    const response = await axios.post(url, payload);
    console.log(`Response from ${url}: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error(`Error forwarding to ${url}:`, error.message);
    throw error;
  }
};

// Endpoint to receive payloads from ChirpStack
app.post('/api/chirpstack', async (req, res) => {
  const payload = req.body;
  console.log(`Received payload: ${JSON.stringify(payload)}`);

  // Define your target URLs
  const targetUrls = {
    'prod-app': 'https://app.buoy.fish/api/payloads',
    'dev-app': 'https://dev.buoy.fish/api/payloads',
    'mappers': 'https://mappers.helium.com/api/v1/ingest/uplink',
    'supabase': 'https://supabase.example.com/api',
  };

  try {
    // Forward to each target API
    const results = await Promise.all(
      Object.entries(targetUrls).map(([target, url]) => {
        const transformedPayload = transformPayload(payload, target);
        return forwardPayload(url, transformedPayload);
      })
    );
    res.status(200).send(results);
  } catch (error) {
    console.error('Error in forwarding process:', error.message);
    res.status(500).send({ error: 'Failed to forward payloads' });
  }
});

app.listen(port, () => {
  console.log(`API translation service listening at http://localhost:${port}`);
});
