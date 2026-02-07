# Spotify Personalization - Quick Start

## What You Built

A genre map that **personalizes to your music taste** using Spotify data:
- 🎵 Connects to your Spotify account
- 🎨 Analyzes your top 50 artists and tracks
- 🗺️ Matches your taste to Every Noise's 5,453 ultra-specific genres
- 📊 Visualizes your taste with larger, brighter nodes

## How to Test It Right Now

### 1️⃣ Start the Server
```bash
npm run dev
```
Wait for: `✓ Ready in 2s`

### 2️⃣ Open the App
Go to: **http://localhost:3000**

You should see a genre map with ~5,453 small white nodes.

### 3️⃣ Open Developer Console
Press: **F12** or **Cmd+Option+I** (Mac)
Go to: **Console** tab

### 4️⃣ Click "Connect with Spotify"
- You'll be redirected to Spotify login
- Log in with your Spotify account
- Click "Agree" to authorize the app
- You'll be redirected back

### 5️⃣ Watch the Console
You should see emoji-prefixed messages:
```
🎵 Building taste profile from Spotify data...
📊 Found 20-30 Spotify genres from user's top artists
🎯 Top 10 Spotify genres:
   indie (100%), pop (85%), indie pop (80%), ...
🗺️ Loaded 5453 genres from map
✅ Matched 15-25 genres to map
🎨 Top matched genres:
   indie pop (80%), bedroom pop (65%), dream pop (60%), ...
✅ Taste profile created: {...}
📍 Genre scores map size: 25
💾 Taste profile saved to localStorage
```

### 6️⃣ Observe the Visualization
The map should now show:
- **Larger nodes** for genres you listen to (2-3x bigger)
- **Brighter colors** for your favorite genres
- **Interactive panel** when you hover/click

## What's Happening Behind the Scenes

```
🎵 Your Spotify Account
   ↓ [OAuth 2.0]
📊 Top 50 Artists (with genres: indie, pop, rock, etc.)
   ↓ [API Request]
🎸 Top 50 Tracks
   ↓ [Audio Analysis]
📈 Average Audio Features (danceability, energy, valence, etc.)
   ↓ [Genre Matching Algorithm]
🗺️ Every Noise Genres (5,453 ultra-specific genres)
   ↓ [Fuzzy String Matching]
🎯 Matched Genres (dalarna indie, bedroom pop, indie rock, etc.)
   ↓ [Save to Database]
💾 Convex Database
   ↓ [Load in Frontend]
🎨 Canvas Visualization
   └─ Nodes scale: 6px → 20px based on your taste
```

## Understanding the Genre Matching

### Spotify Returns (Broad)
```
indie       ← Your #1 genre
pop         ← Your #2 genre
indie pop   ← Your #3 genre
```

### Every Noise Has (Ultra-Specific)
```
dalarna indie       ← matched from "indie" (0.8 similarity)
bedroom pop         ← matched from "pop" (0.8 similarity)
indie pop           ← exact match! (1.0 similarity)
australian classical piano  ← won't match anything (0% similarity)
```

### Result
When you listen to your top artists, those matched genres light up in the visualization!

## Interactive Features

### Hover Over a Genre
- Shows genre name
- Shows "Your taste match: X%"
- Highlights related genres

### Click a Genre
- Opens detail panel on the right
- Shows:
  - Your taste match percentage
  - Similar genres you like
  - Artists in that genre
  - Audio feature profile

### Search Box (top-left)
- Type genre name
- Highlights matching nodes
- Shows autocomplete suggestions

## Expected Behavior Timeline

| Time | What Happens |
|------|-------------|
| 0s | Click "Connect with Spotify" |
| 1-2s | Spotify login page appears |
| ~30s | You authorize & redirect back |
| 2-4s | Server processes your taste profile |
| ~1s | Visualization updates with personalization |
| Instant | Your taste profile persists in localStorage |

## If It's Not Working

### No console logs appearing?
- Check that you're seeing the console output
- Make sure you clicked "Connect with Spotify"
- Check if there are any error messages (red text)

### Console shows "Matched 0 genres"?
- Your Spotify account might not have enough listening history
- Try:
  - Opening Spotify and playing some music
  - Waiting a few hours for Spotify to update
  - Checking if you have >50 top artists

### Nodes not getting bigger?
- Check console for "Genre scores map size: X"
- If X = 0, the matching didn't work
- If X > 0, the visualization should be updating
- Try reloading the page

### Still not working?
Check the [TESTING_PERSONALIZATION.md](TESTING_PERSONALIZATION.md) file for detailed troubleshooting.

## Files Created/Modified

```
📁 /Users/shreyanish/muses/
├── 🆕 IMPLEMENTATION_COMPLETE.md (you are here)
├── 🆕 TESTING_PERSONALIZATION.md (detailed testing guide)
├── 🆕 IMPLEMENTATION_CHECKLIST.md (verification checklist)
├── app/api/spotify/taste-profile/route.ts (✏️ added genre matching)
├── lib/spotify-helpers.ts (✏️ added matching functions)
└── components/GenreMap.tsx (already had visualization)
```

## The Matching Algorithm Explained

### Level 1: Exact Match
```typescript
"indie" === "indie"  →  score: 1.0 ✅
```

### Level 2: Substring Match  
```typescript
"indie" in "dalarna indie"  →  score: 0.8 ✅
"pop" in "bedroom pop"      →  score: 0.8 ✅
```

### Level 3: Token Overlap
```typescript
"indie pop" vs "indie rock"
Tokens: ["indie", "pop"] vs ["indie", "rock"]
Match: "indie" ✅
Score: 1 / 2 = 0.5
```

### Threshold
Only matches with score > 0.2 (20%) are kept:
- Exact match (1.0) ✅ Always keeps
- Substring (0.8) ✅ Always keeps
- Token overlap > 0.2 ✅ Sometimes keeps
- Token overlap ≤ 0.2 ❌ Discards

This prevents false positives like "metal" matching to "metallica".

## What Gets Stored

### In Convex Database
- Your Spotify user ID
- Top artists and tracks
- Audio features profile
- **Top 20 matched genres** (selectedGenres)
- **Top 100 matched genres with scores** (genreScores)
- Audio analysis metrics

### In Browser localStorage
- Access token (for quick login)
- Refresh token (for future updates)
- Full taste profile (for offline use)

### In Visualization
- genreScoresMap: Map<genreName, score>
- Used to scale node size and color
- Persists across page reloads

## Next: Try It Out!

1. Open terminal: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Press F12 for console
4. Click "Connect with Spotify"
5. Watch the magic happen! ✨

Your genre map should now be uniquely **yours** — a visual representation of your music taste!

---

**Questions?** Check [TESTING_PERSONALIZATION.md](TESTING_PERSONALIZATION.md) for troubleshooting.
