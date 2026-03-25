import SpotifyAuth from './spotify-auth.js';

class SpotifyMCPServer {
  constructor() {
    this.spotify = new SpotifyAuth();
    this.rateLimitDelay = 600; // 100 requests per minute = 600ms between requests
    this.lastRequestTime = 0;
  }

  async handleRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'initialize':
        return this.handleInitialize(params);
      case 'tools/list':
        return this.handleToolsList();
      case 'tools/call':
        return this.handleToolCall(params);
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  handleInitialize(_params) {
    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "spotify-mcp-server",
        version: "1.0.0"
      }
    };
  }

  handleToolsList() {
    return {
      tools: [
        {
          name: "search_tracks",
          description: "Search Spotify's catalog for tracks",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search term (song name, artist, album)"
              },
              limit: {
                type: "integer",
                description: "Number of results (default: 10, max: 50)",
                default: 10,
                minimum: 1,
                maximum: 50
              }
            },
            required: ["query"]
          }
        },
        {
          name: "get_artist_info",
          description: "Get detailed artist information and top tracks",
          inputSchema: {
            type: "object",
            properties: {
              artist_id: {
                type: "string",
                description: "Spotify artist ID"
              }
            },
            required: ["artist_id"]
          }
        },
        {
          name: "get_track_features",
          description: "Get audio analysis features for a track",
          inputSchema: {
            type: "object",
            properties: {
              track_id: {
                type: "string",
                description: "Spotify track ID"
              }
            },
            required: ["track_id"]
          }
        }
      ]
    };
  }

  async handleToolCall(params) {
    const { name, arguments: args } = params;

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    try {
      switch (name) {
        case 'search_tracks':
          return await this.searchTracks(args);
        case 'get_artist_info':
          return await this.getArtistInfo(args);
        case 'get_track_features':
          return await this.getTrackFeatures(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }

  async searchTracks(args) {
    const { query, limit = 10 } = args;
    const encodedQuery = encodeURIComponent(query);
    
    const data = await this.spotify.makeAuthenticatedRequest(
      `https://api.spotify.com/v1/search?q=${encodedQuery}&type=track&limit=${limit}`
    );

    const tracks = data.tracks.items.map(track => ({
      name: track.name,
      artist: track.artists.map(artist => artist.name).join(', '),
      album: track.album.name,
      popularity: track.popularity,
      preview_url: track.preview_url,
      spotify_url: track.external_urls.spotify
    }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify(tracks, null, 2)
      }]
    };
  }

  async getArtistInfo(args) {
    const { artist_id } = args;
    
    const [artistData, topTracksData] = await Promise.all([
      this.spotify.makeAuthenticatedRequest(`https://api.spotify.com/v1/artists/${artist_id}`),
      this.spotify.makeAuthenticatedRequest(`https://api.spotify.com/v1/artists/${artist_id}/top-tracks?market=US`)
    ]);

    const result = {
      name: artistData.name,
      genres: artistData.genres,
      popularity: artistData.popularity,
      follower_count: artistData.followers.total,
      top_tracks: topTracksData.tracks.map(track => track.name)
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  async getTrackFeatures(args) {
    const { track_id } = args;
    
    const data = await this.spotify.makeAuthenticatedRequest(
      `https://api.spotify.com/v1/audio-features/${track_id}`
    );

    const result = {
      danceability: data.danceability,
      energy: data.energy,
      valence: data.valence,
      tempo: data.tempo,
      loudness: data.loudness
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
}

// JSON-RPC server implementation
const server = new SpotifyMCPServer();

process.stdin.setEncoding('utf8');
process.stdin.on('readable', async () => {
  let chunk;
  // Drain all buffered chunks — readable fires once but read() may have multiple
  while ((chunk = process.stdin.read()) !== null) {
    let request;
    try {
      request = JSON.parse(chunk.trim());
      const response = await server.handleRequest(request);

      const jsonResponse = {
        jsonrpc: "2.0",
        id: request.id,
        result: response
      };

      process.stdout.write(JSON.stringify(jsonResponse) + '\n');
    } catch (error) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: request?.id ?? null,
        error: {
          code: -32603,
          message: error.message
        }
      };

      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});