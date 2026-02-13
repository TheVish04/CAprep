import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import DOMPurify from 'dompurify';
import './QuizReview.css'; // Create this CSS file

const QuizReview = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const quizAttempt = location.state?.quizAttempt;
    const [source, setSource] = useState('');
    
    // Determine where the user came from (quiz results or history)
    useEffect(() => {
        // Check if we have a source in the state
        if (location.state?.from) {
            setSource(location.state.from);
        } else {
            // Try to infer based on whether this is a recently completed quiz
            // Recent quizzes will have the full questions array
            if (quizAttempt && quizAttempt.questions && !quizAttempt._id) {
                // Came directly from quiz results (no _id means it's not from history)
                setSource('quiz-results');
            } else {
                // Otherwise assume it's from quiz history
                setSource('quiz-history');
            }
        }
    }, [location, quizAttempt]);
    
    const handleBackClick = () => {
        if (source === 'quiz-results') {
            // Go back to quiz results and preserve the quiz attempt data
            navigate('/quiz', { 
                state: { 
                    showResults: true,
                    lastQuizAttempt: quizAttempt
                },
                replace: true 
            });
        } else {
            // Go back to quiz history or navigate(-1)
            navigate(-1);
        }
    };

    if (!quizAttempt) {
        // If no state is passed, redirect or show an error
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="quiz-review-container error-message">
                    <h2>Error</h2>
                    <p>No quiz attempt data found. Please go back to the quiz results or history.</p>
                    <Link to="/quiz" className="btn">Take a Quiz</Link>
                    <Link to="/quiz-history" className="btn">View History</Link>
                </div>
            </div>
        );
    }

    const { subject, score, totalQuestions, percentage, date, questionsAttempted, questions } = quizAttempt;

    // Format date with fallback
    const formatDate = (dateString) => {
        if (!dateString) return "Not available";
        
        // Try to create a date object
        const dateObj = new Date(dateString);
        
        // Check if the date is valid
        if (isNaN(dateObj.getTime())) {
            // If the date is stored as a timestamp string, try parsing it
            if (typeof dateString === 'string' && !isNaN(parseInt(dateString))) {
                const timestamp = parseInt(dateString);
                const timestampDate = new Date(timestamp);
                
                if (!isNaN(timestampDate.getTime())) {
                    return timestampDate.toLocaleString();
                }
            }
            return "Not available"; // Fallback if all parsing attempts fail
        }
        
        return dateObj.toLocaleString();
    };

    // Helper to find the full question details using questionId from the attempt
    const getFullQuestion = (questionId, index) => {
        // First try direct ID matching (standard approach)
        const question = questions.find(q => String(q._id) === String(questionId));
        if (question) return question;
        
        // If not found, try to find by index for AI questions
        // This happens when question IDs don't match exactly (like with AI generated questions)
        if (questions[index]) return questions[index];
        
        // If still not found, return null and we'll handle the missing question case
        return null;
    };

    return (
        <div className="page-wrapper quiz-review-page">
            <Navbar />
            <div className="quiz-review-container">
                <h1>Quiz Review: {subject}</h1>
                <div className="quiz-summary-bar">
                    <span>Score: {score}/{totalQuestions} ({percentage}%)</span>
                    <span>Date: {formatDate(date)}</span>
                </div>

                <div className="review-questions-list">
                    {questionsAttempted.map((attempt, index) => {
                        const fullQuestion = getFullQuestion(attempt.questionId, index);
                        if (!fullQuestion || !fullQuestion.subQuestions || fullQuestion.subQuestions.length === 0) {
                            return (
                                <div key={index} className="review-question-card error">
                                    <h2>Question {index + 1}</h2>
                                    <div className="review-question-text">Question data missing for attempt {index + 1}</div>
                                    {attempt.questionText && (
                                        <div className="review-question-text">
                                            <strong>Original Question:</strong> {attempt.questionText}
                                        </div>
                                    )}
                                    {attempt.optionTexts && attempt.optionTexts.length > 0 && (
                                        <div className="review-options">
                                            <h4>Options:</h4>
                                            <ul>
                                                {attempt.optionTexts.map((optText, optIdx) => (
                                                    <li key={optIdx} className={
                                                        `review-option 
                                                        ${optIdx === attempt.correctOptionIndex ? 'correct-answer' : ''} 
                                                        ${optIdx === attempt.selectedOptionIndex ? (attempt.isCorrect ? 'selected-correct' : 'selected-incorrect') : ''}`
                                                    }>
                                                        <span className="option-marker">{String.fromCharCode(65 + optIdx)}</span>
                                                        {optText}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <div className="review-feedback">
                                        <p className={`status ${attempt.isCorrect ? 'correct' : 'incorrect'}`}>
                                            <strong>Status: </strong> 
                                            {attempt.isCorrect ? 'Correct' : 'Incorrect'}
                                        </p>
                                        {attempt.explanation && (
                                            <div className="answer-explanation">
                                                <h4>Explanation:</h4>
                                                <p className="question-content-wrapper" dangerouslySetInnerHTML={{ 
                                                    __html: DOMPurify.sanitize(attempt.explanation) 
                                                }}></p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                        
                        // Assuming one sub-question per question structure
                        const subQuestion = fullQuestion.subQuestions[attempt.subQuestionIndex || 0];
                        const selectedOption = attempt.selectedOptionIndex !== undefined ? subQuestion.subOptions[attempt.selectedOptionIndex] : null;
                        const correctOption = subQuestion.subOptions[attempt.correctOptionIndex];

                        return (
                            <div key={fullQuestion._id} className={`review-question-card ${attempt.isCorrect ? 'correct' : 'incorrect'}`}>
                                <h2>Question {index + 1}</h2>
                                <div className="review-question-text question-content-wrapper" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(fullQuestion.questionText) }}></div>
                                {subQuestion.subQuestionText && <h3 className="review-subquestion-text">{subQuestion.subQuestionText}</h3>}
                                
                                <div className="review-options">
                                    <h4>Options:</h4>
                                    <ul>
                                        {subQuestion.subOptions.map((option, optIndex) => (
                                            <li key={optIndex} className={
                                                `review-option 
                                                ${optIndex === attempt.correctOptionIndex ? 'correct-answer' : ''} 
                                                ${optIndex === attempt.selectedOptionIndex ? (attempt.isCorrect ? 'selected-correct' : 'selected-incorrect') : ''}`
                                            }>
                                                <span className="option-marker">{String.fromCharCode(65 + optIndex)}</span>
                                                {option.optionText}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="review-feedback">
                                    {attempt.selectedOptionIndex === undefined ? (
                                        <p className="status unanswered"><strong>Status: </strong> Not Answered</p>
                                    ) : attempt.isCorrect ? (
                                        <p className="status correct"><strong>Status: </strong> Correct!</p>
                                    ) : (
                                        <p className="status incorrect"><strong>Status: </strong> Incorrect</p>
                                    )}
                                    {(attempt.explanation || (fullQuestion && fullQuestion.explanation)) && (
                                        <div className="answer-explanation">
                                            <h4>Explanation:</h4>
                                            <p className="question-content-wrapper" dangerouslySetInnerHTML={{ 
                                                __html: DOMPurify.sanitize(attempt.explanation || fullQuestion.explanation) 
                                            }}></p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div className="review-actions">
                     <button onClick={handleBackClick} className="btn btn-secondary">Back</button>
                     <Link to="/quiz" className="btn">Take New Quiz</Link>
                </div>
            </div>
        </div>
    );
};

export default QuizReview; 