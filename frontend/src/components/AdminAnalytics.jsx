import React, { useState, useEffect } from 'react';
import axios from 'axios';
import apiUtils from '../utils/apiUtils';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './AdminAnalytics.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CHART_COLORS = [
  'rgba(3, 169, 244, 0.8)',
  'rgba(0, 188, 212, 0.8)',
  'rgba(156, 39, 176, 0.8)',
  'rgba(255, 152, 0, 0.8)',
  'rgba(76, 175, 80, 0.8)',
  'rgba(233, 30, 99, 0.8)',
  'rgba(63, 81, 181, 0.8)',
  'rgba(255, 193, 7, 0.8)',
];

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: true },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#aaa' } },
    y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#aaa' } },
  },
};

const AdminAnalytics = () => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            setError(null);
            const token = apiUtils.getAuthToken();
            if (!token) {
                setError('Authentication token not found.');
                setLoading(false);
                return;
            }

            try {
                const response = await axios.get(`${apiUtils.getApiBaseUrl()}/admin/analytics`, {
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
    }, []);

    if (loading) return <div className="loading-indicator">Loading Analytics...</div>;
    if (error) return <div className="error-message">Error: {error}</div>;
    if (!analytics) return <div className="info-message">No analytics data available.</div>;

    const quizzesData = {
        labels: (analytics.quizzesTakenPerSubject || []).map((item) => item._id || 'Unknown'),
        datasets: [{
            label: 'Quizzes taken',
            data: (analytics.quizzesTakenPerSubject || []).map((item) => item.count),
            backgroundColor: (analytics.quizzesTakenPerSubject || []).map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
            borderColor: CHART_COLORS.map((c) => c.replace('0.8', '1')),
            borderWidth: 1,
        }],
    };

    const topResources = analytics.topDownloadedResources || [];
    const resourcesData = {
        labels: topResources.map((r) => (r.title && r.title.length > 30 ? r.title.slice(0, 30) + '…' : r.title) || 'Untitled'),
        datasets: [{
            label: 'Downloads',
            data: topResources.map((r) => r.downloadCount || 0),
            backgroundColor: topResources.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
            borderColor: CHART_COLORS.map((c) => c.replace('0.8', '1')),
            borderWidth: 1,
        }],
    };

    const quizzesChartOptions = {
        ...chartOptions,
        indexAxis: 'y',
        plugins: { ...chartOptions.plugins, title: { display: true, text: 'Quizzes per subject', color: '#aaa' } },
    };

    const resourcesChartOptions = {
        ...chartOptions,
        indexAxis: 'y',
        plugins: { ...chartOptions.plugins, title: { display: true, text: 'Top resources by downloads', color: '#aaa' } },
    };

    return (
        <div className="admin-analytics-container">
            <h2>Platform Analytics</h2>

            <div className="analytics-card donations-card">
                <h3>Total Donations Received</h3>
                <p className="donation-amount">₹{analytics.totalDonationsReceived?.toFixed(2) || '0.00'}</p>
            </div>

            <div className="analytics-card quizzes-card">
                <h3>Quizzes Taken Per Subject</h3>
                {analytics.quizzesTakenPerSubject?.length > 0 ? (
                    <div className="admin-analytics-chart">
                        <Bar data={quizzesData} options={quizzesChartOptions} />
                    </div>
                ) : (
                    <p>No quiz data available.</p>
                )}
            </div>

            <div className="analytics-card resources-card">
                <h3>Top Downloaded Resources</h3>
                {topResources.length > 0 ? (
                    <div className="admin-analytics-chart">
                        <Bar data={resourcesData} options={resourcesChartOptions} />
                    </div>
                ) : (
                    <p>No resource download data available.</p>
                )}
            </div>
        </div>
    );
};

export default AdminAnalytics; 