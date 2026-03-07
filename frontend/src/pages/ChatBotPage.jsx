import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import api from '../utils/axiosConfig';
import apiUtils from '../utils/apiUtils';
import AnimatedPlaceholder from '../components/ui/AnimatedPlaceholder';
import AnimatedModal from '../components/shared/AnimatedModal';
import { LinkPreview } from '../components/ui/LinkPreview';
import './ChatBotPage.css';

const getChatHistoryStorageKey = () => {
  const userId = apiUtils.getAuthUserId();
  return userId ? `ca_assistant_chat_history_${userId}` : 'ca_assistant_chat_history';
};

// Typing speed: chars per tick; tick interval in ms (~150-200 chars/sec)
const STREAM_CHARS_PER_TICK = 5;
const STREAM_TICK_MS = 25;
// Title animation (faster, titles are short)
const TITLE_STREAM_CHARS_PER_TICK = 1;
const TITLE_STREAM_TICK_MS = 25;

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
  const [streamingMessage, setStreamingMessage] = useState(null); // { content, displayedLength }
  const [streamingTitle, setStreamingTitle] = useState(null); // { convoId, fullTitle, displayedLength }
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const messageEndRef = useRef(null);
  const textareaRef = useRef(null);
  const createdConversationRef = useRef(null); // Track newly created convo for error-path update
  const [selectedExamStage, setSelectedExamStage] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const [selectedImage, setSelectedImage] = useState(null); // { file, base64 }
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Image Lightbox State
  const [lightboxImage, setLightboxImage] = useState(null);

  // Sidebar State (Resizable & Collapsible)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260); // Default width
  const isResizing = useRef(false);

  // Load chat history from localStorage (per user) on component mount
  useEffect(() => {
    const key = getChatHistoryStorageKey();
    const savedHistory = localStorage.getItem(key);
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        setChatHistory(parsedHistory);
      } catch (e) {
        console.error('Error parsing chat history:', e);
      }
    } else {
      setChatHistory([]);
    }
  }, [apiUtils.getAuthUserId()]);

  // Track if we just loaded a chat from history
  const [justLoadedHistory, setJustLoadedHistory] = useState(false);

  // Mouse event listeners for resizing the sidebar
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      // Calculate new width, preventing it from getting too small or too large
      const newWidth = Math.max(200, Math.min(e.clientX, window.innerWidth * 0.5));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto'; // Re-enable text selection
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault(); // Prevent text selection while dragging
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Disable text selection during drag
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (messageEndRef.current) {
      if (justLoadedHistory) {
        // Jump instantly when switching loaded chats
        messageEndRef.current.scrollIntoView({
          behavior: 'auto',
          block: 'end'
        });
        setJustLoadedHistory(false);
      } else {
        // Smooth scroll for user typing / bot streaming
        messageEndRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'end'
        });
      }
    }
  }, [messages, streamingMessage?.displayedLength, justLoadedHistory]);

  // Token-by-token animation effect (ChatGPT-like)
  useEffect(() => {
    if (!streamingMessage) return;
    const { content, displayedLength } = streamingMessage;
    if (displayedLength >= content.length) {
      const botMsg = { type: 'bot', content, timestamp: new Date() };
      setMessages(prev => {
        const newMsgs = [...prev, botMsg];
        queueMicrotask(() => saveToHistory(newMsgs));
        return newMsgs;
      });
      setStreamingMessage(null);
      setIsLoading(false);
      return;
    }
    const timer = setInterval(() => {
      setStreamingMessage(prev => {
        if (!prev) return null;
        const next = Math.min(prev.displayedLength + STREAM_CHARS_PER_TICK, prev.content.length);
        return { ...prev, displayedLength: next };
      });
    }, STREAM_TICK_MS);
    return () => clearInterval(timer);
  }, [streamingMessage]);

  // Token-by-token animation for AI-generated title in sidebar
  useEffect(() => {
    if (!streamingTitle) return;
    const { convoId, fullTitle, displayedLength } = streamingTitle;
    if (displayedLength >= fullTitle.length) {
      updateConversationTitle(convoId, fullTitle);
      setStreamingTitle(null);
      return;
    }
    const timer = setInterval(() => {
      setStreamingTitle(prev => {
        if (!prev) return null;
        const next = Math.min(prev.displayedLength + TITLE_STREAM_CHARS_PER_TICK, prev.fullTitle.length);
        return { ...prev, displayedLength: next };
      });
    }, TITLE_STREAM_TICK_MS);
    return () => clearInterval(timer);
  }, [streamingTitle]);

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

  // Auto-resize textarea as content grows
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Image Handling Methods
  const processFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    // Convert to base64 for preview and API
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage({
        file,
        base64: e.target.result // Includes data:image/jpeg;base64, prefix
      });
    };
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    // Reset input so the same file could be selected again if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e) => {
    if (e.clipboardData && e.clipboardData.items) {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          processFile(file);
          break; // Process only the first image pasted
        }
      }
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const createNewChat = () => {
    createdConversationRef.current = null;
    setStreamingMessage(null);
    setStreamingTitle(null);
    setIsLoading(false);
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

  // Update conversation title (e.g. when AI-generated title arrives)
  const updateConversationTitle = (convoId, newTitle) => {
    setChatHistory(prev => {
      const updated = prev.map(c =>
        c.id === convoId ? { ...c, title: newTitle } : c
      );
      localStorage.setItem(getChatHistoryStorageKey(), JSON.stringify(updated));
      return updated;
    });
    if (selectedConversation?.id === convoId) {
      setSelectedConversation(prev => prev ? { ...prev, title: newTitle } : null);
    }
  };

  // Create conversation in history as soon as user sends first message (instant appearance)
  const createConversationOnFirstMessage = (messagesWithUser) => {
    const newConvo = {
      id: Date.now(),
      title: 'New Chat',
      timestamp: new Date(),
      messages: messagesWithUser
    };
    createdConversationRef.current = newConvo;
    setChatHistory(prev => {
      const newHistory = [newConvo, ...prev.filter(c => c.id !== newConvo.id).slice(0, 9)];
      localStorage.setItem(getChatHistoryStorageKey(), JSON.stringify(newHistory));
      return newHistory;
    });
    setSelectedConversation(newConvo);
  };

  // Update or create conversation in history (called when bot responds)
  const saveToHistory = (conversation) => {
    if (conversation.length <= 1) return;

    const convoToUpdate = selectedConversation || createdConversationRef.current;
    if (convoToUpdate) {
      createdConversationRef.current = null;
      setChatHistory(prev => {
        // Preserve current title (may be AI-generated) - don't overwrite with stale convoToUpdate.title
        const existingConvo = prev.find(c => c.id === convoToUpdate.id);
        const titleToKeep = existingConvo?.title ?? convoToUpdate.title;
        const updatedConvo = {
          ...convoToUpdate,
          messages: conversation,
          timestamp: new Date(),
          title: titleToKeep
        };
        const newHistory = [
          updatedConvo,
          ...prev.filter(c => c.id !== convoToUpdate.id).slice(0, 9)
        ];
        localStorage.setItem(getChatHistoryStorageKey(), JSON.stringify(newHistory));
        return newHistory;
      });
      setSelectedConversation(prev => {
        const titleToKeep = (prev?.id === convoToUpdate.id && prev?.title) ? prev.title : convoToUpdate.title;
        return { ...convoToUpdate, messages: conversation, timestamp: new Date(), title: titleToKeep };
      });

      // Generate title based on AI's first response if it's a new chat
      const titleToKeep = convoToUpdate.title;
      if (conversation.length === 3 && titleToKeep === 'New Chat') {
        const firstUserMessage = conversation[1];
        const firstBotMessage = conversation[2];
        // Combine the prompt and AI's answer so the title generator has full context
        const dialogueContext = `User: ${firstUserMessage.content || '[Image uploaded]'}\nAI: ${firstBotMessage.content}`;

        api
          .post('/ai/suggest-title', { question: dialogueContext })
          .then(res => {
            const aiTitle = res.data?.title?.trim();
            if (aiTitle && aiTitle.length > 0) {
              setStreamingTitle({ convoId: convoToUpdate.id, fullTitle: aiTitle, displayedLength: 0 });
            }
          })
          .catch(() => { });
      }
    } else {
      // Fallback: create new (e.g. if user navigated away before first message)
      const timestamp = new Date();
      const firstUserMessage = conversation.find(msg => msg.type === 'user');
      const title = 'New Chat';
      const newConvo = { id: Date.now(), title, timestamp, messages: conversation };
      setChatHistory(prev => {
        const newHistory = [newConvo, ...prev.filter(c => c.id !== newConvo.id).slice(0, 9)];
        localStorage.setItem(getChatHistoryStorageKey(), JSON.stringify(newHistory));
        return newHistory;
      });
      setSelectedConversation(newConvo);
      createdConversationRef.current = null;
    }
  };

  const handleSendMessage = async () => {
    if ((input.trim() === '' && !selectedImage) || isLoading) return;

    // Prepare the message text
    let userMsgContent = input.trim();

    const userMessage = {
      type: 'user',
      content: userMsgContent,
      timestamp: new Date(),
      image: selectedImage ? selectedImage.base64 : null,
      animate: true
    };

    const messagesWithUser = [...messages, userMessage];
    setMessages(prev => [...prev, userMessage]);

    // Temporarily capture image to send, then clear input UI
    const imageToSend = selectedImage ? selectedImage.base64 : null;

    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    // Create chat in history immediately on first message (ChatGPT-style: instant + auto-title)
    if (selectedConversation === null) {
      createConversationOnFirstMessage(messagesWithUser);
    }

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
        question: input.trim(), // Send whatever the user typed (can be empty string)
        conversationHistory: conversationHistory,
        image: imageToSend // the base64 string
      };

      if (selectedExamStage) {
        requestData.examStage = selectedExamStage;
      }

      if (selectedSubject) {
        requestData.subject = selectedSubject;
      }

      const response = await api.post('/ai/ask', requestData, config);

      const content = sanitizeResponse(response.data.answer);

      // Start token-by-token animation (ChatGPT-like); isLoading stays true until done
      setStreamingMessage({ content, displayedLength: 0 });

    } catch (error) {
      console.error('Error fetching bot response:', error);
      const errorMsg = {
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again later.',
        timestamp: new Date()
      };
      const messagesWithError = [...messagesWithUser, errorMsg];
      setMessages(prev => [...prev, errorMsg]);
      saveToHistory(messagesWithError);
      setIsLoading(false);
    }
  };

  const loadConversation = (convo) => {
    createdConversationRef.current = null;
    setStreamingMessage(null);
    setStreamingTitle(null);
    setIsLoading(false);
    setMessages(convo.messages);
    setSelectedConversation(convo);
    setJustLoadedHistory(true);
  };

  const deleteConversation = (e, historyId) => {
    e.stopPropagation(); // Prevent triggering the loadConversation

    // Show confirmation dialog
    const confirmDelete = window.confirm('Are you sure you want to delete this conversation?');

    if (confirmDelete) {
      const updatedHistory = chatHistory.filter(item => item.id !== historyId);
      setChatHistory(updatedHistory);
      localStorage.setItem(getChatHistoryStorageKey(), JSON.stringify(updatedHistory));

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
        // Find the text between "CA Assistant can make mistakes" and "official ICAI publications"
        // The original string was: "CA Assistant can make mistakes. Check important info. Please dont rely on answers blindly. Check the official ICAI publications for the most up-to-date information."
        const warningPart = parts[1];
        const subParts = warningPart.split('official ICAI publications');

        return (
          <>
            {parts[0]}
            <span className="warning-text">
              <strong>CA Assistant can make mistakes</strong>
              {subParts[0]}
              <LinkPreview url="https://boslive.icai.org/index.php">
                official ICAI publications
              </LinkPreview>
              {subParts[1]}
            </span>
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
        {/* Toggle Button for Sidebar */}
        <button
          className="sidebar-toggle-btn"
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? "Open Sidebar" : "Close Sidebar"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div
          className={`chatbot-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
          style={{ '--sidebar-width': `${sidebarWidth}px` }}
        >
          <div className="sidebar-content-wrapper" style={{ width: sidebarWidth }}>
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
                    <div className="history-item-title" title={convo.title}>
                      {streamingTitle?.convoId === convo.id ? (
                        <>
                          {streamingTitle.fullTitle.slice(0, streamingTitle.displayedLength)}
                          <span className="streaming-cursor" aria-hidden="true">|</span>
                        </>
                      ) : (
                        convo.title
                      )}
                    </div>
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

          {/* Draggable Resizer Handle */}
          {!isSidebarCollapsed && (
            <div
              className="sidebar-resizer"
              onMouseDown={handleMouseDown}
            ></div>
          )}
        </div>

        <div className="chatbot-main">
          <div className="chatbot-header">
            <h1>CA Assistant</h1>
          </div>

          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`chat-message ${message.type} ${message.animate ? 'animate-in' : ''}`}>
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
                  {message.image && (
                    <div className="message-image" onClick={() => setLightboxImage(message.image)}>
                      <img src={message.image} alt="User attached" />
                    </div>
                  )}
                  {message.content && message.content.trim() !== '' && (
                    <div className="message-text">
                      {message.type === 'bot'
                        ? formatMessageWithWarning(message.content)
                        : message.content}
                    </div>
                  )}
                  <div className="message-time">{formatTime(message.timestamp)}</div>
                </div>
              </div>
            ))}

            {streamingMessage && (
              <div className="chat-message bot streaming">
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
                  <div className="message-text">
                    {streamingMessage.content.slice(0, streamingMessage.displayedLength)}
                    <span className="streaming-cursor" aria-hidden="true">|</span>
                  </div>
                </div>
              </div>
            )}
            {isLoading && !streamingMessage && (
              <div className="chat-message bot animate-in">
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
            <div
              className={`input-wrapper ${isDragging ? 'dragging' : ''} ${selectedImage ? 'has-image' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedImage && (
                <div className="image-preview-container">
                  <div className="image-preview">
                    <img
                      src={selectedImage.base64}
                      alt="Selected"
                      onClick={() => setLightboxImage(selectedImage.base64)}
                      title="Click to expand"
                      style={{ cursor: 'zoom-in' }}
                    />
                    <button className="remove-image-btn" onClick={removeImage} title="Remove image">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <div className="input-row" style={{ position: 'relative' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button
                  className="attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach Image"
                  disabled={isLoading}
                  style={{ alignSelf: 'center' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                  </svg>
                </button>

                <AnimatedPlaceholder
                  placeholders={[
                    'What is the scope of Section 44AB of Income Tax?',
                    'Explain the concept of Marginal Costing...',
                    'What are the reporting requirements under SA 700?',
                    'Difference between IFRS and Ind AS?',
                    'How is Transfer Pricing computed under the Act?',
                    'What is the time limit for GST registration?',
                    'Explain the concept of deferred tax under Ind AS 12.',
                    'What is the significance of SA 315 in an audit?',
                    'How is goodwill accounted under Ind AS 103?',
                    'What are the provisions of Section 80C?',
                    'Explain CARO 2020 reporting requirements.',
                    'What is the difference between CGST, SGST and IGST?',
                    'What is the due date for filing GSTR-1?',
                    'Explain the provisions of Section 194C on TDS.',
                    'What is the concept of Going Concern in auditing?',
                    'How are contingent liabilities disclosed under Ind AS 37?',
                    'What are the components of Cost of Production?',
                    'Explain the materiality concept in accounting.',
                    'What is a Letter of Credit in trade finance?',
                    'What are the types of Audit Opinions?',
                    'Explain Section 73 and 74 of CGST Act.',
                    'What is the difference between Standard Costing and Budgetary Control?',
                    'How is Value Added Tax different from GST?',
                    'What is the nature of Share Application Money?',
                    'Explain Related Party Transactions under Ind AS 24.',
                    'What are the duties of a Company Auditor under Companies Act 2013?',
                    'What is the difference between capital and revenue expenditure?',
                    'Explain zero-based budgeting and its advantages.',
                  ]}
                  isActive={input.trim() === '' && !isLoading}
                />

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  onPaste={handlePaste}
                  disabled={isLoading}
                  rows={1}
                  style={{ background: 'transparent', position: 'relative', zIndex: 2 }}
                />

                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || (input.trim() === '' && !selectedImage)}
                  className="send-button"
                >
                  Send
                </button>
              </div>
            </div>

            <div className="input-controls">
              <div className="input-selectors">
                <div className="select-wrapper" data-value={selectedExamStage || "Exam Stage"}>
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
                </div>

                <div className="select-wrapper" data-value={selectedSubject || "Subject"}>
                  <select
                    value={selectedSubject}
                    onChange={handleSubjectChange}
                    disabled={!selectedExamStage}
                    className="input-selector"
                  >
                    <option value="">Subject</option>
                    {selectedExamStage === 'Foundation' ? (
                      <>
                        <option value="1 - Accounting">1 - Accounting</option>
                        <option value="2 - Business Laws">2 - Business Laws</option>
                        <option value="3 - Quantitative Aptitude">3 - Quantitative Aptitude</option>
                        <option value="4 - Business Economics">4 - Business Economics</option>
                      </>
                    ) : selectedExamStage === 'Intermediate' ? (
                      <>
                        <option value="1 - Advanced Accounting">1 - Advanced Accounting</option>
                        <option value="2 - Corporate and Other Laws">2 - Corporate and Other Laws</option>
                        <option value="3 - Taxation">3 - Taxation</option>
                        <option value="4 - Cost and Management Accounting">4 - Cost and Management Accounting</option>
                        <option value="5 - Auditing and Ethics">5 - Auditing and Ethics</option>
                        <option value="6 - Financial Management and Strategic Management">6 - Financial Management and Strategic Management</option>
                      </>
                    ) : selectedExamStage === 'Final' ? (
                      <>
                        <option value="1 - Financial Reporting">1 - Financial Reporting</option>
                        <option value="2 - Advanced Financial Management">2 - Advanced Financial Management</option>
                        <option value="3 - Advanced Auditing, Assurance and Professional Ethics">3 - Advanced Auditing, Assurance and Professional Ethics</option>
                        <option value="4 - Direct Tax Laws and International Taxation">4 - Direct Tax Laws and International Taxation</option>
                        <option value="5 - Indirect Tax Laws">5 - Indirect Tax Laws</option>
                        <option value="6 - Integrated Business Solutions (Multidisciplinary Case Study)">6 - Integrated Business Solutions (Multidisciplinary Case Study)</option>
                      </>
                    ) : null}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Lightbox Modal */}
      <AnimatedModal
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        className="lightbox-card"
      >
        <img
          src={lightboxImage}
          alt="Expanded view"
          className="lightbox-image"
          onClick={(e) => e.stopPropagation()}
        />
      </AnimatedModal>
    </div>
  );
};

export default ChatBotPage; 