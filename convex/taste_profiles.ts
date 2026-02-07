import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveTasteProfile = mutation({
  args: {
    userId: v.string(),
    displayName: v.optional(v.string()),
    spotifyRefreshToken: v.optional(v.string()),
    topArtists: v.array(v.string()),
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
    selectedGenres: v.array(v.string()),
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
        score: v.number(),
      })
    ),
    timeRange: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if profile already exists for this user
    const existing = await ctx.db
      .query("taste_profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing profile
      return await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        spotifyRefreshToken: args.spotifyRefreshToken || existing.spotifyRefreshToken,
        topArtists: args.topArtists,
        topArtistsWithGenres: args.topArtistsWithGenres,
        topTracks: args.topTracks,
        selectedGenres: args.selectedGenres,
        audioFeaturesAverage: args.audioFeaturesAverage,
        genreScores: args.genreScores,
        timeRange: args.timeRange,
        lastUpdated: now,
      });
    } else {
      // Create new profile
      return await ctx.db.insert("taste_profiles", {
        userId: args.userId,
        displayName: args.displayName,
        spotifyRefreshToken: args.spotifyRefreshToken,
        topArtists: args.topArtists,
        topArtistsWithGenres: args.topArtistsWithGenres,
        topTracks: args.topTracks,
        selectedGenres: args.selectedGenres,
        audioFeaturesAverage: args.audioFeaturesAverage,
        genreScores: args.genreScores,
        createdAt: now,
        lastUpdated: now,
        timeRange: args.timeRange,
      });
    }
  },
});

export const getTasteProfile = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taste_profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const getTasteProfileById = query({
  args: {
    id: v.id("taste_profiles"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const deleteTasteProfile = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("taste_profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (profile) {
      await ctx.db.delete(profile._id);
      return { success: true, deletedId: profile._id };
    }
    return { success: false };
  },
});
