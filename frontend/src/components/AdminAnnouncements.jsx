import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import './AdminAnnouncements.css';
import { format } from 'date-fns';

const AdminAnnouncements = () => {
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
  
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'general',
    priority: 'medium',
    targetSubjects: [],
    validUntil: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Fetch announcements on component mount
  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // Fetch all announcements
  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Use the admin endpoint instead, which should return all announcements
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/announcements`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          showAll: true, // Include all announcements, even expired ones
          limit: 100 // Get a larger number of announcements
        }
      });

      if (response.data.success) {
        setAnnouncements(response.data.data);
      } else {
        setError('Failed to fetch announcements');
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError(err.message || 'Failed to fetch announcements');
    }
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle subject selection changes
  const handleSubjectChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      if (checked) {
        return {
          ...prev,
          targetSubjects: [...prev.targetSubjects, value]
        };
      } else {
        return {
          ...prev,
          targetSubjects: prev.targetSubjects.filter(subject => subject !== value)
        };
      }
    });
  };

  // Validate form data
  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.content.trim()) errors.content = 'Content is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      let response;
      
      if (editingId) {
        // Update existing announcement
        response = await axios.put(
          `${import.meta.env.VITE_API_URL}/api/admin/announcements/${editingId}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // Create new announcement
        response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/admin/announcements`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      if (response.data.success) {
        resetForm();
        fetchAnnouncements();
        setShowForm(false);
        alert(editingId ? 'Announcement updated successfully!' : 'Announcement created successfully!');
      } else {
        setError('Failed to save announcement');
      }
    } catch (err) {
      console.error('Error saving announcement:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save announcement');
    }
  };

  // Reset form data
  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      type: 'general',
      priority: 'medium',
      targetSubjects: [],
      validUntil: ''
    });
    setEditingId(null);
    setFormErrors({});
  };

  // Edit announcement
  const handleEdit = (announcement) => {
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      targetSubjects: announcement.targetSubjects || [],
      validUntil: announcement.validUntil ? format(new Date(announcement.validUntil), 'yyyy-MM-dd') : ''
    });
    setEditingId(announcement._id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete announcement
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      const response = await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/admin/announcements/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        fetchAnnouncements();
        alert('Announcement deleted successfully!');
      } else {
        setError('Failed to delete announcement');
      }
    } catch (err) {
      console.error('Error deleting announcement:', err);
      setError(err.message || 'Failed to delete announcement');
    }
  };

  // Subject options for checkboxes
  const subjectOptions = {
    Foundation: [
      'Accounting',
      'Business Laws',
      'Quantitative Aptitude',
      'Business Economics'
    ],
    Intermediate: [
      'Advanced Accounting',
      'Corporate Laws',
      'Cost and Management Accounting',
      'Taxation',
      'Auditing and Code of Ethics',
      'Financial and Strategic Management'
    ],
    Final: [
      'Financial Reporting',
      'Advanced Financial Management',
      'Advanced Auditing',
      'Direct and International Tax Laws',
      'Indirect Tax Laws',
      'Integrated Business Solutions'
    ]
  };

  return (
    <div className="admin-announcements-container">
      <Navbar />
      <div className="admin-announcements-wrapper">
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
        
        {error && <div className="error-message">{error}</div>}
        
        <h2 className="section-title">Manage Announcements</h2>
        
        <div className="announcement-actions">
          <button 
            className="toggle-form-btn"
            onClick={() => {
              if (showForm && editingId) {
                resetForm();
              }
              setShowForm(!showForm);
            }}
          >
            {showForm ? 'Cancel' : 'Add New Announcement'}
          </button>
        </div>
        
        {showForm && (
          <div className="announcement-form-container">
            <h2>{editingId ? 'Edit Announcement' : 'Create New Announcement'}</h2>
            <form onSubmit={handleSubmit} className="announcement-form">
              <div className="form-group">
                <label htmlFor="title">Title*</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className={formErrors.title ? 'input-error' : ''}
                />
                {formErrors.title && <span className="error-text">{formErrors.title}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="content">Content*</label>
                <textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  rows={5}
                  className={formErrors.content ? 'input-error' : ''}
                  placeholder="Announcement details, PDF description, deadlines, etc."
                />
                {formErrors.content && <span className="error-text">{formErrors.content}</span>}
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="type">Type</label>
                  <select id="type" name="type" value={formData.type} onChange={handleChange}>
                    <option value="general">General</option>
                    <option value="system">System</option>
                    <option value="syllabus">Syllabus</option>
                    <option value="exam">Exam</option>
                    <option value="feature">Feature</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="priority">Priority</label>
                  <select id="priority" name="priority" value={formData.priority} onChange={handleChange}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="validUntil">Valid Until</label>
                  <input
                    type="date"
                    id="validUntil"
                    name="validUntil"
                    value={formData.validUntil}
                    onChange={handleChange}
                  />
                </div>
              </div>
              
              <div className="form-group subject-checkboxes">
                <label>Target Subjects (Optional)</label>
                
                <div className="subject-sections">
                  {Object.entries(subjectOptions).map(([examStage, subjects]) => (
                    <div key={examStage} className="subject-section">
                      <h4>{examStage}</h4>
                      {subjects.map(subject => (
                        <div key={subject} className="subject-checkbox">
                          <input
                            type="checkbox"
                            id={subject.replace(/\s+/g, '')}
                            value={subject}
                            checked={formData.targetSubjects.includes(subject)}
                            onChange={handleSubjectChange}
                          />
                          <label htmlFor={subject.replace(/\s+/g, '')}>{subject}</label>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="form-buttons">
                <button type="submit" className="submit-btn">
                  {editingId ? 'Update Announcement' : 'Create Announcement'}
                </button>
                <button type="button" className="reset-btn" onClick={resetForm}>
                  Reset
                </button>
              </div>
            </form>
          </div>
        )}
        
        <div className="announcements-list">
          <h2>Current Announcements</h2>
          
          {announcements.length === 0 ? (
            <div className="no-announcements">
              <p>No announcements found.</p>
            </div>
          ) : (
            <div className="announcements-table-container">
              <table className="announcements-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Date Created</th>
                    <th>Valid Until</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map(announcement => (
                    <tr key={announcement._id} className={`priority-${announcement.priority}`}>
                      <td>{announcement.title}</td>
                      <td>
                        <span className={`announcement-type ${announcement.type}`}>
                          {announcement.type}
                        </span>
                      </td>
                      <td>{announcement.priority}</td>
                      <td>{format(new Date(announcement.createdAt), 'dd MMM yyyy')}</td>
                      <td>
                        {announcement.validUntil ? 
                          format(new Date(announcement.validUntil), 'dd MMM yyyy') : 
                          'Not set'}
                      </td>
                      <td className="actions">
                        <button onClick={() => handleEdit(announcement)} className="edit-btn">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(announcement._id)} className="delete-btn">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnnouncements; 