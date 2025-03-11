import axios from 'axios';

export const CLIENT_ID = "e4774b450b194ba5aa0c0ccdbb5e8ae9";
const CLIENT_SECRET = "bfe8dd9f4623446f8a5e35643b7dfb71";
export const REDIRECT_URI = "http://localhost:3000/"; // Remplace avec l'URL de redirection enregistrée
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
export const TOKEN_MISTRALAI = 'zdFjVoUKFIdZ8rjyVVZ0sjqrMIfMqbPc';
// Stockage des tokens en mémoire
let accessToken = null;
let refreshToken = null;
let tokenExpiration = null;
const SCOPES = [
    "playlist-modify-public",
    "playlist-modify-private",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-read-private",
    "user-library-read",
    "user-library-modify",
    "user-read-currently-playing", 
    "user-read-playback-state",
    "user-modify-playback-state" 

].join(" "); // 🔹 Transforme le tableau en une chaîne de scopes séparés par des espaces

export const SPOTIFY_AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
// 🟢 Fonction pour récupérer un token via le code d'autorisation
export const getAccessToken = async (authorizationCode) => {
    try {
        const response = await axios.post(
            TOKEN_ENDPOINT,
            new URLSearchParams({
                grant_type: "authorization_code",
                code: authorizationCode,
                redirect_uri: REDIRECT_URI,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
                },
            }
        );

        // Stocker les tokens et l'expiration
        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token;
        tokenExpiration = Date.now() + response.data.expires_in * 1000; // Convertir en millisecondes

        return accessToken;
    } catch (error) {
        console.error("Erreur lors de l'obtention du token d'accès:", error);
        return null;
    }
};

export const refreshAccessToken = async () => {
    if (!refreshToken) {
        console.error("Aucun refresh token disponible");
        return null;
    }

    // Vérifier si le token est encore valide
    if (Date.now() < tokenExpiration) {
        return accessToken; // Retourner le token actuel s'il est encore valide
    }

    try {
        const response = await axios.post(
            TOKEN_ENDPOINT,
            new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
                },
            }
        );

        // Mettre à jour le token et son expiration
        accessToken = response.data.access_token;
        tokenExpiration = Date.now() + response.data.expires_in * 1000; // Convertir en millisecondes

        return accessToken;
    } catch (error) {
        console.error("Erreur lors du rafraîchissement du token d'accès:", error);
        return null;
    }
};

// 🔑 Fonction pour récupérer le token, rafraîchir si nécessaire
export const getValidAccessToken = async () => {
    if (!accessToken || Date.now() >= tokenExpiration) {
        return await refreshAccessToken();
    }
    return accessToken;
};