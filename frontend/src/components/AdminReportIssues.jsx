import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import apiUtils from '../utils/apiUtils';
import { format } from 'date-fns';
import './AdminReportIssues.css';

const AdminReportIssues = () => {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const token = apiUtils.getAuthToken();
      if (!token) {
        navigate('/login');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${apiUtils.getApiBaseUrl()}/admin/contact/report-issues`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 100 }
        });
        if (response.data.success && Array.isArray(response.data.data)) {
          setList(response.data.data);
        } else {
          setList([]);
        }
      } catch (err) {
        console.error('Error fetching report issues:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load issue reports');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  if (loading) return <div className="admin-contact-loading">Loading issue reports...</div>;
  if (error) return <div className="admin-contact-error">Error: {error}</div>;

  return (
    <div className="admin-contact-container">
      <h2 className="admin-contact-title">Report Issue</h2>
      <p className="admin-contact-subtitle">Submissions from the Contact Us form.</p>
      {list.length === 0 ? (
        <p className="admin-contact-empty">No issue reports yet.</p>
      ) : (
        <div className="admin-contact-list">
          {list.map((item) => (
            <div key={item._id} className="admin-contact-card">
              <div className="admin-contact-card-header">
                <span className="admin-contact-badge admin-contact-badge-issue">Issue</span>
                <time className="admin-contact-date">{format(new Date(item.createdAt), 'MMM d, yyyy · h:mm a')}</time>
              </div>
              <h3 className="admin-contact-card-title">{item.subject || 'No subject'}</h3>
              <p className="admin-contact-description">{item.description}</p>
              <p className="admin-contact-user">{item.name} · <a href={`mailto:${item.email}`}>{item.email}</a></p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReportIssues;
