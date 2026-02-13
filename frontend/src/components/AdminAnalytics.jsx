import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminAnalytics.css'; // We'll create this CSS file

const AdminAnalytics = () => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://caprep.onrender.com';

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Authentication token not found.');
                setLoading(false);
                return;
            }

            try {
                const response = await axios.get(`${API_BASE_URL}/api/admin/analytics`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setAnalytics(response.data);
            } catch (err) {
                console.error("Error fetching admin analytics:", err);
                setError(err.response?.data?.error || "Failed to load analytics data.");
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [API_BASE_URL]);

    if (loading) return <div className="loading-indicator">Loading Analytics...</div>;
    if (error) return <div className="error-message">Error: {error}</div>;
    if (!analytics) return <div className="info-message">No analytics data available.</div>;

    return (
        <div className="admin-analytics-container">
            <h2>Platform Analytics</h2>

            {/* Total Donations */} 
            <div className="analytics-card donations-card">
                <h3>Total Donations Received</h3>
                <p className="donation-amount">₹{analytics.totalDonationsReceived?.toFixed(2) || '0.00'}</p>
            </div>

            {/* Quizzes Taken Per Subject */} 
            <div className="analytics-card quizzes-card">
                <h3>Quizzes Taken Per Subject</h3>
                {analytics.quizzesTakenPerSubject?.length > 0 ? (
                    <ul>
                        {analytics.quizzesTakenPerSubject.map(item => (
                            <li key={item._id}><strong>{item._id}:</strong> {item.count}</li>
                        ))}
                    </ul>
                ) : (
                    <p>No quiz data available.</p>
                )}
            </div>

            {/* Top Downloaded Resources */} 
            <div className="analytics-card resources-card">
                <h3>Top Downloaded Resources</h3>
                {analytics.topDownloadedResources?.length > 0 ? (
                    <ul>
                        {analytics.topDownloadedResources.map(resource => (
                            <li key={resource._id}><strong>{resource.title}:</strong> {resource.downloadCount} downloads</li>
                        ))}
                    </ul>
                ) : (
                    <p>No resource download data available.</p>
                )}
            </div>
        </div>
    );
};

export default AdminAnalytics; 