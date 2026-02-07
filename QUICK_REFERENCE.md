# Quick Reference Guide - Personalized Genre Map

## File Structure

```
muses/
├── convex/                              # Backend functions & schema
│   ├── schema.ts                        # Taste profile data model
│   ├── taste_profiles.ts                # Mutations & queries
│   └── _generated/                      # Auto-generated types
├── lib/
│   └── spotify-helpers.ts               # Spotify API utilities
├── app/api/spotify/
│   ├── swap/route.ts                    # OAuth token exchange
│   └── taste-profile/route.ts           # Taste profile builder
├── components/
│   └── GenreMap.tsx                     # Main visualization + personalization
└── IMPLEMENTATION_SUMMARY.md            # Full documentation
```

## Key Files Modified/Created

### New Files
1. `/convex/schema.ts` - Database schema for taste profiles
2. `/convex/taste_profiles.ts` - Backend mutations & queries
3. `/lib/spotify-helpers.ts` - Spotify API utilities
4. `/app/api/spotify/taste-profile/route.ts` - Taste profile builder endpoint

### Modified Files
1. `/components/GenreMap.tsx` - Added personalization visualization
2. `package.json` - Added `convex` dependency

## API Quick Reference

### Build Taste Profile
```bash
POST /api/spotify/taste-profile
Content-Type: application/json

{
  "accessToken": "spotify_access_token",
  "refreshToken": "spotify_refresh_token",  // optional
  "timeRange": "medium_term"                // short_term | medium_term | long_term
}

Response:
{
  "success": true,
  "userId": "spotify_user_id",
  "topGenres": ["indie pop", "alternative", ...],
  "audioFeatures": { danceability, energy, ... },
  "genreScores": [{ genre, score }, ...]
}
```

### Convex Functions

**Save Profile**:
```typescript
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const saveProfile = useMutation(api.taste_profiles.saveTasteProfile);

await saveProfile({
  userId: "spotify_user_123",
  displayName: "John Doe",
  topArtists: ["artist1", "artist2", ...],
  audioFeaturesAverage: { ... },
  genreScores: [ ... ]
});
```

**Get Profile**:
```typescript
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const profile = useQuery(api.taste_profiles.getTasteProfile, {
  userId: "spotify_user_123"
});
```

## Data Flow Diagram

```
Spotify OAuth
     ↓
Token Swap (/api/spotify/swap)
     ↓
Build Taste Profile (/api/spotify/taste-profile)
     ├─→ Fetch top artists (genres)
     ├─→ Fetch top tracks (audio features)
     ├─→ Calculate average features
     ├─→ Score all genres
     └─→ Save to Convex DB
     ↓
Frontend (GenreMap.tsx)
     ├─→ Load taste profile
     ├─→ Map genre scores
     └─→ Render personalized visualization
```

## Personalization Logic

### Genre Relevance Score
```
For each genre:
  score = sum(artist.popularity / 100) for artists with genre
  score = normalized to 0-1 range
```

### Node Visualization
```typescript
// Size calculation
radius = isMatch ? 30 : (isRelevant ? 8 + score * 12 : 6)

// Color enhancement
const brightenFactor = 1 + score * 0.5
rgba(r * brightenFactor, g * brightenFactor, b * brightenFactor, opacity)

// Opacity
opacity = 0.5 + (isRelevant ? score * 0.4 : 0)
```

## Common Tasks

### Check User's Taste Profile in Convex
```bash
# Open Convex dashboard
https://dashboard.convex.dev/d/decisive-gazelle-414

# Query taste_profiles table
# Filter by userId to find user's profile
```

### Add New Spotify Scope
```typescript
// In GenreMap.tsx, handleSpotifyLogin()
const SCOPES = "user-top-read user-library-read";  // Add new scope

// In convex/schema.ts, update fields if needed
```

### Add New Audio Feature
```typescript
// In lib/spotify-helpers.ts
interface AudioFeatures {
  // Add new field
  newFeature: number;
}

// In convex/schema.ts
audioFeaturesAverage: v.object({
  // Add field
  newFeature: v.number(),
})
```

### Debug Taste Profile
```typescript
// In GenreMap.tsx
console.log("Taste Profile:", tasteProfile);
console.log("Genre Scores Map:", genreScoresMap);
console.log("Selected Genre Score:", genreScoresMap.get(selectedGenre.id));
```

## Environment Setup

```bash
# Install dependencies
npm install

# Initialize/update Convex
npx convex dev --once

# Start dev server
npm run dev

# Build for production
npm run build
```

## Performance Tips

1. **Genre Scores**: Cached in `genreScoresMap` Map for O(1) lookups
2. **Canvas Rendering**: Only redraws when state changes (requestAnimationFrame)
3. **localStorage**: Taste profile cached locally to avoid re-fetching
4. **Convex Indexes**: `by_userId` index for fast profile lookups

## Security Considerations

- ✅ Spotify tokens stored in localStorage (session-based)
- ✅ Refresh tokens optional but recommended for long-term access
- ✅ All Spotify API calls server-side via Next.js API routes
- ⚠️ TODO: Add rate limiting on taste-profile endpoint
- ⚠️ TODO: Hash/encrypt Spotify tokens before storing in Convex

## Troubleshooting

### "Property 'taste_profiles' does not exist"
→ Run `npx convex dev --once` to regenerate types

### Taste profile not showing
→ Check browser console for API errors
→ Verify Spotify access token is valid
→ Check Convex dashboard for database entries

### Genres not changing size
→ Verify `genreScoresMap` is populated
→ Check if genre name matches exactly (case-sensitive)
→ Ensure `tasteProfile` loaded from localStorage or API

### Canvas not rendering
→ Check if genres.json loaded successfully
→ Verify browser supports Canvas 2D API

---

Need more help? See IMPLEMENTATION_SUMMARY.md for full details!
