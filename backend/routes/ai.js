// backend/routes/ai.js
const express = require('express');
const router = express.Router();
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }) : null;

router.post('/suggest', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, message: 'Prompt missing' });
  }

  if (!model) {
    return res.status(500).json({
      success: false,
      message: 'Missing AI API key on server. Set AI_API_KEY or GEMINI_API_KEY.',
    });
  }

  try {
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || '';

    if (!text.trim()) {
      return res.status(502).json({
        success: false,
        message: 'AI returned an empty suggestion.',
      });
    }

    return res.json({ success: true, suggestion: text });
  } catch (err) {
    console.error('Gemini error:', err);
    const providerMessage = err?.message || 'Gemini error occurred';
    return res.status(502).json({
      success: false,
      message: providerMessage,
    });
  }
});

module.exports = router;