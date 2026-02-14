import React, { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import './PreviewPanel.css'; // Import CSS for styling

const PreviewPanel = ({ data, onClose, questionType = 'objective-subjective' }) => {
  // Create a ref for the modal dialog
  const modalRef = useRef(null);
  
  // Handle keyboard events (Escape key to close)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    // Focus the modal when it opens for accessibility
    if (modalRef.current) {
      modalRef.current.focus();
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Log the data to debug
  console.log('Preview Data:', data, 'Question Type:', questionType);

  if (!data) return null;

  // Helper function to determine the title based on question type
  const getPreviewTitle = () => {
    switch (questionType) {
      case 'subjective-only':
        return 'Subjective Question Preview';
      case 'objective-only':
        return 'Multiple Choice Question Preview';
      default:
        return 'Question Preview';
    }
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="preview-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal Content */}
      <div 
        className="preview-modal"
        ref={modalRef}
        tabIndex="-1"
        role="dialog"
        aria-labelledby="preview-title"
        aria-modal="true"
      >
        <h2 className="preview-title" id="preview-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          {getPreviewTitle()}
        </h2>
        <button className="preview-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        
        <div className="preview-content">
          <div className="preview-info-grid">
            <div className="preview-info-item">
              <span className="preview-label">Subject</span>
              <span className="preview-value">{data.subject || 'N/A'}</span>
            </div>
            <div className="preview-info-item">
              <span className="preview-label">Exam Stage</span>
              <span className="preview-value">{data.examStage || 'N/A'}</span>
            </div>
            <div className="preview-info-item">
              <span className="preview-label">Paper Type</span>
              <span className="preview-value">{data.paperType || 'N/A'}</span>
            </div>
            <div className="preview-info-item">
              <span className="preview-label">Year</span>
              <span className="preview-value">{data.year || 'N/A'}</span>
            </div>
            <div className="preview-info-item">
              <span className="preview-label">Month</span>
              <span className="preview-value">{data.month || 'N/A'}</span>
            </div>
            <div className="preview-info-item">
              <span className="preview-label">Paper No.</span>
              <span className="preview-value">{data.paperNo || 'N/A'}</span>
            </div>
            <div className="preview-info-item">
              <span className="preview-label">Question Number</span>
              <span className="preview-value">{data.questionNumber || 'N/A'}</span>
            </div>
          </div>

          <div className="preview-section">
            <h3 className="preview-section-title">Question Text</h3>
            <div className="preview-question-text" 
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(
                    data.questionText || 'N/A'
                  ) 
                }}
            />
          </div>

          {/* Show answer text for subjective-only and objective-subjective types */}
          {(questionType === 'subjective-only' || (questionType === 'objective-subjective' && data.answerText)) && (
            <div className="preview-section">
              <h3 className="preview-section-title">Answer Text</h3>
              <div className="preview-question-text"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(
                    data.answerText || 'N/A'
                  ) 
                }}
              />
            </div>
          )}

          {/* Show sub-questions for objective-only and objective-subjective types */}
          {(questionType === 'objective-only' || (questionType === 'objective-subjective' && data.subQuestions && data.subQuestions.length > 0)) && (
            <div className="preview-sub-questions">
              <h3 className="preview-section-title">
                {questionType === 'objective-only' ? 'Options' : 'Sub-Questions'}
              </h3>
              {data.subQuestions.map((subQ, subIdx) => (
                <div key={subIdx} className="preview-sub-question">
                  {(questionType !== 'objective-only' || subQ.subQuestionText) && (
                    <>
                      <div className="preview-sub-question-header">
                        <strong>
                          {questionType === 'objective-only' 
                            ? 'Question' 
                            : `Sub Question ${subQ.subQuestionNumber || (subIdx + 1)}`}
                        </strong>
                      </div>
                      <div className="preview-sub-question-text">
                        {subQ.subQuestionText || 'N/A'}
                      </div>
                    </>
                  )}
                  {subQ.subOptions && subQ.subOptions.length > 0 && (
                    <div className="preview-options">
                      {subQ.subOptions.map((subOpt, optIdx) => (
                        <div 
                          key={optIdx} 
                          className={`preview-option ${subOpt.isCorrect ? 'correct' : ''}`}
                        >
                          <div className="preview-option-letter">
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <div className="preview-option-text">
                            {subOpt.optionText || 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="preview-actions">
          <button
            onClick={onClose}
            className="preview-close-btn"
            aria-label="Close preview"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
            Close Preview
          </button>
        </div>
      </div>
    </>
  );
};

export default PreviewPanel;