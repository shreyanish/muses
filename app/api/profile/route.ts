import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const profile = await convex.query(api.taste_profiles.getTasteProfile, { userId });
    if (!profile) {
      return NextResponse.json({ error: "profile not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error("/api/profile error:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
