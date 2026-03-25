import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

class SpotifyAuth {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiresAt = null;

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'Missing Spotify credentials. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your .env file.'
      );
    }
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        throw new Error(`Spotify auth failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 minute early

      return this.accessToken;
    } catch (error) {
      throw new Error(`Failed to get Spotify access token: ${error.message}`);
    }
  }

  async makeAuthenticatedRequest(url, options = {}) {
    const token = await this.getAccessToken();
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`Spotify API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

export default SpotifyAuth;