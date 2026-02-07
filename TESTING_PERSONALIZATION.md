# Testing Spotify Personalization

## What Was Fixed

The genre map personalization now works end-to-end:

1. **Genre Matching**: Spotify's broad genres (indie, pop, rock) are now matched to Every Noise's ultra-specific genres (dalarna indie, bedroom pop, indie rock) using fuzzy string matching
2. **Server-side Processing**: Genre matching happens on the server (app/api/spotify/taste-profile/route.ts) before saving to Convex database
3. **Frontend Visualization**: Matched genres populate the genreScoresMap, which scales node size and brightness based on your listening taste

## How to Test

### Step 1: Start the Development Server
```bash
npm run dev
```
The app will be available at http://localhost:3000

### Step 2: Open Browser Developer Tools
- Press `F12` or `Cmd+Option+I` (macOS)
- Go to Console tab
- Look for emoji-prefixed logs for debugging

### Step 3: Click "Connect with Spotify"
- You'll be redirected to Spotify login
- Authorize the app to access your top artists and top tracks
- You'll be redirected back to the app

### Step 4: Observe the Console Logs
You should see:
```
🎵 Building taste profile from Spotify data...
📊 Found 20-30 Spotify genres from user's top artists
🎯 Top 10 Spotify genres: [indie (100%), pop (85%), ...
🗺️ Loaded 5453 genres from map
✅ Matched 15-25 genres to map
🎨 Top matched genres: [dalarna indie (100%), indie pop (85%), ...
✅ Taste profile created: {...}
📊 Genre scores count: 25
🎯 Top genres: ["dalarna indie", "indie pop", "dream pop", ...]
📍 Genre scores map size: 25
🔝 Top 5 scored genres: [["dalarna indie", 1], ["indie pop", 0.85], ...]
💾 Taste profile saved to localStorage
```

### Step 5: Observe the Visualization
The genre map should now show:
- **Node Size**: Nodes for your favorite genres grow from 6px → 8-20px
  - Dalarna indie gets 20px (your top genre)
  - Bedroom pop gets 15px
  - Dream pop gets 12px
  - Unknown genres stay at 6px

- **Node Color**: Brightness increases for your favorite genres
  - Brightest: dalarna indie (1.5x brightness)
  - Bright: indie pop (1.35x brightness)
  - Normal: other genres

- **Detail Panel**: When you click a genre, you see:
  - "Your taste match: 95%" for dalarna indie
  - "Your taste match: 0%" for australian classical piano (you don't listen to it)

### Step 6: Verify Persistence
- Reload the page (Cmd+R or Ctrl+R)
- The personalization should remain the same
- Check localStorage in DevTools: Application → localStorage → user_taste_profile

## How It Works

### Architecture
```
Spotify OAuth
    ↓
/api/spotify/swap (exchange code for token)
    ↓
buildAndSaveTasteProfile() (frontend)
    ↓
/api/spotify/taste-profile (server)
    ├─ fetchUserTopArtists() [50 artists]
    ├─ fetchUserTopTracks() [50 tracks]
    ├─ extractGenresFromArtists() [Spotify genres]
    ├─ fetchMapGenreNames() [5453 Every Noise genres]
    ├─ matchGenresToMapGenres() [Match Spotify → Every Noise]
    └─ saveTasteProfile(Convex mutation)
    ↓
genreScoresMap populated in frontend
    ↓
Canvas draws nodes with scaled size/brightness
```

### Genre Matching Algorithm
1. **Token-based Similarity**: "indie rock" matches to "indie rock" (1.0)
2. **Substring Matching**: "indie" matches to "dalarna indie" (0.8)
3. **Token Overlap**: "indie pop" and "indie rock" share "indie" (0.5)
4. **Threshold**: Only matches with >20% similarity are kept

### Spotify Genres Returned
Typical top genres (from your favorite artists):
- indie (100%)
- pop (85%)
- indie pop (80%)
- indie rock (75%)
- alternative (70%)
- electronic (60%)
- etc.

### Matched Every Noise Genres
Maps to genres like:
- dalarna indie (matched from "indie")
- bedroom pop (matched from "pop")
- indie pop (exact match)
- indie rock (exact match)
- art rock (fuzzy match from "alternative")
- synth-pop (fuzzy match from "electronic")

## Troubleshooting

### Issue: No Spotify Genres Found
```
❌ Found 0 Spotify genres from user's top artists
```
**Fix**: Check that Spotify has data for your account. Try:
1. Play some music on Spotify (builds listening history)
2. Check Spotify app settings → Privacy
3. Ensure you have >50 top artists

### Issue: No Matches Found
```
✅ Matched 0 genres to map
```
**Fix**: The matching threshold might be too strict. Check:
1. Genre similarity scores in console
2. Adjust threshold in `lib/spotify-helpers.ts` line ~212: `if (bestMatch && bestSimilarity > 0.2)`
3. Try lowering to 0.1 for more matches

### Issue: Nodes Still Not Growing
```
📍 Genre scores map size: 0
```
**Fix**: 
1. Check if `/api/spotify/taste-profile` returned data
2. Verify `genreScores` array is in response
3. Check browser Network tab for API response body

### Issue: Convex Not Saving
Check Convex Dashboard at https://dashboard.convex.dev:
1. Go to your project: "decisive-gazelle-414"
2. View Data → taste_profiles
3. Verify new records are being inserted when you log in

## Expected Behavior After Login

- Map should show **visual difference** within 2 seconds of Spotify redirect
- Nodes for your taste should be **noticeably larger** (2-3x bigger)
- Color should be **brighter** for your taste
- Hovering over a genre shows "Your taste match: X%"
- Detail panel shows all audio features (danceability, energy, etc.)

## Code Locations
- Frontend visualization: [components/GenreMap.tsx](components/GenreMap.tsx#L370)
- Genre matching: [lib/spotify-helpers.ts](lib/spotify-helpers.ts#L187)
- API endpoint: [app/api/spotify/taste-profile/route.ts](app/api/spotify/taste-profile/route.ts#L70)
- Convex mutation: [convex/taste_profiles.ts](convex/taste_profiles.ts)
