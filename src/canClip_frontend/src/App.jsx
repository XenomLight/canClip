import React, { useState, useEffect, useRef } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { canClip_backend } from 'declarations/canClip_backend';
import { Camera, Mic, MicOff, Video, VideoOff, Play, Pause, Download, Trash2, User, LogOut } from 'lucide-react';
import Webcam from 'react-webcam';
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
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Refs
  const webcamRef = useRef(null);
  const playbackVideoRef = useRef(null);
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
          : `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943/`,
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

  // Start preview using react-webcam (video) or raw getUserMedia (audio)
  const startPreview = async () => {
    try {
      if (mediaType === 'video') {
        setIsPreviewing(true);
        // react-webcam will request stream on mount; capture the stream shortly after
        setTimeout(() => {
          const stream = webcamRef.current && webcamRef.current.stream;
          if (stream) {
            setMediaStream(stream);
          }
        }, 100);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setMediaStream(stream);
        setIsPreviewing(true);
      }
    } catch (error) {
      console.error('Error starting preview:', error);
      alert('Error accessing camera/microphone. Please check permissions.');
    }
  };

  const stopPreview = () => {
    if (isRecording) return; // don't stop preview while recording
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    setMediaStream(null);
    setIsPreviewing(false);
  };

  // Start media capture (uses existing preview stream if present)
  const startCapture = async () => {
    try {
      let stream = mediaStream;
      if (!stream) {
        await startPreview();
        stream = mediaStream;
      }
      // If still null, attempt to pull from webcamRef directly
      if (!stream && webcamRef.current && webcamRef.current.stream) {
        stream = webcamRef.current.stream;
        setMediaStream(stream);
      }
      if (!stream) {
        throw new Error('Preview stream not available');
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

  // Stop media capture (keeps preview on)
  const stopCapture = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  // Upload media to backend using chunks
  const uploadMedia = async (blob) => {
    try {
      const CHUNK_SIZE = 500000; // 500KB chunks
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Calculate chunk count
      const chunkCount = Math.ceil(uint8Array.length / CHUNK_SIZE);
      
      // Initialize media upload
      const initResult = await canClip_backend.uploadMediaInit(
        `Recording_${Date.now()}`,
        mediaType,
        chunkCount,
        CHUNK_SIZE,
        uint8Array.length
      );

      if ('err' in initResult) {
        alert('Upload initialization failed: ' + initResult.err);
        return;
      }

      const mediaId = initResult.ok;
      
      // Upload chunks
      for (let i = 0; i < chunkCount; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, uint8Array.length);
        const chunk = Array.from(uint8Array.slice(start, end));
        
        const chunkResult = await canClip_backend.uploadMediaChunk(
          mediaId,
          i,
          chunk
        );
        
        if ('err' in chunkResult) {
          alert(`Upload failed at chunk ${i}: ${chunkResult.err}`);
          return;
        }
      }

      await loadUserMedia();
      alert('Media uploaded successfully!');
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

  // Play media by fetching and reassembling chunks
  const playMedia = async (mediaItem) => {
    try {
      const chunks = [];
      
      // Fetch all chunks
      for (let i = 0; i < mediaItem.chunkCount; i++) {
        const chunkData = await canClip_backend.getMediaChunk(mediaItem.id, i);
        if (chunkData) {
          chunks.push(new Uint8Array(chunkData));
        } else {
          throw new Error(`Failed to fetch chunk ${i}`);
        }
      }
      
      // Reassemble the media
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const uint8Array = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        uint8Array.set(chunk, offset);
        offset += chunk.length;
      }
      
      const blob = new Blob([uint8Array], { 
        type: mediaItem.mediaType === 'video' ? 'video/webm' : 'audio/webm' 
      });
      const url = URL.createObjectURL(blob);
      
      if (mediaItem.mediaType === 'video') {
        if (playbackVideoRef.current) {
          playbackVideoRef.current.src = url;
          await playbackVideoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      } else {
        if (audioRef.current) {
          audioRef.current.src = url;
          await audioRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('Error playing media:', error);
      alert('Failed to play media: ' + error.message);
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

  const toNumber = (v) => (typeof v === 'bigint' ? Number(v) : v);
  // Format file size (handles BigInt)
  const formatFileSize = (bytesLike) => {
    const bytes = toNumber(bytesLike) ?? 0;
    if (bytes <= 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)) || 0);
    const value = bytes / Math.pow(k, i);
    return `${value.toFixed(2)} ${sizes[i]}`;
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

  const videoConstraints = { width: 1280, height: 720, facingMode: 'user' };

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
            {!isPreviewing ? (
              <button onClick={startPreview} className="capture-btn start">
                <Camera size={20} />
                Enable {mediaType === 'video' ? 'Camera' : 'Microphone'} Preview
              </button>
            ) : (
              <>
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
                {!isRecording && (
                  <button onClick={stopPreview} className="capture-btn stop" style={{ marginLeft: 10 }}>
                    <VideoOff size={20} />
                    Disable {mediaType === 'video' ? 'Camera' : 'Microphone'}
                  </button>
                )}
              </>
            )}
          </div>

          {isPreviewing && (
            <div className="preview">
              {mediaType === 'video' ? (
                <Webcam
                  ref={webcamRef}
                  audio={true}
                  muted
                  playsInline
                  className="preview-video"
                  videoConstraints={videoConstraints}
                  onUserMedia={(stream) => {
                    setMediaStream(stream);
                  }}
                  onUserMediaError={(e) => {
                    console.error('Webcam error', e);
                  }}
                />
              ) : (
                <div className="audio-preview">
                  <Mic size={48} />
                  <p>{isRecording ? 'Recording Audio...' : 'Microphone Enabled'}</p>
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
                    <p>{item.mediaType} • {formatFileSize(item.totalSize)}</p>
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
        <video ref={playbackVideoRef} style={{ display: 'none' }} />
        <audio ref={audioRef} style={{ display: 'none' }} />
      </main>
    </div>
  );
}

export default App;
