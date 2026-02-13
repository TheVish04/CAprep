import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import './QuizHistory.css'; // We'll create this CSS file next

const QuizHistory = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://caprep.onrender.com';

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`${API_BASE_URL}/api/users/me/quiz-history`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                setHistory(response.data || []);
            } catch (err) {
                console.error("Error fetching quiz history:", err);
                setError(err.response?.data?.error || "Failed to load quiz history.");
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [navigate, API_BASE_URL]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            return new Intl.DateTimeFormat('en-US', options).format(new Date(dateString));
        } catch (e) {
            return 'Invalid Date';
        }
    };

    const navigateToReview = async (quizAttempt) => {
        try {
            // Show loading state
            setLoading(true);
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }
            
            // For AI quizzes, we construct the questions from the saved data
            if (quizAttempt.isAiQuiz) {
                // Create questions from the stored attempt data
                const aiQuestions = quizAttempt.questionsAttempted.map((attempt, index) => {
                    // Get option text if available, or generate placeholders
                    let options = [];
                    
                    // If we have the question text stored, create more detailed options
                    if (attempt.questionText) {
                        // If we have option texts stored, use those
                        if (attempt.optionTexts && attempt.optionTexts.length > 0) {
                            options = attempt.optionTexts.map((optText, optIdx) => ({
                                optionText: optText || `Option ${String.fromCharCode(65 + optIdx)}`,
                                isCorrect: optIdx === attempt.correctOptionIndex
                            }));
                        } else {
                            // Create a more complete set of options with the correct one highlighted
                            options = Array(4).fill(null).map((_, optIdx) => ({
                                optionText: optIdx === attempt.correctOptionIndex 
                                    ? `[Correct Option]` 
                                    : `Option ${String.fromCharCode(65 + optIdx)}`,
                                isCorrect: optIdx === attempt.correctOptionIndex
                            }));
                        }
                    } else {
                        // Basic options when we don't have details
                        options = Array(4).fill(null).map((_, optIdx) => ({
                            optionText: `Option ${String.fromCharCode(65 + optIdx)}`,
                            isCorrect: optIdx === attempt.correctOptionIndex
                        }));
                    }
                    
                    // Create a synthetic question object with the necessary structure
                    return {
                        _id: attempt.isAiGenerated ? `ai-question-${index}` : attempt.questionId,
                        questionText: attempt.questionText || `AI Generated Question ${index + 1}`,
                        subQuestions: [{
                            subQuestionNumber: '1',
                            subQuestionText: '',
                            subOptions: options
                        }]
                    };
                });
                
                // Navigate to review with reconstructed data
                const completeQuizAttempt = {
                    ...quizAttempt,
                    questions: aiQuestions
                };
                
                navigate('/quiz-review', { 
                    state: { 
                        quizAttempt: completeQuizAttempt,
                        from: 'quiz-history'
                    } 
                });
                setLoading(false);
                return;
            }
            
            // For standard quizzes, fetch complete questions data for the attempted questions
            const questionIds = quizAttempt.questionsAttempted.map(q => q.questionId);
            const response = await axios.post(`${API_BASE_URL}/api/questions/batch`, 
                { questionIds },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            // Create a complete quiz attempt object with full question data
            const completeQuizAttempt = {
                ...quizAttempt,
                questions: response.data
            };
            
            // Navigate to the review page with complete data
            navigate('/quiz-review', { 
                state: { 
                    quizAttempt: completeQuizAttempt,
                    from: 'quiz-history'
                } 
            });
        } catch (err) {
            console.error("Error fetching question details:", err);
            alert("Couldn't load quiz review details. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper quiz-history-page">
            <Navbar />
            <div className="quiz-history-container">
                <h1>Quiz History</h1>

                {loading && <p className="loading-message">Loading history...</p>}
                {error && <p className="error-message">Error: {error}</p>}
                
                {!loading && !error && history.length === 0 && (
                    <p className="no-history-message">You haven't completed any quizzes yet.</p>
                )}

                {!loading && !error && history.length > 0 && (
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Subject</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((entry, index) => (
                                <tr key={entry._id || index} className={entry.isAiQuiz ? 'ai-quiz-row' : ''}> 
                                    <td data-label="Date">{formatDate(entry.date)}</td>
                                    <td data-label="Subject">
                                        {entry.subject}
                                        {entry.isAiQuiz ? 
                                            <span className="quiz-type-badge ai-quiz-badge">AI</span> : 
                                            <span className="quiz-type-badge standard-quiz-badge">Standard</span>
                                        }
                                    </td>
                                    <td data-label="Score">{entry.score} / {entry.totalQuestions}</td>
                                    <td data-label="Percentage">{entry.percentage}%</td>
                                    <td data-label="Actions">
                                        {entry.questionsAttempted && entry.questionsAttempted.length > 0 ? (
                                            <button 
                                                className="review-btn"
                                                onClick={() => navigateToReview(entry)}
                                                disabled={loading}
                                            >
                                                {loading ? 'Loading...' : 'Review'}
                                            </button>
                                        ) : (
                                            <span className="no-review-available">No details available</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                <div className="actions-footer">
                  <Link to="/quiz" className="action-link">Take a New Quiz</Link>
                </div>
            </div>
        </div>
    );
};

export default QuizHistory; 