import React, { useRef, useCallback, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useSocket } from '../hooks/useSocket';
import { 
  Users, 
  Wifi, 
  WifiOff, 
  Settings, 
  Copy, 
  Check, 
  AlertCircle,
  RefreshCw,
  LogOut
} from 'lucide-react';

interface CodeEditorProps {
  roomId: string;
  username: string;
  onRoomLeave: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ roomId, username, onRoomLeave }) => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReceivingUpdate = useRef(false);

  const {
    socket,
    isConnected,
    participants,
    connectionError,
    isReconnecting,
    joinRoom,
    emitCodeChange,
    emitLanguageChange,
    reconnect
  } = useSocket({ serverPath: 'http://localhost:3001' });

  // Join room on component mount
  useEffect(() => {
    if (socket && isConnected) {
      joinRoom(roomId, username);
    }
  }, [socket, isConnected, roomId, username, joinRoom]);

  // Listen for code updates from other users
  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (data: any) => {
      console.log('📥 Room state received');
      isReceivingUpdate.current = true;
      setCode(data.code);
      setLanguage(data.language);
      setIsLoading(false);
      
      setTimeout(() => {
        isReceivingUpdate.current = false;
      }, 100);
    };

    const handleCodeUpdate = (data: any) => {
      console.log('📝 Code update from:', data.updatedBy);
      isReceivingUpdate.current = true;
      setCode(data.code);
      if (data.language) setLanguage(data.language);
      
      setTimeout(() => {
        isReceivingUpdate.current = false;
      }, 100);
    };

    const handleLanguageUpdate = (data: any) => {
      console.log('🔧 Language changed to:', data.language, 'by:', data.updatedBy);
      setLanguage(data.language);
    };

    socket.on('room-state', handleRoomState);
    socket.on('code-update', handleCodeUpdate);
    socket.on('language-update', handleLanguageUpdate);

    return () => {
      socket.off('room-state', handleRoomState);
      socket.off('code-update', handleCodeUpdate);
      socket.off('language-update', handleLanguageUpdate);
    };
  }, [socket]);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    editor.focus();
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Fira Code, Monaco, "Cascadia Code", "Ubuntu Mono", monospace',
      fontLigatures: true,
      lineHeight: 1.6,
      letterSpacing: 0.5,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'gutter',
      scrollBeyondLastLine: false,
      minimap: { enabled: window.innerWidth > 1024 },
      wordWrap: 'on',
      automaticLayout: true
    });
  };

  const handleCodeChange = useCallback((value: string | undefined) => {
    if (isReceivingUpdate.current || !value) return;
    
    setCode(value);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Debounce the socket emission
    timeoutRef.current = setTimeout(() => {
      emitCodeChange(value, language);
    }, 300);
  }, [emitCodeChange, language]);

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    emitLanguageChange(newLanguage);
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy room ID:', err);
    }
  };

  const languages = [
    { value: 'javascript', label: 'JavaScript', icon: '🟨' },
    { value: 'typescript', label: 'TypeScript', icon: '🔷' },
    { value: 'python', label: 'Python', icon: '🐍' },
    { value: 'java', label: 'Java', icon: '☕' },
    { value: 'cpp', label: 'C++', icon: '⚡' },
    { value: 'csharp', label: 'C#', icon: '💜' },
    { value: 'go', label: 'Go', icon: '🐹' },
    { value: 'rust', label: 'Rust', icon: '🦀' },
    { value: 'html', label: 'HTML', icon: '🌐' },
    { value: 'css', label: 'CSS', icon: '🎨' },
    { value: 'json', label: 'JSON', icon: '📋' },
    { value: 'markdown', label: 'Markdown', icon: '📝' }
  ];

  const getConnectionStatus = () => {
    if (connectionError) return { color: 'bg-red-500', text: 'Error', icon: AlertCircle };
    if (isReconnecting) return { color: 'bg-yellow-500', text: 'Reconnecting...', icon: RefreshCw };
    if (isConnected) return { color: 'bg-green-500', text: 'Connected', icon: Wifi };
    return { color: 'bg-gray-500', text: 'Disconnected', icon: WifiOff };
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-white text-xl mb-2">Connecting to room...</div>
          <div className="text-gray-400">Room ID: {roomId}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white mb-2">CodeSync</h1>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Room: <span className="text-blue-400 font-mono text-xs">{roomId}</span>
            </div>
            <button
              onClick={copyRoomId}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Copy Room ID"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${status.color} ${isReconnecting ? 'animate-pulse' : ''}`}></div>
              <span className="text-sm text-gray-300">{status.text}</span>
              <StatusIcon className="w-4 h-4 text-gray-400" />
            </div>
            {connectionError && (
              <button
                onClick={reconnect}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
          {connectionError && (
            <div className="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded">
              {connectionError}
            </div>
          )}
        </div>

        {/* Language Selector */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Language
            </label>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {languages.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.icon} {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Participants */}
        <div className="p-4 flex-1">
          <div className="flex items-center space-x-2 mb-3">
            <Users className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-300">
              Participants ({participants.length})
            </h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center space-x-3 p-2 bg-gray-700 rounded-md"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-300 truncate">
                    {participant.username}
                    {participant.username === username && (
                      <span className="text-xs text-blue-400 ml-1">(you)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(participant.joinedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {participants.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">
                No participants yet
              </div>
            )}
          </div>
        </div>

        {/* Leave Room */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onRoomLeave}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Room</span>
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Collaborative Editor
            </h2>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>{participants.length} active</span>
              </div>
              <div className="text-xs">
                {languages.find(l => l.value === language)?.icon} {languages.find(l => l.value === language)?.label}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 relative">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleCodeChange}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: 'Fira Code, Monaco, "Cascadia Code", "Ubuntu Mono", monospace',
              automaticLayout: true,
              minimap: { enabled: window.innerWidth > 1024 },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderLineHighlight: 'gutter',
              selectOnLineNumbers: true,
              matchBrackets: 'always',
              folding: true,
              foldingHighlight: true,
              showFoldingControls: 'always',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on'
            }}
            loading={
              <div className="flex items-center justify-center h-full bg-gray-900">
                <div className="text-white">Loading editor...</div>
              </div>
            }
          />
          
          {/* Connection overlay */}
          {!isConnected && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 text-center">
                <WifiOff className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <div className="text-white mb-2">Connection Lost</div>
                <div className="text-gray-400 text-sm mb-4">
                  {isReconnecting ? 'Attempting to reconnect...' : 'Unable to sync changes'}
                </div>
                {!isReconnecting && (
                  <button
                    onClick={reconnect}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
                  >
                    Reconnect
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};