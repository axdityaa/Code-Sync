// backend/routes/ai.js
const express = require('express');
const router = express.Router();
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const normalizeModelName = (modelName) => {
  if (!modelName) {
    return null;
  }

  return modelName.replace(/^models\//i, '').trim();
};

const MODEL_CANDIDATES = [
  normalizeModelName(process.env.GEMINI_MODEL),
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
].filter(Boolean);

const isModelNotSupportedError = (error) => {
  const statusCode =
    Number(error?.status) ||
    Number(error?.code) ||
    Number(error?.response?.status) ||
    Number(error?.error?.code) ||
    null;

  const raw = `${error?.message || ''} ${JSON.stringify(error || {})}`.toLowerCase();
  const looksLikeModelIssue =
    raw.includes('model') &&
    (raw.includes('not found') ||
      raw.includes('not supported') ||
      raw.includes('generatecontent') ||
      raw.includes('unknown model'));

  return statusCode === 404 || looksLikeModelIssue;
};

const generateWithFallbackModels = async (prompt) => {
  let lastError = null;
  const attempts = [];

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result?.response?.text?.() || '';

      return {
        text,
        modelName,
      };
    } catch (error) {
      lastError = error;
      attempts.push({
        modelName,
        error: error?.message || 'Unknown model error',
      });

      if (!isModelNotSupportedError(error)) {
        throw error;
      }
    }
  }

  const attemptsSummary = attempts
    .map(({ modelName, error }) => `${modelName}: ${error}`)
    .join(' | ');

  throw (
    lastError ||
    new Error(
      `No valid Gemini model is configured. Attempted models: ${MODEL_CANDIDATES.join(', ')}. ${attemptsSummary}`
    )
  );
};

router.post('/suggest', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, message: 'Prompt missing' });
  }

  if (!genAI) {
    return res.status(500).json({
      success: false,
      message: 'Missing AI API key on server. Set AI_API_KEY or GEMINI_API_KEY.',
    });
  }

  try {
    const { text, modelName } = await generateWithFallbackModels(prompt);

    if (!text.trim()) {
      return res.status(502).json({
        success: false,
        message: 'AI returned an empty suggestion.',
      });
    }

    console.log(`Gemini response generated with model: ${modelName}`);
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