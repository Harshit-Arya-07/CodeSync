import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Code, Users, Zap, Shield, Sparkles } from 'lucide-react';

interface RoomJoinProps {
  onJoinRoom: (roomId: string, username: string) => void;
}

export const RoomJoin: React.FC<RoomJoinProps> = ({ onJoinRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<{ roomId?: string; username?: string }>({});

  const validateForm = () => {
    const newErrors: { roomId?: string; username?: string } = {};
    
    if (!roomId.trim()) {
      newErrors.roomId = 'Room ID is required';
    } else if (roomId.trim().length < 3) {
      newErrors.roomId = 'Room ID must be at least 3 characters';
    }
    
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.trim().length < 2) {
      newErrors.username = 'Username must be at least 2 characters';
    } else if (username.trim().length > 20) {
      newErrors.username = 'Username must be less than 20 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onJoinRoom(roomId.trim(), username.trim());
    }
  };

  const handleCreateRoom = () => {
    const newRoomId = uuidv4().slice(0, 8).toUpperCase();
    setRoomId(newRoomId);
    setIsCreating(true);
    setErrors({});
  };

  const generateRandomUsername = () => {
    const adjectives = ['Cool', 'Smart', 'Fast', 'Bright', 'Swift', 'Bold', 'Clever', 'Quick'];
    const nouns = ['Coder', 'Dev', 'Hacker', 'Builder', 'Creator', 'Ninja', 'Wizard', 'Master'];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 100);
    
    setUsername(`${randomAdjective}${randomNoun}${randomNumber}`);
    setErrors(prev => ({ ...prev, username: undefined }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-700/50">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4 shadow-lg">
            <Code className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">CodeSync</h1>
          <p className="text-gray-400">Real-time collaborative coding platform</p>
        </div>

        {/* Form */}
        <form onSubmit={handleJoinRoom} className="space-y-6">
          {/* Username Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                Your Name
              </label>
              <button
                type="button"
                onClick={generateRandomUsername}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Generate random
              </button>
            </div>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErrors(prev => ({ ...prev, username: undefined }));
              }}
              placeholder="Enter your display name"
              className={`w-full bg-gray-700/50 border rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
                errors.username 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-600 focus:ring-blue-500 focus:border-transparent'
              }`}
              maxLength={20}
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-400">{errors.username}</p>
            )}
          </div>

          {/* Room ID Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="roomId" className="block text-sm font-medium text-gray-300">
                Room ID
              </label>
              {!isCreating && (
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Create new room</span>
                </button>
              )}
            </div>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value.toUpperCase());
                setErrors(prev => ({ ...prev, roomId: undefined }));
                setIsCreating(false);
              }}
              placeholder="Enter room ID or create new"
              className={`w-full bg-gray-700/50 border rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all font-mono ${
                errors.roomId 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-600 focus:ring-blue-500 focus:border-transparent'
              }`}
              style={{ textTransform: 'uppercase' }}
            />
            {errors.roomId && (
              <p className="mt-1 text-sm text-red-400">{errors.roomId}</p>
            )}
            {isCreating && (
              <p className="mt-1 text-sm text-green-400 flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>New room created! Ready to join.</span>
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center space-x-2 shadow-lg"
          >
            <Users className="w-5 h-5" />
            <span>{isCreating ? 'Create & Join Room' : 'Join Room'}</span>
          </button>
        </form>

        {/* Features */}
        <div className="mt-8 pt-6 border-t border-gray-700/50">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="group">
              <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 p-3 rounded-lg mb-2 group-hover:from-blue-500/30 group-hover:to-blue-600/30 transition-all">
                <Zap className="w-6 h-6 text-blue-400 mx-auto" />
              </div>
              <div className="text-xs text-gray-400">Real-time Sync</div>
            </div>
            <div className="group">
              <div className="bg-gradient-to-r from-green-500/20 to-green-600/20 p-3 rounded-lg mb-2 group-hover:from-green-500/30 group-hover:to-green-600/30 transition-all">
                <Code className="w-6 h-6 text-green-400 mx-auto" />
              </div>
              <div className="text-xs text-gray-400">Multi-Language</div>
            </div>
            <div className="group">
              <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 p-3 rounded-lg mb-2 group-hover:from-purple-500/30 group-hover:to-purple-600/30 transition-all">
                <Shield className="w-6 h-6 text-purple-400 mx-auto" />
              </div>
              <div className="text-xs text-gray-400">Secure Rooms</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Share your room ID with others to collaborate in real-time
          </p>
        </div>
      </div>
    </div>
  );
};