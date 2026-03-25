# Spotify MCP Server

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Spotify API](https://img.shields.io/badge/Spotify%20Web%20API-v1-1DB954?style=flat-square&logo=spotify&logoColor=white)](https://developer.spotify.com/documentation/web-api)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-5865F2?style=flat-square)](https://modelcontextprotocol.io/)
[![JSON-RPC](https://img.shields.io/badge/JSON--RPC-2.0-orange?style=flat-square)](https://www.jsonrpc.org/specification)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that bridges AI assistants directly to Spotify's Web API — letting Claude, GPT, and other LLMs search tracks, analyze audio features, and explore artist data through natural conversation.**

---

## What is MCP?

The Model Context Protocol (MCP) is an open standard that lets AI assistants call external tools and data sources in a structured way. This server implements MCP over JSON-RPC 2.0, exposing Spotify's Web API as typed, callable tools that any MCP-compatible AI client can discover and invoke automatically.

---

## Architecture

```
┌─────────────────────┐        JSON-RPC 2.0        ┌──────────────────────────┐
│                     │   (stdin / stdout stream)   │                          │
│   AI Assistant      │ ◄─────────────────────────► │   SpotifyMCPServer       │
│  (Claude, GPT, etc) │                             │                          │
│                     │   tools/list                │  ┌────────────────────┐  │
│   "Find me jazz     │   tools/call                │  │   SpotifyAuth      │  │
│    tracks with      │                             │  │                    │  │
│    high energy"     │                             │  │  Client Credentials│  │
│                     │                             │  │  Flow + Auto-Renew │  │
└─────────────────────┘                             │  └────────┬───────────┘  │
                                                    │           │              │
                                                    └───────────┼──────────────┘
                                                                │ HTTPS
                                                                ▼
                                                    ┌──────────────────────────┐
                                                    │   Spotify Web API        │
                                                    │   api.spotify.com/v1     │
                                                    └──────────────────────────┘
```

**Key design decisions:**
- **Stdio transport** — zero networking overhead; runs as a subprocess of the AI client
- **Client Credentials flow** — server-to-server auth, no user login required for catalog access
- **Automatic token refresh** — tokens are cached and renewed 60 seconds before expiry
- **Built-in rate limiting** — respects Spotify's 100 req/min limit with automatic back-off

---

## Available Tools

The server exposes three MCP tools that any compatible AI client can call:

### `search_tracks`
Search Spotify's full catalog by song name, artist, or album.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search term (song, artist, album, or any combination) |
| `limit` | integer | No | Number of results to return — default `10`, max `50` |

**Returns:** Array of track objects including name, artist(s), album, popularity score (0–100), 30-second preview URL, and Spotify deep-link.

---

### `get_artist_info`
Fetch full artist profile and their current top tracks.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `artist_id` | string | Yes | Spotify artist ID (from a `search_tracks` result or Spotify URL) |

**Returns:** Artist name, genres, popularity score, follower count, and list of top 10 track names in the US market.

---

### `get_track_features`
Retrieve Spotify's audio analysis data for a track.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `track_id` | string | Yes | Spotify track ID (from a `search_tracks` result) |

**Returns:** Normalized audio features — `danceability`, `energy`, `valence` (positivity), `tempo` (BPM), and `loudness` (dB). All values 0.0–1.0 except tempo and loudness.

> **Note:** The `/audio-features` endpoint requires Spotify's extended quota mode. If your app is in development mode, this tool will return an authorization error. See [Spotify's quota extension docs](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) for details.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [Spotify Developer](https://developer.spotify.com/dashboard) account (free)

### 1. Clone and install

```bash
git clone https://github.com/your-username/spotify-mcp-server.git
cd spotify-mcp-server
npm install
```

### 2. Create a Spotify app

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Set any **Redirect URI** (e.g. `http://localhost:3000`) — it's not used for Client Credentials flow
4. Copy your **Client ID** and **Client Secret**

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

### 4. Run the server

```bash
npm start
```

The server starts and listens for JSON-RPC requests on stdin.

### 5. Run the test suite

```bash
node test-server.js
```

This spawns the server as a subprocess and runs all three tools end-to-end, printing the full JSON responses.

---

## Usage with AI Assistants

### Claude Desktop

Add the following to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "spotify": {
      "command": "node",
      "args": ["/absolute/path/to/spotify-mcp-server/server.js"],
      "env": {
        "SPOTIFY_CLIENT_ID": "your_client_id_here",
        "SPOTIFY_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

Restart Claude Desktop. You can now ask things like:

> *"Search for upbeat jazz tracks and show me the audio features for the most popular one."*

> *"Who are the top artists in the lo-fi hip hop genre? Get me info on the most followed one."*

### Other MCP Clients

Any MCP-compatible client can connect by launching the server as a subprocess and communicating over stdin/stdout using JSON-RPC 2.0. The server announces its capabilities during the `initialize` handshake.

---

## Configuration Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SPOTIFY_CLIENT_ID` | Your Spotify app's Client ID | Yes |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify app's Client Secret | Yes |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ (ES Modules) |
| Protocol | Model Context Protocol (MCP) 2024-11-05 |
| Transport | JSON-RPC 2.0 over stdio |
| Auth | Spotify Client Credentials OAuth 2.0 |
| HTTP | `node-fetch` v3 |
| Config | `dotenv` |

---

## Project Structure

```
spotify-mcp-server/
├── server.js          # MCP server — protocol handling, tool definitions, request routing
├── spotify-auth.js    # Spotify OAuth client — token management and authenticated requests
├── test-server.js     # End-to-end test runner — spawns server and exercises all tools
├── .env.example       # Environment variable template
└── package.json
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
