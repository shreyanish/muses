import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    // Generate dummy profile data
    const dummyProfile = {
      userId: "dummy-music-bot",
      displayName: "MusicBot 3000",
      spotifyRefreshToken: "dummy_token",
      topArtists: ["Daft Punk", "Justice", "Deadmau5", "Skrillex", "Disclosure"],
      topArtistsWithGenres: [
        { name: "Daft Punk", genres: ["electro", "filter house"], popularity: 85 },
        { name: "Justice", genres: ["electro house", "new rave"], popularity: 75 },
      ],
      topTracks: [
        { id: "1", name: "One More Time", artist: "Daft Punk" },
        { id: "2", name: "D.A.N.C.E.", artist: "Justice" },
      ],
      selectedGenres: ["electro", "filter house", "new rave", "edm", "pop"],
      audioFeaturesAverage: {
        danceability: 0.8,
        energy: 0.9,
        acousticness: 0.1,
        instrumentalness: 0.4,
        valence: 0.7,
        tempo: 128,
        loudness: -5,
        speechiness: 0.05,
      },
      timeRange: "medium_term",
      // Manually crafted genre scores for high overlap in electronic, low elsewhere
      genreScores: [
        { genre: "electro", score: 0.95 },
        { genre: "filter house", score: 0.9 },
        { genre: "new rave", score: 0.85 },
        { genre: "edm", score: 0.8 },
        { genre: "pop", score: 0.6 },
        { genre: "house", score: 0.75 },
        { genre: "techno", score: 0.7 },
        { genre: "dubstep", score: 0.65 },
        { genre: "drum and bass", score: 0.6 },
        { genre: "synthwave", score: 0.55 }
      ]
    };

    // Save to Convex
    console.log("Creating dummy user...");
    await convex.mutation(api.taste_profiles.saveTasteProfile, dummyProfile);

    return NextResponse.json({ 
      success: true, 
      message: "Dummy user created!",
      testLink: `${request.nextUrl.origin}/?compare=dummy-music-bot`
    });
  } catch (error) {
    console.error("Error seeding dummy user:", error);
    return NextResponse.json(
      { error: "Failed to seed dummy user" },
      { status: 500 }
    );
  }
}
