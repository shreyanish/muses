import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { code, redirect_uri } = await request.json();

  const client_id = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    return NextResponse.json({ 
      error: 'Missing environment variables',
      details: `ID: ${!!client_id}, Secret: ${!!client_secret}`
    }, { status: 500 });
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirect_uri,
    }),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
