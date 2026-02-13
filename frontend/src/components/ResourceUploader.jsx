import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import './ResourceUploader.css';

const ResourceUploader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const getActiveTab = () => {
    if (location.pathname.includes('/resources')) return 'resources';
    if (location.pathname.includes('/analytics')) return 'analytics';
    if (location.pathname.includes('/announcements')) return 'announcements';
    return 'questions';
  };
  const [activeTab, setActiveTab] = useState(getActiveTab());
  
  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [location.pathname]);
  
  // Initialize form state with empty values
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    paperType: '',
    year: '',
    month: '',
    examStage: '',
  });
  
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resources, setResources] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [filters, setFilters] = useState({
    subject: '',
    paperType: '',
    year: '',
    month: '',
    examStage: '',
    search: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const resourcesPerPage = 10;

  // Check admin authentication and fetch existing resources
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    // Check if user is admin
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        navigate('/');
        return;
      }
      const payload = JSON.parse(atob(parts[1]));
      if (payload.role !== 'admin') {
        navigate('/');
        return;
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/');
      return;
    }

    // Load cached selections if available
    const cachedSelections = localStorage.getItem('resourceUploaderSelections');
    if (cachedSelections) {
      try {
        const { 
          examStage, 
          subject, 
          paperType, 
          year, 
          month, 
          title
        } = JSON.parse(cachedSelections);
        setFilters(prev => ({
          ...prev,
          examStage: examStage || '',
          subject: subject || '',
          paperType: paperType || '',
          year: year || '',
          month: month || '',
        }));
        setFormData(prev => ({
          ...prev,
          title: title || '',
        }));
      } catch (error) {
        console.error('Error parsing cached selections:', error);
      }
    }

    // Load cached filters
    const cachedFilters = localStorage.getItem('resourceFilterSelections');
    if (cachedFilters) {
      try {
        const parsedFilters = JSON.parse(cachedFilters);
        setFilters(prev => ({
          ...prev,
          examStage: parsedFilters.examStage || '',
          subject: parsedFilters.subject || '',
          paperType: parsedFilters.paperType || '',
          year: parsedFilters.year || '',
          month: parsedFilters.month || '',
          search: parsedFilters.search || '',
        }));
      } catch (error) {
        console.error('Error parsing cached filters:', error);
      }
    }

    // Fetch resources
    fetchResources(token);
  }, [navigate]);

  const fetchResources = async (token, query = '') => {
    try {
      // Set a loading state
      console.log(`Fetching resources with query: ${query}`);
      
      // Add a cache-busting parameter to ensure we get fresh data
      const timestamp = new Date().getTime();
      const cacheParam = `cacheBust=${timestamp}`;
      
      // Use the API URL from environment variables instead of hardcoded URL
      const API_URL = import.meta.env.VITE_API_URL || 'https://caprep.onrender.com';
      const url = `${API_URL}/api/resources${query ? `?${query}&${cacheParam}` : `?${cacheParam}`}`;
      
      console.log(`Fetching from URL: ${url}`);
      
      // First try with standard headers to avoid CORS issues
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Fetched ${Array.isArray(data) ? data.length : 0} resources`);
          
          if (Array.isArray(data)) {
            setResources(data);
          } else {
            console.error('API did not return an array:', data);
            setResources([]);
          }
          return; // Exit successfully
        }
      } catch (initialError) {
        console.log('Initial fetch attempt failed, trying with cache headers:', initialError);
      }
      
      // If the first attempt failed, try with cache control headers
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Fetched ${Array.isArray(data) ? data.length : 0} resources`);
        
        if (Array.isArray(data)) {
          setResources(data);
        } else {
          console.error('API did not return an array:', data);
          setResources([]);
        }
      } else {
        console.error('Failed to fetch resources:', response.statusText);
        // Try to get more details from the error response
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
    }
  };

  // Cache form selections
  const cacheFormSelections = () => {
    const selectionsToCache = {
      examStage: formData.examStage,
      subject: formData.subject,
      paperType: formData.paperType,
      year: formData.year,
      month: formData.month,
      title: formData.title
    };
    localStorage.setItem('resourceUploaderSelections', JSON.stringify(selectionsToCache));
  };

  // Clear cached selections
  const clearCachedSelections = () => {
    localStorage.removeItem('resourceUploaderSelections');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    validateField(name, value);
    
    // Cache selections when any field is changed
    setTimeout(() => cacheFormSelections(), 100);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setErrors((prev) => ({ ...prev, file: 'Only PDF files are allowed' }));
        setFile(null);
      } else if (selectedFile.size > 20 * 1024 * 1024) { // 20MB limit
        setErrors((prev) => ({ ...prev, file: 'File size must be less than 20MB' }));
        setFile(null);
      } else {
        setErrors((prev) => ({ ...prev, file: '' }));
        setFile(selectedFile);
        
        // Set title based on filename (removing .pdf extension)
        const fileName = selectedFile.name.replace(/\.pdf$/i, '');
        setFormData(prev => ({
          ...prev,
          title: fileName
        }));
      }
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const validateField = (name, value) => {
    let error = '';
    
    switch (name) {
      case 'title':
        if (!value || value.trim() === '') {
          error = 'Title is required';
        } else if (value.length < 5) {
          error = 'Title must be at least 5 characters';
        } else if (value.length > 100) {
          error = 'Title must be less than 100 characters';
        }
        break;
        
      case 'subject':
        if (!value || value === '') {
          error = 'Subject is required';
        }
        break;
        
      case 'paperType':
        if (!value || value === '') {
          error = 'Paper Type is required';
        }
        break;
        
      case 'year':
        if (!value || value === '') {
          error = 'Year is required';
        }
        break;
        
      case 'month':
        if (!value || value === '') {
          error = 'Month is required';
        }
        break;
        
      case 'examStage':
        if (!value || value === '') {
          error = 'Exam Stage is required';
        }
        break;
        
      case 'file':
        if (!value && !isEditMode) {
          error = 'File is required';
        } else if (value && value.type !== 'application/pdf') {
          error = 'Only PDF files are allowed';
        } else if (value && value.size > 20 * 1024 * 1024) { // 20MB limit
          error = 'File size must be less than 20MB';
        }
        break;
        
      default:
        break;
    }
    
    // Update error state for the specific field
    setErrors(prev => ({ ...prev, [name]: error }));
    
    return error === '';
  };

  const validateForm = () => {
    const newErrors = {};
    const requiredFields = ['title', 'subject', 'paperType', 'year', 'month', 'examStage'];
    
    requiredFields.forEach((field) => {
      validateField(field, formData[field]);
      if (errors[field]) newErrors[field] = errors[field];
    });
    
    // For new resource, validate file
    if (!isEditMode && !file) {
      newErrors.file = 'PDF file is required';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    const validationErrors = validateForm();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      
      if (isEditMode) {
        // Update existing resource (PUT request)
        const response = await fetch(`https://caprep.onrender.com/api/resources/${editingResourceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });
        
        if (response.ok) {
          // Cache form selections before resetting
          cacheFormSelections();
          
          // Fetch fresh resources after update
          await fetchResources(token);
          resetForm();
          setIsEditMode(false);
          setEditingResourceId(null);
          alert('Resource updated successfully!');
        } else {
          const errorData = await response.json();
          alert(`Failed to update resource: ${errorData.error || 'Unknown error'}`);
        }
      } else {
        // Create new resource (POST request with FormData for file upload)
        const formDataObj = new FormData();
        formDataObj.append('title', formData.title);
        formDataObj.append('subject', formData.subject);
        formDataObj.append('paperType', formData.paperType);
        formDataObj.append('year', formData.year);
        formDataObj.append('month', formData.month);
        formDataObj.append('examStage', formData.examStage);
        formDataObj.append('file', file);
        
        // Cache form selections before submission
        cacheFormSelections();
        
        const response = await fetch('https://caprep.onrender.com/api/resources', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formDataObj,
        });
        
        if (response.ok) {
          // Clear server cache via admin endpoint
          try {
            await fetch('https://caprep.onrender.com/api/admin/clear-cache', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            console.log('Cache cleared after resource upload');
          } catch (cacheError) {
            console.error('Failed to clear cache:', cacheError);
          }
          
          // Fetch fresh resources after adding new one
          resetForm();
          await fetchResources(token);
          alert('Resource uploaded successfully!');
        } else {
          const errorData = await response.json();
          alert(`Failed to upload resource: ${errorData.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error handling form submission:', error);
      alert(`Error: ${error.message || 'Something went wrong'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (resource) => {
    setFormData({
      title: resource.title || '',
      subject: resource.subject || '',
      paperType: resource.paperType || '',
      year: resource.year || '',
      month: resource.month || '',
      examStage: resource.examStage || '',
    });
    setIsEditMode(true);
    setEditingResourceId(resource._id);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch(`https://caprep.onrender.com/api/resources/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        fetchResources(token);
        alert('Resource deleted successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to delete: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting resource:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const resetForm = () => {
    // Save current form data before clearing it
    const currentForm = {
      examStage: formData.examStage,
      subject: formData.subject,
      paperType: formData.paperType,
      year: formData.year, 
      month: formData.month
    };
    
    // Clear the form
    setFormData({
      title: '',
      subject: '',
      paperType: '',
      year: '',
      month: '',
      examStage: '',
    });
    setFile(null);
    setErrors({});
    setIsEditMode(false);
    setEditingResourceId(null);
    
    // Restore the cached values from the current form
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        examStage: currentForm.examStage,
        subject: currentForm.subject,
        paperType: currentForm.paperType,
        year: currentForm.year,
        month: currentForm.month,
      }));
    }, 100);
  };

  // Add method to completely reset form and clear cache
  const resetFormAndCache = () => {
    resetForm();
    clearCachedSelections();
    
    // Re-initialize form with empty values
    setFormData({
      title: '',
      subject: '',
      paperType: '',
      year: '',
      month: '',
      examStage: '',
    });
    
    setFile(null);
    setErrors({});
    
    // Clear input file element
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Filter resources based on the selected filters
  const filteredResources = resources;
  
  // Pagination
  const indexOfLastResource = currentPage * resourcesPerPage;
  const indexOfFirstResource = indexOfLastResource - resourcesPerPage;
  const currentResources = filteredResources.slice(indexOfFirstResource, indexOfLastResource);
  const totalPages = Math.ceil(filteredResources.length / resourcesPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const applyFilters = () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    let queryParams = new URLSearchParams();
    
    // Add each non-empty filter to query params
    if (filters.subject) queryParams.append('subject', filters.subject);
    if (filters.paperType) queryParams.append('paperType', filters.paperType);
    if (filters.year) queryParams.append('year', filters.year);
    if (filters.month) queryParams.append('month', filters.month);
    if (filters.examStage) queryParams.append('examStage', filters.examStage);
    if (filters.search) queryParams.append('search', filters.search);

    const query = queryParams.toString();
    console.log(`Applying filters: ${query}`);
    
    // Reset to first page when applying filters
    setCurrentPage(1);
    
    // Fetch with the filters
    fetchResources(token, query);
    
    // Cache the filter selections including the search term
    const selectionsToCache = {
      examStage: filters.examStage || '',
      subject: filters.subject || '',
      paperType: filters.paperType || '',
      year: filters.year || '',
      month: filters.month || '',
      search: filters.search || ''
    };
    localStorage.setItem('resourceFilterSelections', JSON.stringify(selectionsToCache));
  };

  // Add a new function to handle viewing resources with proper filename
  const handleViewResource = (resource) => {
    // Open resource in new tab
    window.open(resource.fileUrl, '_blank');
    
    // Trigger cache update for this resource
    setTimeout(() => {
      const token = localStorage.getItem('token');
      if (token) {
        fetchResources(token);
      }
    }, 1000);
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="resource-uploader-section">
        <div className="resource-uploader-container">
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
          </div>
          
          <h2>{isEditMode ? 'Edit Resource' : 'Upload PDF Resource'}</h2>
          
          <form onSubmit={handleSubmit} className="resource-form">
            <div className="form-group">
              <label htmlFor="title">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={errors.title ? 'error' : ''}
                readOnly={!isEditMode && file !== null}
                title={!isEditMode && file !== null ? "Title is automatically set from PDF filename" : ""}
              />
              {errors.title && <div className="error-message">{errors.title}</div>}
            </div>
            
            <div className="form-group">
              <label htmlFor="examStage">Exam Stage *</label>
              <select
                id="examStage"
                name="examStage"
                value={formData.examStage}
                onChange={(e) => {
                  // Reset subject when exam stage changes
                  handleChange(e);
                  setFormData(prev => ({ 
                    ...prev, 
                    examStage: e.target.value,
                    subject: '',
                  }));
                }}
                className={errors.examStage ? 'error' : ''}
              >
                <option value="">Select Exam Stage</option>
                <option value="Foundation">Foundation</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Final">Final</option>
              </select>
              {errors.examStage && <div className="error-message">{errors.examStage}</div>}
            </div>
            
            <div className="form-group">
              <label htmlFor="subject">Subject *</label>
              <select
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className={errors.subject ? 'error' : ''}
              >
                <option value="">Select Subject</option>
                {formData.examStage === 'Foundation' ? (
                  // Foundation subjects
                  <>
                    <option value="Accounting">Accounting</option>
                    <option value="Business Laws">Business Laws</option>
                    <option value="Quantitative Aptitude">Quantitative Aptitude</option>
                    <option value="Business Economics">Business Economics</option>
                  </>
                ) : formData.examStage === 'Intermediate' ? (
                  // Intermediate subjects
                  <>
                    <option value="Advanced Accounting">Advanced Accounting</option>
                    <option value="Corporate Laws">Corporate Laws</option>
                    <option value="Cost and Management Accounting">Cost and Management Accounting</option>
                    <option value="Taxation">Taxation</option>
                    <option value="Auditing and Code of Ethics">Auditing and Code of Ethics</option>
                    <option value="Financial and Strategic Management">Financial and Strategic Management</option>
                  </>
                ) : formData.examStage === 'Final' ? (
                  // Final subjects
                  <>
                    <option value="Financial Reporting">Financial Reporting</option>
                    <option value="Advanced Financial Management">Advanced Financial Management</option>
                    <option value="Advanced Auditing">Advanced Auditing</option>
                    <option value="Direct and International Tax Laws">Direct and International Tax Laws</option>
                    <option value="Indirect Tax Laws">Indirect Tax Laws</option>
                    <option value="Integrated Business Solutions">Integrated Business Solutions</option>
                  </>
                ) : (
                  <option value="">Please select an exam stage first</option>
                )}
              </select>
              {errors.subject && <div className="error-message">{errors.subject}</div>}
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="paperType">Paper Type *</label>
                <select
                  id="paperType"
                  name="paperType"
                  value={formData.paperType}
                  onChange={handleChange}
                  className={errors.paperType ? 'error' : ''}
                >
                  <option value="">Select Paper Type</option>
                  <option value="MTP">MTP</option>
                  <option value="RTP">RTP</option>
                  <option value="PYQS">PYQS</option>
                  <option value="Model TP">Model TP</option>
                </select>
                {errors.paperType && <div className="error-message">{errors.paperType}</div>}
              </div>
              
              <div className="form-group">
                <label htmlFor="year">Year *</label>
                <select
                  id="year"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  className={errors.year ? 'error' : ''}
                >
                  <option value="">Select Year</option>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year.toString()}>
                      {year}
                    </option>
                  ))}
                </select>
                {errors.year && <div className="error-message">{errors.year}</div>}
              </div>
              
              <div className="form-group">
                <label htmlFor="month">Month *</label>
                <select
                  id="month"
                  name="month"
                  value={formData.month}
                  onChange={handleChange}
                  className={errors.month ? 'error' : ''}
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
                {errors.month && <div className="error-message">{errors.month}</div>}
              </div>
            </div>
            
            {!isEditMode && (
              <div className="form-group">
                <label htmlFor="file">PDF File *</label>
                <input
                  type="file"
                  id="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className={errors.file ? 'error' : ''}
                />
                {errors.file && <div className="error-message">{errors.file}</div>}
              </div>
            )}
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : isEditMode ? 'Update Resource' : 'Upload Resource'}
              </button>
              
              {isEditMode && (
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
              
              <button 
                type="button" 
                className="reset-btn"
                onClick={resetFormAndCache}
              >
                Reset All
              </button>
            </div>
          </form>
          
          <div className="resources-management">
            <h3>Manage Resources</h3>
            
            <div className="filter-toolbar">
              <div className="filter-row">
                <select
                  name="examStage"
                  value={filters.examStage}
                  onChange={handleFilterChange}
                  className="filter-select"
                >
                  <option value="">All Exam Stages</option>
                  <option value="Foundation">Foundation</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Final">Final</option>
                </select>
                
                <select
                  name="subject"
                  value={filters.subject}
                  onChange={handleFilterChange}
                  className="filter-select"
                >
                  <option value="">All Subjects</option>
                  {filters.examStage === 'Foundation' ? (
                    // Foundation subjects
                    <>
                      <option value="Accounting">Accounting</option>
                      <option value="Business Laws">Business Laws</option>
                      <option value="Quantitative Aptitude">Quantitative Aptitude</option>
                      <option value="Business Economics">Business Economics</option>
                    </>
                  ) : filters.examStage === 'Intermediate' ? (
                    // Intermediate subjects
                    <>
                      <option value="Advanced Accounting">Advanced Accounting</option>
                      <option value="Corporate Laws">Corporate Laws</option>
                      <option value="Cost and Management Accounting">Cost and Management Accounting</option>
                      <option value="Taxation">Taxation</option>
                      <option value="Auditing and Code of Ethics">Auditing and Code of Ethics</option>
                      <option value="Financial and Strategic Management">Financial and Strategic Management</option>
                    </>
                  ) : filters.examStage === 'Final' ? (
                    // Final subjects
                    <>
                      <option value="Financial Reporting">Financial Reporting</option>
                      <option value="Advanced Financial Management">Advanced Financial Management</option>
                      <option value="Advanced Auditing">Advanced Auditing</option>
                      <option value="Direct and International Tax Laws">Direct and International Tax Laws</option>
                      <option value="Indirect Tax Laws">Indirect Tax Laws</option>
                      <option value="Integrated Business Solutions">Integrated Business Solutions</option>
                    </>
                  ) : (
                    // Show all subjects when All Exam Stages is selected
                    <>
                      <option value="Accounting">Accounting</option>
                      <option value="Business Laws">Business Laws</option>
                      <option value="Quantitative Aptitude">Quantitative Aptitude</option>
                      <option value="Business Economics">Business Economics</option>
                      <option value="Advanced Accounting">Advanced Accounting</option>
                      <option value="Corporate Laws">Corporate Laws</option>
                      <option value="Cost and Management Accounting">Cost and Management Accounting</option>
                      <option value="Taxation">Taxation</option>
                      <option value="Auditing and Code of Ethics">Auditing and Code of Ethics</option>
                      <option value="Financial and Strategic Management">Financial and Strategic Management</option>
                      <option value="Financial Reporting">Financial Reporting</option>
                      <option value="Advanced Financial Management">Advanced Financial Management</option>
                      <option value="Advanced Auditing">Advanced Auditing</option>
                      <option value="Direct and International Tax Laws">Direct and International Tax Laws</option>
                      <option value="Indirect Tax Laws">Indirect Tax Laws</option>
                      <option value="Integrated Business Solutions">Integrated Business Solutions</option>
                    </>
                  )}
                </select>
                
                <select
                  name="paperType"
                  value={filters.paperType}
                  onChange={handleFilterChange}
                  className="filter-select"
                >
                  <option value="">All Paper Types</option>
                  <option value="MTP">MTP</option>
                  <option value="RTP">RTP</option>
                  <option value="PYQS">PYQS</option>
                  <option value="Model TP">Model TP</option>
                </select>
              </div>
              
              <div className="filter-row">
                <select
                  name="year"
                  value={filters.year}
                  onChange={handleFilterChange}
                  className="filter-select"
                >
                  <option value="">All Years</option>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year.toString()}>
                      {year}
                    </option>
                  ))}
                </select>
                
                <select
                  name="month"
                  value={filters.month}
                  onChange={handleFilterChange}
                  className="filter-select"
                >
                  <option value="">All Months</option>
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
                
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search resources..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  />
                </div>
              </div>
              
              <button 
                className="filter-btn"
                onClick={applyFilters}
              >
                Apply Filters
              </button>
              
              <button 
                className="reset-filter-btn"
                onClick={() => {
                  // Reset all filters to empty values
                  setFilters({
                    subject: '',
                    paperType: '',
                    year: '',
                    month: '',
                    examStage: '',
                    search: '',
                  });
                  
                  // Reset to first page
                  setCurrentPage(1);
                  
                  // Clear cached filters
                  localStorage.removeItem('resourceFilterSelections');
                  
                  // Fetch all resources without any query parameters
                  const token = localStorage.getItem('token');
                  if (token) {
                    fetchResources(token, '');
                  }
                }}
              >
                Reset Filters
              </button>
            </div>
            
            <div className="resources-table-container">
              {resources.length === 0 ? (
                <p className="no-resources">No resources found.</p>
              ) : (
                <>
                  <table className="resources-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Subject</th>
                        <th>Type</th>
                        <th>Year/Month</th>
                        <th>Downloads</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentResources.map((resource) => (
                        <tr key={resource._id}>
                          <td>{resource.title}</td>
                          <td>{resource.subject}</td>
                          <td>{resource.paperType}</td>
                          <td>{resource.month} {resource.year}</td>
                          <td>{resource.downloadCount}</td>
                          <td className="action-buttons">
                            <button
                              className="edit-btn"
                              onClick={() => handleEdit(resource)}
                            >
                              Edit
                            </button>
                            <button
                              className="delete-btn"
                              onClick={() => handleDelete(resource._id)}
                            >
                              Delete
                            </button>
                            <button
                              className="view-btn"
                              onClick={() => handleViewResource(resource)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="pagination">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                        <button
                          key={pageNumber}
                          onClick={() => paginate(pageNumber)}
                          className={currentPage === pageNumber ? 'active' : ''}
                        >
                          {pageNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceUploader;