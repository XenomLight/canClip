import React, { useState, useEffect, useRef } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { canClip_backend } from 'declarations/canClip_backend';
import { Camera, Mic, MicOff, Video, VideoOff, Play, Pause, Download, Trash2, User, LogOut } from 'lucide-react';
import './index.scss';

function App() {
  // Authentication state
  const [authClient, setAuthClient] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Media capture state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaType, setMediaType] = useState('video'); // 'video' or 'audio'
  const [mediaStream, setMediaStream] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [userMedia, setUserMedia] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // Initialize auth client
  useEffect(() => {
    const initAuth = async () => {
      const client = await AuthClient.create();
      setAuthClient(client);
      
      if (await client.isAuthenticated()) {
        setIsAuthenticated(true);
        await authenticateUser(client);
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // Authenticate user with backend
  const authenticateUser = async (client) => {
    try {
      const result = await canClip_backend.authenticate();
      if ('ok' in result) {
        setUser(result.ok.user);
        await loadUserMedia();
      }
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  };

  // Login function
  const login = async () => {
    try {
      await authClient.login({
        identityProvider: process.env.DFX_NETWORK === "ic" 
          ? "https://identity.ic0.app/#authorize"
          : `http://localhost:4943?canisterId=rdmx6-jaaaa-aaaaa-aaadq-cai`,
        onSuccess: async () => {
          setIsAuthenticated(true);
          await authenticateUser(authClient);
        },
      });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // Logout function
  const logout = async () => {
    await authClient.logout();
    setIsAuthenticated(false);
    setUser(null);
    setUserMedia([]);
  };

  // Start media capture
  const startCapture = async () => {
    try {
      const constraints = {
        video: mediaType === 'video' ? { width: 1280, height: 720 } : false,
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: mediaType === 'video' ? 'video/webm' : 'audio/webm'
      });

      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { 
          type: mediaType === 'video' ? 'video/webm' : 'audio/webm' 
        });
        await uploadMedia(blob);
        setRecordedChunks([]);
      };

      setMediaRecorder(recorder);
      setRecordedChunks(chunks);
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting capture:', error);
      alert('Error accessing camera/microphone. Please check permissions.');
    }
  };

  // Stop media capture
  const stopCapture = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setMediaStream(null);
  };

  // Upload media to backend
  const uploadMedia = async (blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const result = await canClip_backend.uploadMedia(
        `Recording_${Date.now()}`,
        mediaType,
        Array.from(uint8Array)
      );

      if ('ok' in result) {
        await loadUserMedia();
        alert('Media uploaded successfully!');
      } else {
        alert('Upload failed: ' + result.err);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    }
  };

  // Load user's media
  const loadUserMedia = async () => {
    try {
      const media = await canClip_backend.getUserMedia();
      setUserMedia(media);
    } catch (error) {
      console.error('Error loading media:', error);
    }
  };

  // Play media
  const playMedia = (mediaItem) => {
    const blob = new Blob([mediaItem.data], { 
      type: mediaItem.mediaType === 'video' ? 'video/webm' : 'audio/webm' 
    });
    const url = URL.createObjectURL(blob);
    
    if (mediaItem.mediaType === 'video') {
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.play();
        setIsPlaying(true);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Delete media
  const deleteMedia = async (mediaId) => {
    if (window.confirm('Are you sure you want to delete this media?')) {
      try {
        const result = await canClip_backend.deleteMedia(mediaId);
        if ('ok' in result) {
          await loadUserMedia();
          alert('Media deleted successfully!');
        } else {
          alert('Delete failed: ' + result.err);
        }
      } catch (error) {
        console.error('Delete error:', error);
        alert('Delete failed: ' + error.message);
      }
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="login-container">
          <div className="login-card">
            <img src="/logo2.svg" alt="canClip Logo" className="logo" />
            <h1>canClip</h1>
            <p>Video & Audio Capture on Internet Computer</p>
            <button onClick={login} className="login-btn">
              <User size={20} />
              Login with Internet Identity
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>canClip</h1>
          <div className="user-info">
            <span>Welcome, {user?.name}</span>
            <button onClick={logout} className="logout-btn">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="capture-section">
          <h2>Capture Media</h2>
          
          <div className="media-type-selector">
            <button 
              className={mediaType === 'video' ? 'active' : ''}
              onClick={() => setMediaType('video')}
            >
              <Video size={20} />
              Video
            </button>
            <button 
              className={mediaType === 'audio' ? 'active' : ''}
              onClick={() => setMediaType('audio')}
            >
              <Mic size={20} />
              Audio
            </button>
          </div>

          <div className="capture-controls">
            {!isRecording ? (
              <button onClick={startCapture} className="capture-btn start">
                <Camera size={20} />
                Start Recording
              </button>
            ) : (
              <button onClick={stopCapture} className="capture-btn stop">
                <VideoOff size={20} />
                Stop Recording
              </button>
            )}
          </div>

          {mediaStream && (
            <div className="preview">
              {mediaType === 'video' ? (
                <video ref={videoRef} autoPlay muted className="preview-video" />
              ) : (
                <div className="audio-preview">
                  <Mic size={48} />
                  <p>Recording Audio...</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="media-section">
          <h2>Your Media</h2>
          
          {userMedia.length === 0 ? (
            <div className="empty-state">
              <Camera size={48} />
              <p>No media recorded yet. Start capturing to see your recordings here.</p>
            </div>
          ) : (
            <div className="media-grid">
              {userMedia.map((item) => (
                <div key={item.id} className="media-item">
                  <div className="media-preview">
                    {item.mediaType === 'video' ? (
                      <Video size={32} />
                    ) : (
                      <Mic size={32} />
                    )}
                  </div>
                  <div className="media-info">
                    <h3>{item.name}</h3>
                    <p>{item.mediaType} • {formatFileSize(item.size)}</p>
                    <p>{new Date(Number(item.createdAt) / 1000000).toLocaleDateString()}</p>
                  </div>
                  <div className="media-actions">
                    <button onClick={() => playMedia(item)} className="action-btn play">
                      <Play size={16} />
                    </button>
                    <button onClick={() => deleteMedia(item.id)} className="action-btn delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hidden video/audio elements for playback */}
        <video ref={videoRef} style={{ display: 'none' }} />
        <audio ref={audioRef} style={{ display: 'none' }} />
      </main>
    </div>
  );
}

export default App;
