# CodeSync - Real-Time Collaborative Code Editor

A modern, real-time collaborative code editor built with React, Monaco Editor, and Socket.IO. Multiple users can edit code simultaneously with live synchronization, syntax highlighting, and multi-language support.

## ✨ Features

- **Real-time Collaboration**: Multiple users can edit the same document simultaneously
- **Live Synchronization**: See changes from other users instantly
- **Multi-language Support**: JavaScript, TypeScript, Python, Java, C++, and more
- **Monaco Editor**: Full-featured code editor with IntelliSense and syntax highlighting
- **Room-based Sessions**: Create or join rooms with unique IDs
- **User Presence**: See who's currently editing in real-time
- **Connection Management**: Automatic reconnection and error handling
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Professional UI**: Clean, modern interface optimized for coding
- **Run Code (beta)**: Execute JavaScript from the editor with room-wide results

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collaborative-code-editor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm run dev
   ```

This will start both the frontend (http://localhost:5173) and backend (http://localhost:3001) servers simultaneously.

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Monaco Editor** - VS Code's editor component
- **Socket.IO Client** - Real-time communication
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icons
- **Vite** - Fast development and building

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **Socket.IO** - WebSocket communication
- **CORS** - Cross-origin resource sharing
- **UUID** - Unique identifier generation

## 📁 Project Structure

```
collaborative-code-editor/
├── src/
│   ├── components/
│   │   ├── CodeEditor.tsx      # Main editor component
│   │   └── RoomJoin.tsx        # Room joining interface
│   ├── hooks/
│   │   └── useSocket.ts        # Socket.IO hook
│   ├── App.tsx                 # Main app component
│   └── main.tsx               # App entry point
├── server/
│   └── index.js               # Express + Socket.IO server
├── package.json
└── README.md
```

## ▶️ Run Code (Beta)

Supports JavaScript, Python, Java, and C++:
- Click the Run button in the editor header to execute the current code.
- Results (stdout/stderr, exit code, time) are shown in the Output panel and broadcast to all users in the room.
- Safety limits: 5s timeout and 64KB output cap.
- Requirements: Python (python or py), Java (javac/java), C++ compiler (g++ or clang++). Ensure these are installed and available on PATH.
- Java/C++: provide a full program with an entry point (public class Main for Java; int main() for C++).
- Note: This runs code on the server process (no OS sandbox). Do not expose this to untrusted users without isolation.

## 🎯 How It Works

### Room Management
- Users create or join rooms using unique room IDs
- Each room maintains its own code state and participant list
- Rooms are automatically cleaned up when empty

### Real-time Synchronization
- Code changes are debounced (300ms) to optimize network usage
- Socket.IO broadcasts changes to all participants in the room
- Conflict resolution ensures smooth collaborative editing

### Connection Handling
- Automatic reconnection on connection loss
- Visual indicators for connection status
- Error handling and user feedback

## 🔧 Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run client` - Start only the frontend development server
- `npm run server` - Start only the backend server
- `npm run build` - Build the frontend for production
- `npm run preview` - Preview the production build
- `npm run lint` - Run ESLint for code quality

## 🌐 API Endpoints

### Health Check
```
GET /api/health
```
Returns server status and statistics.

### Room Information
```
GET /api/rooms/:roomId
```
Get information about a specific room.

### Socket Events

### Client to Server
- `join-room` - Join a collaborative room
- `code-change` - Send code changes
- `language-change` - Change programming language
- `run-code` - Request code execution (payload: `{ roomId, code, language }`). Languages: javascript, python, java, cpp
- `ping` - Connection health check

### Server to Client
- `room-state` - Initial room state on join
- `code-update` - Code changes from other users
- `language-update` - Language changes
- `run-result` - Code execution result broadcast to the room (`{ stdout, stderr, exitCode, durationMs, initiatedBy, timedOut, outputTruncated }`)
- `user-joined` - New user joined the room
- `user-left` - User left the room
- `pong` - Health check response
- `error` - Error messages

## 🎨 Customization

### Adding New Languages
Edit the `languages` array in `CodeEditor.tsx`:

```typescript
const languages = [
  { value: 'javascript', label: 'JavaScript', icon: '🟨' },
  { value: 'your-language', label: 'Your Language', icon: '🔥' },
  // ... more languages
];
```

### Styling
The project uses Tailwind CSS. Customize the design by modifying the Tailwind classes in the components.

### Editor Configuration
Monaco Editor options can be customized in the `handleEditorDidMount` function in `CodeEditor.tsx`.

## 🚀 Deployment

### Frontend (Netlify/Vercel)
1. Build the project: `npm run build`
2. Deploy the `dist` folder to your hosting platform
3. Update the Socket.IO server URL in production

### Backend (Railway/Render/Heroku)
1. Deploy the server code to your platform
2. Set the `PORT` environment variable
3. Update CORS origins for your frontend domain

### Environment Variables
- `PORT` - Server port (default: 3001)
- `VITE_SERVER_URL` - Frontend env var to point to the Socket.IO server (defaults to http://localhost:3001)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Known Issues & Limitations

- Room data is stored in memory (use Redis for production)
- No user authentication (rooms are public)
- No persistent storage (code is lost when room is empty)
- Limited to text-based collaboration

## 🔮 Future Enhancements

- [ ] User authentication and profiles
- [ ] Persistent code storage with database
- [ ] File upload and project management
- [ ] Voice/video chat integration
- [ ] Multi-language code execution and preview (currently JavaScript only)
- [ ] Version control and history
- [ ] Cursor position sharing
- [ ] Collaborative debugging tools

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub or contact the development team.

---

Built with ❤️ using React, Monaco Editor, and Socket.IO