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
  const [expandedArtists, setExpandedArtists] = useState<any[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [tasteProfile, setTasteProfile] = useState<any>(null);
  const [genreScoresMap, setGenreScoresMap] = useState<Map<string, number>>(new Map());

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

  // Automatically fetch expanded artists when a genre is selected if authenticated
  useEffect(() => {
    if (accessToken && selectedGenre) {
      exploreMoreArtists();
    } else {
      setExpandedArtists([]);
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
      const response = await fetch(`https://api.spotify.com/v1/search?q=genre:"${selectedGenre.id}"&type=artist&limit=30`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      setExpandedArtists(data.artists.items || []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsExpanding(false);
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
      const genreScore = genreScoresMap.get(node.id) || 0; // 0-1 relevance score from user's taste
      const isRelevant = genreScore > 0.1; // Genre is relevant if score > 0.1

      // Dynamic radius based on search match or genre relevance
      let radius = 6;
      let opacity = 0.5;
      
      if (isMatch) {
        radius = 30;
        opacity = 1;
      } else if (isRelevant) {
        // Scale radius from 8 to 20 based on genre score
        radius = 8 + genreScore * 12;
        opacity = 0.6 + genreScore * 0.4;
      }

      // Base color with taste-based brightness adjustment
      const baseColor = node.c;
      const rgb = parseInt(baseColor.replace('#', ''), 16);
      const r = (rgb >> 16) & 255;
      const g = (rgb >> 8) & 255;
      const b = rgb & 255;
      
      // Brighten color if genre is relevant to user's taste
      const brightenFactor = isRelevant ? 1 + genreScore * 0.5 : 1;
      const brightR = Math.min(255, Math.round(r * brightenFactor));
      const brightG = Math.min(255, Math.round(g * brightenFactor));
      const brightB = Math.min(255, Math.round(b * brightenFactor));
      const displayColor = `rgba(${brightR}, ${brightG}, ${brightB}, ${opacity})`;

      ctx.fillStyle = displayColor;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius / transform.current.scale, 0, Math.PI * 2);
      ctx.fill();

      if (transform.current.scale > 0.4 || isMatch) {
        ctx.font = `${14 / transform.current.scale}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = isRelevant ? `rgba(${brightR}, ${brightG}, ${brightB}, 1)` : `rgba(255, 255, 255, 0.7)`;
        ctx.fillText(node.id, node.x!, node.y! + (18 / transform.current.scale));
      }
    });

    ctx.restore();
  }, [loading, searchQuery]);

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
            <h1 className="text-5xl font-extrabold tracking-tighter bg-linear-to-b from-white via-white to-zinc-600 bg-clip-text text-transparent">Every Noise</h1>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.5em] mt-2 font-bold italic">Interactive Physics Graph</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <input
              type="text"
              placeholder="GENRE SEARCH..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-72 border-white/5 bg-zinc-900/60 px-6 py-3 text-xs tracking-widest backdrop-blur-xl focus:outline-none focus:ring-1 focus:ring-white/30 rounded-full transition-all hover:bg-zinc-800/60 placeholder:text-zinc-700 font-mono"
            />
            {accessToken && (
              <button
                onClick={handleSpotifyLogout}
                className="text-[8px] uppercase tracking-[0.3em] text-zinc-600 hover:text-zinc-400 transition-colors mt-2 mr-4 font-bold"
              >
                Disconnect Spotify
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

          <div className="text-right text-[10px] text-zinc-600 uppercase tracking-[0.2em] mb-4 font-black">
            Scroll to zoom <span className="mx-3 opacity-20">|</span> Drag nodes to interact <span className="mx-3 opacity-20">|</span> Click to explore
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedGenre && (
        <div className="absolute right-0 top-0 h-full w-100 bg-zinc-950/80 backdrop-blur-3xl border-l border-white/10 p-10 overflow-y-auto z-40 animate-slide-in">
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
                        width: key === 'Tempo' ? `${(val as number / 220) * 100}%` : (key === 'Loudness' ? `${(Math.abs(val as number) / 60) * 100}%` : `${(val as number) * 100}%`),
                        opacity: 0.3 + (Math.random() * 0.7)
                      }}
                    />
                  </div>
                </div>
              ))}
              {!selectedGenre.features || Object.keys(selectedGenre.features).length === 0 && (
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

          <section>
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-black mb-6">
              {accessToken ? "Verified Spotify Artists" : "Static Historical Artists"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {!accessToken ? (
                selectedGenre.topArtists?.map((artist, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-[11px] text-zinc-300 transition-colors border border-white/5 font-medium"
                  >
                    {artist}
                  </span>
                ))
              ) : (
                <div className="w-full space-y-3">
                  {isExpanding ? (
                    <div className="flex flex-col gap-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-14 w-full bg-white/5 animate-pulse rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    expandedArtists.map((artist, i) => {
                      const hasListened = userTopArtists.has(artist.name);
                      return (
                        <div
                          key={i}
                          className={`group flex items-center gap-4 p-3 rounded-xl border border-white/5 transition-all ${hasListened ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-white/5 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'
                            }`}
                        >
                          {artist.images?.[0]?.url && (
                            <img src={artist.images[0].url} className="h-10 w-10 rounded-full object-cover shadow-2xl" alt="" />
                          )}
                          <div className="flex-1">
                            <p className={`text-xs font-bold tracking-tight ${hasListened ? 'text-cyan-400' : 'text-zinc-300'}`}>
                              {artist.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
                                Pop: {Math.round(artist.popularity)}
                              </p>
                              {hasListened && (
                                <div className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[7px] font-black uppercase tracking-widest rounded-sm border border-cyan-400/20">
                                  Your Radar
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {!accessToken && !selectedGenre.topArtists?.length && (
                <p className="text-zinc-700 text-xs italic">Exploring unknown creators...</p>
              )}
            </div>
          </section>

          {!accessToken && (
            <button
              onClick={() => setShowLoginPrompt(true)}
              className="w-full mt-10 py-4 bg-[#1DB954] text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-xl hover:bg-[#1ed760] transition-all flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(29,185,84,0.2)]"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="black"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S17.627 0 12 0zm5.49 17.306c-.215.353-.674.463-1.026.248-2.846-1.738-6.427-2.13-10.647-1.168-.403.093-.813-.157-.905-.56-.092-.403.157-.813.56-.905 4.624-1.057 8.575-.61 11.77 1.343.352.215.462.674.248 1.026zm1.465-3.264c-.27.439-.844.58-1.284.31-3.257-2-8.223-2.583-12.073-1.414-.495.15-.494.15-.644-.344-.15-.494.15-.493.644-.643 4.397-1.334 9.873-.67 13.647 1.65.44.27.58.844.31 1.284zm.126-3.414c-3.906-2.32-10.334-2.533-14.075-1.397-.597.18-.596.18-.777-.417-.18-.597.18-.596.777-.777 4.298-1.304 11.404-1.053 15.93 1.631.54.32.71.1.39.64-.32.54-.1.71-.64.39z" /></svg>
              Connect Spotify to Fix Data
            </button>
          )}

        </div>
      )}

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xl z-60 p-6 text-center animate-in fade-in duration-300">
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
