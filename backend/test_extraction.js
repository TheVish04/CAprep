const fs = require('fs');
const path = require('path');
const { Groq } = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = 'openai/gpt-oss-120b';

async function runExperiment() {
  const images = [];
  const imagePaths = ['../1.png', '../2.png', '../3.png', '../4.png'];
  
  for (const imgPath of imagePaths) {
    const fullPath = path.resolve(__dirname, imgPath);
    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath);
      const base64 = buffer.toString('base64');
      images.push(`data:image/png;base64,${base64}`);
    } else {
        console.log("File not found:", fullPath);
    }
  }

  const visionPrompt = `Extract ALL text, numbers, options, and tables from this image verbatim. Do not format it into JSON or try to answer the question. Just transcribe the raw contents perfectly.`;

  const messageContent = [
    { type: "text", text: visionPrompt }
  ];

  images.forEach(img => {
    messageContent.push({ type: "image_url", image_url: { url: img } });
  });

  console.log('Stage 1: Extracting raw text using Maverick vision...');
  const visionCompletion = await groq.chat.completions.create({
    messages: [{ role: "user", content: messageContent }],
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    temperature: 0.1,
    max_tokens: 8192,
  });

  const rawExtractedText = visionCompletion.choices[0]?.message?.content || "";
  console.log("\nRAW EXTRACTED TEXT:\n------------------\n", rawExtractedText, "\n------------------\n");
  
  console.log('Stage 2: Structuring raw text into JSON using 120b model...');
  
  const structurePrompt = `You are an expert OCR formatting and data extraction AI specializing in the CA curriculum. 
I have raw, messy text that was extracted from an image of a CA exam question. Your task is to clean it up and output it in a strict JSON format.

RAW TEXT FROM IMAGE:
"""
${rawExtractedText}
"""

INSTRUCTIONS:
1. Reconstruct the full text from the raw extraction accurately, fixing any obvious OCR typos.
2. Identify the Question Type strictly as one of: "objective-only", "subjective-only", or "objective-subjective".
   - If options (A, B, C, D) are present -> objective.
   - If no options -> subjective.
   - If it has both a main question/answer and options -> objective-subjective.
3. Support permutations: It might just be a question+answer, or question+answer+sub-questions, or just sub-questions. Fill whatever data exists in the raw text.
4. TABLE EXTRACTION: If any tabular data exists in the raw text, convert it strictly to clean, standardized HTML <table> tags within the relevant text field.
5. Do NOT include markdown blocks like \`\`\`json outside the JSON output. Return pure JSON.

JSON SCHEMA:
{
  "questionNumber": "Extracted question number (e.g. '1', '2a', etc) or empty string if none",
  "questionType": "objective-subjective" | "objective-only" | "subjective-only",
  "questionText": "Main question text or HTML table (if any)...",
  "answerText": "Detailed answer text or HTML table (if any)...",
  "subQuestions": [
    {
      "subQuestionText": "Sub-question text...",
      "subOptions": [
        { "optionText": "Option A text...", "isCorrect": false },
        { "optionText": "Option B text...", "isCorrect": true }
      ]
    }
  ]
}

Ensure "subQuestions" is an empty array if there are none. If it's an objective-only question, "answerText" should be empty. Return ONLY valid JSON and nothing else.`;

  const structCompletion = await groq.chat.completions.create({
    messages: [{ role: "user", content: structurePrompt }],
    model: GROQ_MODEL,
    temperature: 0.1,
    max_tokens: 8192,
    response_format: { type: "json_object" }
  });

  const structuredJsonText = structCompletion.choices[0]?.message?.content || "";
  console.log("\nSTRUCTURED JSON FORMATTING:\n------------------\n", structuredJsonText, "\n------------------\n");
  
  fs.writeFileSync('/tmp/extracted.json', structuredJsonText);
  console.log('Done!');
}

runExperiment().catch(console.error);
