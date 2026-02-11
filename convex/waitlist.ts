import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Add email to waitlist
export const addToWaitlist = mutation({
  args: {
    email: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      return { success: false, message: "Email already on waitlist" };
    }

    // Add to waitlist
    await ctx.db.insert("waitlist", {
      email: args.email,
      createdAt: Date.now(),
      source: args.source || "spotify_connect",
    });

    return { success: true, message: "Successfully added to waitlist" };
  },
});

// Check if user has an account (by checking if they have a taste profile)
export const hasAccount = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("taste_profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return !!profile;
  },
});
