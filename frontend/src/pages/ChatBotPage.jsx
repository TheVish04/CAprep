import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import axios from 'axios';
import './ChatBotPage.css';

const ChatBotPage = () => {
  const [messages, setMessages] = useState([
    { 
      type: 'bot', 
      content: 'Hello! I\'m your CA Assistant. Ask me any questions about Chartered Accountancy. My knowledge is based on the existing CA curriculum. However, remember that accounting standards and legal provisions are subject to change, so always refer to the official ICAI publications for the most up-to-date information. I am a tool to assist your learning, not a replacement for thorough study and engagement with official resources.\n\nPlease mention your Exam Stage and Subject with every question for best results.\nCA Assistant can make mistakes. Check important info. Please dont rely on answers blindly. Check the official ICAI publications for the most up-to-date information.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const messageEndRef = useRef(null);
  const [selectedExamStage, setSelectedExamStage] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('ca_assistant_chat_history');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        setChatHistory(parsedHistory);
      } catch (e) {
        console.error('Error parsing chat history:', e);
      }
    }
  }, []);
  
  // Auto scroll to bottom of messages
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end',
        inline: 'nearest'
      });
    }
  }, [messages]);

  // Function to remove markdown formatting from AI responses
  const sanitizeResponse = (text) => {
    if (!text) return '';
    
    // Remove markdown italics/bold asterisks (replace with the actual text)
    let sanitized = text.replace(/\*\*\*(.*?)\*\*\*/g, '$1'); // Bold + italic (three asterisks)
    sanitized = sanitized.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold (two asterisks)
    sanitized = sanitized.replace(/\*(.*?)\*/g, '$1'); // Italic (one asterisk)
    
    // Remove other markdown if needed
    sanitized = sanitized.replace(/__(.*?)__/g, '$1'); // Underline
    sanitized = sanitized.replace(/_(.*?)_/g, '$1'); // Alternate italic
    
    return sanitized;
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const createNewChat = () => {
    setMessages([{ 
      type: 'bot', 
      content: 'Hello! I\'m your CA Assistant. Ask me any questions about Chartered Accountancy. My knowledge is based on the existing CA curriculum. However, remember that accounting standards and legal provisions are subject to change, so always refer to the official ICAI publications for the most up-to-date information. I am a tool to assist your learning, not a replacement for thorough study and engagement with official resources.\n\nPlease mention your Exam Stage and Subject with every question for best results.\nCA Assistant can make mistakes. Check important info. Please dont rely on answers blindly. Check the official ICAI publications for the most up-to-date information.',
      timestamp: new Date()
    }]);
    setSelectedConversation(null);
  };

  const handleExamStageChange = (e) => {
    setSelectedExamStage(e.target.value);
    setSelectedSubject(''); // Reset subject when exam stage changes
  };

  const handleSubjectChange = (e) => {
    setSelectedSubject(e.target.value);
  };
  
  const saveToHistory = (conversation) => {
    // Only save conversations with more than the initial greeting
    if (conversation.length <= 1) return;
    
    const timestamp = new Date();
    const firstUserMessage = conversation.find(msg => msg.type === 'user');
    const title = firstUserMessage ? 
      (firstUserMessage.content.length > 25 ? 
        firstUserMessage.content.substring(0, 25) + '...' : 
        firstUserMessage.content) : 
      'Conversation ' + timestamp.toLocaleString();
    
    const newConvo = { id: Date.now(), title, timestamp, messages: conversation };
    const newHistory = [
      newConvo,
      ...chatHistory.filter(c => c.id !== selectedConversation?.id).slice(0, 9) // Keep only the 10 most recent conversations
    ];
    
    setChatHistory(newHistory);
    setSelectedConversation(newConvo);
    localStorage.setItem('ca_assistant_chat_history', JSON.stringify(newHistory));
  };
  
  const handleSendMessage = async () => {
    if (input.trim() === '' || isLoading) return;
    
    const userMessage = {
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Prepare conversation history (last 10 messages or fewer)
      // Skip the initial greeting/instructions message
      const conversationHistory = messages.length > 1 
        ? messages.slice(1).slice(-10) 
        : [];
      
      // Include the selected options in the API request if they're set
      const requestData = { 
        question: userMessage.content,
        conversationHistory: conversationHistory
      };
      
      if (selectedExamStage) {
        requestData.examStage = selectedExamStage;
      }
      
      if (selectedSubject) {
        requestData.subject = selectedSubject;
      }
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/ai-quiz/ask`, 
        requestData,
        config
      );
      
      const botMessage = {
        type: 'bot',
        // Sanitize the response to remove markdown formatting
        content: sanitizeResponse(response.data.answer),
        timestamp: new Date()
      };
      
      const newMessages = [...messages, userMessage, botMessage];
      setMessages(prev => [...prev, botMessage]);
      
      // Save this conversation to history
      saveToHistory(newMessages);
      
    } catch (error) {
      console.error('Error fetching bot response:', error);
      setMessages(prev => [...prev, {
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again later.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadConversation = (convo) => {
    setMessages(convo.messages);
    setSelectedConversation(convo);
  };
  
  const deleteConversation = (e, historyId) => {
    e.stopPropagation(); // Prevent triggering the loadConversation
    
    // Show confirmation dialog
    const confirmDelete = window.confirm('Are you sure you want to delete this conversation?');
    
    if (confirmDelete) {
      const updatedHistory = chatHistory.filter(item => item.id !== historyId);
      setChatHistory(updatedHistory);
      localStorage.setItem('ca_assistant_chat_history', JSON.stringify(updatedHistory));
      
      // If the deleted conversation is the currently selected one, create a new chat
      if (selectedConversation && selectedConversation.id === historyId) {
        createNewChat();
      }
    }
  };
  
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Add rendering function to format warning message with styled content
  const formatMessageWithWarning = (content) => {
    if (!content) return '';
    
    // Check if the message contains the warning text
    if (content.includes('CA Assistant can make mistakes')) {
      // Find the warning part of the message (starting with "CA Assistant can make mistakes")
      const parts = content.split('CA Assistant can make mistakes');
      
      if (parts.length === 2) {
        // Replace "official ICAI publications" with hyperlink
        const warningText = parts[1].replace(
          'official ICAI publications', 
          '<a href="https://boslive.icai.org/index.php" target="_blank" rel="noopener noreferrer">official ICAI publications</a>'
        );
        
        return (
          <>
            {parts[0]}
            <span className="warning-text" dangerouslySetInnerHTML={{ 
              __html: `CA Assistant can make mistakes${warningText}` 
            }} />
          </>
        );
      }
    }
    
    // Return the original content if no warning text found
    return content;
  };

  return (
    <div className="chatbot-page">
      <Navbar />
      
      <div className="chatbot-container">
        <div className="chatbot-sidebar">
          <button className="new-chat-button" onClick={createNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" strokeWidth="2">
              <path d="M12 4v16m-8-8h16" stroke="currentColor" strokeLinecap="round" />
            </svg>
            New chat
          </button>
          
          <div className="history-divider">
            <span>Chat History</span>
          </div>
          
          <div className="chat-history-list">
            {chatHistory.length === 0 ? (
              <div className="empty-history-message">
                No chat history yet
              </div>
            ) : (
              chatHistory.map(convo => (
                <div 
                  key={convo.id} 
                  className={`history-item ${selectedConversation?.id === convo.id ? 'active' : ''}`}
                  onClick={() => loadConversation(convo)}
                >
                  <div className="history-item-title">{convo.title}</div>
                  <button 
                    className="history-delete-btn"
                    onClick={(e) => deleteConversation(e, convo.id)}
                    aria-label="Delete conversation"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="chatbot-main">
          <div className="chatbot-header">
            <h1>CA Assistant</h1>
          </div>
          
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`chat-message ${message.type}`}>
                <div className="message-avatar">
                  {message.type === 'bot' ? (
                    <div className="bot-avatar">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="12" rx="2" ry="2"></rect>
                        <line x1="8" y1="12" x2="8" y2="16"></line>
                        <line x1="16" y1="12" x2="16" y2="16"></line>
                        <rect x="8" y="8" width="2" height="2"></rect>
                        <rect x="14" y="8" width="2" height="2"></rect>
                      </svg>
                    </div>
                  ) : (
                    <div className="user-avatar">You</div>
                  )}
                </div>
                <div className="message-content">
                  <div className="message-text">
                    {message.type === 'bot' 
                      ? formatMessageWithWarning(message.content) 
                      : message.content}
                  </div>
                  <div className="message-time">{formatTime(message.timestamp)}</div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="chat-message bot">
                <div className="message-avatar">
                  <div className="bot-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="12" rx="2" ry="2"></rect>
                      <line x1="8" y1="12" x2="8" y2="16"></line>
                      <line x1="16" y1="12" x2="16" y2="16"></line>
                      <rect x="8" y="8" width="2" height="2"></rect>
                      <rect x="14" y="8" width="2" height="2"></rect>
                    </svg>
                  </div>
                </div>
                <div className="message-content">
                  <div className="skeleton-container">
                    <div className="skeleton-line" style={{ width: '90%' }}></div>
                    <div className="skeleton-line" style={{ width: '75%' }}></div>
                    <div className="skeleton-line" style={{ width: '80%' }}></div>
                    <div className="skeleton-line" style={{ width: '60%' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messageEndRef} className="message-end"></div>
          </div>
          
          <div className="chatbot-input">
            <div className="input-wrapper">
              <textarea
                value={input}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type your question here..."
                disabled={isLoading}
              />
            
              <button 
                onClick={handleSendMessage} 
                disabled={isLoading || !input.trim()}
                className="send-button"
              >
                Send
              </button>
            </div>
            
            <div className="input-controls">
              <div className="input-selectors">
                <select 
                  value={selectedExamStage}
                  onChange={handleExamStageChange}
                  className="input-selector"
                >
                  <option value="">Exam Stage</option>
                  <option value="Foundation">Foundation</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Final">Final</option>
                </select>
                
                <select
                  value={selectedSubject}
                  onChange={handleSubjectChange}
                  disabled={!selectedExamStage}
                  className="input-selector"
                >
                  <option value="">Subject</option>
                  {selectedExamStage === 'Foundation' ? (
                    <>
                      <option value="Accounting">Accounting</option>
                      <option value="Business Laws">Business Laws</option>
                      <option value="Quantitative Aptitude">Quantitative Aptitude</option>
                      <option value="Business Economics">Business Economics</option>
                    </>
                  ) : selectedExamStage === 'Intermediate' ? (
                    <>
                      <option value="Advanced Accounting">Advanced Accounting</option>
                      <option value="Corporate Laws">Corporate Laws</option>
                      <option value="Cost and Management Accounting">Cost and Management Accounting</option>
                      <option value="Taxation">Taxation</option>
                      <option value="Auditing and Code of Ethics">Auditing and Code of Ethics</option>
                      <option value="Financial and Strategic Management">Financial and Strategic Management</option>
                    </>
                  ) : selectedExamStage === 'Final' ? (
                    <>
                      <option value="Financial Reporting">Financial Reporting</option>
                      <option value="Advanced Financial Management">Advanced Financial Management</option>
                      <option value="Advanced Auditing">Advanced Auditing</option>
                      <option value="Direct and International Tax Laws">Direct and International Tax Laws</option>
                      <option value="Indirect Tax Laws">Indirect Tax Laws</option>
                      <option value="Integrated Business Solutions">Integrated Business Solutions</option>
                    </>
                  ) : null}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBotPage; 