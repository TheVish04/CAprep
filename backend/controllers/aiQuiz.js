const express = require('express');
const router = express.Router();
const { Groq } = require('groq-sdk');
const { authMiddleware } = require('../middleware/authMiddleware');
const Question = require('../models/QuestionModel');
const logger = require('../config/logger');
const { sendErrorResponse } = require('../utils/errorResponse');
require('dotenv').config(); // Ensure environment variables are loaded

// Initialize Groq Client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
// Fast and versatile model for standard queries
const GROQ_MODEL = 'openai/gpt-oss-120b';

// POST /api/ai-quiz/generate - Generate questions using AI
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { subject, examStage, count = 5 } = req.body; // Default to 5 questions

    logger.info('AI Quiz Request: subject=' + subject + ', examStage=' + examStage + ', count=' + count);

    // 1. Input Validation (Basic)
    if (!subject || !examStage) {
      logger.info('Missing required fields: subject or examStage');
      return res.status(400).json({ error: 'Subject and Exam Stage are required.' });
    }

    // 2. Retrieve Example Questions
    logger.info('Fetching example questions for subject: ' + subject + ', examStage: ' + examStage);
    const totalQuestions = await Question.countDocuments({ subject, examStage });

    let exampleQuestions = [];
    if (totalQuestions > 0) {
      const sampleSize = Math.min(totalQuestions, 30);
      logger.info(`Found ${totalQuestions} total questions, will sample ${sampleSize} random questions for AI context.`);
      exampleQuestions = await Question.aggregate([
        { $match: { subject, examStage } },
        { $sample: { size: sampleSize } }
      ]);
    }

    // 3. Construct Enhanced Prompt
    let prompt = `You are CA Prep Assistant, an expert AI specializing in the Indian Chartered Accountancy (CA) curriculum. Your primary role is to generate high-quality, relevant multiple-choice questions (MCQs) for CA students preparing for their exams on the CAprep website.

Generate ${count} new, unique MCQs suitable for the CA ${examStage} level, focusing specifically on the subject "${subject}".

**Instructions for Question Generation:**
1.  **Clarity and Relevance:** Ensure each question is clear, unambiguous, and directly tests conceptual understanding relevant to the ${examStage} level and the ${subject} subject, based on the latest ICAI syllabus and applicable standards/laws.
2.  **Options:** Provide exactly four options (A, B, C, D). Only one option must be the correct answer.
3.  **Distractors:** Craft incorrect options (distractors) that are plausible and common misconceptions but definitively wrong for a knowledgeable student.
4.  **Explanation:** Provide a detailed explanation for *each* question. This explanation must clearly state why the correct answer is right and provide concise reasoning for why *each* of the other options is incorrect. Reference relevant sections or concepts where applicable.
5.  **Difficulty:** Aim for a mix of difficulty levels, from straightforward application to more challenging analytical questions, appropriate for the ${examStage} stage.
6.  **Uniqueness:** Ensure the generated questions are distinct from the provided examples and general knowledge, offering fresh practice material.
7.  **Formatting:** Adhere strictly to the JSON output format specified later.

`;

    if (exampleQuestions.length > 0) {
      prompt += "Here are some examples of existing questions to understand the style and format:\n\n";
      exampleQuestions.forEach((q, index) => {
        const isEmptyMainQuestion = q.questionText.trim().length < 20 && q.subQuestions && q.subQuestions.length > 0;
        if (!isEmptyMainQuestion) {
          prompt += "Example " + (index + 1) + ":\nQuestion: " + q.questionText + "\n";
          if (q.options && q.options.length > 0) {
            prompt += "Options: ";
            q.options.forEach((opt, i) => {
              prompt += String.fromCharCode(65 + i) + ") " + opt;
              if (i < q.options.length - 1) prompt += ", ";
            });
            prompt += "\n";
          }
        }
        if (q.subQuestions && q.subQuestions.length > 0) {
          if (q.questionText.trim().length < 20 && q.subQuestions.length === 1 && q.subQuestions[0].subQuestionText) {
            const subQuestionText = q.subQuestions[0].subQuestionText;
            prompt += "Example " + (index + 1) + " (Sub):\nQuestion: " + subQuestionText + "\n";
            if (q.subQuestions[0].subOptions && q.subQuestions[0].subOptions.length > 0) {
              prompt += "Options: ";
              q.subQuestions[0].subOptions.forEach((opt, i) => {
                prompt += String.fromCharCode(65 + i) + ") " + opt.optionText;
                if (i < q.subQuestions[0].subOptions.length - 1) prompt += ", ";
              });
              prompt += "\n";
            }
            prompt += "\n";
          } else {
            q.subQuestions.forEach((subQ, subIndex) => {
              if (subQ.subQuestionText) {
                prompt += "Sub Question " + (subIndex + 1) + ": " + subQ.subQuestionText + "\n";
              }
              if (subQ.subOptions && subQ.subOptions.length > 0) {
                prompt += "Options: ";
                subQ.subOptions.forEach((opt, i) => {
                  prompt += String.fromCharCode(65 + i) + ") " + opt.optionText;
                  if (i < subQ.subOptions.length - 1) prompt += ", ";
                });
                prompt += "\n";
              }
            });
          }
        }
        prompt += "\n";
      });
    } else {
      prompt += "You don't have any specific examples for this subject, but please use your knowledge of " +
        "CA curriculum to create realistic and challenging questions for " + examStage + " level " +
        "students studying " + subject + ".\n\n" +
        "For this subject, focus on the key concepts, calculations, and applications that would be " +
        "appropriate for the " + examStage + " level of CA exams in India. Be specific to the subject " +
        "matter and avoid generic questions.\n\n";
    }

    prompt += "Important: Format your response strictly as a JSON array of objects. " +
      "Each object must have these exact keys: \"questionText\" (string), " +
      "\"options\" (array of 4 strings), \"correctAnswerIndex\" (integer from 0 to 3 " +
      "indicating the index of the correct option in the 'options' array), and " +
      "\"explanation\" (string containing a detailed explanation of why the correct answer is right and why the others are wrong). " +
      "Do not include any introductory text, explanations, or markdown formatting like ```json outside " +
      "the JSON array itself. Only output the valid JSON array.";

    // 4. Call Groq API
    logger.info("Sending prompt to Groq API...");
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: GROQ_MODEL,
        temperature: 0.7,
        max_tokens: 32768,
        response_format: { type: "json_object" }
      });

      // 5. Parse Response
      let generatedQuestions = [];
      const rawContent = chatCompletion.choices[0]?.message?.content || "";
      logger.info("Raw Content from Groq received.");

      try {
        let jsonString = rawContent.trim();
        const jsonMatch = rawContent.match(/```json\n?([\s\S]*?)```|(\[[\s\S]*\])/);
        if (jsonMatch) {
          jsonString = jsonMatch[1] || jsonMatch[2];
        }

        const parsed = JSON.parse(jsonString);

        // Handle if groq returns the array wrapped in a top level object key e.g {"questions": [...]}
        if (Array.isArray(parsed)) {
          generatedQuestions = parsed;
        } else if (parsed && typeof parsed === 'object') {
          const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
          if (possibleArray) generatedQuestions = possibleArray;
        }

        if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
          throw new Error("Parsed response is not a valid array.");
        }

        logger.info("Successfully parsed " + generatedQuestions.length + " questions.");

      } catch (parseError) {
        sendErrorResponse(res, 500, { message: 'Failed to parse AI response.', error: parseError });
        return;
      }

      // 6. Send to Frontend
      res.status(200).json(generatedQuestions);

    } catch (apiError) {
      sendErrorResponse(res, 500, { message: 'Error calling AI service API', error: apiError });
      return;
    }

  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Failed to generate AI quiz.', error });
  }
});

// POST /api/ai-quiz/suggest-title - Generate a short title for chat from user's first message (auth required)
router.post('/suggest-title', authMiddleware, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const prompt = `Based on this CA exam study context, generate an extremely short title (strictly 2-3 words ONLY) for a chat. Extract the main topic or concept. Use proper casing (e.g. CGST and SGST, not cgst and sgst). Return ONLY the title, no quotes, punctuation, or explanation.

Context: ${question.substring(0, 1000)}

Title:`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      max_tokens: 30,
    });

    const raw = chatCompletion.choices[0]?.message?.content || "";
    // Strip <think>...</think> reasoning tags emitted by some models
    const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const title = cleaned.replace(/^["']|["']$/g, '') || question.substring(0, 40);
    res.json({ title });
  } catch (error) {
    logger.error('suggest-title error: ' + (error && error.message));
    res.status(500).json({ error: 'Failed to generate title' });
  }
});

// POST /api/ai-quiz/ask - Answer CA-related questions using AI (auth required)
router.post('/ask', authMiddleware, async (req, res) => {
  try {
    const { question, examStage, subject, conversationHistory = [], image = null } = req.body;

    logger.info('AI Bot Question Request: historyLength=' + conversationHistory.length + ', hasImage=' + !!image);

    // Input Validation
    if (!question && !image) {
      return res.status(400).json({ error: 'Question or image is required.' });
    }

    // Build context based on provided parameters
    let contextDetails = '';
    if (examStage && subject) {
      contextDetails = `for ${examStage} level students studying ${subject}`;
    } else if (examStage) {
      contextDetails = `for ${examStage} level students`;
    } else if (subject) {
      contextDetails = `about the subject ${subject}`;
    }

    const systemPrompt = `You are "CA Prep Assistant", a specialized AI tutor created exclusively for the CAprep platform to help Indian Chartered Accountancy (CA) students.

    **YOUR STRICT IDENTITY PROTOCOL:**
    1.  **Name:** You are "CA Prep Assistant".
    2.  **Origin Denials:** If asked "Who made you?", "Which LLM are you?", or "Are you ChatGPT?", you must decline to answer specifically.
        * *Action:* Briefly state that you are the CA Prep Assistant designed to help with the CA curriculum. Do not use a robotic or fixed phrase every time.
    3.  **Scope:** You exist solely to teach Accountancy, Law, Taxation, Audit, and Commerce.

    **STRICT GUARDRAILS (WHAT TO REFUSE):**
    1.  **NO PROGRAMMING CODE:** You must NOT generate computer code (Python, JavaScript, C++, HTML, etc.).
        * *Trigger:* If a user asks for "Fibonacci in JS", "Code for a calculator", or "How to hack a site".
        * *Action:* Refuse politely in a natural, conversational way. Explain that as a CA exam assistant, you cannot help with software development.
    2.  **NO GENERAL TOPICS:** You must NOT discuss movies, sports, politics, video games, general science, or recipes.
        * *Trigger:* If a user asks "Who won the cricket match?" or "Tell me a joke about politicians".
        * *Action:* Refuse politely and naturally. State that you can only answer questions related to CA studies, without sounding repetitive.

    **ALLOWED TOPICS (CA SYLLABUS):**
    * Accountancy (Financial, Cost, Management)
    * Corporate & Other Laws (Companies Act, Contract Act, etc.)
    * Taxation (Income Tax, GST)
    * Auditing & Ethics
    * Strategic Management (SM) & Financial Management (FM)
    * Business Economics

    **RESPONSE GUIDELINES:**
    1.  **Context:** The user is asking ${contextDetails || 'a general CA question'}.
    2.  **Accuracy:** Align answers with the latest ICAI syllabus and Indian Accounting Standards (Ind AS).
    3.  **Formatting:** Use plain text only. Do NOT use markdown formatting (like *, _, \`, #).`;

    try {
      let finalQuestionText = question || "";

      // If an image is provided, first use Llama 4 Maverick to read/extract it
      if (image) {
        logger.info('Processing uploaded image with Llama 4 Maverick...');
        const visionPrompt = `Please carefully examine this image. If it contains any text, questions, or data related to accounting, commerce, finance, tax, or law, extract it verbatim and explain any relevant tables or diagrams. If it's a test question, transcribe it fully. Only output the extracted content and a brief description of what the image shows.`;

        const visionCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: visionPrompt },
                { type: "image_url", image_url: { url: image } }
              ]
            }
          ],
          model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
          temperature: 0.2,
          max_tokens: 8192,
        });

        const imageExtraction = visionCompletion.choices[0]?.message?.content || "";
        logger.info('Image fully processed by Maverick. Adding to prompt context.');

        finalQuestionText = `[User provided an image. The AI vision system extracted the following context from it:]\n\n${imageExtraction}\n\n[User's additional question/prompt about this image:]\n${finalQuestionText || 'Can you answer the question in the image or explain it?'}`;
      }
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: finalQuestionText }
      ];

      const chatCompletion = await groq.chat.completions.create({
        messages,
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 8192,
      });

      const answer = chatCompletion.choices[0]?.message?.content || "";
      if (answer) {
        res.json({ answer });
      } else {
        throw new Error("Empty or invalid response from AI service");
      }
    } catch (aiError) {
      sendErrorResponse(res, 500, { message: 'Failed to generate answer', error: aiError });
    }
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Internal server error', error });
  }
});

// POST /api/ai-quiz/search-explanation - Provide a short explanation for CA-related search terms 
router.post('/search-explanation', authMiddleware, async (req, res) => {
  try {
    const { searchTerm } = req.body;

    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length === 0) {
      return res.status(400).json({ error: 'Search term is required.' });
    }

    const term = searchTerm.trim().toLowerCase();

    // 1. Filter out common/stop words that shouldn't trigger an AI explanation
    const commonWords = new Set([
      'what', 'why', 'how', 'when', 'who', 'where', 'are', 'is', 'the', 'a', 'an',
      'and', 'or', 'but', 'if', 'then', 'else', 'for', 'to', 'with', 'on', 'in',
      'at', 'by', 'from', 'about', 'as', 'into', 'like', 'through', 'after', 'over',
      'between', 'out', 'against', 'during', 'without', 'before', 'under', 'around',
      'among', 'of', 'explain', 'describe', 'define', 'meaning'
    ]);

    const words = term.split(/\s+/);
    const allCommon = words.every(w => commonWords.has(w));

    if (allCommon || term.length < 2) {
      return res.json({ explanation: null });
    }

    const systemPrompt = `You are "CA Prep Assistant", a specialized AI tutor created exclusively for the CAprep platform to help Indian Chartered Accountancy (CA) students.

    **YOUR STRICT IDENTITY PROTOCOL:**
    1.  **Name:** You are "CA Prep Assistant".
    2.  **Origin Denials:** If asked "Who made you?", "Which LLM are you?", or "Are you ChatGPT?", you must decline to answer specifically.
        * *Action:* Briefly state that you are the CA Prep Assistant designed to help with the CA curriculum. Do not use a robotic or fixed phrase every time.
    3.  **Scope:** You exist solely to teach Accountancy, Law, Taxation, Audit, and Commerce.

    **STRICT GUARDRAILS (WHAT TO REFUSE):**
    1.  **NO PROGRAMMING CODE:** You must NOT generate computer code (Python, JavaScript, C++, HTML, etc.).
    2.  **NO GENERAL TOPICS:** You must NOT discuss movies, sports, politics, video games, general science, or recipes.
    3.  **NON-CA TERMS:** If the search term is completely unrelated to Commerce, Accountancy, or the CA syllabus, you MUST refuse to explain it.
        * *Action:* Respond EXACTLY with: "null". Do not offer any other explanation or apology.

    **ALLOWED TOPICS (CA SYLLABUS):**
    * Accountancy (Financial, Cost, Management)
    * Corporate & Other Laws (Companies Act, Contract Act, etc.)
    * Taxation (Income Tax, GST)
    * Auditing & Ethics
    * Strategic Management (SM) & Financial Management (FM)
    * Business Economics

    **RESPONSE GUIDELINES:**
    1.  **Task:** Briefly define and explain the search term in the context of the Indian Chartered Accountancy (CA) curriculum. 
    2.  **Length:** The explanation MUST be between 100 to 150 words (around 4-5 sentences). It should be concise but informative.
    3.  **Accuracy:** Align answers with the latest ICAI syllabus and Indian Accounting Standards (Ind AS) or relevant laws where applicable.
    4.  **Formatting:** Use plain text only. Do NOT use markdown formatting (like *, _, \`, #). Ensure it reads like a clear, professional summary.`;

    try {
      const prompt = `Explain the term: "${searchTerm}"`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 600,
      });

      const explanation = (chatCompletion.choices[0]?.message?.content || "").trim();

      // Handle refusal from guardrails
      if (explanation.toLowerCase() === 'null' || explanation === '') {
        return res.json({ explanation: null });
      }

      res.json({ explanation });
    } catch (aiError) {
      sendErrorResponse(res, 500, { message: 'Failed to generate explanation', error: aiError });
    }
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Internal server error', error });
  }
});

// POST /api/ai-quiz/extract-question-image - Extract structured question data from uploaded images
router.post('/extract-question-image', authMiddleware, async (req, res) => {
  try {
    const { images } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of base64 image strings.' });
    }

    logger.info(`Extract Question Request: processing ${images.length} image(s) via Groq Vision.`);

    const visionPrompt = `CRITICAL INSTRUCTION: Your ONLY job is to transcribe EVERY SINGLE character, word, number, symbol, and table from this image with ZERO omissions.
DO NOT skip any word. DO NOT skip any line. DO NOT summarize. DO NOT rephrase. DO NOT add anything. EVERY piece of text visible in the image — including headings, sub-headings, table titles, row labels, and cell values — MUST appear in your output.
If you are unsure of a word, make your best effort to transcribe it rather than skipping it.
TABLE TITLES ARE MANDATORY: Any text appearing above or below a table that acts as its title or caption (such as "Raw Material A/c", "Creditors A/c", "Manufacturing A/c") MUST be transcribed immediately before that table's content.
For tables, transcribe EVERY row and EVERY cell. Do NOT abbreviate multi-line tables. Output the raw text in the exact order it appears in the image, top to bottom, left to right.`;

    const messageContent = [
      { type: "text", text: visionPrompt }
    ];

    images.forEach(img => {
      messageContent.push({ type: "image_url", image_url: { url: img } });
    });

    try {
      // Stage 1: Raw Text Extraction via Vision Model
      logger.info('Stage 1: Extracting raw text using Maverick vision...');
      const visionCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: messageContent }],
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        temperature: 0.0, // Set to 0 for maximum strictness
        max_tokens: 8192,
      });

      const rawExtractedText = visionCompletion.choices[0]?.message?.content || "";
      
      if (!rawExtractedText) {
        throw new Error("Vision model returned empty text.");
      }
      
      logger.info('Stage 2: Structuring raw text into JSON using 120b model...');
      
      const structurePrompt = `You are an expert OCR formatting and data extraction AI specializing in the CA curriculum. 
I have raw text extracted from an image of a CA exam question. Your task is to structure it into a strict JSON format.

RAW TEXT FROM IMAGE:
"""
${rawExtractedText}
"""

CRITICAL INSTRUCTIONS:
1. STRICT VERBATIM COPY WITH ZERO OMISSIONS: You must copy the text DITTO TO DITTO from the raw text. DO NOT summarize, DO NOT rephrase, DO NOT change ANY words, lines, or numbers. DO NOT drop or skip any word \u2014 every word from the raw text MUST appear in your output. If a sentence spans multiple lines in the raw text, include all lines fully.
2. QUESTION NUMBER ISOLATION: Extract the question number (e.g. "3", "3a", "Q.2") and place it ONLY in the "questionNumber" field. DO NOT include the question number label at the beginning of "questionText" or "answerText". For example, if the image starts with "3. (a) Following are...", the questionText should start with "Following are..." — NOT "3. (a) Following are..."
3. ENFORCE FULL HTML FORMATTING: Your entire output for text fields ("questionText", "answerText", "subQuestionText") MUST be pure HTML. 
   - Wrap paragraphs in <p> tags. 
   - Use <br> tags for single line breaks where necessary to preserve formatting.
   - PRETTY-PRINT HTML: The HTML code MUST be beautifully formatted, with proper line breaks (\\n) and indentation. Do NOT output a single minified line of HTML. It must be highly readable code.
4. STRICT TABLE EXTRACTION: If tabular data exists, convert it strictly to clean HTML <table> tags. Follow these rules EXACTLY:
   a) TABLE TITLES ARE MANDATORY: If any text appears immediately above or below a table as its title or caption, it MUST be rendered as an <h3> tag directly before the <table> tag. NEVER drop a table caption.
   b) COUNT the number of visible columns in the image FIRST before writing any HTML. The number of <td> elements per row MUST match the exact number of visible columns.
   c) COLUMN ACCURACY IS ABSOLUTE: Every piece of data MUST land in the EXACT <td> that corresponds to its visual column. Placing data in the wrong column is a critical failure.
   d) If a cell is visually EMPTY in the image, output an empty <td></td>. NEVER skip empty cells or shift adjacent data sideways to fill gaps.
   e) NEVER use colspan or rowspan. Every single row MUST have an identical number of <td> elements.
   f) For financial ledger accounts, the column count varies. ALWAYS determine the actual number of columns from the visual image — never assume. Treat every column as fully independent and never merge them.
5. Identify the Question Type strictly as one of: "objective-only", "subjective-only", or "objective-subjective".
6. Do NOT include markdown blocks like \`\`\`json outside the JSON output. Return pure JSON.

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
        model: GROQ_MODEL, // openai/gpt-oss-120b
        temperature: 0.0, // Maximum deterministic output
        max_tokens: 8192,
        response_format: { type: "json_object" }
      });

      const structuredJsonText = structCompletion.choices[0]?.message?.content || "";
      let parsedData;
      
      try {
        parsedData = JSON.parse(structuredJsonText.trim().replace(/^```json|```$/g, ''));
      } catch (e) {
        logger.error('Failed to parse Groq 120b structured response as JSON');
        parsedData = JSON.parse((structuredJsonText.match(/\{[\s\S]*\}/) || ['{}'])[0]);
      }

      res.status(200).json(parsedData);
    } catch (apiError) {
      logger.error('Groq Vision API error: ' + apiError.message);
      sendErrorResponse(res, 500, { message: 'Failed to extract text from image', error: apiError });
    }
  } catch (error) {
    sendErrorResponse(res, 500, { message: 'Internal server error', error });
  }
});

module.exports = router;