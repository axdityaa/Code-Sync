// backend/routes/ai.js
const express = require('express');
const router = express.Router();
require('dotenv').config();

// Correct import for the newer @google/genai package
const { GoogleGenAI } = require('@google/genai');

// Initialize with correct structure
const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY });

router.post('/suggest', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, message: 'Prompt missing' });
  }

  try {
    // Use the newer API structure with ai.models.generateContent
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 0, // Disables thinking
        },
      }
    });

    const text = response.text;

    return res.json({ success: true, suggestion: text });
  } catch (err) {
    console.error('Gemini error:', err);
    return res.status(500).json({ success: false, message: 'Gemini error occurred' });
  }
});

module.exports = router;