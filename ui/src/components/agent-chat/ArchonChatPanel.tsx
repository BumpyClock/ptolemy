import React, { useEffect, useState, useRef } from 'react';
import { Send, User, WifiOff, RefreshCw } from 'lucide-react';
import { PtolemyLoadingSpinner } from '../animations/Animations';
import { agentChatService, ChatMessage } from '../../services/agentChatService';

/**
 * Props for the PtolemyChatPanel component
 */
interface PtolemyChatPanelProps {
  'data-id'?: string;
}
/**
 * PtolemyChatPanel - A chat interface for the Ptolemy AI assistant
 *
 * This component provides a resizable chat panel with message history,
 * loading states, and input functionality connected to real AI agents.
 */
export const PtolemyChatPanel: React.FC<PtolemyChatPanelProps> = props => {
  // State for messages, session, and other chat functionality
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  // State for input field, panel width, loading state, and dragging state
  const [inputValue, setInputValue] = useState('');
  const [width, setWidth] = useState(416); // Default width - increased by 30% from 320px
  const [isTyping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [streamingMessage] = useState('');
  const [isStreaming] = useState(false);
  
  // Add connection status state
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // No agent switching - always use RAG
  
  // Refs for DOM elements
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  /**
   * Initialize chat session and connection
   */
  const initializeChat = React.useCallback(async () => {
      try {
        setConnectionStatus('connecting');
        
        // Yield to next frame to avoid initialization race conditions
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Create a new chat session
        try {
          console.log(`[CHAT PANEL] Creating session with agentType: "rag"`);
          const { session_id } = await agentChatService.createSession('rag');
          console.log(`[CHAT PANEL] Session created with ID: ${session_id}`);
          setSessionId(session_id);
          sessionIdRef.current = session_id;
          
          // Load initial chat history
          try {
            const history = await agentChatService.getChatHistory(session_id);
            console.log(`[CHAT PANEL] Loaded chat history:`, history);
            setMessages(history || []);
          } catch (error) {
            console.error('Failed to load chat history:', error);
            // Initialize with empty messages if history can't be loaded
            setMessages([]);
          }
          
          // Start polling for new messages (will fail gracefully if backend is down)
          try {
            await agentChatService.streamMessages(
              session_id,
              (message: ChatMessage) => {
                setMessages(prev => [...prev, message]);
                setConnectionError(null); // Clear any previous errors on successful message
                setConnectionStatus('online');
              },
              (error: Error) => {
                console.error('Message streaming error:', error);
                setConnectionStatus('offline');
                setConnectionError('Chat service is offline. Messages will not be received.');
              }
            );
          } catch (error) {
            console.error('Failed to start message streaming:', error);
            // Continue anyway - the chat will work in offline mode
          }
          
          setIsInitialized(true);
          setConnectionStatus('online');
          setConnectionError(null);
        } catch (error) {
          console.error('Failed to initialize chat session:', error);
          if (error instanceof Error && error.message.includes('not available')) {
            setConnectionError('Agent chat service is disabled. Enable it in docker-compose to use this feature.');
          } else {
            setConnectionError('Failed to initialize chat. Server may be offline.');
          }
          setConnectionStatus('offline');
        }
        
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        if (error instanceof Error && error.message.includes('not available')) {
          setConnectionError('Agent chat service is disabled. Enable it in docker-compose to use this feature.');
        } else {
          setConnectionError('Failed to connect to agent. Server may be offline.');
        }
        setConnectionStatus('offline');
      }
    }, []);
  
  // Initialize on mount and when explicitly requested
  useEffect(() => {
    if (!isInitialized) {
      initializeChat();
    }
  }, [isInitialized, initializeChat]);
  
  // Cleanup effect - only on unmount
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        console.log('[CHAT PANEL] Component unmounting, cleaning up session:', sessionIdRef.current);
        // Stop streaming messages when component unmounts
        agentChatService.stopStreaming(sessionIdRef.current);
      }
    };
  }, []); // Empty deps = only on unmount
  
  /**
   * Handle resizing of the chat panel via drag
   */
  useEffect(() => {
    // Handler for mouse movement during drag
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && chatPanelRef.current) {
        const containerRect = chatPanelRef.current.parentElement?.getBoundingClientRect();
        if (containerRect) {
          // Calculate new width based on mouse position (from right edge of screen)
          const newWidth = window.innerWidth - e.clientX;
          // Set min and max width constraints
          if (newWidth >= 280 && newWidth <= 600) {
            setWidth(newWidth);
          }
        }
      }
    };
    // Handler for mouse up to end dragging
    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    // Add event listeners when dragging
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    }
    // Clean up event listeners
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  /**
   * Handler for starting the drag operation
   */
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  /**
   * Auto-scroll to the bottom when messages change
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages, isTyping, streamingMessage]);
  /**
   * Handle sending a new message to the agent
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !sessionId) return;

    try {
      // Add context for RAG agent
      const context = {
        match_count: 5,
        // Can add source_filter here if needed in the future
      };
      
      // Send message to agent via service
      await agentChatService.sendMessage(sessionId, {
        message: inputValue.trim(),
        context,
      });
      setInputValue('');
      setConnectionError(null);
    } catch (error) {
      console.error('Failed to send message:', error);
      setConnectionError('Failed to send message. Please try again.');
    }
  };
  /**
   * Format timestamp for display in messages
   */
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  /**
   * Handle manual reconnection
   */
  const handleReconnect = async () => {
    if (!sessionId || isReconnecting) return;
    
    setIsReconnecting(true);
    setConnectionStatus('connecting');
    setConnectionError('Attempting to reconnect...');
    
    try {
      const success = await agentChatService.manualReconnect(sessionId);
      if (success) {
        setConnectionError(null);
        setConnectionStatus('online');
      } else {
        setConnectionError('Reconnection failed. Server may still be offline.');
        setConnectionStatus('offline');
      }
    } catch (error) {
      console.error('Manual reconnection failed:', error);
      setConnectionError('Reconnection failed. Please try again later.');
      setConnectionStatus('offline');
    } finally {
      setIsReconnecting(false);
    }
  };
  return (
    <div ref={chatPanelRef} className="h-full flex flex-col relative" style={{
      width: `${width}px`
    }} data-id={props['data-id']}>
      {/* Drag handle for resizing */}
      <div ref={dragHandleRef} className={`absolute left-0 top-0 w-1.5 h-full cursor-ew-resize z-20 ${isDragging ? 'bg-muted' : 'bg-transparent hover:bg-muted'} transition-colors duration-200`} onMouseDown={handleDragStart} />
      {/* Main panel with glassmorphism */}
      <div className="h-full flex flex-col relative bg-card border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              {/* Ptolemy Logo - No animation in header */}
              <div className="relative w-8 h-8 mr-3 flex items-center justify-center">
                <img src="/logo-neon.png" alt="Ptolemy" className="w-6 h-6 z-10 relative" />
              </div>
              <h2 className="text-foreground font-medium z-10 relative">
                Knowledge Base Assistant
              </h2>
            </div>
          </div>
          
          {/* Connection status and controls */}
          <div className="flex items-center gap-2">
            {/* Connection status indicator */}
            {connectionStatus === 'offline' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Chat Offline
                </div>
                <button
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="flex items-center gap-1 text-xs text-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
                  {isReconnecting ? 'Connecting...' : 'Reconnect'}
                </button>
              </div>
            )}
            
            {connectionStatus === 'connecting' && (
              <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                <div className="flex items-center">
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Connecting...
                </div>
              </div>
            )}
            
            {connectionStatus === 'online' && !connectionError && (
              <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-foreground rounded-full mr-1" />
                  Online
                </div>
              </div>
            )}
            
            {/* Error message overlay */}
            {connectionError && connectionStatus !== 'offline' && (
              <div className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
                {connectionError}
              </div>
            )}
          </div>
        </div>
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[80%] rounded-lg p-3 
                ${message.sender === 'user' 
                  ? 'bg-secondary text-secondary-foreground border border-border ml-auto'
                  : 'bg-muted text-foreground border border-border mr-auto'}
              `}>
                <div className="flex items-center mb-1">
                  {message.sender === 'agent' ? (
                    <div className="w-4 h-4 mr-1 flex items-center justify-center">
                      <img src="/logo-neon.png" alt="Ptolemy" className="w-full h-full" />
                    </div>
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground mr-1" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="text-foreground text-sm whitespace-pre-wrap">
                  {/* For RAG responses, handle markdown-style formatting */}
                  {message.agent_type === 'rag' && message.sender === 'agent' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {message.content.split('\n').map((line, idx) => {
                        // Handle bold text
                        const boldRegex = /\*\*(.*?)\*\*/g;
                        const parts = line.split(boldRegex);
                        
                        return (
                          <div key={idx}>
                            {parts.map((part, partIdx) => 
                              partIdx % 2 === 1 ? (
                                <strong key={partIdx}>{part}</strong>
                              ) : (
                                <span key={partIdx}>{part}</span>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            </div>
          ))}
          {/* Streaming message */}
          {isStreaming && streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[80%] bg-muted text-foreground border border-border mr-auto rounded-lg p-3">
                <div className="flex items-center mb-1">
                  <div className="w-4 h-4 mr-1 flex items-center justify-center">
                    <img src="/logo-neon.png" alt="Ptolemy" className="w-full h-full" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(new Date())}
                  </span>
                  <div className="ml-2 w-1 h-1 bg-foreground rounded-full animate-pulse" />
                </div>
                <p className="text-foreground text-sm whitespace-pre-wrap">
                  {streamingMessage}
                </p>
              </div>
            </div>
          )}
          
          {/* Typing indicator */}
          {(isTyping && !isStreaming) && (
            <div className="flex justify-start">
              <div className="max-w-[80%] mr-auto flex items-center justify-center py-4">
                <PtolemyLoadingSpinner size="md" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Agent is typing...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {/* Input area */}
        <div className="p-4 border-t border-border bg-background">
          {connectionStatus === 'offline' && (
            <div className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-center text-sm text-destructive">
                <WifiOff className="w-4 h-4 mr-2" />
                Chat is currently offline. Please use the reconnect button above to try again.
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {/* Text input field */}
            <div className="flex-1 bg-background border border-input rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-ring transition-all duration-200">
              <input 
                type="text" 
                value={inputValue} 
                onChange={e => setInputValue(e.target.value)} 
                placeholder={
                  connectionStatus === 'offline' ? "Chat is offline..." :
                  connectionStatus === 'connecting' ? "Connecting..." :
                  "Search the knowledge base..."
                }
                disabled={connectionStatus !== 'online'} 
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50" 
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSendMessage();
                }} 
              />
            </div>
            {/* Send button */}
            <button 
              onClick={handleSendMessage} 
              disabled={connectionStatus !== 'online' || isTyping || !inputValue.trim()} 
              className="flex items-center justify-center p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
