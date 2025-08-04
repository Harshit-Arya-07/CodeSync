import React, { useState } from 'react';
import { RoomJoin } from './components/RoomJoin';
import { CodeEditor } from './components/CodeEditor';

interface AppState {
  currentRoom: string | null;
  username: string | null;
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    currentRoom: null,
    username: null
  });

  const handleJoinRoom = (roomId: string, username: string) => {
    setAppState({
      currentRoom: roomId,
      username
    });
  };

  const handleLeaveRoom = () => {
    setAppState({
      currentRoom: null,
      username: null
    });
  };

  if (!appState.currentRoom || !appState.username) {
    return <RoomJoin onJoinRoom={handleJoinRoom} />;
  }

  return (
    <CodeEditor
      roomId={appState.currentRoom}
      username={appState.username}
      onRoomLeave={handleLeaveRoom}
    />
  );
}

export default App;