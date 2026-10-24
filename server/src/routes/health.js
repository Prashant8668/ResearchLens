const express = require('express');
const axios = require('axios');
const router = express.Router();

const NLP_SERVICE_URL = process.env.PYTHON_SERVICE_URL || process.env.NLP_SERVICE_URL || 'http://127.0.0.1:8000';

router.get('/health', async (req, res) => {
  let nlpStatus = 'unavailable';
  let nlpError = null;

  try {
    const urls = [NLP_SERVICE_URL];
    if (NLP_SERVICE_URL.includes('localhost')) {
      urls.push(NLP_SERVICE_URL.replace('localhost', '127.0.0.1'));
    } else if (NLP_SERVICE_URL.includes('127.0.0.1')) {
      urls.push(NLP_SERVICE_URL.replace('127.0.0.1', 'localhost'));
    }

    for (const u of urls) {
      try {
        const response = await axios.get(`${u}/health`, { timeout: 3000 });
        if (response.status === 200 && response.data?.status === 'ok') {
          nlpStatus = 'ok';
          nlpError = null;
          break;
        }
      } catch (e) {
        nlpError = e.message;
      }
    }
  } catch (err) {
    nlpError = err.message;
  }

  res.status(200).json({
    status: 'ok',
    service: 'server',
    nlp: {
      status: nlpStatus,
      url: NLP_SERVICE_URL,
      error: nlpError,
    },
  });
});

module.exports = router;

