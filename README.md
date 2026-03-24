# RentGen Runner

A high-speed network runner game where you navigate twisted pair cables as a data packet. Dodge viruses and collect VPN nodes to survive!

## Features

- **High-speed gameplay**: Navigate through network cables at blazing speeds
- **Telegram WebApp integration**: Play directly in Telegram
- **Global leaderboard**: Compete with players worldwide using Firebase
- **Audio synthesis**: Dynamic music generated in real-time
- **Responsive design**: Works on desktop and mobile

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Backend**: Firebase Realtime Database for leaderboard
- **Deployment**: GitHub Pages
- **Audio**: Web Audio API with real-time synthesis

## Development

### Prerequisites

- Node.js (for local development server)

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Realtime Database
3. Set database rules to allow read/write:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Add Firebase secrets to GitHub repository:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_DATABASE_URL`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`

### Deployment

The game automatically deploys to GitHub Pages on every push to the main branch via GitHub Actions.

## Game Controls

- **Arrow Keys** or **WASD**: Move the data packet
- **Space**: Jump over obstacles
- **P**: Pause/Resume
- **M**: Toggle music
- **R**: Restart game

## Architecture

- `index.html`: Main HTML file with Firebase SDK imports
- `script.js`: Game logic, Firebase integration, audio synthesis
- `metadata.json`: Telegram WebApp metadata
- `.github/workflows/deploy.yml`: GitHub Actions deployment pipeline
