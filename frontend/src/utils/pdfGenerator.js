import html2pdf from 'html2pdf.js';
import DOMPurify from 'dompurify';

const STYLES = `
  <style>
    /* Base styles */
    * {
      background-color: #fff !important;
      color: #000 !important;
    }
    
    /* Typography */
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      font-size: 12pt;
    }

    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      margin: 1em 0 0.5em;
      font-weight: bold;
    }

    /* Lists */
    ul, ol {
      margin-left: 20px;
      padding-left: 20px;
      margin-bottom: 1em;
    }

    ul { list-style-type: disc; }
    ol { list-style-type: decimal; }
    ul ul { list-style-type: circle; }
    ul ul ul { list-style-type: square; }
    
    li {
      margin: 8px 0;
      padding-left: 10px;
    }

    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }

    th, td {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
    }

    th {
      background-color: #f0f0f0 !important;
      font-weight: bold;
    }

    /* Code blocks */
    pre, code {
      font-family: "Courier New", Courier, monospace;
      background-color: #f5f5f5 !important;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* Blockquotes */
    blockquote {
      margin: 1em 0;
      padding: 10px 20px;
      border-left: 3px solid #000;
      background-color: #f9f9f9 !important;
    }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      margin: 1em 0;
    }

    /* Mathematical expressions */
    .math {
      font-family: "Times New Roman", Times, serif;
      font-style: italic;
    }

    /* Subscript and Superscript */
    sub, sup {
      font-size: 75%;
      line-height: 0;
      position: relative;
      vertical-align: baseline;
    }
    sup { top: -0.5em; }
    sub { bottom: -0.25em; }

    /* Text formatting */
    strong, b { font-weight: bold; }
    em, i { font-style: italic; }
    u { text-decoration: underline; }
    s, strike { text-decoration: line-through; }

    /* Definition lists */
    dl {
      margin: 1em 0;
    }
    dt {
      font-weight: bold;
      margin-top: 0.5em;
    }
    dd {
      margin-left: 20px;
    }

    /* Case scenario styles */
    .case-scenario {
      margin: 15px 0;
    }

    .case-scenario-title {
      font-weight: bold;
      margin-bottom: 10px;
    }

    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 210mm;
      margin: 0;
      padding: 20px;
    }
    
    .pdf-header {
      border-bottom: 1px solid #000;
      padding: 15px;
      text-align: center;
      margin-bottom: 20px;
      page-break-before: always;
      page-break-after: avoid;
    }
    
    .filter-info {
      border: 1px solid #000;
      padding: 10px;
      margin-bottom: 20px;
      font-size: 12px;
      page-break-after: avoid;
    }
    
    .question-card {
      border: 1px solid #000;
      margin-bottom: 20px;
      padding: 15px;
      page-break-inside: auto;
    }
    
    .question-header {
      border-bottom: 1px solid #000;
      padding: 10px;
      margin: -15px -15px 15px -15px;
      page-break-after: avoid;
    }
    
    .question-content {
      page-break-inside: auto;
    }
    
    .case-scenario {
      border-left: 1px solid #000;
      padding: 10px;
      margin: 10px 0;
    }
    
    .sub-questions {
      margin-left: 20px;
      page-break-inside: auto;
    }
    
    .options {
      margin-left: 20px;
    }
    
    .option {
      margin: 5px 0;
      padding: 5px;
    }
    
    .correct-option {
      border-left: 1px solid #000;
      font-weight: bold;
    }

    /* Remove any custom colors from question elements */
    .question-title,
    .case-scenario-title,
    .sub-question-title {
      color: #000 !important;
      background-color: #fff !important;
    }

    /* Force override any inline styles */
    [style*="color"] {
      color: #000 !important;
    }

    [style*="background"] {
      background-color: #fff !important;
    }
  </style>
`;

export const generateQuestionsPDF = async (questions, filters, includeAnswers, individualAnswers) => {
  const formatContent = (text) => {
    if (!text) return '';
    
    let formattedText = text;

    // Convert bullet points
    formattedText = formattedText.replace(/•\s*(.*?)(?=(?:•|\n|$))/g, '<li>$1</li>');
    if (formattedText.includes('<li>')) {
      formattedText = `<ul>${formattedText}</ul>`;
    }

    // Convert numbered lists (e.g., "1.", "2.", etc.)
    formattedText = formattedText.replace(/^\d+\.\s*(.*?)(?=(?:\n\d+\.|\n|$))/gm, '<li>$1</li>');
    if (formattedText.match(/^\d+\./m)) {
      formattedText = `<ol>${formattedText}</ol>`;
    }

    // Convert simple table syntax (if used)
    // Example: | Header 1 | Header 2 | -> proper HTML table
    if (formattedText.includes('|')) {
      const rows = formattedText.split('\n').filter(row => row.trim().startsWith('|'));
      if (rows.length > 0) {
        const tableRows = rows.map(row => {
          const cells = row.split('|').filter(cell => cell.trim());
          return `<tr>${cells.map(cell => `<td>${cell.trim()}</td>`).join('')}</tr>`;
        });
        formattedText = `<table>${tableRows.join('')}</table>`;
      }
    }

    // Handle code blocks
    formattedText = formattedText.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Handle inline code
    formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Handle mathematical expressions
    formattedText = formattedText.replace(/\$([^$]+)\$/g, '<span class="math">$1</span>');

    return formattedText;
  };

  const sanitizeOptions = {
    ALLOWED_TAGS: [
      // Structure
      'div', 'p', 'br', 'hr',
      // Typography
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'sub', 'sup',
      // Lists
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      // Tables
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      // Other
      'blockquote', 'pre', 'code',
      'img', 'span'
    ],
    ALLOWED_ATTR: ['src', 'alt', 'title', 'class', 'id'],
    FORBID_ATTR: ['style', 'color', 'background', 'background-color'],
  };

  // Create HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        ${STYLES}
      </head>
      <body>
        <div class="pdf-header">
          <h1>CA Exam Preparation</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
        
          <div class="filter-info">
            ${Object.entries(filters)
              .filter(([_, value]) => value)
              .map(([key, value]) => `<div>${key}: ${value}</div>`)
              .join('') || 'All Questions'}
          </div>
        </div>
        
        ${questions.map((question, index) => `
          <div class="question-card">
            <div class="question-header">
              <h2>Q${question.questionNumber || (index + 1)}: ${question.subject || ''} (${question.month || ''} ${question.year || ''} | ${question.paperType || ''})</h2>
            </div>
            
            <div class="question-content">
              ${DOMPurify.sanitize(formatContent(question.questionText || ''), sanitizeOptions)}
            </div>
            
            ${(includeAnswers || individualAnswers[question._id]) && question.answerText ? `
              <div class="answer-section" style="margin-top: 10px; padding: 10px; border-top: 1px solid #ccc;">
                <h3>Answer:</h3>
                <div>${DOMPurify.sanitize(formatContent(question.answerText), sanitizeOptions)}</div>
              </div>
            ` : ''}
            
            ${question.subQuestions?.map((subQ, subIndex) => `
              <div class="sub-questions">
                <h3>Sub-Question ${subQ.subQuestionNumber || (subIndex + 1)}</h3>
                ${subQ.subQuestionText ? 
                  `<div>${DOMPurify.sanitize(formatContent(subQ.subQuestionText), sanitizeOptions)}</div>` : ''}
                
                ${subQ.subOptions?.length ? `
                  <div class="options">
                    ${subQ.subOptions.map((opt, optIndex) => {
                      const isCorrect = opt.isCorrect && (includeAnswers || individualAnswers[question._id]);
                      return `
                        <div class="option ${isCorrect ? 'correct-option' : ''}">
                          ${String.fromCharCode(65 + optIndex)}. 
                          ${DOMPurify.sanitize(opt.optionText || '')}
                          ${isCorrect ? ' ✓' : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : ''}
                
                ${(includeAnswers || individualAnswers[question._id]) && subQ.answerText ? `
                  <div class="answer-section" style="margin-top: 10px; padding: 10px; border-top: 1px dashed #ccc;">
                    <h4>Answer:</h4>
                    <div>${DOMPurify.sanitize(formatContent(subQ.answerText), sanitizeOptions)}</div>
                  </div>
                ` : ''}
              </div>
            `).join('') || ''}
          </div>
        `).join('')}
      </body>
    </html>
  `;

  // PDF generation options
  const options = {
    margin: [15, 15],
    filename: `ca-questions-${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      logging: false
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
    },
    pagebreak: { 
      mode: 'avoid-all',
      before: '.pdf-header',
      avoid: ['.question-header', 'h3', 'h4']
    }
  };

  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    // Generate PDF
    const pdf = await html2pdf().set(options).from(container).save();
    return pdf;
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
};

export const savePDF = async (questions, filters, includeAnswers, individualAnswers) => {
  await generateQuestionsPDF(questions, filters, includeAnswers, individualAnswers);
};
