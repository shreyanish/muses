/**
 * Helper functions to fetch user's Spotify listening data for taste profile creation
 */

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images: Array<{ url: string }>;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
}

interface AudioFeatures {
  danceability: number;
  energy: number;
  acousticness: number;
  instrumentalness: number;
  valence: number;
  tempo: number;
  loudness: number;
  speechiness: number;
}

export async function fetchUserTopArtists(
  accessToken: string,
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term"
) {
  const response = await fetch(
    `https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=50`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch top artists: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items as SpotifyArtist[];
}

export async function fetchUserTopTracks(
  accessToken: string,
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term"
) {
  const response = await fetch(
    `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=50`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch top tracks: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items as SpotifyTrack[];
}

export async function fetchAudioFeatures(
  accessToken: string,
  trackIds: string[]
) {
  const url = `https://api.spotify.com/v1/audio-features?ids=${trackIds.join(",")}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    // Try to surface useful debugging information from Spotify
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch (e) {
      bodyText = `<unreadable body: ${String(e)}>`;
    }
    throw new Error(
      `Failed to fetch audio features: ${response.status} ${response.statusText} - ${bodyText}`
    );
  }

  const data = await response.json();
  return data.audio_features as (AudioFeatures | null)[];
}

export async function fetchCurrentUser(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch current user: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Calculate average audio features from a list of audio features
 */
export function calculateAverageAudioFeatures(
  features: (AudioFeatures | null)[]
): AudioFeatures {
  const validFeatures = features.filter((f) => f !== null) as AudioFeatures[];

  if (validFeatures.length === 0) {
    return {
      danceability: 0,
      energy: 0,
      acousticness: 0,
      instrumentalness: 0,
      valence: 0,
      tempo: 0,
      loudness: 0,
      speechiness: 0,
    };
  }

  const sum = validFeatures.reduce(
    (acc, feature) => ({
      danceability: acc.danceability + feature.danceability,
      energy: acc.energy + feature.energy,
      acousticness: acc.acousticness + feature.acousticness,
      instrumentalness: acc.instrumentalness + feature.instrumentalness,
      valence: acc.valence + feature.valence,
      tempo: acc.tempo + feature.tempo,
      loudness: acc.loudness + feature.loudness,
      speechiness: acc.speechiness + feature.speechiness,
    }),
    {
      danceability: 0,
      energy: 0,
      acousticness: 0,
      instrumentalness: 0,
      valence: 0,
      tempo: 0,
      loudness: 0,
      speechiness: 0,
    }
  );

  return {
    danceability: sum.danceability / validFeatures.length,
    energy: sum.energy / validFeatures.length,
    acousticness: sum.acousticness / validFeatures.length,
    instrumentalness: sum.instrumentalness / validFeatures.length,
    valence: sum.valence / validFeatures.length,
    tempo: sum.tempo / validFeatures.length,
    loudness: sum.loudness / validFeatures.length,
    speechiness: sum.speechiness / validFeatures.length,
  };
}

/**
 * Extract unique genres from user's top artists
 */
export function extractGenresFromArtists(
  artists: SpotifyArtist[]
): { genre: string; score: number }[] {
  const genreMap = new Map<string, number>();

  artists.forEach((artist) => {
    artist.genres.forEach((genre) => {
      const current = genreMap.get(genre) || 0;
      // Weight by artist popularity (normalized to 0-1)
      genreMap.set(genre, current + artist.popularity / 100);
    });
  });

  // Convert to sorted array and normalize scores
  const genres = Array.from(genreMap.entries())
    .map(([genre, score]) => ({ genre, score }))
    .sort((a, b) => b.score - a.score);

  const maxScore = genres[0]?.score || 1;
  return genres.map((g) => ({
    genre: g.genre,
    score: g.score / maxScore, // Normalize to 0-1
  }));
}

/**
 * Match Spotify genres to Every Noise genres via string similarity
 * This allows personalization to work with the genre map's specific genre names
 */
export function matchGenresToMapGenres(
  spotifyGenres: { genre: string; score: number }[],
  mapGenreNames: string[]
): { genre: string; score: number }[] {
  const matched: { genre: string; score: number }[] = [];
  const usedMapGenres = new Set<string>();

  // For each Spotify genre, find the best matching map genre
  spotifyGenres.forEach(({ genre: spotifyGenre, score }) => {
    let bestMatch = "";
    let bestSimilarity = 0;

    mapGenreNames.forEach((mapGenre) => {
      if (usedMapGenres.has(mapGenre)) return; // Skip already matched genres

      const similarity = calculateStringSimilarity(spotifyGenre, mapGenre);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = mapGenre;
      }
    });

    // Only match if there's meaningful similarity (>20%)
    if (bestMatch && bestSimilarity > 0.2) {
      matched.push({ genre: bestMatch, score });
      usedMapGenres.add(bestMatch);
    }
  });

  return matched;
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses a simple approach: substring matching and token overlap
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match (highest priority)
  if (s1 === s2) return 1;

  // Substring match
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Token-based similarity
  const tokens1 = s1.split(/[\s\-_]+/);
  const tokens2 = s2.split(/[\s\-_]+/);

  let matches = 0;
  tokens1.forEach((t1) => {
    if (tokens2.some((t2) => t1 === t2 || t1.startsWith(t2) || t2.startsWith(t1))) {
      matches++;
    }
  });

  if (matches === 0) return 0;

  return matches / Math.max(tokens1.length, tokens2.length);
}
