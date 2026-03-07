import React, { useState, useEffect } from 'react';
import api from '../../utils/axiosConfig';
import apiUtils from '../../utils/apiUtils';
import AnimatedModalLegacy from '../shared/AnimatedModal';
import './PointPdfModal.css';

const PointPdfModal = ({ isOpen, onClose, onSelect, filters }) => {
    const [pdfs, setPdfs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchPdfs();
        }
    }, [isOpen, filters]);

    const fetchPdfs = async () => {
        setLoading(true);
        setError(null);
        try {
            // Build query string from filters that have values
            const queryParams = new URLSearchParams();
            if (filters.examStage) queryParams.append('examStage', filters.examStage);
            if (filters.subject) queryParams.append('subject', filters.subject);
            if (filters.paperType) queryParams.append('paperType', filters.paperType);
            if (filters.year) queryParams.append('year', filters.year);
            if (filters.month) queryParams.append('month', filters.month);
            queryParams.append('fileType', 'pdf'); // Ensure we only get PDFs

            const response = await api.get(`/resources?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${apiUtils.getAuthToken()}`
                }
            });

            // Expected response might be { data: [...] }, { resources: [...] } or just an array
            const resources = Array.isArray(response.data) ? response.data :
                (response.data.data || response.data.resources || []);

            setPdfs(resources);
        } catch (err) {
            console.error('Error fetching PDFs for modal:', err);
            setError('Failed to load PDFs');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatedModalLegacy isOpen={isOpen} onClose={onClose} className="point-pdf-modal-container">
            <div className="point-pdf-modal-content">
                <div className="point-pdf-modal-header">
                    <h2>Select PDF Context</h2>
                </div>

                <div className="point-pdf-filters-info">
                    <p><strong>Looking for:</strong>
                        {filters.examStage ? ` ${filters.examStage}` : ''}
                        {filters.subject ? ` | ${filters.subject}` : ''}
                        {filters.paperType ? ` | ${filters.paperType}` : ''}
                        {filters.year ? ` | ${filters.year}` : ''}
                        {filters.month ? ` | ${filters.month}` : ''}
                    </p>
                </div>

                <div className="point-pdf-list-container">
                    {loading ? null : error ? (
                        <div className="error-message">{error}</div>
                    ) : pdfs.length === 0 ? (
                        <div className="no-pdfs-message">No PDFs found matching these details.</div>
                    ) : (
                        <ul className="point-pdf-list">
                            {pdfs.map(pdf => (
                                <li key={pdf._id} className="point-pdf-item">
                                    <div className="pdf-info">
                                        <strong>{pdf.title}</strong>
                                        <span>{pdf.examStage} - {pdf.subject} ({pdf.paperType} {pdf.month} {pdf.year})</span>
                                    </div>
                                    <button
                                        className="correct-btn"
                                        onClick={() => {
                                            onSelect(pdf._id, pdf.title);
                                            onClose();
                                        }}
                                    >
                                        Correct
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AnimatedModalLegacy>
    );
};

export default PointPdfModal;
