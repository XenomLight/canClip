import React, { useState, useEffect, useRef } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { canClip_backend } from 'declarations/canClip_backend';
import { Camera, Video, VideoOff, Play, Pause, Trash2, User, LogOut, X } from 'lucide-react';
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
  const [isPaused, setIsPaused] = useState(false);
  // Only video capture
  const [mediaStream, setMediaStream] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [userMedia, setUserMedia] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);  
  const [saveProgress, setSaveProgress] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');
  const [videoThumbnails, setVideoThumbnails] = useState({});
  // Custom active recording timer
  const [elapsed, setElapsed] = useState(0);
  const timerIdRef = useRef(null);

  // Refs
  const mediaRecorderRef = useRef(null);
  const modalVideoRef = useRef(null);
  const webcamRef = useRef(null);
  const playbackRef = useRef(null);
  const recorder = mediaRecorderRef.current;

  // Local playback for recorded video before upload
  const [showLocalPlayback, setShowLocalPlayback] = useState(false);
  // Removed audioRef

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

  // Custom timer effect for active recording time
  useEffect(() => {
    if (isRecording && !isPaused) {
      if (!timerIdRef.current) {
        timerIdRef.current = setInterval(() => {
          setElapsed((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
    }
    if (!isRecording) {
      setElapsed(0);
    }
    return () => {
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
    };
  }, [isRecording, isPaused]);

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

  // Start preview using react-webcam (video only)
  const startPreview = async () => {
    try {
      setIsPreviewing(true);
      setTimeout(() => {
        const stream = webcamRef.current && webcamRef.current.stream;
        if (stream) {
          setMediaStream(stream);
        }
      }, 100);
    } catch (error) {
      console.error('Error starting preview:', error);
      alert('Error accessing camera. Please check permissions.');
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

  // Start media capture (video only)
  const startCapture = async () => {
    try {
      let stream = mediaStream;
      if (!stream) {
        await startPreview();
        stream = webcamRef.current?.stream;
      }
      if (!stream) {
        throw new Error('Preview stream not available after startPreview');
      }
      setMediaStream(stream);

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm'
    });

    const chunks = [];
    recorder.ondataavailable = (event) => {
      console.log('ondataavailable fired:', event);
      if (event.data.size > 0) {
        chunks.push(event.data);
        console.log('Chunk pushed, size:', event.data.size, 'Total chunks:', chunks.length);
      }
    };

    recorder.onstop = async () => {
      console.log('MediaRecorder stopped. Chunks:', chunks.length);
      const blob = new Blob(chunks, { type: 'video/webm' });
      console.log('Created Blob for upload:', blob, 'Blob size:', blob.size);
      setRecordedChunks(chunks); // keep chunks for preview
      setIsSaving(false);
      setSaveProgress(0);
      setShowLocalPlayback(true); // open preview modal automatically
    };

      mediaRecorderRef.current = recorder;
      setRecordedChunks(chunks);
      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      
    } catch (error) {
      console.error('Error starting capture:', error);
      alert('Error accessing camera. Please check permissions.');
    }
  };

  // Stop media capture (keeps preview on)
  const stopCapture = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          if (mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
          }
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setIsPaused(false);
        setElapsed(0);
  };

  // Pause/Resume recording
  const togglePause = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  // Discard recording
  const discardRecording = () => {
  if (recorder && recorder.state === 'recording') {
    recorder.stop();
  }
    setRecordedChunks([]);
    setIsRecording(false);
    setIsPaused(false);
    setIsSaving(false);
    setElapsed(0);
  };

  // Set preview video src and play when modal opens and recordedChunks changes
  useEffect(() => {
    let url;
    if (showLocalPlayback && recordedChunks.length > 0 && playbackRef.current) {
      try {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        console.log('Preview Blob:', blob);
        const url = URL.createObjectURL(blob);
        console.log('Preview URL:', url);
        playbackRef.current.src = url;
        playbackRef.current.onplay = () => {
          console.log('Video started playing');
        };
        playbackRef.current.onerror = (e) => {
          console.error('Video playback error:', e);
          alert('Unable to play media. See console for details.');
        };
        playbackRef.current.load();
        playbackRef.current.play().catch((err) => {
          console.error('play() failed:', err);
          alert('Unable to play media. See console for details.');
        });
      } catch (err) {
        console.error('Error creating preview Blob:', err);
        alert('Unable to play media. See console for details.');
      }
    }
    return () => {
        if (url) {
            URL.revokeObjectURL(url);
        }
    };
  }, [showLocalPlayback, recordedChunks]);

  class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Playback error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <p>Something went wrong with playback.</p>;
    }

    return this.props.children;
  }
}

  // Upload video to backend using chunks
  const uploadMedia = async (blob) => {
    try {
      setIsSaving(true);

      const CHUNK_SIZE = 500000; // 500KB chunks
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const chunkCount = Math.ceil(uint8Array.length / CHUNK_SIZE);
      const initResult = await canClip_backend.uploadMediaInit(
        `Recording_${Date.now()}`,
        'video',
        chunkCount,
        CHUNK_SIZE,
        uint8Array.length
      );
      if ('err' in initResult) {
        alert('Upload initialization failed: ' + initResult.err);
        setIsSaving(false);
        return;
      }
      const mediaId = initResult.ok;
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
          setIsSaving(false);
          return;
        }
        const progress = Math.round(((i + 1) / chunkCount) * 100);
        setSaveProgress(progress);
      }
      await loadUserMedia();
      setIsSaving(false);
      setSaveProgress(0);
      alert('Video uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
      setIsSaving(false);
      setSaveProgress(0);
    }
  };

  // Load user's media
  const loadUserMedia = async () => {
    try {
      const media = await canClip_backend.getUserMedia();
      setUserMedia(media);
      
      // Generate thumbnails for video files
      for (const item of media) {
        if (item.mediaType === 'video' && !videoThumbnails[item.id]) {
          await generateVideoThumbnail(item);
        }
      }
    } catch (error) {
      console.error('Error loading media:', error);
    }
  };

  // Generate video thumbnail
  const generateVideoThumbnail = async (mediaItem) => {
    try {
      const chunks = [];
      
      // Fetch all chunks
      for (let i = 0; i < mediaItem.chunkCount; i++) {
        const chunkData = await canClip_backend.getMediaChunk(mediaItem.id, i);
        if (chunkData) {
          chunks.push(new Uint8Array(chunkData));
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
      
      const blob = new Blob([uint8Array], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      // Create video element to capture thumbnail
      const video = document.createElement('video');
      video.src = url;
      video.currentTime = 1; // Capture frame at 1 second
      
      video.onloadeddata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        setVideoThumbnails(prev => ({
          ...prev,
          [mediaItem.id]: thumbnailUrl
        }));
        
        URL.revokeObjectURL(url);
      };
    } catch (error) {
      console.error('Error generating thumbnail:', error);
    }
  };

  // Play video by fetching and reassembling chunks
const playMedia = async (mediaItem) => {
  console.log("--- Starting Media Playback ---"); // <-- ADD THIS
  console.log("Attempting to play media item:", mediaItem); // <-- ADD THIS

  try {
    const chunks = [];
    for (let i = 0; i < mediaItem.chunkCount; i++) {
      const chunkData = await canClip_backend.getMediaChunk(mediaItem.id, i);

      // Let's inspect the raw data from the backend
      console.log(`Chunk ${i} Data:`, chunkData); // <-- ADD THIS

      if (chunkData && chunkData.length > 0) { // Make the check more robust
        chunks.push(new Uint8Array(chunkData));
      } else {
        // This will tell us if a specific chunk failed to load
        console.error(`Failed to fetch or received empty chunk ${i}`); // <-- ADD THIS
        // You can choose to continue or throw an error
        // For now, let's log and continue
      }
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const uint8Array = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      uint8Array.set(chunk, offset);
      offset += chunk.length;
    }

    const blob = new Blob([uint8Array], { type: 'video/webm' });

    // Let's inspect the final file before trying to play it
    console.log("Final Blob for playback:", blob); // <-- ADD THIS

    // If the blob size is 0, there's no video data
    if (blob.size === 0) {
      throw new Error("Reassembled Blob is empty. Cannot play video.");
    }

    const url = URL.createObjectURL(blob);
    setCurrentVideoUrl(url);
    setShowVideoModal(true);
    setIsPlaying(true);

  } catch (error) {
    console.error('Error playing video:', error);
    alert('Failed to play video: ' + error.message);
  }
};

  // Close video modal
  const closeVideoModal = () => {
    setShowVideoModal(false);
    setCurrentVideoUrl('');
    setIsPlaying(false);
    if (currentVideoUrl) {
      URL.revokeObjectURL(currentVideoUrl);
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

  // Format recording time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  const videoConstraints = { width: 1920, height: 1080, facingMode: 'user' };

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
          
          {/* Only video capture, no media type selector */}
        <div className="capture-controls">
          {!isPreviewing ? (
            <button onClick={startPreview} className="capture-btn start">
              <Camera size={20} />
              Enable Camera Preview
            </button>
          ) : (
            <>
              {/* STATE 1: Ready to record */}
              {!isRecording && recordedChunks.length === 0 && (
                <button onClick={startCapture} className="capture-btn start">
                  <Camera size={20} />
                  Start Recording
                </button>
              )}

              {/* STATE 2: Actively recording */}
              {isRecording && (
                <div className="recording-controls">
                  <button onClick={stopCapture} className="capture-btn stop">
                    <VideoOff size={20} />
                    Stop
                  </button>
                  <button onClick={togglePause} className="capture-btn pause">
                    {isPaused ? <Play size={20} /> : <Pause size={20} />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                </div>
              )}

              {/* STATE 3: Post-recording (UI is now in the modal) */}
              {/* This section is intentionally left blank because the preview modal now handles all post-recording actions. */}

              {/* "Disable Camera" button should only appear when idle */}
              {!isRecording && recordedChunks.length === 0 && (
                <button onClick={stopPreview} className="capture-btn stop" style={{ marginLeft: 10 }}>
                  <VideoOff size={20} />
                  Disable Camera
                </button>
              )}
            </>
          )}
        </div>
        {/* Local Playback Modal for recorded video before upload */}
        {showLocalPlayback && (
          <div className="video-modal-overlay" onClick={() => setShowLocalPlayback(false)}>
            <div className="video-modal" onClick={e => e.stopPropagation()}>
              <div className="video-modal-header">
                <h3>Preview Recording</h3>
                <button onClick={() => { setShowLocalPlayback(false); discardRecording(); }} className="close-btn">
                  <X size={24} />
                </button>
              </div>
              <div className="video-modal-content">
                <ErrorBoundary>
                  <video
                    ref={playbackRef}
                    controls
                    autoPlay
                    style={{ width: '100%', maxHeight: '70vh', borderRadius: '8px', background: '#000' }}
                  />
                </ErrorBoundary>
                  <div className="modal-actions">
                  <button
                    className="capture-btn upload"
                    onClick={() => {
                      const blob = new Blob(recordedChunks, { type: 'video/webm' });
                      uploadMedia(blob);
                      setShowLocalPlayback(false); 
                      setRecordedChunks([]); 
                    }}
                  >
                    Upload
                  </button>
                  <button
                    className="capture-btn discard"
                    onClick={() => { discardRecording(); setShowLocalPlayback(false); }}
                  >
                    <Trash2 size={20} />
                    Discard & Re-record
                </button>
                </div>
              </div>

            </div>
          </div>
        )}

         {/* Recording status and timer */}
          {isRecording && (
            <div className="recording-status">
              <div className="recording-indicator">
                <div className="recording-dot"></div>
                <span>REC</span>
              </div>
              <div className="recording-timer">
                {formatTime(elapsed)}
              </div>
            </div>
          )}

          {/* Progress bar for saving */}
          {isSaving && (
            <div className="save-progress">
              <div className="progress-header">
                <span>Saving the video...</span>
                <span>{saveProgress}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${saveProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {isPreviewing && (
            <div className="preview">
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
                    {videoThumbnails[item.id] ? (
                      <img 
                        src={videoThumbnails[item.id]} 
                        alt="Video thumbnail" 
                        className="video-thumbnail"
                      />
                    ) : (
                      <div className="thumbnail-placeholder">
                        <Video size={32} />
                        <span>Loading...</span>
                      </div>
                    )}
                  </div>
                  <div className="media-info">
                    <h3>{item.name}</h3>
                    <p>video • {formatFileSize(item.totalSize)}</p>
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

  {/* Video Modal */}
        {showVideoModal && (
          <div className="video-modal-overlay" onClick={closeVideoModal}>
            <div className="video-modal" onClick={(e) => e.stopPropagation()}>
              <div className="video-modal-header">
                <h3>Video Player</h3>
                <button onClick={closeVideoModal} className="close-btn">
                  <X size={24} />
                </button>
              </div>
              <div className="video-modal-content">
                <video
                  ref={modalVideoRef}
                  src={currentVideoUrl}
                  controls
                  autoPlay
                  className="modal-video"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
