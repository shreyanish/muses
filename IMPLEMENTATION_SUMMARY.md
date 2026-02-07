# Personalized Genre Map Implementation - Complete Setup

## Overview
You now have a fully functional backend that personalizes the genre map based on each user's Spotify listening taste. When users connect their Spotify account, their top tracks, artists, and audio features are analyzed to create a personalized taste profile stored in Convex.

## What Was Implemented

### 1. **Convex Backend Setup**
- **Database**: PostgreSQL-based with TypeScript-native API
- **Schema**: `taste_profiles` table with indexes on `userId` and `createdAt`
- **Location**: `/convex/` directory

**Data Model**:
```typescript
{
  userId: string;                    // Spotify user ID
  displayName: string;               // User's display name
  spotifyRefreshToken: string;       // For long-term API access
  topArtists: string[];              // Top 50 artist names
  topArtistsWithGenres: Array<{...}>; // Artists with their genres
  topTracks: Array<{...}>;           // Top 50 tracks
  selectedGenres: string[];          // Top 20 user genres
  audioFeaturesAverage: {...};       // Average music taste profile
  genreScores: Array<{genre, score}>; // All genres scored 0-1
  createdAt: number;
  lastUpdated: number;
  timeRange: string;                 // "short_term", "medium_term", "long_term"
}
```

### 2. **API Endpoints**

#### `/api/spotify/taste-profile` (POST)
Fetches user's Spotify data and creates a personalized taste profile.

**Request**:
```json
{
  "accessToken": "spotify_token",
  "refreshToken": "optional_refresh_token",
  "timeRange": "medium_term" // or "short_term", "long_term"
}
```

**Response**:
```json
{
  "success": true,
  "userId": "spotify_user_id",
  "displayName": "User Name",
  "genreCount": 5453,
  "topGenres": ["indie pop", "alternative", ...],
  "audioFeatures": {
    "danceability": 0.65,
    "energy": 0.72,
    "valence": 0.58,
    ...
  },
  "genreScores": [
    { "genre": "indie pop", "score": 0.95 },
    ...
  ]
}
```

### 3. **Convex Mutations & Queries**

**Mutations** (in `/convex/taste_profiles.ts`):
- `saveTasteProfile`: Creates or updates a user's taste profile
- `deleteTasteProfile`: Removes a user's profile

**Queries**:
- `getTasteProfile`: Fetch profile by userId
- `getTasteProfileById`: Fetch profile by database ID

### 4. **Helper Functions** (`/lib/spotify-helpers.ts`)

Spotify API utilities:
- `fetchUserTopArtists()` - Gets top 50 artists with genres
- `fetchUserTopTracks()` - Gets top 50 tracks
- `fetchAudioFeatures()` - Gets audio analysis for tracks
- `calculateAverageAudioFeatures()` - Computes user's taste vector
- `extractGenresFromArtists()` - Scores genres by user preference

### 5. **Frontend Integration** (GenreMap.tsx)

**New Features**:
1. **Dynamic Node Sizing**: Genre nodes grow in size based on how relevant they are to the user's taste (based on genre scores)
2. **Color Enhancement**: Genres the user listens to become brighter/more vibrant
3. **Taste Panel**: When a genre is selected, displays:
   - Genre relevance percentage
   - User's audio profile (energy, danceability, valence, acousticness)
   - Comparison with genre characteristics
4. **Session Persistence**: Taste profile stored in localStorage for quick reloads

**Authentication Flow**:
```
User clicks "Spotify Login"
   ↓
OAuth redirect to Spotify
   ↓
User authorizes app
   ↓
Token swap at /api/spotify/swap
   ↓
buildAndSaveTasteProfile() called
   ↓
Fetches top tracks/artists + audio features
   ↓
Saves to Convex database
   ↓
GenreMap visualizes with personalization
```

## How It Works

### Step-by-Step Data Flow

1. **User Authenticates**
   - User clicks "Connect Spotify" button
   - Redirected to Spotify OAuth consent screen
   - Authorization code returned to app

2. **Token Exchange**
   - App exchanges code for access/refresh tokens
   - Tokens stored in localStorage and Convex

3. **Taste Profile Creation**
   - Fetches user's top 50 artists → extracts genres
   - Fetches user's top 50 tracks
   - Gets audio features for all tracks
   - Calculates average audio features (taste vector)
   - Scores all ~5400 genres by relevance
   - Saves complete profile to Convex database

4. **Visualization Updates**
   - GenreMap reads taste scores from stored profile
   - Renders nodes:
     - **Size**: Proportional to genre relevance (8-20px radius)
     - **Brightness**: Increased for relevant genres
     - **Color**: Enhanced saturation for user's taste matches

5. **Interactive Panel**
   - When user clicks a genre, detail panel shows:
     - How relevant this genre is to their taste (%)
     - Their overall audio feature profile
     - Top artists in that genre (marked if in their listening history)

## Environment Variables

The following are automatically set by Convex during initialization:

```
NEXT_PUBLIC_CONVEX_URL=https://...convex.cloud
CONVEX_DEPLOYMENT=...
```

Ensure your `.env.local` has:
```
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://localhost:3000
```

## Key Features Enabled

✅ **Personalized Visualization**
- Node sizes reflect genre relevance
- Colors brighten for user's favorite genres
- Discover adjacent genres aligned with taste

✅ **Persistent User Data**
- Taste profiles saved in Convex database
- Accessible across sessions
- Can track taste evolution over time

✅ **Audio Feature Analysis**
- User's taste quantified (danceability, energy, valence, etc.)
- Compare with genre characteristics
- Understand your music DNA

✅ **Genre Scoring**
- All 5,453 genres ranked by relevance (0-1 scale)
- Weighted by artist popularity
- Used for discovery recommendations

## Future Enhancement Possibilities

1. **Taste Timeline**: Track how taste evolves over weeks/months
2. **Discovery Path**: Highlight adjacent genres to explore
3. **Playlist Generation**: Create playlists from top-relevant genres
4. **Taste Comparison**: Compare taste profiles with friends
5. **Smart Recommendations**: Suggest new artists based on taste vector
6. **Export/Share**: Share taste profile visualizations
7. **Real-time Sync**: Auto-refresh profile when listening changes

## Database Schema Details

### taste_profiles Table
```sql
CREATE TABLE taste_profiles (
  _id STRING PRIMARY KEY,
  userId STRING NOT NULL,
  displayName STRING,
  spotifyRefreshToken STRING,
  topArtists ARRAY<STRING>,
  topArtistsWithGenres ARRAY<{name, genres, popularity}>,
  topTracks ARRAY<{id, name, artist}>,
  selectedGenres ARRAY<STRING>,
  audioFeaturesAverage {
    danceability: FLOAT,
    energy: FLOAT,
    acousticness: FLOAT,
    instrumentalness: FLOAT,
    valence: FLOAT,
    tempo: FLOAT,
    loudness: FLOAT,
    speechiness: FLOAT
  },
  genreScores ARRAY<{genre: STRING, score: FLOAT}>,
  timeRange STRING,
  createdAt TIMESTAMP,
  lastUpdated TIMESTAMP,
  
  INDEX by_userId (userId),
  INDEX by_createdAt (createdAt)
);
```

## Testing the Implementation

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Open http://localhost:3000**

3. **Click "Connect Spotify"** and authorize

4. **Observe**:
   - Nodes grow/brighten for your favorite genres
   - Click a genre to see your taste match %
   - View your audio feature profile

5. **Try different time ranges** (in taste-profile endpoint):
   - `short_term`: Last 4 weeks
   - `medium_term`: Last 6 months (default)
   - `long_term`: All-time

## Architecture Benefits

- **TypeScript-First**: End-to-end type safety
- **Real-time Capable**: Convex supports live queries
- **Serverless**: No server management needed
- **Scalable**: Handles growth from 10 to 10M users
- **Persistent**: User data preserved across sessions
- **Fast**: Optimized indexes for quick lookups
- **Flexible**: Easy to extend with new features

---

**Status**: ✅ Fully implemented and tested. Ready for user testing!
