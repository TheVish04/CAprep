import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import PreviewPanel from '../shared/PreviewPanel';
import Navbar from '../layout/Navbar';
import DOMPurify from 'dompurify';
import AdminAnalytics from './AdminAnalytics';
import AdminFeatureRequests from './AdminFeatureRequests';
import AdminReportIssues from './AdminReportIssues';
import ResourceUploader from './ResourceUploader';
import authUtils from '../../utils/authUtils';
import apiUtils from '../../utils/apiUtils';
import ImageExtractor from './ImageExtractor';
import PointPdfModal from './PointPdfModal';
import AdminContactUs from './AdminContactUs';
import './AdminPanel.css';

const AdminPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    if (location.pathname.includes('/resources')) return 'resources';
    if (location.pathname.includes('/analytics')) return 'analytics';
    if (location.pathname.includes('/announcements')) return 'announcements';
    if (location.pathname.includes('/feature-requests')) return 'feature-requests';
    if (location.pathname.includes('/report-issues')) return 'report-issues';
    if (location.pathname.includes('/contact-us')) return 'contact-us';
    return 'questions';
  };
  const [activeTab, setActiveTab] = useState(getActiveTab());

  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [location.pathname]);

  // Add question type state
  const [questionType, setQuestionType] = useState('objective-subjective');

  const [formData, setFormData] = useState({
    subject: '',
    paperType: '',
    year: '',
    month: '',
    examStage: '',
    questionNumber: '',
    questionText: '',
    answerText: '',
    subQuestions: [],
    pdfResourceId: null,
  });

  const [showPointPdfModal, setShowPointPdfModal] = useState(false);
  const [selectedPdfName, setSelectedPdfName] = useState('');

  const [errors, setErrors] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [storedQuestions, setStoredQuestions] = useState([]);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [filters, setFilters] = useState({
    subject: '',
    year: '',
    questionNumber: '',
    paperType: '',
    month: '',
    examStage: '',
    search: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmittedId, setLastSubmittedId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 10;

  const fetchQuestions = useCallback(async (token, query = '') => {
    try {
      const response = await fetch(`${apiUtils.getApiBaseUrl()}/questions${query ? `?${query}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      const data = await response.json();

      if (response.ok) {
        const list = Array.isArray(data) ? data : (data?.data ?? [data]);
        const questions = Array.isArray(list) ? list : [list];
        const sortedQuestions = [...questions].sort((a, b) =>
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        setStoredQuestions(sortedQuestions);
      } else {
        console.error('Failed to fetch questions:', response.statusText, data);

        // Check for token expiration and handle automatic logout
        if (authUtils.handleTokenExpiration(data, navigate)) {
          return; // Return early if token expired and user is being redirected
        }

        if (data.error) {
          alert(`Failed to fetch questions: ${data.error}`);
        } else {
          alert(`Failed to fetch questions: ${response.statusText} - ${data.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error fetching questions:', error);

      // Check if it's a token expiration error and handle automatic logout
      if (!authUtils.handleTokenExpiration(error, navigate)) {
        alert(`Error fetching questions: ${error.message}`);
      }
    }
  }, [navigate]);

  const applyFilters = useCallback((token) => {
    const query = new URLSearchParams(filters).toString();
    fetchQuestions(token, query);
  }, [filters, fetchQuestions]);

  useEffect(() => {
    const token = apiUtils.getAuthToken();
    if (!token) {
      navigate('/');
    } else {
      applyFilters(token);
    }
  }, [navigate, applyFilters]);

  const handleImageExtract = (extractedData) => {
    if (extractedData.questionType) {
      setQuestionType(extractedData.questionType);
    }

    setFormData(prev => ({
      ...prev,
      questionNumber: extractedData.questionNumber || prev.questionNumber || '',
      questionText: extractedData.questionText || '',
      answerText: extractedData.answerText || '',
      subQuestions: Array.isArray(extractedData.subQuestions) ? extractedData.subQuestions.map(sq => ({
        subQuestionText: sq.subQuestionText || '',
        subOptions: Array.isArray(sq.subOptions) && sq.subOptions.length > 0 ? sq.subOptions.map(opt => ({
          optionText: opt.optionText || '',
          isCorrect: !!opt.isCorrect
        })) : [{ optionText: '', isCorrect: false }]
      })) : [],
    }));

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.questionText;
      delete newErrors.answerText;
      // also clear subQuestion errors manually if present
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith('subQuestion') || key.startsWith('subOption')) {
          delete newErrors[key];
        }
      });
      return newErrors;
    });

    // Auto-resize all textareas after hydration
    setTimeout(() => {
      const textareas = document.querySelectorAll('.admin-form textarea');
      textareas.forEach(textarea => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 600)}px`;
      });
    }, 100);

    alert('Content successfully extracted and filled into the form below!');
  };

  const autoResizeTextarea = (e) => {
    const textarea = e.target;
    textarea.style.height = 'auto'; // Reset to auto to get actual scrollHeight
    textarea.style.height = `${Math.min(textarea.scrollHeight, 600)}px`; // Max height of 600px
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    // If examStage is changing, reset subject as it depends on examStage
    if (name === 'examStage') {
      setFilters(prev => ({
        ...prev,
        [name]: value,
        subject: ''
      }));
    } else {
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  const addSubQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      subQuestions: [
        ...prev.subQuestions,
        { subQuestionNumber: '', subQuestionText: '', subOptions: [{ optionText: '', isCorrect: false }] },
      ],
    }));
  };

  const removeSubQuestion = (index) => {
    console.log('Removing subquestion at index:', index);
    setFormData((prev) => {
      const updatedSubQuestions = prev.subQuestions.filter((_, i) => i !== index);
      console.log('Updated subQuestions:', updatedSubQuestions);
      return { ...prev, subQuestions: updatedSubQuestions };
    });
  };

  const handleSubQuestionChange = (index, field, value) => {
    const updated = [...formData.subQuestions];
    updated[index][field] = value;
    setFormData((prev) => ({ ...prev, subQuestions: updated }));
    validateSubQuestion(index, field, value);
  };

  const addSubOption = (subIndex) => {
    const updated = [...formData.subQuestions];
    updated[subIndex].subOptions.push({ optionText: '', isCorrect: false });
    setFormData((prev) => ({ ...prev, subQuestions: updated }));
  };

  const removeSubOption = (subIndex, optionIndex) => {
    const updated = [...formData.subQuestions];
    if (updated[subIndex].subOptions.length > 1) {
      updated[subIndex].subOptions = updated[subIndex].subOptions.filter((_, i) => i !== optionIndex);
    }
    setFormData((prev) => ({ ...prev, subQuestions: updated }));
  };

  const handleSubOptionChange = (subIndex, optionIndex, e) => {
    const { name, value } = e.target;
    const updated = [...formData.subQuestions];
    updated[subIndex].subOptions[optionIndex][name] = value;
    setFormData((prev) => ({ ...prev, subQuestions: updated }));
    validateSubOption(subIndex, optionIndex, name, value);
  };

  const markCorrectSubOption = (subIndex, optionIndex) => {
    const updated = [...formData.subQuestions];
    updated[subIndex].subOptions = updated[subIndex].subOptions.map((opt, i) => ({
      ...opt,
      isCorrect: i === optionIndex,
    }));
    setFormData((prev) => ({ ...prev, subQuestions: updated }));

    setTimeout(() => {
      const subOptionsElements = document.querySelectorAll(`.sub-question-${subIndex} .option-item`);
      subOptionsElements.forEach((el) => {
        el.classList.remove('correct-option');
      });

      const selectedOption = document.querySelector(`.option-item-${subIndex}-${optionIndex}`);
      if (selectedOption) {
        selectedOption.classList.add('correct-option');
      }
    }, 10);
  };

  const handlePreview = () => {
    const validation = validateForm();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      alert('Please fix the validation errors before previewing.');
    } else {
      window.scrollPreviewPosition = window.scrollY;
      setPreviewVisible(true);
    }
  };

  const closePreview = () => {
    setPreviewVisible(false);
    setTimeout(() => {
      if (window.scrollPreviewPosition !== undefined) {
        window.scrollTo(0, window.scrollPreviewPosition);
        window.scrollPreviewPosition = undefined;
      }
    }, 10);
  };

  const validateField = (name, value) => {
    let error = '';
    switch (name) {
      case 'subject':
        if (!value || value === '') error = 'Subject is required';
        break;
      case 'paperType':
        if (!value || value === '') error = 'Paper Type is required';
        break;
      case 'year':
        if (!value || value === '') error = 'Year is required';
        break;
      case 'month':
        if (!value || value === '') error = 'Month is required';
        break;
      case 'examStage':
        if (!value || value === '' || value === 'Select Exam Stage') error = 'Exam Stage is required';
        break;
      case 'questionNumber':
        if (!value) error = 'Question Number is required';
        break;
      case 'questionText':
        // Question text is now optional
        break;
      default:
        break;
    }
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const validateSubQuestion = (index, field, value) => {
    let error = field === 'subQuestionText' && !value.trim() ? `Sub-question ${index + 1} text is required` : '';
    setErrors((prev) => ({ ...prev, [`subQuestion_${index}`]: error }));
  };

  const validateSubOption = (subIndex, optionIndex, name, value) => {
    let error = name === 'optionText' && !value.trim() ? `Sub-question ${subIndex + 1}, Option ${optionIndex + 1} text is required` : '';
    setErrors((prev) => ({ ...prev, [`subOption_${subIndex}_${optionIndex}`]: error }));
  };

  const validateForm = () => {
    let tempErrors = {};

    // Core field validation for all question types
    if (!formData.subject || formData.subject === '') tempErrors.subject = 'Subject is required';
    if (!formData.paperType || formData.paperType === '') tempErrors.paperType = 'Paper Type is required';
    if (!formData.year || formData.year === '') tempErrors.year = 'Year is required';
    if (!formData.month || formData.month === '') tempErrors.month = 'Month is required';
    if (!formData.examStage || formData.examStage === '' || formData.examStage === 'Select Exam Stage') {
      tempErrors.examStage = 'Exam Stage is required';
    }

    // Question type-specific validation
    switch (questionType) {
      case 'objective-subjective':
        // Both subjective and objective elements, flexible validation
        break;

      case 'subjective-only':
        // Must have answer text for subjective-only
        if (!formData.answerText || formData.answerText.trim() === '') {
          tempErrors.answerText = 'Answer text is required for subjective questions';
        }
        break;

      case 'objective-only':
        // Must have at least one sub-question with options for objective-only
        if (formData.subQuestions.length === 0) {
          tempErrors.subQuestions = 'At least one question with options is required';
        } else {
          // Validate first sub-question has content and options
          const firstSubQ = formData.subQuestions[0];
          if (!firstSubQ.subOptions || firstSubQ.subOptions.length < 2) {
            tempErrors[`subQuestion_0`] = 'At least 2 options are required';
          } else {
            // Check if any option is marked as correct
            const hasCorrectOption = firstSubQ.subOptions.some(opt => opt.isCorrect);
            if (!hasCorrectOption) {
              tempErrors[`subQuestion_0`] = 'One option must be marked as correct';
            }

            // Check if all options have text
            firstSubQ.subOptions.forEach((opt, optIndex) => {
              if (!opt.optionText || opt.optionText.trim() === '') {
                tempErrors[`subOption_0_${optIndex}`] = `Option ${optIndex + 1} text is required`;
              }
            });
          }
        }
        break;

      default:
        break;
    }

    // Set errors state
    setErrors(tempErrors);
    return tempErrors;
  };

  const cleanSubQuestions = (subQuestions) => {
    return subQuestions.map((subQ, index) => ({
      subQuestionText: subQ.subQuestionText || '',
      subOptions: subQ.subOptions.map((opt) => ({
        optionText: opt.optionText || '',
        isCorrect: !!opt.isCorrect,
      })),
    }));
  };

  // Add useEffect to load cached form selections on component mount
  useEffect(() => {
    const cachedSelections = localStorage.getItem('adminFormSelections');
    if (cachedSelections) {
      try {
        const parsedSelections = JSON.parse(cachedSelections);
        setFormData(prevData => ({
          ...prevData,
          subject: parsedSelections.subject || '',
          paperType: parsedSelections.paperType || '',
          year: parsedSelections.year || '',
          month: parsedSelections.month || '',
          examStage: parsedSelections.examStage || '',
          pdfResourceId: parsedSelections.pdfResourceId || null,
        }));
        if (parsedSelections.selectedPdfName) {
          setSelectedPdfName(parsedSelections.selectedPdfName);
        }
      } catch (e) {
        console.error('Error parsing cached form selections:', e);
      }
    }
  }, []);

  // Add function to cache current selections
  const cacheFormSelections = (customSelections = null) => {
    const selectionsToCache = customSelections || {
      subject: formData.subject,
      paperType: formData.paperType,
      year: formData.year,
      month: formData.month,
      examStage: formData.examStage,
      pdfResourceId: formData.pdfResourceId,
      selectedPdfName,
    };
    localStorage.setItem('adminFormSelections', JSON.stringify(selectionsToCache));
  };

  // Modify resetForm to preserve cached selections
  const resetForm = () => {
    // Reset form data
    setFormData({
      subject: '',
      paperType: '',
      year: '',
      month: '',
      examStage: '',
      questionNumber: '',
      questionText: '',
      answerText: '',
      subQuestions: [],
      pdfResourceId: null,
    });
    setErrors({});
    setSelectedPdfName('');
    setQuestionType('objective-subjective'); // Reset question type

    // Try to load cached selections
    const cachedSelections = localStorage.getItem('adminFormSelections');
    if (cachedSelections) {
      try {
        const { subject, paperType, year, month, examStage, pdfResourceId, selectedPdfName: cachedPdfName } = JSON.parse(cachedSelections);
        setFormData(prev => ({
          ...prev,
          subject: subject || '',
          paperType: paperType || '',
          year: year || '',
          month: month || '',
          examStage: examStage || '',
          pdfResourceId: pdfResourceId || null,
        }));
        if (cachedPdfName) {
          setSelectedPdfName(cachedPdfName);
        }
      } catch (error) {
        console.error('Error loading cached form selections:', error);
      }
    }
  };

  // Add function to clear cached selections
  const clearCachedSelections = () => {
    localStorage.removeItem('adminFormSelections');
    setFormData({
      subject: '',
      paperType: '',
      year: '',
      month: '',
      examStage: '',
      questionNumber: '',
      questionText: '',
      answerText: '',
      subQuestions: [],
      pdfResourceId: null,
    });
    setErrors({});
    setSelectedPdfName('');
    alert('Form cache cleared');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = apiUtils.getAuthToken();
    if (!token) {
      navigate('/login');
      return;
    }

    const validation = validateForm();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      console.log('Form validation errors:', validation);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare question data based on question type
      let questionData = { ...formData };

      // For subjective-only, ensure subQuestions is empty
      if (questionType === 'subjective-only') {
        questionData.subQuestions = [];
      }

      // For objective-only, ensure answer text is empty if not needed
      if (questionType === 'objective-only') {
        questionData.answerText = '';
      }

      // Clean and prepare data
      const cleanedSubQuestions = cleanSubQuestions(questionData.subQuestions);
      questionData.subQuestions = cleanedSubQuestions;

      const response = await fetch(`${apiUtils.getApiBaseUrl()}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(questionData),
      });

      const data = await response.json();

      if (response.ok) {
        setLastSubmittedId(data._id || data.id);
        alert('Question saved successfully!');

        // Cache selections for convenience
        cacheFormSelections();

        // Reset form but keep common fields like exam stage, subject
        const { examStage, subject, paperType, year, month } = formData;
        resetForm();
        setFormData(prev => ({
          ...prev,
          examStage,
          subject,
          paperType,
          year,
          month
        }));

        // Refresh the questions list
        fetchQuestions(token);
      } else {
        console.error('Error submitting question:', data);

        // Check for token expiration and handle automatic logout
        if (authUtils.handleTokenExpiration(data, navigate)) {
          return; // Return early if token expired and user is being redirected
        }

        if (data.message) {
          alert(`Failed to submit: ${data.message}`);
        } else {
          alert('Failed to submit question. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error submitting question:', error);

      // Check if it's a token expiration error and handle automatic logout
      if (!authUtils.handleTokenExpiration(error, navigate)) {
        alert(`Error submitting question: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const token = apiUtils.getAuthToken();
    if (!token) {
      navigate('/login');
      return;
    }

    const validation = validateForm();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      console.log('Form validation errors on update:', validation);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare question data based on question type
      let questionData = { ...formData };

      // For subjective-only, ensure subQuestions is empty
      if (questionType === 'subjective-only') {
        questionData.subQuestions = [];
      }

      // For objective-only, ensure answer text is empty if not needed
      if (questionType === 'objective-only') {
        questionData.answerText = '';
      }

      // Clean and prepare data
      const cleanedSubQuestions = cleanSubQuestions(questionData.subQuestions);
      questionData.subQuestions = cleanedSubQuestions;

      const response = await fetch(`${apiUtils.getApiBaseUrl()}/questions/${editingQuestionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(questionData),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Question updated successfully!');

        // Cache selections for convenience
        cacheFormSelections();

        // Reset form and exit edit mode
        resetForm();
        setEditingQuestionId(null);

        // Refresh the questions list
        fetchQuestions(token);
      } else {
        console.error('Error updating question:', data);

        // Check for token expiration and handle automatic logout
        if (authUtils.handleTokenExpiration(data, navigate)) {
          return; // Return early if token expired and user is being redirected
        }

        if (data.message) {
          alert(`Failed to update: ${data.message}`);
        } else {
          alert('Failed to update question. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error updating question:', error);

      // Check if it's a token expiration error and handle automatic logout
      if (!authUtils.handleTokenExpiration(error, navigate)) {
        alert(`Error updating question: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (question) => {
    setEditingQuestionId(question._id);

    // Determine question type based on content
    let detectedQuestionType = 'objective-subjective'; // Default

    if (question.answerText && (!question.subQuestions || question.subQuestions.length === 0)) {
      // If it has answer text but no sub-questions, it's subjective-only
      detectedQuestionType = 'subjective-only';
    } else if ((!question.answerText || question.answerText.trim() === '') &&
      question.subQuestions && question.subQuestions.length > 0) {
      // If it has sub-questions but no answer text, it's objective-only
      detectedQuestionType = 'objective-only';
    }

    setQuestionType(detectedQuestionType);

    // Ensure subQuestions is always an array
    const subQuestions = question.subQuestions || [];

    // Map subQuestions to ensure each has subOptions as an array
    const formattedSubQuestions = subQuestions.map(sq => ({
      ...sq,
      subOptions: sq.subOptions || []
    }));

    // Set form data (exclude pageNumber)
    setFormData({
      subject: question.subject || '',
      paperType: question.paperType || '',
      year: question.year || '',
      month: question.month || '',
      examStage: question.examStage || '',
      questionNumber: question.questionNumber || '',
      questionText: question.questionText || '',
      answerText: question.answerText || '',
      subQuestions: formattedSubQuestions,
      pdfResourceId: question.pdfResourceId || null,
    });
    setSelectedPdfName(question.pdfResourceId ? 'Linked PDF' : '');

    // Scroll to the top of the form
    window.scrollTo(0, 0);
  };

  const handleDelete = async (id) => {
    const token = apiUtils.getAuthToken();
    if (!token) {
      navigate('/login');
      return;
    }

    const confirmDelete = window.confirm('Are you sure you want to delete this question?');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`${apiUtils.getApiBaseUrl()}/questions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('Question deleted successfully');
        const currentQuery = new URLSearchParams(filters).toString();
        fetchQuestions(token, currentQuery);
      } else {
        const data = await response.json();
        console.error('Error deleting question:', data);

        // Check for token expiration and handle automatic logout
        if (authUtils.handleTokenExpiration(data, navigate)) {
          return; // Return early if token expired and user is being redirected
        }

        alert(`Failed to delete question: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting question:', error);

      // Check if it's a token expiration error and handle automatic logout
      if (!authUtils.handleTokenExpiration(error, navigate)) {
        alert(`Error deleting question: ${error.message}`);
      }
    }
  };

  const visibleErrors = Object.values(errors).filter((error) => error);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'resources':
        return <ResourceUploader />;
      case 'analytics':
        return <AdminAnalytics />;
      case 'feature-requests':
        return <AdminFeatureRequests />;
      case 'report-issues':
        return <AdminReportIssues />;
      case 'contact-us':
        return <AdminContactUs />;
      case 'announcements':
        return null; // This tab is handled by a separate route
      case 'questions':
      default:
        return (
          <>
            {visibleErrors.length > 0 && (
              <div className="error">
                <h3 className="error-title">Validation Errors:</h3>
                <ul className="error-list">
                  {visibleErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {previewVisible && (
              <PreviewPanel
                data={formData}
                onClose={closePreview}
                questionType={questionType}
              />
            )}

            <div className="form-mode-indicator">
              <h2>{editingQuestionId ? 'Edit Question' : 'Add New Question'}</h2>
              {editingQuestionId && (
                <p className="edit-mode-note">You are currently editing question ID: {editingQuestionId}</p>
              )}
              <button
                type="button"
                onClick={clearCachedSelections}
                className="clear-cache-btn"
                title="Clear cached form selections and start fresh"
              >
                Clear Form Cache
              </button>
            </div>

            <ImageExtractor
              onExtract={handleImageExtract}
              disabled={!!editingQuestionId}
            />

            <PointPdfModal
              isOpen={showPointPdfModal}
              onClose={() => setShowPointPdfModal(false)}
              onSelect={(pdfId, pdfName) => {
                setFormData(prev => ({ ...prev, pdfResourceId: pdfId }));
                setSelectedPdfName(pdfName);

                // Immediately cache when selected
                const cached = localStorage.getItem('adminFormSelections');
                let parsed = {};
                if (cached) {
                  try {
                    parsed = JSON.parse(cached);
                  } catch (e) { }
                }
                parsed.pdfResourceId = pdfId;
                parsed.selectedPdfName = pdfName;
                cacheFormSelections(parsed);
              }}
              filters={{
                examStage: formData.examStage,
                subject: formData.subject,
                paperType: formData.paperType,
                year: formData.year,
                month: formData.month
              }}
            />

            <form
              onSubmit={editingQuestionId ? handleUpdate : handleSubmit}
              className={`admin-form ${editingQuestionId ? 'edit-mode' : ''}`}
            >
              <div className="form-section">
                <h2>General Details</h2>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Exam Stage:</label>
                    <select
                      name="examStage"
                      value={formData.examStage}
                      onChange={(e) => {
                        const newExamStage = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          examStage: newExamStage,
                          subject: '',
                        }));
                        validateField('examStage', newExamStage);
                      }}
                      className="form-input"
                      required
                    >
                      <option value="">Select Exam Stage</option>
                      <option value="Foundation">Foundation</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Final">Final</option>
                    </select>
                    {errors.examStage && <p className="error-message">{errors.examStage}</p>}
                  </div>
                  <div className="form-group">
                    <label>Subject:</label>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={(e) => {
                        handleChange(e);
                        autoResizeTextarea(e);
                      }}
                      onInput={autoResizeTextarea}
                      className="form-input"
                      required
                    >
                      <option value="">Select Subject</option>
                      {formData.examStage === 'Foundation' ? (
                        <>
                          <option value="1 - Accounting">1 - Accounting</option>
                          <option value="2 - Business Laws">2 - Business Laws</option>
                          <option value="3 - Quantitative Aptitude">3 - Quantitative Aptitude</option>
                          <option value="4 - Business Economics">4 - Business Economics</option>
                        </>
                      ) : formData.examStage === 'Intermediate' ? (
                        <>
                          <optgroup label="Group I">
                            <option value="1 - Advanced Accounting">1 - Advanced Accounting</option>
                            <option value="2 - Corporate and Other Laws">2 - Corporate and Other Laws</option>
                            <option value="3 - Taxation">3 - Taxation</option>
                          </optgroup>
                          <optgroup label="Group II">
                            <option value="4 - Cost and Management Accounting">4 - Cost and Management Accounting</option>
                            <option value="5 - Auditing and Ethics">5 - Auditing and Ethics</option>
                            <option value="6 - Financial Management and Strategic Management">6 - Financial Management and Strategic Management</option>
                          </optgroup>
                        </>
                      ) : formData.examStage === 'Final' ? (
                        <>
                          <optgroup label="Group I">
                            <option value="1 - Financial Reporting">1 - Financial Reporting</option>
                            <option value="2 - Advanced Financial Management">2 - Advanced Financial Management</option>
                            <option value="3 - Advanced Auditing, Assurance and Professional Ethics">3 - Advanced Auditing, Assurance and Professional Ethics</option>
                          </optgroup>
                          <optgroup label="Group II">
                            <option value="4 - Direct Tax Laws and International Taxation">4 - Direct Tax Laws and International Taxation</option>
                            <option value="5 - Indirect Tax Laws">5 - Indirect Tax Laws</option>
                            <option value="6 - Integrated Business Solutions (Multidisciplinary Case Study)">6 - Integrated Business Solutions (Multidisciplinary Case Study)</option>
                          </optgroup>
                        </>
                      ) : (
                        <option value="" disabled>Please select an Exam Stage first</option>
                      )}
                    </select>
                    {errors.subject && <p className="error-message">{errors.subject}</p>}
                  </div>
                  <div className="form-group">
                    <label>Paper Type:</label>
                    <select
                      name="paperType"
                      value={formData.paperType}
                      onChange={(e) => {
                        handleChange(e);
                        autoResizeTextarea(e);
                      }}
                      onInput={autoResizeTextarea}
                      className="form-input"
                      required
                    >
                      <option value="">Select Paper Type</option>
                      <option value="MTP">MTP</option>
                      <option value="RTP">RTP</option>
                      <option value="PYQS">PYQS</option>
                      <option value="Model TP">Model TP</option>
                    </select>
                    {errors.paperType && <p className="error-message">{errors.paperType}</p>}
                  </div>
                  <div className="form-group">
                    <label>Year:</label>
                    <select
                      name="year"
                      value={formData.year}
                      onChange={(e) => {
                        handleChange(e);
                        autoResizeTextarea(e);
                      }}
                      onInput={autoResizeTextarea}
                      className="form-input"
                      required
                    >
                      <option value="">Select Year</option>
                      <option value="2025">2025</option>
                      <option value="2024">2024</option>
                      <option value="2023">2023</option>
                    </select>
                    {errors.year && <p className="error-message">{errors.year}</p>}
                  </div>
                  <div className="form-group">
                    <label>Month:</label>
                    <select
                      name="month"
                      value={formData.month}
                      onChange={(e) => {
                        handleChange(e);
                        autoResizeTextarea(e);
                      }}
                      onInput={autoResizeTextarea}
                      className="form-input"
                      required
                    >
                      <option value="">Select Month</option>
                      <option value="January">January</option>
                      <option value="February">February</option>
                      <option value="March">March</option>
                      <option value="April">April</option>
                      <option value="May">May</option>
                      <option value="June">June</option>
                      <option value="July">July</option>
                      <option value="August">August</option>
                      <option value="September">September</option>
                      <option value="October">October</option>
                      <option value="November">November</option>
                      <option value="December">December</option>
                    </select>
                    {errors.month && <p className="error-message">{errors.month}</p>}
                  </div>

                  <div className="form-group point-pdf-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label>PDF Association:</label>
                    <button
                      type="button"
                      onClick={() => setShowPointPdfModal(true)}
                      className="point-pdf-btn"
                      style={{
                        padding: '10px 15px',
                        backgroundColor: 'var(--primary-color)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        width: 'fit-content'
                      }}
                    >
                      Point PDF
                    </button>
                    {selectedPdfName && (
                      <div className="selected-pdf-badge" style={{ fontSize: '0.85rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        {selectedPdfName}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, pdfResourceId: null }));
                            setSelectedPdfName('');

                            // Immediately remove from cache
                            const cached = localStorage.getItem('adminFormSelections');
                            if (cached) {
                              try {
                                const parsed = JSON.parse(cached);
                                parsed.pdfResourceId = null;
                                parsed.selectedPdfName = '';
                                localStorage.setItem('adminFormSelections', JSON.stringify(parsed));
                              } catch (e) { }
                            }
                          }}
                          style={{
                            background: 'none', border: 'none', color: 'var(--error-color)', cursor: 'pointer', marginLeft: 'auto', padding: '0 5px'
                          }}
                          title="Remove PDF association"
                        >
                          &times;
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              <div className="form-section">
                <h2>Question Type</h2>
                <div className="question-type-selector">
                  <div
                    className={`question-type-option ${questionType === 'objective-subjective' ? 'active' : ''}`}
                    onClick={() => setQuestionType('objective-subjective')}
                  >
                    <h3>Question + Answer + Options</h3>
                    <p>For questions with both objective and subjective components</p>
                  </div>

                  <div
                    className={`question-type-option ${questionType === 'subjective-only' ? 'active' : ''}`}
                    onClick={() => setQuestionType('subjective-only')}
                  >
                    <h3>Question + Answer Only</h3>
                    <p>For subjective questions without options</p>
                  </div>

                  <div
                    className={`question-type-option ${questionType === 'objective-only' ? 'active' : ''}`}
                    onClick={() => setQuestionType('objective-only')}
                  >
                    <h3>MCQs Only</h3>
                    <p>For objective multiple-choice questions</p>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h2>Question Details</h2>
                <div className="form-group">
                  <label>Question Number:</label>
                  <input
                    type="text"
                    name="questionNumber"
                    value={formData.questionNumber}
                    onChange={(e) => {
                      handleChange(e);
                      autoResizeTextarea(e);
                    }}
                    onInput={autoResizeTextarea}
                    className="form-input"
                    required
                  />
                  {errors.questionNumber && <p className="error-message">{errors.questionNumber}</p>}
                </div>
                <div className="form-group">
                  <label>Question Text:</label>
                  <textarea
                    name="questionText"
                    value={formData.questionText}
                    onChange={(e) => {
                      handleChange(e);
                      autoResizeTextarea(e);
                    }}
                    onInput={autoResizeTextarea}
                    rows={6}
                    className="form-input"
                    placeholder="Optional: Paste HTML code for tables, or type your question text..."
                  />
                  {errors.questionText && <p className="error-message">{errors.questionText}</p>}
                  <p className="field-info">(Optional) You can leave this empty if you're only using sub-questions</p>
                </div>
              </div>

              {/* Conditionally show Answer section based on question type */}
              {(questionType === 'objective-subjective' || questionType === 'subjective-only') && (
                <div className="form-section">
                  <h2>Answer (for Subjective Questions)</h2>
                  <div className="form-group">
                    <label>Answer Text:</label>
                    <textarea
                      name="answerText"
                      value={formData.answerText}
                      onChange={(e) => {
                        handleChange(e);
                        autoResizeTextarea(e);
                      }}
                      onInput={autoResizeTextarea}
                      rows={6}
                      className="form-input"
                      placeholder="Paste HTML code for tables, or just type your answer..."
                      required={questionType === 'subjective-only'}
                    />
                  </div>
                </div>
              )}

              {/* Conditionally show Sub-Questions section based on question type */}
              {(questionType === 'objective-subjective' || questionType === 'objective-only') && (
                <div className="form-section">
                  <h2>{questionType === 'objective-only' ? 'Options' : 'Sub-Questions with Options'}</h2>
                  {formData.subQuestions.map((subQ, subIndex) => (
                    <div key={subIndex} className={`sub-question-section sub-question-${subIndex}`}>
                      <div className="form-group">
                        <label>{questionType === 'objective-only' ? 'Question' : `Sub Question ${subIndex + 1}`}:</label>
                        <textarea
                          id={`subQuestionText-${subIndex}`}
                          name="subQuestionText"
                          value={subQ.subQuestionText}
                          onChange={(e) => {
                            handleSubQuestionChange(subIndex, 'subQuestionText', e.target.value);
                            autoResizeTextarea(e);
                          }}
                          onInput={autoResizeTextarea}
                          className="form-input html-content"
                          rows={questionType === 'objective-only' ? 4 : 6}
                          placeholder={
                            questionType === 'objective-only'
                              ? "Enter question text with HTML formatting (tables, lists, etc.)"
                              : "Paste HTML code for tables, lists, or format your sub-question with HTML tags..."
                          }
                          required={questionType === 'objective-only' && subIndex === 0}
                        />
                        {/* Add HTML preview for sub-question */}
                        <div
                          className="rich-text-preview"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(subQ.subQuestionText || '')
                          }}
                        />
                        <span className="html-help-tooltip" title="You can use HTML tags for formatting">
                          HTML enabled
                        </span>
                        {errors[`subQuestion_${subIndex}`] &&
                          <p className="error-message">{errors[`subQuestion_${subIndex}`]}</p>
                        }
                      </div>
                      <div className="sub-options-section">
                        {subQ.subOptions.map((subOpt, optIndex) => (
                          <div
                            key={optIndex}
                            className={`form-group option-item option-item-${subIndex}-${optIndex} ${subOpt.isCorrect ? 'correct-option' : ''
                              }`}
                          >
                            <label>Option {String.fromCharCode(65 + optIndex)}:</label>
                            <textarea
                              name="optionText"
                              value={subOpt.optionText}
                              onChange={(e) => handleSubOptionChange(subIndex, optIndex, e)}
                              className="form-input html-content"
                              rows={3}
                              placeholder="Enter option text with HTML formatting (tables, lists, etc.)"
                              required
                            />
                            {/* Add HTML preview for option */}
                            <div
                              className="rich-text-preview option-preview"
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(subOpt.optionText || '')
                              }}
                            />
                            <span className="html-help-tooltip" title="You can use HTML tags for formatting">
                              HTML enabled
                            </span>
                            {errors[`subOption_${subIndex}_${optIndex}`] &&
                              <p className="error-message">
                                {errors[`subOption_${subIndex}_${optIndex}`]}
                              </p>
                            }
                            <div className="option-controls">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  name="isCorrect"
                                  checked={subOpt.isCorrect}
                                  onChange={(e) =>
                                    handleSubOptionChange(subIndex, optIndex, {
                                      target: { name: 'isCorrect', value: e.target.checked }
                                    })
                                  }
                                />
                                Correct Answer
                              </label>
                              {subQ.subOptions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeSubOption(subIndex, optIndex)}
                                  className="remove-btn"
                                >
                                  Remove Option
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addSubOption(subIndex)}
                          className="add-btn"
                        >
                          Add Option
                        </button>
                      </div>
                      <div className="sub-question-actions">
                        <button
                          type="button"
                          onClick={() => removeSubQuestion(subIndex)}
                          className="remove-btn"
                        >
                          Remove {questionType === 'objective-only' ? 'This Question' : 'This Sub Question'}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addSubQuestion} className="add-btn">
                    {questionType === 'objective-only' ? 'Add Another Question' : 'Add Sub Question'}
                  </button>
                </div>
              )}

              <div className="form-actions-container">
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={handlePreview}
                    className="preview-btn"
                    disabled={isSubmitting}
                  >
                    Preview
                  </button>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : editingQuestionId ? 'Update' : 'Submit'}
                  </button>
                  {editingQuestionId && (
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setEditingQuestionId(null);
                      }}
                      className="cancel-btn"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div className="filter-section">
              <h2>Filter Questions</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Exam Stage:</label>
                  <select
                    name="examStage"
                    value={filters.examStage}
                    onChange={handleFilterChange}
                    className="form-input"
                  >
                    <option value="">All</option>
                    <option value="Foundation">Foundation</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Final">Final</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Subject:</label>
                  <select
                    name="subject"
                    value={filters.subject}
                    onChange={handleFilterChange}
                    className="form-input"
                  >
                    <option value="">All Subjects</option>
                    {filters.examStage === 'Foundation' ? (
                      <>
                        <option value="1 - Accounting">1 - Accounting</option>
                        <option value="2 - Business Laws">2 - Business Laws</option>
                        <option value="3 - Quantitative Aptitude">3 - Quantitative Aptitude</option>
                        <option value="4 - Business Economics">4 - Business Economics</option>
                      </>
                    ) : filters.examStage === 'Intermediate' ? (
                      <>
                        <option value="1 - Advanced Accounting">1 - Advanced Accounting</option>
                        <option value="2 - Corporate and Other Laws">2 - Corporate and Other Laws</option>
                        <option value="3 - Taxation">3 - Taxation</option>
                        <option value="4 - Cost and Management Accounting">4 - Cost and Management Accounting</option>
                        <option value="5 - Auditing and Ethics">5 - Auditing and Ethics</option>
                        <option value="6 - Financial Management and Strategic Management">6 - Financial Management and Strategic Management</option>
                      </>
                    ) : filters.examStage === 'Final' ? (
                      <>
                        <option value="1 - Financial Reporting">1 - Financial Reporting</option>
                        <option value="2 - Advanced Financial Management">2 - Advanced Financial Management</option>
                        <option value="3 - Advanced Auditing, Assurance and Professional Ethics">3 - Advanced Auditing, Assurance and Professional Ethics</option>
                        <option value="4 - Direct Tax Laws and International Taxation">4 - Direct Tax Laws and International Taxation</option>
                        <option value="5 - Indirect Tax Laws">5 - Indirect Tax Laws</option>
                        <option value="6 - Integrated Business Solutions (Multidisciplinary Case Study)">6 - Integrated Business Solutions (Multidisciplinary Case Study)</option>
                      </>
                    ) : (
                      <option value="">Select an Exam Stage first</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label>Paper Type:</label>
                  <select
                    name="paperType"
                    value={filters.paperType}
                    onChange={handleFilterChange}
                    className="form-input"
                  >
                    <option value="">All</option>
                    <option value="MTP">MTP</option>
                    <option value="RTP">RTP</option>
                    <option value="PYQS">PYQS</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Year:</label>
                  <select
                    name="year"
                    value={filters.year}
                    onChange={handleFilterChange}
                    className="form-input"
                  >
                    <option value="">All Years</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Month:</label>
                  <select
                    name="month"
                    value={filters.month}
                    onChange={handleFilterChange}
                    className="form-input"
                  >
                    <option value="">All</option>
                    <option value="January">January</option>
                    <option value="February">February</option>
                    <option value="March">March</option>
                    <option value="April">April</option>
                    <option value="May">May</option>
                    <option value="June">June</option>
                    <option value="July">July</option>
                    <option value="August">August</option>
                    <option value="September">September</option>
                    <option value="October">October</option>
                    <option value="November">November</option>
                    <option value="December">December</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Question Number:</label>
                  <input
                    type="text"
                    name="questionNumber"
                    value={filters.questionNumber}
                    onChange={handleFilterChange}
                    className="form-input"
                    placeholder="e.g. 1, 2a, etc."
                  />
                </div>
                <div className="form-group">
                  <label>Search Keyword:</label>
                  <input
                    type="text"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    className="form-input"
                    placeholder="Enter keywords"
                  />
                </div>
              </div>
              <button onClick={() => applyFilters(apiUtils.getAuthToken())} className="apply-filter-btn">
                Apply Filters
              </button>
            </div>

            <div className="stored-questions-section">
              <h2>Stored Questions</h2>
              {storedQuestions.length === 0 ? (
                <p className="no-questions">No questions stored yet.</p>
              ) : (
                <div className="questions-list">
                  {storedQuestions.map((question) => (
                    <div key={question._id} className="question-card">
                      <p><strong>Subject:</strong> {question.subject || 'N/A'}</p>
                      <p><strong>Paper Type:</strong> {question.paperType || 'N/A'}</p>
                      <p><strong>Year:</strong> {question.year || 'N/A'}</p>
                      <p><strong>Month:</strong> {question.month || 'N/A'}</p>
                      <p><strong>Exam Stage:</strong> {question.examStage || 'N/A'}</p>
                      <p><strong>Question Number:</strong> {question.questionNumber || 'N/A'}</p>
                      <h3>Question Text:</h3>
                      <div
                        className="question-text"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(question.questionText || 'N/A') }}
                      />
                      {question.answerText && (
                        <>
                          <h3>Answer Text:</h3>
                          <div
                            className="question-text"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(question.answerText || 'N/A') }}
                          />
                        </>
                      )}
                      {question.subQuestions && question.subQuestions.length > 0 && (
                        <div>
                          <h3>Sub-Questions:</h3>
                          {question.subQuestions.map((subQ, subIdx) => (
                            <div key={subIdx} className="sub-question">
                              <p><strong>Sub Question Number:</strong> {subQ.subQuestionNumber || 'N/A'}</p>
                              <p><strong>Sub Question Text:</strong> {subQ.subQuestionText || 'N/A'}</p>
                              {subQ.subOptions && subQ.subOptions.length > 0 && (
                                <ul className="sub-options">
                                  {subQ.subOptions.map((subOpt, optIdx) => (
                                    <li key={optIdx}>
                                      {subOpt.optionText || 'N/A'}{' '}
                                      {subOpt.isCorrect && <span className="correct-answer">(Correct)</span>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="question-actions">
                        <button
                          onClick={() => handleEdit(question)}
                          className="edit-btn"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(question._id)}
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        );
    }
  };

  return (
    <div className="admin-page">
      <Navbar />
      <div className="admin-container">
        <div className="admin-tabs">
          <button
            className={activeTab === 'questions' ? 'active-tab' : ''}
            onClick={() => {
              setActiveTab('questions');
              navigate('/admin');
            }}
          >
            Manage Questions
          </button>
          <button
            className={activeTab === 'resources' ? 'active-tab' : ''}
            onClick={() => {
              setActiveTab('resources');
              navigate('/admin/resources');
            }}
          >
            Manage Resources
          </button>
          <button
            className={activeTab === 'announcements' ? 'active-tab' : ''}
            onClick={() => {
              setActiveTab('announcements');
              navigate('/admin/announcements');
            }}
          >
            Manage Announcements
          </button>
          <button
            className={activeTab === 'analytics' ? 'active-tab' : ''}
            onClick={() => {
              setActiveTab('analytics');
              navigate('/admin/analytics');
            }}
          >
            Analytics
          </button>
          <button
            className={activeTab === 'feature-requests' ? 'active-tab' : ''}
            onClick={() => {
              setActiveTab('feature-requests');
              navigate('/admin/feature-requests');
            }}
          >
            Request Feature
          </button>
          <button
            className={activeTab === 'report-issues' ? 'active-tab' : ''}
            onClick={() => {
              setActiveTab('report-issues');
              navigate('/admin/report-issues');
            }}
          >
            Report Issue
          </button>
          <button
            className={activeTab === 'contact-us' ? 'active-tab' : ''}
            onClick={() => {
              setActiveTab('contact-us');
              navigate('/admin/contact-us');
            }}
          >
            Contact Us
          </button>
        </div>
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default AdminPanel;