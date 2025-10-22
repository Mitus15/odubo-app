#!/usr/bin/env node
// Simulate an R2/S3 notification POST to the worker endpoint for local testing
import fetch from 'node-fetch';

const workerUrl = process.argv[2] || 'http://localhost:8787/';
const key = process.argv[3] || 'galleries/1/videos/test_123.webm';

const payload = {
  Records: [
    { r2: { key } }
  ]
};

(async () => {
  const res = await fetch(workerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  console.log('status', res.status);
  const txt = await res.text();
  console.log('body', txt);
})();
