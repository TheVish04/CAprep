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

    const resourcesBySubject = analytics.resourcesBySubject || [];
    const resourcesBySubjectData = {
        labels: resourcesBySubject.map((r) => r._id || 'Unknown'),
        datasets: [{
            label: 'Resources',
            data: resourcesBySubject.map((r) => r.count),
            backgroundColor: resourcesBySubject.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
            borderColor: CHART_COLORS.map((c) => c.replace('0.8', '1')),
            borderWidth: 1,
        }],
    };

    const questionsBySubject = analytics.questionsBySubject || [];
    const questionsBySubjectData = {
        labels: questionsBySubject.map((q) => q._id || 'Unknown'),
        datasets: [{
            label: 'Questions',
            data: questionsBySubject.map((q) => q.count),
            backgroundColor: questionsBySubject.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
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

    const barChartOptions = {
        ...chartOptions,
        indexAxis: 'x',
        plugins: { ...chartOptions.plugins, title: { display: false } },
    };

    const usersByRole = analytics.usersByRole || {};
    const adminCount = usersByRole.admin ?? 0;
    const userCount = analytics.totalUsers != null ? analytics.totalUsers - adminCount : 0;

    return (
        <div className="admin-analytics-container">
            <h2>Platform Analytics</h2>

            <div className="analytics-summary-row">
                <div className="analytics-summary-card">
                    <span className="analytics-summary-value">{analytics.totalUsers ?? 0}</span>
                    <span className="analytics-summary-label">Total users</span>
                    <span className="analytics-summary-meta">{userCount} users, {adminCount} admins</span>
                </div>
                <div className="analytics-summary-card">
                    <span className="analytics-summary-value">{analytics.newUsersLast30Days ?? 0}</span>
                    <span className="analytics-summary-label">New users (30 days)</span>
                </div>
                <div className="analytics-summary-card">
                    <span className="analytics-summary-value">{analytics.totalQuizAttempts ?? 0}</span>
                    <span className="analytics-summary-label">Total quiz attempts</span>
                </div>
                <div className="analytics-summary-card">
                    <span className="analytics-summary-value">{analytics.totalResources ?? 0}</span>
                    <span className="analytics-summary-label">Resources</span>
                </div>
                <div className="analytics-summary-card">
                    <span className="analytics-summary-value">{analytics.totalQuestions ?? 0}</span>
                    <span className="analytics-summary-label">Questions</span>
                </div>
                <div className="analytics-summary-card">
                    <span className="analytics-summary-value">{analytics.totalDiscussions ?? 0}</span>
                    <span className="analytics-summary-label">Discussions</span>
                </div>
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

            <div className="analytics-card">
                <h3>Resources by Subject</h3>
                {resourcesBySubject.length > 0 ? (
                    <div className="admin-analytics-chart">
                        <Bar data={resourcesBySubjectData} options={barChartOptions} />
                    </div>
                ) : (
                    <p>No resource data by subject.</p>
                )}
            </div>

            <div className="analytics-card">
                <h3>Questions by Subject</h3>
                {questionsBySubject.length > 0 ? (
                    <div className="admin-analytics-chart">
                        <Bar data={questionsBySubjectData} options={barChartOptions} />
                    </div>
                ) : (
                    <p>No question data by subject.</p>
                )}
            </div>
        </div>
    );
};

export default AdminAnalytics; 