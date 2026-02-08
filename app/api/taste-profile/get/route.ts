import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Fetch profile from Convex
    // Note: We need to use the internal query since we're on the server
    // In a real production app, you might want a dedicated public query
    const profile = await convex.query(api.taste_profiles.getTasteProfile, { userId });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Return only public data for comparison
    const publicProfile = {
      userId: profile.userId,
      displayName: profile.displayName || "Unknown User",
      genreScores: profile.genreScores,
      selectedGenres: profile.selectedGenres,
      topArtists: profile.topArtists.slice(0, 10), // Limit artists
      audioFeatures: profile.audioFeaturesAverage,
      topArtistsWithGenres: profile.topArtistsWithGenres || [],
    };

    return NextResponse.json(publicProfile);
  } catch (error) {
    console.error("Error fetching friend profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
