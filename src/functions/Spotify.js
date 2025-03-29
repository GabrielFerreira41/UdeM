import { refreshAccessToken } from './auth'; // Assure-toi que cette fonction existe dans auth.js


export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

/**
 * Vérifie si le token est encore valide (selon sa date d'expiration dans le localStorage)
 */

export const getValidAccessToken = async () => {
    const accessToken = localStorage.getItem("access_token");
    const expirationTime = localStorage.getItem("token_expiration");

    const isTokenExpired = !expirationTime || Date.now() >= Number(expirationTime);

    if (accessToken && !isTokenExpired) {
        return accessToken;
    }

    // Rafraîchit le token si expiré
    const newToken = await refreshAccessToken();
    return newToken;
};

/**
 * Récupère les playlists de l'utilisateur connecté
 */
export const getUserPlaylists = async (token) => {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return data.items;
};

/**
 * Récupère les morceaux d'une playlist
 */
export const getPlaylistTracks = async (playlistId, token) => {
    const response = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return data.items;
};

/**
 * Recherche un morceau sur Spotify à partir d'un nom/artiste
 */

/**
 * Crée une nouvelle playlist privée dans le compte de l'utilisateur
 */
export const createPlaylist = async (userId, name, token) => {
    const response = await fetch(`${SPOTIFY_API_BASE}/users/${userId}/playlists`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, public: false }),
    });
    const data = await response.json();
    return data.id;
};

/**
 * Ajoute une liste de morceaux (URIs) à une playlist Spotify existante
 */
export const addTracksToPlaylist = async (playlistId, uris, token) => {
    await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris }),
    });
};


export const searchSpotifyTrack = async (trackName, accessToken) => {
    if (!accessToken || !trackName) return null;

    try {
        const regex = /\d+\.\s*(?:Titre|Title)\s*:\s*"?(.*?)"?\s*-\s*(?:Artiste|Artistes|Artist|Artists)\s*:\s*"?(.*?)"?$/
        const match = trackName.match(regex);
        console.log(trackName)
        console.log(match)
        if (!match) return null;

        const title = match[1].trim();
        const artist = match[2].trim();

        const query = encodeURIComponent(`track:${title} artist:${artist}`);
        const url = `${SPOTIFY_API_BASE}/search?q=${query}&type=track&limit=1`;

        const response = await fetch(url, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });

        const data = await response.json();
        return data.tracks.items.length > 0 ? data.tracks.items[0].uri : null;
    } catch (error) {
        console.error(`❌ Erreur Spotify track search:`, error);
        return null;
    }
};

export const getCurrentTrackInfo = async (accessToken) => {
    if (!accessToken) return null;

    try {
        const response = await fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });

        if (response.status === 204) return null;

        const data = await response.json();
        if (!data || !data.item) return null;

        return {
            title: data.item.name,
            artist: data.item.artists.map(a => a.name).join(', '),
            id: data.item.id
        };
    } catch (error) {
        console.error("❌ Erreur récupération current track :", error);
        return null;
    }
};

export const addTracksToQueue = async (tracks, accessToken) => {
    if (!accessToken || tracks.length === 0) return;

    for (const track of tracks) {
        const uri = await searchSpotifyTrack(track, accessToken);
        if (uri) {
            await fetch(`${SPOTIFY_API_BASE}/me/player/queue?uri=${uri}`, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            });
        }
    }
};

export const createSpotifyPlaylist = async (tracks, theme, accessToken, playlistSize = 10) => {
    try {
        const userResp = await fetch(`${SPOTIFY_API_BASE}/me`, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });
        const userData = await userResp.json();

        const playlistResp = await fetch(`${SPOTIFY_API_BASE}/users/${userData.id}/playlists`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: `Playlist AI - ${theme}`,
                description: "Playlist générée automatiquement",
                public: false
            })
        });

        const playlistData = await playlistResp.json();
        const playlistId = playlistData.id;

        const trackURIs = [];
        for (let i = 0; i < tracks.length && trackURIs.length < playlistSize; i++) {
            const uri = await searchSpotifyTrack(tracks[i], accessToken);
            if (uri) trackURIs.push(uri);
        }

        await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ uris: trackURIs })
        });

        return playlistData.external_urls.spotify;
    } catch (error) {
        console.error("❌ Erreur création playlist :", error);
        return null;
    }
};