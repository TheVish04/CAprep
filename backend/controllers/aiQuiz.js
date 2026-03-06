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

module.exports = router;