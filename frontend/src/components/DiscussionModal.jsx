import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import './DiscussionModal.css';

const DiscussionModal = ({ isOpen, onClose, itemType, itemId, itemTitle }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || 'https://caprep.onrender.com';
  
  // Add state variables for editing messages
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const editInputRef = useRef(null);
  
  useEffect(() => {
    if (isOpen && itemId) {
      fetchDiscussion();
      fetchCurrentUser();
    }
  }, [isOpen, itemId]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    if (replyingTo && messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [replyingTo]);
  
  useEffect(() => {
    if (editingMessage && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingMessage]);
  
  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        setCurrentUser(response.data);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  };
  
  const fetchDiscussion = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('You must be logged in to view discussions');
        setLoading(false);
        return;
      }
      
      console.log(`Fetching discussion: ${API_URL}/api/discussions/${itemType}/${itemId}`);
      const response = await axios.get(
        `${API_URL}/api/discussions/${itemType}/${itemId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      console.log('Discussion data:', response.data);
      setMessages(response.data.messages || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching discussion:', err);
      setError('Failed to load discussion. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('You must be logged in to send messages');
        return;
      }
      
      // Log more detailed information about the reply
      console.log('Sending message with details:', { 
        content: newMessage,
        replyingTo: replyingTo,
        parentMessageId: replyingTo ? replyingTo._id : null
      });
      
      const response = await axios.post(
        `${API_URL}/api/discussions/${itemType}/${itemId}/message`,
        { 
          content: newMessage,
          parentMessageId: replyingTo ? replyingTo._id : null
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      console.log('Response after sending message:', response.data);
      setMessages(response.data.messages);
      setNewMessage('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Error sending message:', err);
      setError(`Failed to send message: ${err.message || 'Unknown error'}`);
    }
  };
  
  const handleLike = async (messageId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // First get the discussion ID
      const discussionResponse = await axios.get(
        `${API_URL}/api/discussions/${itemType}/${itemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const discussionId = discussionResponse.data._id;
      
      const response = await axios.post(
        `${API_URL}/api/discussions/${discussionId}/message/${messageId}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessages(response.data.messages);
    } catch (err) {
      console.error('Error liking message:', err);
    }
  };
  
  const handleReply = (message) => {
    console.log('Replying to message:', message);
    
    // Store the entire message object as the replyingTo state
    setReplyingTo(message);
    
    // Get the name in a safe way using our helper function
    const displayName = getUserDisplayName(message.userId);
    const firstName = displayName.split(' ')[0];
    
    setNewMessage(`@${firstName} `);
    
    // Set focus to the message input field
    setTimeout(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }, 100);
  };
  
  const cancelReply = () => {
    setReplyingTo(null);
    setNewMessage('');
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Add handlers for edit and delete actions
  const handleEditMessage = async (e) => {
    e.preventDefault();
    if (!editContent.trim() || !editingMessage) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // First get the discussion ID
      const discussionResponse = await axios.get(
        `${API_URL}/api/discussions/${itemType}/${itemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const discussionId = discussionResponse.data._id;
      
      const response = await axios.put(
        `${API_URL}/api/discussions/${discussionId}/message/${editingMessage._id}`,
        { content: editContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessages(response.data.messages);
      setEditingMessage(null);
      setEditContent('');
    } catch (err) {
      console.error('Error editing message:', err);
      setError(`Failed to edit message: ${err.message || 'Unknown error'}`);
    }
  };
  
  const handleDeleteMessage = async (messageId) => {
    // Check if this message has any replies
    const hasReplies = messages.some(msg => 
      msg.parentMessageId && msg.parentMessageId === messageId
    );
    
    // Create a confirmation message that includes a warning about replies
    const confirmMessage = hasReplies 
      ? 'This message has replies. Deleting it will also delete all replies to this message. Are you sure you want to continue?'
      : 'Are you sure you want to delete this message?';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // First get the discussion ID
      const discussionResponse = await axios.get(
        `${API_URL}/api/discussions/${itemType}/${itemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const discussionId = discussionResponse.data._id;
      
      const response = await axios.delete(
        `${API_URL}/api/discussions/${discussionId}/message/${messageId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessages(response.data.messages);
    } catch (err) {
      console.error('Error deleting message:', err);
      setError(`Failed to delete message: ${err.message || 'Unknown error'}`);
    }
  };
  
  const handleStartEdit = (message) => {
    setEditingMessage(message);
    setEditContent(message.content);
  };
  
  const cancelEdit = () => {
    setEditingMessage(null);
    setEditContent('');
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Let the default behavior happen (add a new line)
        return;
      } else {
        // Prevent the default Enter behavior (new line)
        e.preventDefault();
        // Submit the form if there's content
        if (newMessage.trim()) {
          handleSendMessage(e);
        }
      }
    }
  };
  
  if (!isOpen) return null;
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };
  
  // Fix helper functions to check for admin role
  const formatMessage = (content) => {
    if (!content) return '';
    
    // Safely sanitize the content
    const sanitized = DOMPurify.sanitize(content);
    
    // Link detection (basic example)
    const withLinks = sanitized.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Handle @mentions
    const withMentions = withLinks.replace(
      /@(\w+)/g,
      '<span class="mention">@$1</span>'
    );
    
    return withMentions;
  };

  // Update the function to handle nested replies
  const organizeMessages = () => {
    if (!messages || messages.length === 0) return [];
    
    // Debug: Log all messages to check structure
    console.log('All messages:', messages);
    
    // Create a map of all messages by ID for easy lookup
    const messageMap = {};
    messages.forEach(msg => {
      messageMap[msg._id] = { ...msg, replies: [] };
    });
    
    // Identify top-level parent messages and organize replies
    const parentMessages = [];
    
    // First pass: organize messages into their correct parent
    messages.forEach(msg => {
      // If this message has a parent
      if (msg.parentMessageId) {
        console.log('Found reply:', msg._id, 'to parent:', msg.parentMessageId);
        
        // If the parent exists in our map, add this as a reply to it
        if (messageMap[msg.parentMessageId]) {
          messageMap[msg.parentMessageId].replies.push(messageMap[msg._id]);
        } else {
          // If we can't find the parent, treat it as a top-level message
          console.warn('Could not find parent message:', msg.parentMessageId);
          parentMessages.push(messageMap[msg._id]);
        }
      } else {
        // This is a top-level message
        parentMessages.push(messageMap[msg._id]);
      }
    });
    
    // Sort all the parent messages by timestamp
    const sortedParents = parentMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    console.log('Organized messages with nested replies:', sortedParents);
    return sortedParents;
  };

  // Helper function to correctly check for admin role
  const isUserAdmin = (userId) => {
    // Check multiple ways a user might be identified as admin
    if (!userId) return false;
    
    // If userId is an object with role property
    if (userId && typeof userId === 'object' && userId.role === 'admin') {
      return true;
    }
    
    // If it's a string ID, look through messages
    const userMsg = messages.find(msg => 
      msg.userId && 
      (msg.userId._id === userId || msg.userId === userId)
    );
    
    return userMsg && 
      ((userMsg.userId && userMsg.userId.role === 'admin') || 
       userMsg.userRole === 'admin');
  };

  // Helper function to get the display name from a user object
  const getUserDisplayName = (user) => {
    // Handle different possible user field structures
    if (!user) return 'Anonymous';
    if (typeof user === 'string') return user;
    if (user.fullName) return user.fullName;
    if (user.name) return user.name;
    if (user.email) return user.email.split('@')[0];
    return 'Anonymous';
  };

  // Helper function to get the first letter of name for avatar
  const getAvatarInitial = (user) => {
    const name = getUserDisplayName(user);
    return name.charAt(0) || '?';
  };
  
  // Check if current user can edit/delete a message
  const canModifyMessage = (message) => {
    if (!currentUser || !message) return false;
    return isUserAdmin(currentUser._id) || (message.userId && message.userId._id === currentUser._id);
  };

  // Render message content with edit form if needed
  const renderMessageContent = (message) => {
    if (message.deleted) {
      return <div className="deleted-message">[This message was deleted]</div>;
    }
    
    if (editingMessage && editingMessage._id === message._id) {
      return (
        <form className="edit-form" onSubmit={handleEditMessage}>
          <textarea
            className="edit-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            ref={editInputRef}
          />
          <div className="edit-actions">
            <button type="submit" className="save-button">Save</button>
            <button type="button" className="cancel-button" onClick={cancelEdit}>Cancel</button>
          </div>
        </form>
      );
    }
    
    return (
      <div className="message-content">
        {DOMPurify.sanitize(message.content)}
        {message.edited && <span className="edited-indicator">(edited)</span>}
      </div>
    );
  };

  // Render message actions including like, reply, edit, delete buttons
  const renderMessageActions = (message, isReply = false) => {
    const actionClass = isReply ? 'reply-actions' : 'message-actions';
    
    return (
      <div className={actionClass}>
        <button 
          className={`like-button ${message.likes && currentUser && message.likes.includes(currentUser._id) ? 'liked' : ''}`}
          onClick={() => handleLike(message._id)}
        >
          {message.likes?.length || 0} ♥
        </button>
        
        {!message.deleted && (
          <button className="reply-button" onClick={() => handleReply(message)}>
            Reply
          </button>
        )}
        
        {canModifyMessage(message) && !message.deleted && (
          <>
            <button 
              className="edit-button" 
              onClick={() => handleStartEdit(message)}
              disabled={editingMessage !== null}
            >
              Edit
            </button>
            <button 
              className="delete-button" 
              onClick={() => handleDeleteMessage(message._id)}
            >
              Delete
            </button>
          </>
        )}
      </div>
    );
  };
  
  const renderMessageThread = (message) => {
    return (
      <div key={message._id} className="message-thread">
        {renderMessage(message)}
        {message.replies && message.replies.length > 0 && (
          <div className="replies-container">
            {message.replies.map(renderNestedMessage)}
          </div>
        )}
      </div>
    );
  };

  // Function to recursively render nested messages
  const renderNestedMessage = (message) => {
    return (
      <div key={message._id} className="nested-reply">
        {renderMessage(message)}
        {message.replies && message.replies.length > 0 && (
          <div className="nested-replies-container">
            {message.replies.map(renderNestedMessage)}
          </div>
        )}
      </div>
    );
  };
  
  const renderMessage = (message) => {
    // Direct check for admin role
    let isAdmin = false;
    if (message.userId && typeof message.userId === 'object' && message.userId.role === 'admin') {
      isAdmin = true;
    } else if (message.userRole === 'admin') {
      isAdmin = true;
    }
    
    const isCurrentUser = currentUser && message.userId && 
      (message.userId._id === currentUser._id || message.userId === currentUser._id);
    
    const isDeleted = message.isDeleted;
    
    // Choose message class based on user role
    let messageClass = isCurrentUser ? 'user-message' : 'system-message';
    if (isAdmin) {
      messageClass = 'admin-message';
    }

    if (message._id === editingMessage?._id) {
      return (
        <div key={message._id} className={`message ${messageClass}`}>
          <div className="message-header">
            <div className="message-author">
              <div className="user-avatar">{getAvatarInitial(message.userId)}</div>
              <span>{getUserDisplayName(message.userId)}</span>
              {isAdmin && <span className="admin-badge">ADMIN</span>}
            </div>
            <div className="message-time">{formatDate(message.timestamp)}</div>
          </div>
          <form onSubmit={handleEditMessage} className="edit-form">
            <textarea
              ref={editInputRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="edit-textarea"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditMessage(e);
                }
              }}
            />
            <div className="edit-actions">
              <button type="button" onClick={cancelEdit} className="cancel-button">Cancel</button>
              <button type="submit" className="save-button">Save</button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div key={message._id} className={`message ${messageClass}`}>
        <div className="message-header">
          <div className="message-author">
            <div className="user-avatar">{getAvatarInitial(message.userId)}</div>
            <span>{getUserDisplayName(message.userId)}</span>
            {isAdmin && <span className="admin-badge">ADMIN</span>}
          </div>
          <div className="message-time">{formatDate(message.timestamp)}</div>
        </div>
        {isDeleted ? (
          <div className="deleted-message">This message has been deleted</div>
        ) : (
          <>
            <div className="message-content" 
                 dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }} />
            {message.edited && <span className="edited-indicator">(edited)</span>}
          </>
        )}
        {!isDeleted && (
          <div className="message-actions">
            {!replyingTo && (
              <button 
                className={`like-button ${message.likes?.includes(currentUser?._id) ? 'liked' : ''}`}
                onClick={() => handleLike(message._id)}
              >
                {message.likes?.length || 0} {message.likes?.length === 1 ? 'Like' : 'Likes'}
              </button>
            )}
            {!replyingTo && (
              <button className="reply-button" onClick={() => handleReply(message)}>
                Reply
              </button>
            )}
            
            {/* Edit button - users can only edit their own messages */}
            {isCurrentUser && !isDeleted && (
              <button 
                className="edit-button" 
                onClick={() => handleStartEdit(message)}
                disabled={!!replyingTo}
              >
                Edit
              </button>
            )}

            {/* Delete button - users can only delete their own messages */}
            {isCurrentUser && !isDeleted && (
              <button 
                className="delete-button" 
                onClick={() => handleDeleteMessage(message._id)}
              >
                Delete
              </button>
            )}
            
            {/* Admin can delete ANY message (but not edit others' messages) */}
            {currentUser && currentUser.role === 'admin' && !isCurrentUser && !isDeleted && (
              <button 
                className="delete-button" 
                onClick={() => handleDeleteMessage(message._id)}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="discussion-modal-overlay" onClick={onClose}>
      <div className="discussion-modal" onClick={(e) => e.stopPropagation()}>
        <div className="discussion-modal-header">
          <h2>Discussion: {itemTitle}</h2>
          <button className="discussion-close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="discussion-content">
          {error && <div className="error-message">{error}</div>}
          
          {loading ? (
            <div className="loading-placeholder">Loading discussion...</div>
          ) : messages.length === 0 ? (
            <div className="empty-discussion">
              <p>No messages yet. Be the first to start the discussion!</p>
            </div>
          ) : (
            <div className="discussion-messages">
              {organizeMessages().map(renderMessageThread)}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        <div className="message-input-container">
          {replyingTo && (
            <div className="replying-to">
              <span>
                Replying to: <strong>{getUserDisplayName(replyingTo.userId)}</strong>
                {replyingTo.userId && replyingTo.userId.role === 'admin' && 
                  <span className="admin-badge-small">ADMIN</span>
                }
              </span>
              <button onClick={cancelReply} className="cancel-reply">×</button>
            </div>
          )}
          
          {editingMessage ? (
            <form onSubmit={handleEditMessage} className="message-form">
              <textarea
                ref={editInputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Edit your message..."
                required
              />
              <div className="form-actions">
                <button type="button" onClick={cancelEdit} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="send-btn">
                  Save
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSendMessage} className="message-form">
              <textarea
                ref={messageInputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message... (Enter to send, Shift+Enter for new line)"
                required
              />
              <button type="submit" className="send-btn">
                Send
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscussionModal; 