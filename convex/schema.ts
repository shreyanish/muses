import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  taste_profiles: defineTable({
    userId: v.string(), // Spotify user ID
    displayName: v.optional(v.string()),
    spotifyRefreshToken: v.optional(v.string()), // For long-term Spotify API access
    topArtists: v.array(v.string()), // Array of artist names
    topArtistsWithGenres: v.array(
      v.object({
        name: v.string(),
        genres: v.array(v.string()),
        popularity: v.number(),
      })
    ),
    topTracks: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        artist: v.string(),
      })
    ),
    selectedGenres: v.array(v.string()), // Genres user has interacted with
    audioFeaturesAverage: v.object({
      danceability: v.number(),
      energy: v.number(),
      acousticness: v.number(),
      instrumentalness: v.number(),
      valence: v.number(),
      tempo: v.number(),
      loudness: v.number(),
      speechiness: v.number(),
    }),
    genreScores: v.array(
      v.object({
        genre: v.string(),
        score: v.number(), // 0-1 relevance score based on user's listening
      })
    ),
    createdAt: v.number(), // Timestamp
    lastUpdated: v.number(),
    timeRange: v.optional(v.string()), // "short_term", "medium_term", "long_term"
  })
    .index("by_userId", ["userId"])
    .index("by_createdAt", ["createdAt"]),
  
  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
    source: v.optional(v.string()), // e.g., "spotify_connect", "landing_page"
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),
});
