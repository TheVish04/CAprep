import html2pdf from 'html2pdf.js';
import DOMPurify from 'dompurify';

// Human-readable labels for filter keys
const FILTER_LABELS = {
  examStage:      'Exam Stage',
  subject:        'Subject',
  paperType:      'Paper Type',
  year:           'Year',
  month:          'Month',
  questionNumber: 'Question No.',
  search:         'Search Keyword',
};

const STYLES = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

    * {
      box-sizing: border-box;
      background-color: #fff !important;
      color: #111 !important;
    }

    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.65;
      color: #111;
      max-width: 210mm;
      margin: 0;
      padding: 0;
    }

    /* Headings */
    h1 { font-size: 18pt; font-weight: 700; margin: 0 0 4px 0; }
    h2 { font-size: 12pt; font-weight: 700; margin: 0; }
    h3 { font-size: 11pt; font-weight: 700; margin: 8px 0 4px 0; }
    h4 { font-size: 10pt; font-weight: 600; margin: 6px 0 3px 0; }

    /* Normalize headings inside question/answer HTML */
    .question-content h1,
    .question-content h2,
    .question-content h3,
    .question-content h4,
    .question-content h5,
    .question-content h6,
    .answer-content h1,
    .answer-content h2,
    .answer-content h3,
    .answer-content h4,
    .answer-content h5,
    .answer-content h6 {
      font-size: 10.5pt !important;
      font-weight: 700 !important;
      margin: 6px 0 3px 0 !important;
      color: #111 !important;
    }

    p { margin: 0 0 5px 0; }

    /* Lists */
    ul, ol { margin: 4px 0 8px 20px; padding-left: 16px; }
    ul { list-style-type: disc; }
    ol { list-style-type: decimal; }
    li { margin: 3px 0; }

    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
      font-size: 10pt !important;
    }
    th, td {
      border: 1px solid #444;
      padding: 6px 9px;
      text-align: left;
      font-size: 10pt !important;
      vertical-align: top;
    }
    th {
      background-color: #e8e8e8 !important;
      font-weight: 700;
    }

    /* Code */
    pre, code {
      font-family: "Courier New", Courier, monospace;
      background-color: #f5f5f5 !important;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 3px;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 10pt;
    }

    /* Text formatting */
    strong, b { font-weight: 700; }
    em, i { font-style: italic; }
    u { text-decoration: underline; }
    sub, sup { font-size: 75%; line-height: 0; position: relative; vertical-align: baseline; }
    sup { top: -0.5em; }
    sub { bottom: -0.25em; }

    /* ── PDF Header ── */
    .pdf-header {
      border-bottom: 2px solid #111;
      padding: 16px 20px 12px;
      margin-bottom: 16px;
    }
    .pdf-header-subtitle {
      font-size: 10pt;
      color: #555 !important;
      margin-top: 4px;
    }

    /* ── Filter Info Box ── */
    .filter-info {
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 20px;
      font-size: 10pt;
      background-color: #f9f9f9 !important;
      display: flex;
      flex-wrap: wrap;
      gap: 6px 20px;
    }
    .filter-chip {
      display: inline-block;
    }
    .filter-chip .label {
      font-weight: 600;
      color: #333 !important;
    }

    /* ── Question Card ── */
    .question-card {
      border: 1px solid #ccc;
      border-radius: 4px;
      margin-bottom: 20px;
      overflow: hidden;
      page-break-inside: auto;
    }

    .question-header {
      background-color: #f0f0f0 !important;
      padding: 8px 14px;
      border-bottom: 1px solid #ccc;
      page-break-after: avoid;
    }

    .question-body {
      padding: 12px 14px;
    }

    .section-label {
      font-size: 9pt;
      font-weight: 700;
      color: #555 !important;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
    }

    .question-content {
      margin-bottom: 6px;
      page-break-inside: auto;
    }

    /* ── Answer Section ── */
    .answer-section {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #aaa;
      page-break-inside: auto;
    }

    .answer-label {
      font-size: 9pt;
      font-weight: 700;
      color: #2a7a2a !important;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
    }

    .answer-content { }

    /* ── Sub Questions ── */
    .sub-questions-section {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
    }

    .subquestion-item {
      margin-left: 16px;
      margin-bottom: 10px;
      padding-left: 10px;
      border-left: 2px solid #ccc;
    }

    /* ── Options ── */
    .options { margin: 6px 0 6px 10px; }
    .option { margin: 3px 0; padding: 3px 6px; }
    .correct-option { font-weight: 700; border-left: 3px solid #2a7a2a; padding-left: 6px; }
  </style>
`;

const sanitizeOptions = {
  ALLOWED_TAGS: [
    'div', 'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'sub', 'sup',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'blockquote', 'pre', 'code',
    'img', 'span',
  ],
  ALLOWED_ATTR: ['src', 'alt', 'title', 'class', 'colspan', 'rowspan'],
  FORBID_ATTR: ['style', 'color', 'background', 'background-color'],
};

/** Sanitise already-HTML content for PDF — no double-processing */
const sanitize = (html) => DOMPurify.sanitize(html || '', sanitizeOptions);

/** Build a smart filename from the active filters */
const buildFilename = (filters, includeAnswers) => {
  const parts = ['ca'];
  if (filters.examStage) parts.push(filters.examStage.toLowerCase());
  if (filters.subject)   parts.push(filters.subject.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  if (filters.paperType) parts.push(filters.paperType.toLowerCase());
  if (filters.year)      parts.push(filters.year);
  parts.push('questions');
  if (includeAnswers)    parts.push('with-answers');
  return `${parts.join('-')}.pdf`;
};

/** Render the applied filters as readable chips */
const renderFilterInfo = (filters) => {
  const chips = Object.entries(FILTER_LABELS)
    .map(([key, label]) => {
      const val = filters[key];
      if (!val || val === false) return '';
      return `<span class="filter-chip"><span class="label">${label}:</span> ${val}</span>`;
    })
    .filter(Boolean)
    .join('');

  if (!chips) return '<span>All Questions</span>';
  return chips;
};

export const generateQuestionsPDF = async (questions, filters, includeAnswers, individualAnswers) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        ${STYLES}
      </head>
      <body>
        <div class="pdf-header">
          <h1>CAprep</h1>
          <div class="pdf-header-subtitle">
            Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            &nbsp;·&nbsp; ${questions.length} question${questions.length !== 1 ? 's' : ''}
            ${includeAnswers ? '&nbsp;·&nbsp; Answers included' : ''}
          </div>
        </div>

        <div class="filter-info">
          ${renderFilterInfo(filters)}
        </div>

        ${questions.map((q, index) => `
          <div class="question-card">
            <div class="question-header">
              <h2>Q${q.questionNumber || (index + 1)}: ${q.subject || ''} (${[q.month, q.year, q.paperType].filter(Boolean).join(' | ')})</h2>
            </div>

            <div class="question-body">
              <div class="section-label">Question</div>
              <div class="question-content">
                ${sanitize(q.questionText || '')}
              </div>

              ${(includeAnswers || individualAnswers[q._id]) && q.answerText ? `
                <div class="answer-section">
                  <div class="answer-label">Answer</div>
                  <div class="answer-content">${sanitize(q.answerText)}</div>
                </div>
              ` : ''}

              ${q.subQuestions?.length ? `
                <div class="sub-questions-section">
                  ${q.subQuestions.map((subQ, subIdx) => `
                    <div class="subquestion-item">
                      <h4>Sub-Question ${subQ.subQuestionNumber || (subIdx + 1)}</h4>
                      ${subQ.subQuestionText ? `<div class="question-content">${sanitize(subQ.subQuestionText)}</div>` : ''}

                      ${subQ.subOptions?.length ? `
                        <div class="options">
                          ${subQ.subOptions.map((opt, optIdx) => {
                            const correct = opt.isCorrect && (includeAnswers || individualAnswers[q._id]);
                            return `<div class="option ${correct ? 'correct-option' : ''}">
                              ${String.fromCharCode(65 + optIdx)}. ${DOMPurify.sanitize(opt.optionText || '')}${correct ? ' ✓' : ''}
                            </div>`;
                          }).join('')}
                        </div>
                      ` : ''}

                      ${(includeAnswers || individualAnswers[q._id]) && subQ.answerText ? `
                        <div class="answer-section">
                          <div class="answer-label">Answer</div>
                          <div class="answer-content">${sanitize(subQ.answerText)}</div>
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </body>
    </html>
  `;

  const options = {
    margin: [12, 14],
    filename: buildFilename(filters, includeAnswers),
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    },
    pagebreak: {
      mode: ['css'],
      avoid: ['.question-header', 'h3', 'h4'],
    },
  };

  // Use string mode — avoids html2canvas blank-page issue with off-screen elements
  await html2pdf().set(options).from(htmlContent, 'string').save();
};

export const savePDF = async (questions, filters, includeAnswers, individualAnswers) => {
  await generateQuestionsPDF(questions, filters, includeAnswers, individualAnswers);
};
