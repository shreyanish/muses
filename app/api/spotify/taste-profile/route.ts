import { NextRequest, NextResponse } from "next/server";
import {
  fetchUserTopArtists,
  fetchUserTopTracks,
  fetchAudioFeatures,
  fetchCurrentUser,
  calculateAverageAudioFeatures,
  extractGenresFromArtists,
  matchGenresToMapGenres,
} from "@/lib/spotify-helpers";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Fetch all genre names from the Every Noise genre map
 */
async function fetchMapGenreNames(): Promise<string[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || "http://localhost:3000"}/genres.json`);
    if (!response.ok) {
      console.warn("Could not fetch genres.json, using empty array");
      return [];
    }
    const data = await response.json();
    return data.nodes?.map((node: any) => node.id) || [];
  } catch (err) {
    console.warn("Error fetching genres.json:", err);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { accessToken, refreshToken, timeRange = "medium_term" } =
      await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token required" },
        { status: 400 }
      );
    }

    // Fetch user info
    const user = await fetchCurrentUser(accessToken);
    const userId = user.id;
    const displayName = user.display_name || user.email;

    // Fetch top artists (for genres and taste)
    const topArtists = await fetchUserTopArtists(accessToken, timeRange);
    const topArtistNames = topArtists.map((a) => a.name);
    const topArtistsWithGenres = topArtists.map((a) => ({
      name: a.name,
      genres: a.genres,
      popularity: a.popularity,
    }));

    // Fetch top tracks
    const topTracks = await fetchUserTopTracks(accessToken, timeRange);
    const topTrackIds = topTracks.map((t) => t.id);
    const topTracksFormatted = topTracks.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artists[0]?.name || "Unknown",
    }));

    // Fetch audio features for tracks (wrap in try/catch so we can still save a partial profile)
    let audioFeaturesList: (any | null)[] = [];
    let averageAudioFeatures = {
      danceability: 0,
      energy: 0,
      acousticness: 0,
      instrumentalness: 0,
      valence: 0,
      tempo: 0,
      loudness: 0,
      speechiness: 0,
    };

    try {
      audioFeaturesList = await fetchAudioFeatures(accessToken, topTrackIds);
      averageAudioFeatures = calculateAverageAudioFeatures(audioFeaturesList as any);
    } catch (err: any) {
      console.error("❌ Failed to fetch audio features:", err?.message || err);
      console.error("ℹ️ trackIds count:", topTrackIds.length, "sample:", topTrackIds.slice(0, 5));
      // Proceed with empty/default audio features so we can still save the profile
    }

    // Extract genres from artists
    let genreScores = extractGenresFromArtists(topArtists);
    console.log(`📊 Found ${genreScores.length} Spotify genres from user's top artists`);
    console.log(`🎯 Top 10 Spotify genres:`, genreScores.slice(0, 10).map(g => `${g.genre} (${(g.score * 100).toFixed(0)}%)`));

    // Match Spotify genres to Every Noise map genres
    const mapGenreNames = await fetchMapGenreNames();
    console.log(`🗺️ Loaded ${mapGenreNames.length} genres from map`);
    
    if (mapGenreNames.length > 0) {
      genreScores = matchGenresToMapGenres(genreScores, mapGenreNames);
      console.log(`✅ Matched ${genreScores.length} genres to map`);
      console.log(`🎨 Top matched genres:`, genreScores.slice(0, 10).map(g => `${g.genre} (${(g.score * 100).toFixed(0)}%)`));
    }

    // Save to Convex
    console.log(`💾 Saving taste profile for userId=${userId}, selectedGenres=${genreScores.slice(0,20).map(g=>g.genre).join(', ')}`);
    const result = await convex.mutation(api.taste_profiles.saveTasteProfile, {
      userId,
      displayName,
      spotifyRefreshToken: refreshToken,
      topArtists: topArtistNames,
      topArtistsWithGenres,
      topTracks: topTracksFormatted,
      selectedGenres: genreScores.slice(0, 20).map((g) => g.genre), // Top 20 genres
      audioFeaturesAverage: averageAudioFeatures,
      genreScores: genreScores.slice(0, 100), // Top 100 genres with scores
      timeRange,
    });
    console.log('✅ Convex save result:', result);

    return NextResponse.json({
      success: true,
      userId,
      displayName,
      genreCount: genreScores.length,
      topGenres: genreScores.slice(0, 10).map((g) => g.genre),
      audioFeatures: averageAudioFeatures,
      genreScores: genreScores.slice(0, 100),
    });
  } catch (error) {
    console.error("Error building taste profile:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to build taste profile",
      },
      { status: 500 }
    );
  }
}
