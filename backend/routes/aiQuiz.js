const express = require('express');
const router = express.Router();
// const axios = require('axios'); // No longer needed for the API call
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai'); // Import Gemini SDK
const { authMiddleware } = require('../middleware/authMiddleware');
const Question = require('../models/QuestionModel');
require('dotenv').config(); // Ensure environment variables are loaded

// Initialize Gemini Client
if (!process.env.GEMINI_API_KEY) {
  console.error('FATAL ERROR: GEMINI_API_KEY is not defined in .env');
  // Optional: Exit process if key is critical for startup
  // process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure safety settings (adjust as needed)
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// POST /api/ai-quiz/generate - Generate questions using AI
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { subject, examStage, count = 5 } = req.body; // Default to 5 questions
    
    console.log('AI Quiz Request:', { subject, examStage, count });

    // 1. Input Validation (Basic)
    if (!subject || !examStage) {
      console.log('Missing required fields:', { subject, examStage });
      return res.status(400).json({ error: 'Subject and Exam Stage are required.' });
    }
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI API Key not configured in .env');
        return res.status(500).json({ error: 'AI service configuration error.' });
    }
    
    console.log('Gemini API Key available:', !!process.env.GEMINI_API_KEY);

    // 2. Retrieve Example Questions
    console.log('Fetching example questions for subject:', subject, 'examStage:', examStage);
    // Get the total count of available questions first
    const totalQuestions = await Question.countDocuments({ subject, examStage });
    
    // Random sampling logic for example questions
    let exampleQuestions = [];
    if (totalQuestions > 0) {
      // Determine how many examples to use (up to 30)
      const sampleSize = Math.min(totalQuestions, 30);
      console.log(`Found ${totalQuestions} total questions, will sample ${sampleSize} random questions for AI context.`);
      
      // Use MongoDB's aggregate with $sample for truly random selection
      exampleQuestions = await Question.aggregate([
        { $match: { subject, examStage } },
        { $sample: { size: sampleSize } }
      ]);
    }
    
    if (!exampleQuestions || exampleQuestions.length === 0) {
      console.warn(`No example questions found for Subject: ${subject}, Stage: ${examStage}. Will generate questions using AI's general knowledge.`);
    } else {
      console.log(`Using ${exampleQuestions.length} random example questions for AI prompt context.`);
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

**Contextual Learning from Examples:**
When example questions are provided below, analyze them carefully. Pay attention to:
* The style, tone, and complexity of the questions.
* The structure, especially how main questions and potential sub-questions are handled.
* The nature of explanations and how distractors are designed.
Use these examples to refine the quality and relevance of the questions you generate.

`;

    if (exampleQuestions.length > 0) {
      prompt += "Here are some examples of existing questions to understand the style and format:\n\n";
      exampleQuestions.forEach((q, index) => {
        // Check if this is an empty question with subquestions
        const isEmptyMainQuestion = q.questionText.trim().length < 20 && q.subQuestions && q.subQuestions.length > 0;
        
        // Only add the main question if it's not empty
        if (!isEmptyMainQuestion) {
          prompt += "Example " + (index + 1) + ":\nQuestion: " + q.questionText + "\n";
          
          // Process main question options if available
          if (q.options && q.options.length > 0) {
            prompt += "Options: ";
            q.options.forEach((opt, i) => {
              prompt += String.fromCharCode(65 + i) + ") " + opt;
              if (i < q.options.length - 1) prompt += ", ";
            });
            prompt += "\n";
          }
        }
        
        // Process subQuestions if available
        if (q.subQuestions && q.subQuestions.length > 0) {
          // First, check if there's only one subquestion with no main question content
          // This is a common pattern where the main question is empty and all content is in the subquestion
          if (q.questionText.trim().length < 20 && q.subQuestions.length === 1 && q.subQuestions[0].subQuestionText) {
            // Create a new question entry with the subquestion content instead of replacing
            // This avoids modifying the prompt string that's already been built
            const subQuestionText = q.subQuestions[0].subQuestionText;
            prompt += "Example " + (index + 1) + " (Sub):\nQuestion: " + subQuestionText + "\n";
            
            // Process subQuestion options
            if (q.subQuestions[0].subOptions && q.subQuestions[0].subOptions.length > 0) {
              prompt += "Options: ";
              q.subQuestions[0].subOptions.forEach((opt, i) => {
                prompt += String.fromCharCode(65 + i) + ") " + opt.optionText;
                if (i < q.subQuestions[0].subOptions.length - 1) prompt += ", ";
              });
              prompt += "\n";
            }
            prompt += "\n"; // Add a blank line after this example
          } else {
            // Process all subquestions normally
            q.subQuestions.forEach((subQ, subIndex) => {
              if (subQ.subQuestionText) {
                prompt += "Sub Question " + (subIndex + 1) + ": " + subQ.subQuestionText + "\n";
              }
              
              // Process subQuestion options
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
        
        prompt += "\n"; // Add a blank line between examples
      });
    } else {
      // Additional instructions when no examples are available
      prompt += "You don't have any specific examples for this subject, but please use your knowledge of " + 
                "CA curriculum to create realistic and challenging questions for " + examStage + " level " + 
                "students studying " + subject + ".\n\n" +
                "For this subject, focus on the key concepts, calculations, and applications that would be " +
                "appropriate for the " + examStage + " level of CA exams in India. Be specific to the subject " +
                "matter and avoid generic questions.\n\n";
    }

    // Reinforce JSON output format instructions
    prompt += "Important: Format your response strictly as a JSON array of objects. " +
              "Each object must have these exact keys: \"questionText\" (string), " +
              "\"options\" (array of 4 strings), \"correctAnswerIndex\" (integer from 0 to 3 " +
              "indicating the index of the correct option in the 'options' array), and " +
              "\"explanation\" (string containing a detailed explanation of why the correct answer is right and why the others are wrong). " +
              "Do not include any introductory text, explanations, or markdown formatting like ```json outside " +
              "the JSON array itself. Only output the valid JSON array.";

    // 4. Call Google Gemini API
    console.log("Sending prompt to Google Gemini API...");
    console.log("Prompt length:", prompt.length, "characters");
    // console.log("Prompt:", prompt); // Uncomment for debugging

    try {
      // NOTE: Using 'gemini-3-flash-preview' as requested.
      // If you hit Rate Limits, switch this to 'gemini-2.5-flash'
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview", 
        safetySettings 
      });
      
      console.log("Using model: gemini-3-flash-preview");

      const generationConfig = {
        temperature: 0.7,
        maxOutputTokens: 8192,
      };
      
      console.log("Generation config:", generationConfig);

      console.log("Calling Gemini API...");
      const result = await model.generateContent(prompt);
      console.log("Received response from Google Gemini API.");

      // 5. Parse Response
      let generatedQuestions = [];
      if (result && result.response) {
        const rawContent = result.response.text();
        console.log("Raw Content length:", rawContent.length, "characters");
        // console.log("Raw Content from AI:", rawContent);

        // Attempt to parse the content as JSON
        try {
          // Sometimes the AI might wrap the JSON in backticks or add intro text
          console.log("Attempting to parse JSON response...");
          const jsonMatch = rawContent.match(/```json\n?([\s\S]*?)```|(\[[\s\S]*\])/);
          let jsonString = rawContent.trim();
          if (jsonMatch) {
            console.log("Found JSON match with regex");
            jsonString = jsonMatch[1] || jsonMatch[2];
          }

          console.log("Parsing JSON string...");
          generatedQuestions = JSON.parse(jsonString);
          console.log("JSON parsed successfully");

          // Basic validation of the parsed structure
          if (!Array.isArray(generatedQuestions)) {
            console.error("Parsed response is not an array:", typeof generatedQuestions);
            throw new Error("Parsed response is not an array.");
          }
          
          console.log("Validating question objects...");
          let validationErrors = [];
          
          generatedQuestions.forEach((q, i) => {
            if (typeof q.questionText !== 'string') {
              validationErrors.push(`Question ${i}: questionText is not a string`);
            }
            if (!Array.isArray(q.options)) {
              validationErrors.push(`Question ${i}: options is not an array`);
            } else if (q.options.length < 2) {
              validationErrors.push(`Question ${i}: options has less than 2 items`);
            }
            if (typeof q.correctAnswerIndex !== 'number') {
              validationErrors.push(`Question ${i}: correctAnswerIndex is not a number`);
            } else if (q.correctAnswerIndex < 0 || q.correctAnswerIndex >= q.options.length) {
              validationErrors.push(`Question ${i}: correctAnswerIndex is out of bounds`);
            }
            if (typeof q.explanation !== 'string' || !q.explanation) {
              validationErrors.push(`Question ${i}: missing or invalid explanation`);
            }
          });
          
          // Additional quality validation
          let qualityErrors = [];
          generatedQuestions.forEach((q, i) => {
            // Check for minimum question length (at least 20 characters)
            if (q.questionText.length < 20) {
              qualityErrors.push(`Question ${i}: questionText is too short`);
            }
            
            // Check for minimum explanation length (at least 50 characters)
            if (q.explanation && q.explanation.length < 50) {
              qualityErrors.push(`Question ${i}: explanation is too brief`);
            }
            
            // Check that all options are unique
            const uniqueOptions = new Set(q.options);
            if (uniqueOptions.size !== q.options.length) {
              qualityErrors.push(`Question ${i}: contains duplicate options`);
            }
          });
          
          if (validationErrors.length > 0) {
            console.error("Validation errors:", validationErrors);
            throw new Error("Question objects have invalid structure: " + validationErrors.join("; "));
          }
          
          if (qualityErrors.length > 0) {
            console.warn("Quality issues with generated questions:", qualityErrors);
            // We don't throw an error for quality issues, just log warnings
          }

          console.log("Successfully parsed " + generatedQuestions.length + " questions.");

        } catch (parseError) {
          console.error("Failed to parse AI response JSON:", parseError);
          // console.error("First 200 chars of raw content:", rawContent.substring(0, 200));
          return res.status(500).json({ 
            error: 'Failed to parse AI response.', 
            details: parseError.message,
            rawContentPreview: rawContent.substring(0, 100) + "..." 
          });
        }

      } else {
        // Handle cases where the response might be blocked
        console.error('No valid text content received from AI API.', 
                    result ? JSON.stringify(result) : 'No result object');
        
        const blockReason = result?.promptFeedback?.blockReason;
        const safetyRatings = result?.candidates?.[0]?.safetyRatings;
        
        return res.status(500).json({
          error: 'Received no valid text content from AI service.',
          blockReason: blockReason || 'Unknown',
          safetyRatings: safetyRatings || []
        });
      }

      // 6. Send to Frontend
      console.log("Sending " + generatedQuestions.length + " questions to frontend");
      res.status(200).json(generatedQuestions);

    } catch (apiError) {
      console.error('Error calling Gemini API:', apiError);
      console.error('API error details:', JSON.stringify(apiError, null, 2));
      return res.status(500).json({ 
        error: 'Error calling AI service API', 
        details: apiError.message,
        apiErrorDetails: JSON.stringify(apiError)
      });
    }

  } catch (error) {
    // General error handling for API calls or other issues
    console.error('Error generating AI quiz:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate AI quiz.', 
      details: error.message,
      stack: error.stack
    });
  }
});

// POST /api/ai-quiz/ask - Answer CA-related questions using AI
router.post('/ask', async (req, res) => {
  try {
    const { question, examStage, subject, conversationHistory = [] } = req.body;
    
    console.log('AI Bot Question Request:', { question, examStage, subject, historyLength: conversationHistory.length });

    // Input Validation
    if (!question) {
      return res.status(400).json({ error: 'Question is required.' });
    }
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI API Key not configured in .env');
      return res.status(500).json({ error: 'AI service configuration error.' });
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

    // --- SYSTEM INSTRUCTIONS WITH STRICT GUARDRAILS & IDENTITY LOCK ---
    const systemPrompt = `You are "CA Prep Assistant", a specialized AI tutor created exclusively for the CAprep platform to help Indian Chartered Accountancy (CA) students.

    **YOUR STRICT IDENTITY PROTOCOL:**
    1.  **Name:** You are "CA Prep Assistant".
    2.  **Origin Denials:** If asked "Who made you?", "Are you Google AI?", "Are you Gemini?", "Which LLM are you?", or "Are you ChatGPT?", you must DENY it.
        * *Required Answer:* "I am the CA Prep Assistant, a specialized AI designed to help students with the Indian Chartered Accountancy curriculum."
    3.  **Scope:** You exist solely to teach Accountancy, Law, Taxation, Audit, and Commerce.

    **STRICT GUARDRAILS (WHAT TO REFUSE):**
    1.  **NO PROGRAMMING CODE:** You must NOT generate computer code (Python, JavaScript, C++, HTML, etc.).
        * *Trigger:* If a user asks for "Fibonacci in JS", "Code for a calculator", or "How to hack a site".
        * *Action:* Refuse politely. Say: "I am a CA exam assistant. I cannot help with programming code or software development."
    2.  **NO GENERAL TOPICS:** You must NOT discuss movies, sports, politics, video games, general science, or recipes.
        * *Trigger:* If a user asks "Who won the cricket match?" or "Tell me a joke about politicians".
        * *Action:* Refuse politely. Say: "I apologize, but I can only answer questions related to your CA studies."

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
      // Initialize the model with SYSTEM INSTRUCTIONS
      // NOTE: Using 'gemini-3-flash-preview' as requested.
      // If you encounter a 404 or 429 error, fallback to 'gemini-2.5-flash'
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview", 
        safetySettings,
        systemInstruction: systemPrompt // <--- KEY FIX: Guardrails apply to every turn
      });
      
      const generationConfig = {
        temperature: 0.3, // Lower temperature for more factual, strict responses
        maxOutputTokens: 1000,
      };
      
      console.log("Setting up chat with Gemini...");
      
      // Convert conversation history to Gemini's chat format
      // NOTE: We no longer need to manually inject the system prompt here
      const chatHistory = conversationHistory.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      
      // Create a chat session with history
      const chat = model.startChat({
        history: chatHistory,
        generationConfig
      });
      
      console.log("Sending message to Gemini chat...");
      const result = await chat.sendMessage(question);
      console.log("Received response from Gemini chat API.");

      if (result && result.response) {
        const answer = result.response.text();
        console.log("Answer length:", answer.length, "characters");
        
        res.json({ answer });
      } else {
        throw new Error("Empty or invalid response from AI service");
      }
    } catch (aiError) {
      console.error("Error calling Gemini AI chat:", aiError);
      res.status(500).json({ error: 'Failed to generate answer', details: aiError.message });
    }
  } catch (error) {
    console.error('Error handling CA question:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;