const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const Ajv = require('ajv');

const app = express();
const port = 3000;

const ajv = new Ajv();

// JSON schema for validation
const payloadSchema = {
  type: 'object',
  properties: {
    payload: {
      type: 'object',
      properties: {
        accuracy: { type: 'number' },
        altitude: { type: 'number' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
      required: ['accuracy', 'altitude', 'latitude', 'longitude'],
    },
  },
}

const validatePayload = ajv.compile(payloadSchema);

app.use(bodyParser.json());

const transformForMappers = (payload) => {
  if (payload && payload.object) {
    const transformedPayload = {
      adr: payload.adr,
      confirmed: payload.confirmed,
      data: payload.data,
      deduplicationId: payload.deduplicationId,
      devAddr: payload.devAddr,
      deviceInfo: payload.deviceInfo,
      dr: payload.dr,
      event: payload.event,
      fCnt: payload.fCnt,
      fPort: payload.fPort,
      object: {
        accuracy: payload.object.accuracy !== undefined ? Math.round(payload.object.accuracy) : 2.5, // removed undefined checkpoint to hardcode the value suggested by spacerabbit
        latitude: payload.object.latitude,
        longitude: payload.object.longitude,
        altitude: payload.object.altitude !== undefined ? Math.round(payload.object.altitude) : 2,
      },
      rxInfo: payload.rxInfo,
      time: payload.time,
      txInfo: payload.txInfo,
    };

    console.log(`Transformed payload for Mappers: ${JSON.stringify(transformedPayload, null, 2)}`);
    if (!validatePayload(transformedPayload)) {
      console.error('Invalid payload structure:', validatePayload.errors);
      return null;
    }
    return transformedPayload;
  }
  console.error('Invalid payload received: Missing object property');
  return null;
};

const forwardPayload = async (url, payload) => {
  try {
    console.log(`Forwarding payload to URL: ${url}`);
    console.log(`Payload: ${JSON.stringify(payload)}`);
    const response = await axios.post(url, payload);
    console.log(`Response from ${url}: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error(`Error forwarding to ${url}:`, error.message);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

app.post('/api/chirpstack', async (req, res) => {
  const payload = req.body;

  console.log(`Received payload: ${JSON.stringify(payload)}`);

  const targetUrls = [
    { url: 'https://dev.buoy.fish/api/payloads', transform: false },
    { url: 'https://mappers.helium.com/api/v1/ingest/uplink', transform: true },
  ];

  try {
    const results = await Promise.all(
      targetUrls.map(async ({ url, transform }) => {
        const transformedPayload = transform ? transformForMappers(payload) : payload;
        if (!transformedPayload) {
          throw new Error('Payload validation failed');
        }
        return await forwardPayload(url, transformedPayload);
      })
    );
    res.status(200).send(results);
  } catch (error) {
    console.error('Error in forwarding process:', error.message);
    res.status(500).send({ error: 'Failed to forward payloads', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`API translation service listening at http://localhost:${port}`);
});