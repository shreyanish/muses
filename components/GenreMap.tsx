"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3-force';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  c: string;
  originalX?: number;
  originalY?: number;
  topArtists?: string[];
  features?: {
    Danceability?: number;
    Energy?: number;
    Acousticness?: number;
    Instrumentalness?: number;
    Valence?: number;
    Tempo?: number;
    Loudness?: number;
    Speechiness?: number;
  };
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  value: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

export default function GenreMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredGenre, setHoveredGenre] = useState<Node | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<Node | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [userTopArtists, setUserTopArtists] = useState<Set<string>>(new Set());
  const [userTopTracks, setUserTopTracks] = useState<Set<string>>(new Set());
  const [userGenres, setUserGenres] = useState<Set<string>>(new Set());
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [expandedArtists, setExpandedArtists] = useState<any[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [genreTracks, setGenreTracks] = useState<any[]>([]);
  const [genreRecommendations, setGenreRecommendations] = useState<any[]>([]);
  const [tasteProfile, setTasteProfile] = useState<any>(null);
  const [genreScoresMap, setGenreScoresMap] = useState<Map<string, number>>(new Map());

  // Social Comparison State
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [friendGenreScoresMap, setFriendGenreScoresMap] = useState<Map<string, number>>(new Map());
  const [comparisonMode, setComparisonMode] = useState(false);
  const [tasteMatchScore, setTasteMatchScore] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Graph state
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);

  // Transform state
  const transform = useRef({ x: 0, y: 0, scale: 0.1 });
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const draggedNode = useRef<Node | null>(null);

  // Robust sizing
  useEffect(() => {
    setIsClient(true);
    if (!containerRef.current || !canvasRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (canvasRef.current) {
          canvasRef.current.width = entry.contentRect.width;
          canvasRef.current.height = entry.contentRect.height;
          console.log(`Canvas resized to: ${canvasRef.current.width}x${canvasRef.current.height}`);
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;

    fetch('/genres.json')
      .then(res => res.json())
      .then((data: GraphData) => {
        console.log(`Loaded ${data.nodes.length} nodes and ${data.links.length} links`);

        data.nodes.forEach(n => {
          n.originalX = n.x;
          n.originalY = n.y;
          n.x = n.originalX;
          n.y = n.originalY;
        });

        nodesRef.current = data.nodes;
        linksRef.current = data.links;

        // Initialize D3 Simulation
        const simulation = d3.forceSimulation<Node>(nodesRef.current)
          .force("link", d3.forceLink<Node, Link>(linksRef.current).id(d => d.id).distance(40).strength(0.15))
          .force("charge", d3.forceManyBody().strength(-40))
          .force("x", d3.forceX<Node>().x(d => d.originalX ?? 500).strength(0.6))
          .force("y", d3.forceY<Node>().y(d => d.originalY ?? 500).strength(0.6))
          .velocityDecay(0.4);

        simulationRef.current = simulation;

        // Accurate centering (now 0-1000)
        const centerX = 500;
        const centerY = 500;

        const initialScale = Math.min(
          window.innerWidth / 1200,
          window.innerHeight / 1200
        );

        transform.current = {
          x: window.innerWidth / 2 - centerX * initialScale,
          y: window.innerHeight / 2 - centerY * initialScale,
          scale: initialScale
        };

        setLoading(false);
      });

    return () => {
      simulationRef.current?.stop();
    };
  }, [isClient]);

  // Handle Spotify Auth redirect/callback and persistence
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (code) {
        console.log("DEBUG: Authorization code found. Swapping for token...");
        swapCodeForToken(code);
        // Clean URL
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } else if (error) {
        console.error("DEBUG: Spotify returned an error:", error);
        alert(`Spotify Connection Error: ${error}`);
      }
      else {
        const storedToken = localStorage.getItem('spotify_access_token');
        if (storedToken) {
          setAccessToken(storedToken);
          const storedRefresh = localStorage.getItem('spotify_refresh_token');
          if (storedRefresh) {
            setRefreshToken(storedRefresh);
          }

          // Load stored taste profile if available
          const storedProfile = localStorage.getItem('user_taste_profile');
          if (storedProfile) {
            try {
              const profile = JSON.parse(storedProfile);
              setTasteProfile(profile);

              // Recreate genre scores map
              const scoresMap = new Map<string, number>();
              if (profile.genreScores) {
                profile.genreScores.forEach((item: any) => {
                  scoresMap.set(item.genre, item.score);
                });
              }
              setGenreScoresMap(scoresMap);
            } catch (err) {
              console.error("Failed to parse stored taste profile:", err);
            }
          }

          fetchUserTopArtists(storedToken);
        }
      }
    }
  }, []);

  const swapCodeForToken = async (code: string) => {
    const REDIRECT_URI = window.location.origin.replace('localhost', '127.0.0.1');
    try {
      const response = await fetch('/api/spotify/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
      });
      const data = await response.json();
      if (data.access_token) {
        setAccessToken(data.access_token);
        if (data.refresh_token) {
          setRefreshToken(data.refresh_token);
        }
        localStorage.setItem('spotify_access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('spotify_refresh_token', data.refresh_token);
        }

        // Build and save taste profile
        await buildAndSaveTasteProfile(data.access_token, data.refresh_token);

        fetchUserTopArtists(data.access_token);
        setShowLoginPrompt(false);
      } else {
        console.error("DEBUG: Token swap failed:", data);
        alert(`Swap failed: ${data.error_description || data.error}`);
      }
    } catch (err) {
      console.error("DEBUG: Error calling swap API:", err);
    }
  };

  const handleLogout = () => {
    // Clear state
    setAccessToken(null);
    setRefreshToken(null);
    setTasteProfile(null);
    setUserTopArtists(new Set());
    setUserTopTracks(new Set());
    setUserGenres(new Set());
    setShowUserMenu(false);

    // Clear storage
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_code_verifier');

    // Redirect to home to clear URL params if any
    window.location.href = window.location.origin;
  };

  // Automatically fetch expanded artists when a genre is selected if authenticated
  useEffect(() => {
    if (accessToken && selectedGenre) {
      exploreMoreArtists();
    } else {
      setExpandedArtists([]);
    }
  }, [selectedGenre, accessToken]);

  // Handle Social Comparison Link
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const compareUserId = urlParams.get('compare');

      if (compareUserId) {
        console.log("👥 Converting to comparison mode with user:", compareUserId);
        setComparisonMode(true);

        // Fetch friend's profile
        fetch(`/api/taste-profile/get?userId=${compareUserId}`)
          .then(res => {
            if (!res.ok) throw new Error("Friend profile not found");
            return res.json();
          })
          .then(profile => {
            console.log("✅ Friend profile loaded:", profile);
            setFriendProfile(profile);

            // Create map for friend scores
            const fMap = new Map<string, number>();
            if (profile.genreScores) {
              profile.genreScores.forEach((g: any) => fMap.set(g.genre, g.score));
            }
            setFriendGenreScoresMap(fMap);

            // Calculate taste match score (simple overlap algorithm)
            if (tasteProfile?.genreScores) {
              // Get set of all unique genres
              const allGenres = new Set([...genreScoresMap.keys(), ...fMap.keys()]);
              let overlapScore = 0;
              let totalWeight = 0;

              allGenres.forEach(genre => {
                const uScore = genreScoresMap.get(genre) || 0;
                const fScore = fMap.get(genre) || 0;
                // Add minimum score (intersection)
                overlapScore += Math.min(uScore, fScore);
                // Add maximum score (union)
                totalWeight += Math.max(uScore, fScore);
              });

              const match = totalWeight > 0 ? (overlapScore / totalWeight) * 100 : 0;
              setTasteMatchScore(Math.round(match));
            }
          })
          .catch(err => {
            console.error("Failed to load comparison profile:", err);
            // Optional: show toast/alert
          });
      }
    }
  }, [tasteProfile]); // Re-run when OUR profile loads to calc match score

  // Fetch genre-specific tracks and recommendations when a genre is selected
  useEffect(() => {
    if (accessToken && selectedGenre) {
      fetchGenreTracks(selectedGenre.id);
      fetchGenreRecommendations(selectedGenre.id);
    } else {
      setGenreTracks([]);
      setGenreRecommendations([]);
    }
  }, [selectedGenre, accessToken]);

  const fetchUserTopArtists = async (token: string) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/top/artists?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.items) {
        setUserTopArtists(new Set(data.items.map((a: any) => a.name)));
      }
    } catch (err) {
      console.error("Failed to fetch top artists", err);
    }
  };

  const buildAndSaveTasteProfile = async (accessToken: string, refreshToken?: string) => {
    try {
      console.log("🎵 Building taste profile from Spotify data...");
      const response = await fetch('/api/spotify/taste-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          refreshToken,
          timeRange: 'medium_term'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("❌ Taste profile API error:", error);
        throw new Error(`Failed to build taste profile: ${response.statusText}`);
      }

      const profile = await response.json();
      console.log("✅ Taste profile created:", profile);
      console.log("📊 Genre scores count:", profile.genreScores?.length || 0);
      console.log("🎯 Top genres:", profile.topGenres);

      // Store the profile locally for immediate use
      setTasteProfile(profile);

      // Create a genre scores map for quick lookup
      const scoresMap = new Map<string, number>();
      if (profile.genreScores) {
        profile.genreScores.forEach((item: any) => {
          scoresMap.set(item.genre, item.score);
        });
      }
      console.log("📍 Genre scores map size:", scoresMap.size);
      console.log("🔝 Top 5 scored genres:", Array.from(scoresMap.entries()).slice(0, 5));
      setGenreScoresMap(scoresMap);

      localStorage.setItem('user_taste_profile', JSON.stringify(profile));
      console.log("💾 Taste profile saved to localStorage");

      // Extract user genres for highlighting
      if (profile.topGenres && profile.topGenres.length > 0) {
        const genres = new Set<string>(profile.topGenres);
        console.log("🎨 User genres extracted for highlighting:", genres.size);
        setUserGenres(genres);
      }

      // Extract user top track IDs for personalized recommendations
      if (profile.topTrackIds && profile.topTrackIds.length > 0) {
        const trackIds = new Set<string>(profile.topTrackIds);
        console.log("🎵 User track IDs extracted for recommendations:", trackIds.size);
        setUserTopTracks(trackIds);
      }
    } catch (err) {
      console.error("❌ Error building taste profile:", err);
    }
  };

  const handleSpotifyLogin = () => {
    const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;

    if (!CLIENT_ID || CLIENT_ID === "YOUR_CLIENT_ID") {
      alert("CRITICAL ERROR: Spotify Client ID not found. \n\n1. Check your .env.local file. \n2. RESTART your terminal (npm run dev) to load the new ID.");
      return;
    }

    const REDIRECT_URI = window.location.origin.replace('localhost', '127.0.0.1');
    const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
    const RESPONSE_TYPE = "code";
    const SCOPES = "user-top-read";

    const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=${RESPONSE_TYPE}&scope=${SCOPES}`;

    window.location.href = authUrl;
  };

  const handleSpotifyLogout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('user_taste_profile');
    setUserTopArtists(new Set());
    setTasteProfile(null);
    setGenreScoresMap(new Map());
    setExpandedArtists([]);
  };

  const exploreMoreArtists = async () => {
    if (!accessToken) {
      setShowLoginPrompt(true);
      return;
    }

    if (!selectedGenre) return;

    setIsExpanding(true);
    console.log(`Searching Spotify for genre: "${selectedGenre.id}"`);
    try {
      const response = await fetch(`https://api.spotify.com/v1/search?q=genre:"${encodeURIComponent(selectedGenre.id)}"&type=artist&limit=30`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        console.warn(`Search failed for genre ${selectedGenre.id}: ${response.statusText}`);
        setExpandedArtists([]);
        return;
      }

      const data = await response.json();
      setExpandedArtists(data.artists?.items || []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsExpanding(false);
    }
  };

  const fetchGenreTracks = async (genre: string) => {
    if (!accessToken) return;

    // Helper to fetch generic tracks (fallback)
    const fetchGenericTracks = async () => {
      try {
        const response = await fetch(
          `https://api.spotify.com/v1/search?q=genre:"${encodeURIComponent(genre)}"&type=track&limit=10`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
          console.warn(`Generic search failed for genre ${genre}: ${response.statusText}`);
          setGenreTracks([]);
          return;
        }

        const data = await response.json();
        setGenreTracks(data.tracks?.items || []);
      } catch (err) {
        console.error("Failed to fetch generic tracks:", err);
        setGenreTracks([]);
      }
    };

    try {
      // Build personalized recommendations using BOTH genre and user's top tracks
      const trackSeedIds = Array.from(userTopTracks).slice(0, 5).join(',');

      let url = `https://api.spotify.com/v1/recommendations?seed_genres=${encodeURIComponent(genre)}&limit=10`;

      // Add user's tracks as seeds if available for better personalization
      if (trackSeedIds) {
        url += `&seed_tracks=${trackSeedIds}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        // Fallback to generic search if recommendation fails (e.g. invalid genre seed)
        console.warn(`Personalized recs failed (${response.status}), falling back to search for ${genre}`);
        await fetchGenericTracks();
        return;
      }

      const data = await response.json();
      setGenreTracks(data.tracks || []);
    } catch (err) {
      console.error("Failed to fetch personalized tracks:", err);
      await fetchGenericTracks();
    }
  };

  const fetchGenreRecommendations = async (genre: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/recommendations?seed_genres=${encodeURIComponent(genre)}&limit=10`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        // Silently fail for invalid genre seeds to avoid console spam
        if (response.status !== 404) {
          console.warn(`Recommendations failed: ${response.status} ${response.statusText}`);
        }
        setGenreRecommendations([]);
        return;
      }

      const data = await response.json();
      setGenreRecommendations(data.tracks || []);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      setGenreRecommendations([]);
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    ctx.translate(transform.current.x, transform.current.y);
    ctx.scale(transform.current.scale, transform.current.scale);

    // Draw links
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1 / transform.current.scale;
    linksRef.current.forEach(link => {
      const s = link.source as Node;
      const t = link.target as Node;
      if (s.x !== undefined && s.y !== undefined && t.x !== undefined && t.y !== undefined) {
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
      }
    });
    ctx.stroke();

    // Draw nodes
    nodesRef.current.forEach(node => {
      const isMatch = searchQuery && node.id.toLowerCase().includes(searchQuery.toLowerCase());

      // Scores
      const userScore = genreScoresMap.get(node.id) || 0;
      const friendScore = comparisonMode ? (friendGenreScoresMap.get(node.id) || 0) : 0;

      // Relevance check (either user or friend likes it)
      const isUserRelevant = userScore > 0.1;
      const isFriendRelevant = friendScore > 0.1;
      const isRelevant = isUserRelevant || isFriendRelevant;

      // Dynamic radius and opacity
      let radius = 6;
      let opacity = 0.5;

      if (isMatch) {
        radius = 30;
        opacity = 1;
      } else if (isRelevant) {
        // Size based on maximum relevance
        const maxScore = Math.max(userScore, friendScore);
        radius = 8 + maxScore * 14; // Slightly larger for shared
        opacity = 0.6 + maxScore * 0.4;
      }

      // Color Logic for Comparison Mode
      let finalR, finalG, finalB;

      if (comparisonMode && isRelevant) {
        if (isUserRelevant && isFriendRelevant) {
          // SHARED TASTE -> Purple (Mix of Cyan and Red)
          // Approx #A855F7 (Purple 500)
          finalR = 168; finalG = 85; finalB = 247;
          opacity = 0.9;
          radius *= 1.2; // Pop shared nodes more
        } else if (isUserRelevant) {
          // USER UNIQUE -> Cyan
          // Approx #06b6d4 (Cyan 500)
          finalR = 6; finalG = 182; finalB = 212;
        } else {
          // FRIEND UNIQUE -> Strong Red
          // Approx #FF3232
          finalR = 255; finalG = 50; finalB = 50;
        }
      } else {
        // Standard Mode (inherit node color but brighten if relevant)
        const baseColor = node.c;
        const rgb = parseInt(baseColor.replace('#', ''), 16);
        let r = (rgb >> 16) & 255;
        let g = (rgb >> 8) & 255;
        let b = rgb & 255;

        const brightenFactor = isRelevant ? 1 + userScore * 0.5 : 1;
        finalR = Math.min(255, Math.round(r * brightenFactor));
        finalG = Math.min(255, Math.round(g * brightenFactor));
        finalB = Math.min(255, Math.round(b * brightenFactor));
      }

      // Grey out logic (applies to both modes)
      let finalOpacity = opacity;

      if ((accessToken || comparisonMode) && !isRelevant && !isMatch) {
        const grey = Math.round(finalR * 0.299 + finalG * 0.587 + finalB * 0.114);
        finalR = grey;
        finalG = grey;
        finalB = grey;
        finalOpacity = 0.1;
        radius = radius * 0.7;
      }

      const displayColor = `rgba(${finalR}, ${finalG}, ${finalB}, ${finalOpacity})`;

      ctx.fillStyle = displayColor;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius / transform.current.scale, 0, Math.PI * 2);
      ctx.fill();

      // Text rendering
      if (transform.current.scale > 0.4 || isMatch) {
        ctx.font = `${14 / transform.current.scale}px Inter, sans-serif`;
        ctx.textAlign = 'center';

        let textOpacity = 0.7;
        let textColor = `rgba(255, 255, 255, ${textOpacity})`;

        if (isRelevant) {
          textColor = `rgba(${finalR}, ${finalG}, ${finalB}, 1)`;
        } else if ((accessToken || comparisonMode) && !isMatch) {
          textOpacity = 0.2;
          textColor = `rgba(255, 255, 255, ${textOpacity})`;
        }

        ctx.fillStyle = textColor;
        ctx.fillText(node.id, node.x!, node.y! + (18 / transform.current.scale));
      }
    });

    ctx.restore();
  }, [loading, searchQuery, genreScoresMap, friendGenreScoresMap, comparisonMode, accessToken]);

  useEffect(() => {
    let rafId: number;
    const loop = () => {
      draw();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left - transform.current.x) / transform.current.scale;
    const mouseY = (e.clientY - rect.top - transform.current.y) / transform.current.scale;

    let found: Node | null = null;
    const threshold = 25 / transform.current.scale;
    for (const node of nodesRef.current) {
      const dist = Math.sqrt((node.x! - mouseX) ** 2 + (node.y! - mouseY) ** 2);
      if (dist < threshold) {
        found = node;
        break;
      }
    }

    if (found) {
      draggedNode.current = found;
      found.fx = found.x;
      found.fy = found.y;
      simulationRef.current?.alphaTarget(0.3).restart();
      setSelectedGenre(found); // Select on click
    } else {
      isDragging.current = true;
      setSelectedGenre(null); // Click away to deselect
    }

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (draggedNode.current) {
      draggedNode.current.fx! += dx / transform.current.scale;
      draggedNode.current.fy! += dy / transform.current.scale;
    } else if (isDragging.current) {
      transform.current.x += dx;
      transform.current.y += dy;
    } else {
      const mouseX = (e.clientX - rect.left - transform.current.x) / transform.current.scale;
      const mouseY = (e.clientY - rect.top - transform.current.y) / transform.current.scale;

      let found: Node | null = null;
      const threshold = 15 / transform.current.scale;
      for (const node of nodesRef.current) {
        if (node.x === undefined || node.y === undefined) continue;
        const dist = Math.sqrt((node.x - mouseX) ** 2 + (node.y - mouseY) ** 2);
        if (dist < threshold) {
          found = node;
          break;
        }
      }
      setHoveredGenre(found);
    }

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    if (draggedNode.current) {
      draggedNode.current.fx = null;
      draggedNode.current.fy = null;
      draggedNode.current = null;
      simulationRef.current?.alphaTarget(0);
    }
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const factor = Math.pow(1.15, -e.deltaY / 100);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - transform.current.x) / transform.current.scale;
    const worldY = (mouseY - transform.current.y) / transform.current.scale;

    const newScale = Math.min(Math.max(transform.current.scale * factor, 0.0001), 20);

    transform.current.scale = newScale;
    transform.current.x = mouseX - worldX * newScale;
    transform.current.y = mouseY - worldY * newScale;
  };

  if (!isClient) return null;

  return (
    <div ref={containerRef} className="relative h-screen w-screen overflow-hidden bg-black font-sans text-white">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="cursor-crosshair w-full h-full block"
        suppressHydrationWarning
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
          <div className="text-center">
            <div className="text-4xl font-bold tracking-tighter animate-pulse mb-4 italic">GENRE MAP INITIALIZING...</div>
            <div className="text-zinc-500 text-xs uppercase tracking-[0.4em]">Loading {nodesRef.current.length || "5,453"} Universes</div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-8">
        <div className="pointer-events-auto flex items-start justify-between">
          <div className="glass-panel p-6 rounded-2xl bg-zinc-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl">
            <h1 className="text-5xl font-extrabold tracking-tighter bg-linear-to-b from-white via-white to-zinc-600 bg-clip-text text-transparent">Muses</h1>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.5em] mt-2 font-bold italic">Discover your taste</p>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="GENRE SEARCH..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-72 border-white/5 bg-zinc-900/60 px-6 py-3 text-xs tracking-widest backdrop-blur-xl focus:outline-none focus:ring-1 focus:ring-white/30 rounded-full transition-all hover:bg-zinc-800/60 placeholder:text-zinc-700 font-mono"
            />

            {/* User Profile / Login in Header */}
            {accessToken ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 pl-2 pr-4 py-1.5 bg-zinc-900/60 hover:bg-zinc-800/80 backdrop-blur-xl border border-white/5 rounded-full transition-all group"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-xs shadow-lg ring-2 ring-black group-hover:ring-white/20 transition-all">
                    {tasteProfile?.displayName ? tasteProfile.displayName[0].toUpperCase() : "U"}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-[10px] font-bold text-white group-hover:text-cyan-300 transition-colors truncate max-w-[100px]">
                      {tasteProfile?.displayName || "User"}
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-zinc-500 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                    <button
                      onClick={() => {
                        if (tasteProfile) {
                          const link = `${window.location.origin}?compare=${tasteProfile.userId}`;
                          navigator.clipboard.writeText(link);
                          setShowUserMenu(false);
                          alert("Link copied!");
                        }
                      }}
                      className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors border-b border-white/5"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                      </svg>
                      Share Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowLoginPrompt(true)}
                className="flex items-center gap-2 px-6 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-full transition-all shadow-[0_0_20px_rgba(29,185,84,0.3)] hover:shadow-[0_0_30px_rgba(29,185,84,0.5)]"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="black"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S17.627 0 12 0zm5.49 17.306c-.215.353-.674.463-1.026.248-2.846-1.738-6.427-2.13-10.647-1.168-.403.093-.813-.157-.905-.56-.092-.403.157-.813.56-.905 4.624-1.057 8.575-.61 11.77 1.343.352.215.462.674.248 1.026zm1.465-3.264c-.27.439-.844.58-1.284.31-3.257-2-8.223-2.583-12.073-1.414-.495.15-.494.15-.644-.344-.15-.494.15-.644-.643 4.397-1.334 9.873-.67 13.647 1.65.44.27.58.844.31 1.284zm.126-3.414c-3.906-2.32-10.334-2.533-14.075-1.397-.597.18-.596.18-.777-.417-.18-.597.18-.596.777-.777 4.298-1.304 11.404-1.053 15.93 1.631.54.32.71.1.39.64-.32.54-.1.71-.64.39z" /></svg>
                Connect Spotify
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="bg-zinc-900/60 p-8 backdrop-blur-2xl rounded-4xl border border-white/10 min-w-[320px] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-black mb-3">Exploring Universe</h3>
            <p className="text-3xl font-light tracking-tight text-zinc-100">{hoveredGenre ? hoveredGenre.id : (selectedGenre ? selectedGenre.id : "Deep Space")}</p>
            {(hoveredGenre || selectedGenre) && (
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)]" style={{ backgroundColor: (hoveredGenre || selectedGenre)!.c }} />
                  <span className="text-[10px] text-zinc-500 font-mono uppercase">{(hoveredGenre || selectedGenre)!.c}</span>
                </div>
                <div className="text-[9px] text-zinc-700 font-mono uppercase tracking-tighter">
                  x:{Math.round((hoveredGenre || selectedGenre)!.x!)} y:{Math.round((hoveredGenre || selectedGenre)!.y!)}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-6">
            {comparisonMode && friendProfile && (
              <div className="bg-zinc-900/60 p-4 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-xl">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold mb-3 text-right">Taste Map Legend</h3>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">You</span>
                    <div className="h-3 w-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] border border-cyan-400/50" />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">{friendProfile.displayName.split(' ')[0]}</span>
                    <div className="h-3 w-3 rounded-full bg-[#FF3232] shadow-[0_0_10px_rgba(255,50,50,0.5)] border border-red-500/50" />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Shared</span>
                    <div className="h-3 w-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] border border-purple-400/50" />
                  </div>
                </div>
              </div>
            )}

            <div className="text-right text-[10px] text-zinc-600 uppercase tracking-[0.2em] mb-4 font-black">
              Scroll to zoom <span className="mx-3 opacity-20">|</span> Drag nodes to interact <span className="mx-3 opacity-20">|</span> Click to explore
            </div>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedGenre && (
        <div className="absolute right-0 top-0 h-full w-100 bg-zinc-950/80 backdrop-blur-3xl border-l border-white/10 pl-10 pr-10 pt-10 overflow-y-auto z-40 animate-slide-in">
          <button
            onClick={() => setSelectedGenre(null)}
            className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>

          <header className="mb-10">
            <h2 className="text-5xl font-black tracking-tighter text-white mb-2 leading-none uppercase">{selectedGenre.id}</h2>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedGenre.c }} />
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">{selectedGenre.c}</span>
            </div>
          </header>

          <section className="mb-12">
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-black mb-6">Musical Profile</h3>
            <div className="space-y-4">
              {selectedGenre.features && Object.entries(selectedGenre.features).map(([key, val]) => (
                <div key={key}>
                  <div className="flex justify-between text-[10px] uppercase tracking-widest mb-2 font-bold">
                    <span className="text-zinc-400">{key}</span>
                    <span className="text-white font-mono">{typeof val === 'number' ? (key === 'Tempo' ? Math.round(val) : (val * 100).toFixed(0) + '%') : val}</span>
                  </div>
                  <div className="h-0.75 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-1000"
                      style={{
                        width: key === 'Tempo' ? `${((val as number) / 220) * 100}%` : (key === 'Loudness' ? `${(Math.abs(val as number) / 60) * 100}%` : `${(val as number) * 100}%`),
                        opacity: 0.3 + (Math.random() * 0.7)
                      }}
                    />
                  </div>
                </div>
              ))}
              {(!selectedGenre.features || Object.keys(selectedGenre.features).length === 0) && (
                <p className="text-zinc-700 text-xs italic">Awaiting further cosmic analysis...</p>
              )}
            </div>
          </section>

          {tasteProfile && (
            <section className="mb-12 p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 font-black mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Your Taste Match
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-zinc-400">Genre Relevance</span>
                    <span className="text-cyan-400 font-mono">{(((genreScoresMap.get(selectedGenre.id) || 0) * 100).toFixed(1))}%</span>
                  </div>
                  <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all duration-500"
                      style={{ width: `${(genreScoresMap.get(selectedGenre.id) || 0) * 100}%` }}
                    />
                  </div>
                </div>
                {tasteProfile.audioFeatures && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-[9px] text-zinc-500 mb-2 uppercase tracking-widest">Your Audio Profile</p>
                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Energy:</span>
                        <span className="text-cyan-300 font-mono">{(tasteProfile.audioFeatures.energy * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Danceability:</span>
                        <span className="text-cyan-300 font-mono">{(tasteProfile.audioFeatures.danceability * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Valence:</span>
                        <span className="text-cyan-300 font-mono">{(tasteProfile.audioFeatures.valence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Acousticness:</span>
                        <span className="text-cyan-300 font-mono">{(tasteProfile.audioFeatures.acousticness * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Artists Listened To (Personal & Social) - MOVED UP */}
          <div className="mb-12">
            {(() => {
              if (!selectedGenre) return null;
              const genreIdLower = selectedGenre.id.toLowerCase();

              // Improved matching for Spotify genres
              const isGenreMatch = (artistGenres: string[], target: string) => {
                if (!artistGenres) return false;
                return artistGenres.some(g => {
                  const gl = g.toLowerCase();
                  return gl === target || gl.includes(target) || target.includes(gl);
                });
              };

              const myArtists = tasteProfile?.topArtistsWithGenres?.filter((a: any) =>
                isGenreMatch(a.genres, genreIdLower)
              ) || [];

              const friendArtists = friendProfile?.topArtistsWithGenres?.filter((a: any) =>
                isGenreMatch(a.genres, genreIdLower)
              ) || [];

              const seenNames = new Set([
                ...myArtists.map((a: any) => a.name.toLowerCase()),
                ...friendArtists.map((a: any) => a.name.toLowerCase())
              ]);

              const newFromSearch = expandedArtists.filter(a => !seenNames.has(a.name.toLowerCase()));

              return (
                <div className="space-y-12">
                  {/* Your Artists */}
                  {myArtists.length > 0 && (
                    <section>
                      <h3 className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 font-black mb-6 flex items-center gap-2">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        Artists You Listen To
                      </h3>
                      <div className="space-y-3">
                        {myArtists.map((artist: any, i: number) => (
                          <div key={i} className="group flex items-center gap-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all">
                            {artist.images && artist.images[0]?.url ? (
                              <img src={artist.images[0].url} className="h-10 w-10 rounded-full object-cover shadow-2xl ring-2 ring-cyan-500/30" alt="" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-cyan-900/50 flex items-center justify-center text-cyan-300 font-bold text-xs ring-2 ring-cyan-500/30">
                                {artist.name[0]}
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="text-xs font-bold tracking-tight text-cyan-300">{artist.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-cyan-600 uppercase tracking-widest">
                                  {artist.popularity ? `Pop: ${Math.round(artist.popularity)}` : 'Top Artist'}
                                </span>
                                <div className="px-1.5 py-0.5 bg-cyan-500/30 text-cyan-300 text-[7px] font-black uppercase tracking-widest rounded-sm">Your Radar</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Friend's Artists */}
                  {comparisonMode && friendProfile && friendArtists.length > 0 && (
                    <section>
                      <h3 className="text-[10px] uppercase tracking-[0.3em] text-[#FF3232] font-black mb-6 flex items-center gap-2">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                          <circle cx="12" cy="8" r="4" /><path d="M12 14c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
                        </svg>
                        {friendProfile.displayName.split(' ')[0]}'s Listened To
                      </h3>
                      <div className="space-y-3">
                        {friendArtists.map((artist: any, i: number) => (
                          <div key={i} className="group flex items-center gap-4 p-3 rounded-xl bg-[#FF3232]/10 border border-[#FF3232]/30 hover:bg-[#FF3232]/20 transition-all">
                            {artist.images && artist.images[0]?.url ? (
                              <img src={artist.images[0].url} className="h-10 w-10 rounded-full object-cover shadow-2xl ring-2 ring-red-500/30" alt="" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-red-950/50 flex items-center justify-center text-red-300 font-bold text-xs ring-2 ring-red-500/30">
                                {artist.name[0]}
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="text-xs font-bold tracking-tight text-red-300">{artist.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-red-600 uppercase tracking-widest">
                                  {artist.popularity ? `Pop: ${Math.round(artist.popularity)}` : 'Top Artist'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Search Discovery (Kept at bottom of artists block) */}
                  {accessToken && !isExpanding && newFromSearch.length > 0 && (
                    <section>
                      <h3 className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-black mb-6">Explore More {selectedGenre.id}</h3>
                      <div className="w-full space-y-3">
                        {newFromSearch.slice(0, 5).map((artist: any, i: number) => (
                          <div key={i} className="group flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:bg-white/10 transition-all">
                            {artist.images && artist.images[0]?.url ? (
                              <img src={artist.images[0].url} className="h-10 w-10 rounded-full object-cover shadow-2xl" alt="" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-zinc-500 font-bold text-xs">
                                {artist.name[0]}
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="text-xs font-bold tracking-tight text-zinc-300">{artist.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Loading State for Discovery */}
                  {isExpanding && (
                    <section>
                      <h3 className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-black mb-6">Loading Discovery...</h3>
                      <div className="flex flex-col gap-3">
                        {[1, 2, 3].map(i => (<div key={i} className="h-14 w-full bg-white/5 animate-pulse rounded-xl" />))}
                      </div>
                    </section>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Personalized Track Recommendations */}
          {accessToken && genreTracks.length > 0 && (
            <section className="mb-12">
              <h3 className="text-[10px] uppercase tracking-[0.3em] text-purple-400 font-black mb-2 flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                </svg>
                Recommended For You
              </h3>
              <p className="text-[9px] text-zinc-500 mb-4 italic">Based on your taste + {selectedGenre.id}</p>
              <div className="space-y-2">
                {genreTracks.slice(0, 5).map((track: any, i: number) => (
                  <div
                    key={i}
                    className="group flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                  >
                    {track.album?.images?.[0]?.url && (
                      <img src={track.album.images[0].url} className="h-10 w-10 rounded object-cover shadow-lg" alt="" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{track.name}</p>
                      <p className="text-[9px] text-zinc-500 truncate">
                        {track.artists?.map((a: any) => a.name).join(', ')}
                      </p>
                    </div>
                    {track.preview_url && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-white/10 hover:bg-white/20"
                        onClick={() => {
                          const audio = new Audio(track.preview_url);
                          audio.play();
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Discover More Like This (Recommendations) */}
          {accessToken && genreRecommendations.length > 0 && (
            <section className="mb-12">
              <h3 className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 font-black mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Discover More Like This
              </h3>
              <div className="space-y-2">
                {genreRecommendations.slice(0, 5).map((track: any, i: number) => (
                  <div
                    key={i}
                    className="group flex items-center gap-3 p-2 rounded-lg bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 transition-all"
                  >
                    {track.album?.images?.[0]?.url && (
                      <img src={track.album.images[0].url} className="h-10 w-10 rounded object-cover shadow-lg" alt="" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-cyan-300 truncate">{track.name}</p>
                      <p className="text-[9px] text-cyan-600 truncate">
                        {track.artists?.map((a: any) => a.name).join(', ')}
                      </p>
                    </div>
                    {track.preview_url && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30"
                        onClick={() => {
                          const audio = new Audio(track.preview_url);
                          audio.play();
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Share Button (Sticky Bottom) */}
          {accessToken && !comparisonMode && tasteProfile && (
            <div className="mt-auto pt-6 border-t border-white/10 sticky bottom-0 bg-zinc-950 z-50 pb-4 -mx-10 px-10 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
              <button
                onClick={() => {
                  const link = `${window.location.origin}?compare=${tasteProfile.userId}`;
                  navigator.clipboard.writeText(link);
                  alert("Link copied! Send it to a friend to compare tastes.");
                }}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group shadow-lg shadow-cyan-500/20"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                Share Your Taste
              </button>
            </div>
          )}
        </div>
      )}

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xl z-[100] p-6 text-center animate-in fade-in duration-300">
          <div className="max-w-md p-12 rounded-[3rem] bg-zinc-900 border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
            <div className="h-20 w-20 bg-[#1DB954]/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-[#1DB954]/20">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="#1DB954"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S17.627 0 12 0zm5.49 17.306c-.215.353-.674.463-1.026.248-2.846-1.738-6.427-2.13-10.647-1.168-.403.093-.813-.157-.905-.56-.092-.403.157-.813.56-.905 4.624-1.057 8.575-.61 11.77 1.343.352.215.462.674.248 1.026zm1.465-3.264c-.27.439-.844.58-1.284.31-3.257-2-8.223-2.583-12.073-1.414-.495.15-.494.15-.644-.344-.15-.494.15-.493.644-.643 4.397-1.334 9.873-.67 13.647 1.65.44.27.58.844.31 1.284zm.126-3.414c-3.906-2.32-10.334-2.533-14.075-1.397-.597.18-.596.18-.777-.417-.18-.597.18-.596.777-.777 4.298-1.304 11.404-1.053 15.93 1.631.54.32.71.1.39.64-.32.54-.1.71-.64.39z" /></svg>
            </div>
            <h2 className="text-3xl font-black tracking-tighter mb-4 text-white uppercase italic">Connect Intelligence</h2>
            <p className="text-zinc-500 text-xs mb-8 leading-relaxed uppercase tracking-widest">To reveal the truth beyond the dataset and see your own footprints in this genre, we need to bridge your Spotify consciousness.</p>
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={handleSpotifyLogin}
                className="w-full py-5 bg-[#1DB954] text-black font-black uppercase tracking-[0.3em] text-[10px] rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Sync with Spotify
              </button>
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="text-[10px] text-zinc-700 uppercase tracking-widest font-black hover:text-zinc-400 transition-colors"
              >
                Abort Protocol
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
