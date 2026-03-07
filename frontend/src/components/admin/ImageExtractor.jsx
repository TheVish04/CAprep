import React, { useState, useRef, useEffect } from 'react';
import apiUtils from '../../utils/apiUtils';
import './ImageExtractor.css';

const ImageExtractor = ({ onExtract, disabled }) => {
  const [images, setImages] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null); // Stores the full size image URL for preview
  const fileInputRef = useRef(null);

  // Handle clipboard paste
  useEffect(() => {
    const handlePaste = (e) => {
      if (disabled || isExtracting) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const newImages = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          newImages.push(blob);
        }
      }

      if (newImages.length > 0) {
        processFiles(newImages);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, isExtracting]);

  // Close expanded image on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && expandedImage) {
        setExpandedImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedImage]);

  const processFiles = (files) => {
    let validFiles = Array.from(files).filter((file) => {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are supported.');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB.');
        return false;
      }
      return true;
    });

    setImages(prev => {
      const slotsRemaining = 5 - prev.length;
      if (slotsRemaining <= 0) {
        setError('Maximum of 5 images allowed.');
        return prev;
      }

      if (validFiles.length > slotsRemaining) {
        setError(`Only ${slotsRemaining} more image(s) can be added. Maximum is 5.`);
        validFiles = validFiles.slice(0, slotsRemaining);
      } else {
        setError(null);
      }

      // We read the filtered files
      validFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImages(currentImages => {
            // Check again inside async onload just in case
            if (currentImages.length >= 5) return currentImages;
            return [...currentImages, e.target.result];
          });
        };
        reader.readAsDataURL(file);
      });

      return prev; // Let the async onload handle updates
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (indexToRemove) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleExtract = async () => {
    if (images.length === 0) return;

    setIsExtracting(true);
    setError(null);

    try {
      const token = apiUtils.getAuthToken();

      const response = await fetch(`${apiUtils.getApiBaseUrl()}/ai/extract-question-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ images })
      });

      const data = await response.json();

      if (response.ok) {
        onExtract(data);
        setImages([]); // Clear after successful extraction
      } else {
        setError(data.message || data.error || 'Failed to extract content from images.');
      }
    } catch (err) {
      setError('An error occurred during extraction. Make sure server is running.');
      console.error(err);
    } finally {
      setIsExtracting(false);
    }
  };

  if (disabled) return null;

  return (
    <div className="image-extractor-container">
      <div className="extractor-header">
        <h3>Auto-Fill via Image (AI)</h3>
      </div>

      <div
        className={`dropzone ${images.length > 0 ? 'has-images' : ''}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => images.length === 0 && fileInputRef.current?.click()}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden-file-input"
          ref={fileInputRef}
          onChange={handleFileChange}
        />

        {images.length === 0 ? (
          <div className="empty-dropzone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>Drag & drop images here</p>
            <span className="divider-text">OR</span>
            <div className="paste-hint">
              <span className="kbd">Ctrl</span> + <span className="kbd">V</span> to paste from clipboard
            </div>
            <button type="button" className="browse-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              Browse Files
            </button>
          </div>
        ) : (
          <div className="image-preview-area">
            <div className="image-list">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className="image-thumbnail"
                  onClick={() => setExpandedImage(img)}
                  title="Click to view full image"
                >
                  <img src={img} alt={`Upload ${idx + 1}`} />
                  <button type="button" className="remove-img-btn" onClick={(e) => { e.stopPropagation(); removeImage(idx); }}>&times;</button>
                </div>
              ))}
              {images.length < 5 && (
                <div className="add-more-card" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  <span>+</span> Add More
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <div className="extractor-error">{error}</div>}

      {images.length > 0 && (
        <div className="extractor-actions">
          <button
            type="button"
            className={`extract-btn ${isExtracting ? 'extracting' : ''}`}
            onClick={handleExtract}
            disabled={isExtracting}
          >
            {isExtracting ? (
              <>
                <span className="spinner"></span> Extracting Info...
              </>
            ) : (
              '🪄 Extract Content'
            )}
          </button>

          <button
            type="button"
            className="clear-images-btn"
            onClick={() => setImages([])}
            disabled={isExtracting}
          >
            Clear Selected
          </button>
        </div>
      )}

      {/* Expanded Image Modal Overlay */}
      {expandedImage && (
        <div className="image-expansion-modal" onClick={() => setExpandedImage(null)}>
          <div className="expanded-image-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-expanded-btn" onClick={() => setExpandedImage(null)}>
              &times;
            </button>
            <img src={expandedImage} alt="Expanded Preview" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageExtractor;
