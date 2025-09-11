# `canClip` - Video & Audio Capture on Internet Computer

A modern web application for capturing, storing, and managing video and audio recordings on the Internet Computer (ICP) with user authentication via Internet Identity.

## Features

- 🔐 **Internet Identity Authentication** - Secure login using ICP's Internet Identity
- 📹 **Video Recording** - Capture high-quality video with camera access
- 🎤 **Audio Recording** - Record audio-only clips
- 💾 **Decentralized Storage** - Store media files on the Internet Computer
- 🎨 **Modern UI** - Beautiful, responsive interface with gradient designs
- 📱 **Mobile Friendly** - Works on desktop and mobile devices
- 🔄 **Real-time Preview** - Live preview during recording
- 📋 **Media Management** - View, play, and delete your recordings

## Tech Stack

- **Backend**: Motoko (Internet Computer)
- **Frontend**: React 18 + Vite
- **Authentication**: Internet Identity
- **Styling**: SCSS with modern CSS features
- **Icons**: Lucide React
- **Media**: WebRTC MediaRecorder API

## Prerequisites

- Node.js (>=16.0.0)
- npm (>=7.0.0)
- DFX (Internet Computer SDK)
- A modern web browser with camera/microphone access

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd canClip
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd src/canClip_frontend
   npm install
   cd ../..
   ```

3. **Start the local Internet Computer replica**
   ```bash
   dfx start --background
   ```

4. **Deploy the canisters**
   ```bash
   dfx deploy
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

## Usage

### First Time Setup

1. Open your browser and navigate to `http://localhost:3000`
2. Click "Login with Internet Identity"
3. Follow the Internet Identity authentication flow
4. Grant camera/microphone permissions when prompted

### Recording Media

1. **Select Media Type**: Choose between Video or Audio recording
2. **Start Recording**: Click "Start Recording" to begin capture
3. **Stop Recording**: Click "Stop Recording" when finished
4. **Auto Upload**: Your recording will be automatically uploaded to the Internet Computer

### Managing Media

- **View Recordings**: All your recordings appear in the "Your Media" section
- **Play Media**: Click the play button to view/listen to recordings
- **Delete Media**: Click the trash button to remove recordings
- **File Info**: See file size, type, and creation date for each recording

## Project Structure

```
canClip/
├── src/
│   ├── canClip_backend/
│   │   └── main.mo              # Motoko backend with user auth & media storage
│   └── canClip_frontend/
│       ├── src/
│       │   ├── App.jsx          # Main React component
│       │   ├── main.jsx         # React entry point
│       │   └── index.scss       # Modern CSS styles
│       ├── public/
│       │   └── logo2.svg        # App logo
│       └── package.json         # Frontend dependencies
├── dfx.json                     # DFX configuration
└── package.json                 # Root package configuration
```

## Backend API

The Motoko backend provides the following functions:

### Authentication
- `authenticate()` - Authenticate user with Internet Identity
- `updateProfile(name, email)` - Update user profile information

### Media Management
- `uploadMedia(name, mediaType, data)` - Upload video/audio data
- `getUserMedia()` - Get all media for authenticated user
- `getMedia(mediaId)` - Get specific media item
- `deleteMedia(mediaId)` - Delete media item

### Utilities
- `getStorageStats()` - Get storage statistics

## Development

### Backend Development

The backend is written in Motoko and includes:
- User authentication and profile management
- Media storage with blob data support
- Stable storage for persistence across upgrades
- Error handling with Result types

### Frontend Development

The frontend is built with React and includes:
- Internet Identity authentication flow
- Media capture using WebRTC APIs
- Modern UI with responsive design
- Real-time media preview
- Media management interface

### Running in Development

```bash
# Terminal 1: Start IC replica
dfx start --background

# Terminal 2: Start frontend dev server
npm start
```

The app will be available at `http://localhost:3000`

## Deployment

### Local Deployment
```bash
dfx deploy
```

### Production Deployment
```bash
dfx deploy --network ic
```

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

**Note**: Camera and microphone access requires HTTPS in production.

## Troubleshooting

### Common Issues

1. **Camera/Microphone Access Denied**
   - Ensure you're using HTTPS in production
   - Check browser permissions
   - Try refreshing the page

2. **Internet Identity Login Issues**
   - Clear browser cache and cookies
   - Ensure you're using a supported browser
   - Check if the IC replica is running

3. **Media Upload Fails**
   - Check your internet connection
   - Ensure the canister has enough cycles
   - Try recording a shorter clip first

### Getting Help

- Check the [Internet Computer Documentation](https://internetcomputer.org/docs)
- Review the [Motoko Language Guide](https://internetcomputer.org/docs/current/motoko/main/motoko)
- Visit the [ICP Developer Community](https://forum.dfinity.org/)

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.