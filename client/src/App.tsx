import { useRoom } from './hooks/useRoom';
import Home from './pages/Home';
import WatchRoom from './pages/WatchRoom';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const { roomId, nickname, createRoom, joinRoom, leaveRoom } = useRoom();

  return (
    <div className="app">
      {roomId ? (
        <ErrorBoundary>
          <WatchRoom
            roomId={roomId}
            nickname={nickname}
            onLeave={leaveRoom}
          />
        </ErrorBoundary>
      ) : (
        <Home
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
        />
      )}
    </div>
  );
}

export default App;
