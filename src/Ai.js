import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAccessToken, getValidAccessToken } from './auth'; // Importer les fonctions d'authentification
import 'bootstrap/dist/css/bootstrap.min.css';

const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

function AI() {
    const [userPrompt, setUserPrompt] = useState('');
    const [playlist, setPlaylist] = useState([]);
    const [accessToken, setAccessToken] = useState(null);
    const [playlistURL, setPlaylistURL] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const authorizationCode = params.get("code");

        if (authorizationCode) {
            handleAuthorization(authorizationCode);
        } else {
            fetchAccessToken();
        }
    }, [location]);

    const handleAuthorization = async (code) => {
        try {
            const token = await getAccessToken(code);
            if (token) {
                setAccessToken(token);
                localStorage.setItem("spotify_access_token", token); // ✅ Stocker le token localement
                navigate("/ai");
            }
        } catch (error) {
            console.error("❌ Erreur lors de l'obtention du token :", error);
        }
    };

    const fetchAccessToken = async () => {
        try {
            let token = localStorage.getItem("spotify_access_token"); // ✅ Récupération du token stocké
    
            if (!token) {
                console.log("🔄 Aucun token trouvé, tentative de récupération...");
                token = await getValidAccessToken(); // Récupérer un token valide si localStorage est vide
            }
    
            if (token) {
                setAccessToken(token);
                console.log("✅ Access Token récupéré et utilisé :", token);
            } else {
                console.warn("⚠️ Impossible d'obtenir un token.");
            }
        } catch (error) {
            console.error("❌ Erreur lors de la récupération du token :", error);
        }
    };

    const generatePlaylist = async () => {
        if (!userPrompt || !accessToken) {
            console.warn("⚠️ Veuillez entrer un thème et être connecté à Spotify.");
            return;
        }

        try {
            console.log("🔍 Génération de la playlist via Mistral AI...");
            const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer zdFjVoUKFIdZ8rjyVVZ0sjqrMIfMqbPc`
                },
                body: JSON.stringify({
                    model: "mistral-medium",
                    messages: [{ role: "user", content: `Génère une liste de chansons pour: ${userPrompt}` }],
                    max_tokens: 100
                })
            });

            const data = await response.json();
            const rawTracks = data.choices[0]?.message?.content.split('\n') || [];
            const tracks = rawTracks.map(track => track.trim()).filter(track => track.length > 0);

            console.log("✅ Playlist générée par Mistral AI:", tracks);

            setPlaylist(tracks);
            await createSpotifyPlaylist(tracks, userPrompt);
        } catch (error) {
            console.error("❌ Erreur lors de la génération de la playlist avec Mistral AI:", error);
        }
    };

    const searchSpotifyTrack = async (trackName) => {
        if (!accessToken || !trackName) return null;

        try {
            const response = await fetch(`${SPOTIFY_API_BASE_URL}/search?q=${encodeURIComponent(trackName)}&type=track&limit=1`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            const data = await response.json();
            return data.tracks.items.length > 0 ? data.tracks.items[0].uri : null;
        } catch (error) {
            console.error(`❌ Erreur lors de la recherche du titre "${trackName}"`, error);
            return null;
        }
    };

    const createSpotifyPlaylist = async (tracks, theme) => {
        if (!accessToken) {
            console.warn("⚠️ Token d'accès manquant.");
            return;
        }

        try {
            console.log("🎵 Création d'une nouvelle playlist sur Spotify...");

            const userResponse = await fetch(`${SPOTIFY_API_BASE_URL}/me`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            const userData = await userResponse.json();
            const userId = userData.id;

            const playlistResponse = await fetch(`${SPOTIFY_API_BASE_URL}/users/${userId}/playlists`, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: `Playlist AI - ${theme}`,
                    description: "Playlist générée par Mistral AI",
                    public: false
                })
            });

            const playlistData = await playlistResponse.json();
            if (!playlistData.id) {
                console.error("❌ Échec de la création de la playlist sur Spotify.");
                return;
            }

            setPlaylistURL(playlistData.external_urls.spotify);
            const playlistId = playlistData.id;
            console.log("✅ Playlist Spotify créée avec succès:", playlistData);

            const trackURIs = [];
            for (const track of tracks) {
                const trackURI = await searchSpotifyTrack(track);
                if (trackURI) {
                    trackURIs.push(trackURI);
                }
            }

            if (trackURIs.length > 0) {
                await fetch(`${SPOTIFY_API_BASE_URL}/playlists/${playlistId}/tracks`, {
                    method: 'POST',
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ uris: trackURIs })
                });

                console.log("✅ Les morceaux ont été ajoutés à la playlist !");
            } else {
                console.warn("⚠️ Aucun morceau trouvé pour ajouter à la playlist.");
            }
        } catch (error) {
            console.error("❌ Erreur lors de la création de la playlist Spotify :", error);
        }
    };

    return (
        <div className="container text-light py-5" style={{ backgroundColor: "#1e1e1e", minHeight: "100vh" }}>
            <h2 className="text-center">🤖 AI Music Generator (Mistral AI)</h2>
            <p className="text-center">Entrez un thème et laissez Mistral AI générer une playlist Spotify 🎶</p>

            <div className="d-flex justify-content-center">
                <input 
                    type="text" 
                    className="form-control w-50" 
                    placeholder="Ex: Soirée Chill, Workout, Années 80..." 
                    value={userPrompt} 
                    onChange={(e) => setUserPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && generatePlaylist()}
                />
                <button className="btn btn-success ms-2" onClick={generatePlaylist}>Générer 🎵</button>
            </div>

            {playlistURL && (
                <div className="text-center mt-4">
                    <a href={playlistURL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                        🎵 Voir la playlist sur Spotify
                    </a>
                </div>
            )}
        </div>
    );
}

export default AI;