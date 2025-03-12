import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAccessToken, getValidAccessToken, TOKEN_MISTRALAI, SPOTIFY_API_BASE_URL } from './auth'; // Importer les fonctions d'authentification
import 'bootstrap/dist/css/bootstrap.min.css';

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
                    'Authorization': `Bearer ${TOKEN_MISTRALAI}`
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


    // deuxiéme fonctionnalité ########
    // 🆕 Nouvelle section pour recommander des musiques similaires à la musique en cours d'écoute

    const [currentTrack, setCurrentTrack] = useState(null);
    const [recommendations, setRecommendations] = useState([]);

    // 🔹 Récupérer la musique en cours d'écoute
    const getCurrentPlayingTrack = async () => {
        if (!accessToken) {
            console.warn("⚠️ Aucun token d'accès disponible.");
            return;
        }

        try {
            const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player/currently-playing`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            if (response.status === 204) {
                console.log("🎵 Aucun titre en cours de lecture.");
                return;
            }

            const data = await response.json();

            if (data && data.item) {
                const trackInfo = {
                    title: data.item.name,
                    artist: data.item.artists.map(artist => artist.name).join(", "),
                    id: data.item.id
                };
                setCurrentTrack(trackInfo);
                console.log("🎶 Musique en cours de lecture :", trackInfo);
            }
        } catch (error) {
            console.error("❌ Erreur lors de la récupération de la musique en cours :", error);
        }
    };

    // 🔹 Demander des recommandations similaires à Mistral AI
    const getRecommendationsFromMistral = async () => {
        if (!currentTrack) {
            console.warn("⚠️ Aucun titre en cours d'écoute.");
            return;
        }

        try {
            console.log(`🔍 Demande de recommandations pour "${currentTrack.title}"`);

            const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN_MISTRALAI}`
                },
                body: JSON.stringify({
                    model: "mistral-medium",
                    messages: [{
                        role: "user",
                        content: `Propose-moi 5 morceaux similaires à "${currentTrack.title}" de ${currentTrack.artist}. sous forme de liste sans aucune phrases`
                    }],
                    max_tokens: 150
                })
            });

            const data = await response.json();
            const rawTracks = data.choices[0]?.message?.content.split('\n') || [];
            const tracks = rawTracks.map(track => track.trim()).filter(track => track.length > 0);

            console.log("✅ Recommandations obtenues :", tracks);
            setRecommendations(tracks);
        } catch (error) {
            console.error("❌ Erreur lors de la récupération des recommandations :", error);
        }
    };

    // 🔹 Ajouter les recommandations à la suite de la musique en cours de lecture
    const addRecommendationsToQueue = async () => {
        if (!accessToken || recommendations.length === 0) {
            console.warn("⚠️ Aucun token d'accès ou aucune recommandation disponible.");
            return;
        }

        try {
            console.log("🎵 Ajout des recommandations à la file d'attente...");

            for (const track of recommendations) {
                const trackURI = await searchSpotifyTrack(track);
                if (trackURI) {
                    await fetch(`${SPOTIFY_API_BASE_URL}/me/player/queue?uri=${trackURI}`, {
                        method: 'POST',
                        headers: {
                            "Authorization": `Bearer ${accessToken}`
                        }
                    });
                    console.log(`✅ Ajouté à la file d'attente : ${track}`);
                } else {
                    console.warn(`⚠️ Impossible de trouver la musique "${track}" sur Spotify.`);
                }
            }

            console.log("✅ Toutes les recommandations ont été ajoutées à la file d'attente !");
        } catch (error) {
            console.error("❌ Erreur lors de l'ajout des recommandations à la file d'attente :", error);
        }
    };

    return (
        <div className="container-fluid min-vh-100 bg-dark" >
            <div className="container py-4">
                <h2 className="text-center text-spotify-green" style={{ color: "#FFFFFF" }}>🤖 AI Music Generator (Mistral AI)</h2>
                <p className="text-center" style={{ color: "#FFFFFF" }}>Entrez un thème et laissez Mistral AI générer une playlist Spotify 🎶</p>

                <div className="d-flex justify-content-center">
                    <input
                        type="text"
                        className="form-control w-50"
                        placeholder="Ex: Soirée Chill, Workout, Années 80..."
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && generatePlaylist()}
                    />
                    <button className="btn btn-outline-success ms-2 text-spotify-green" onClick={generatePlaylist}>Générer 🎵</button>
                </div>

                {playlistURL && (
                    <div className="text-center mt-4">
                        <a href={playlistURL} target="_blank" rel="noopener noreferrer" className="btn btn-outline-success text-spotify-green">
                            🎵 Voir la playlist sur Spotify
                        </a>
                    </div>
                )}

                <div className="mt-5 p-4" style={{ backgroundColor: "#282828", borderRadius: "8px", color: "#FFFFFF" }}>
                    <h3 className="text-center text-spotify-green">🎵 Recommandations Basées sur la Musique en Cours</h3>

                    <div className="text-center mb-3">
                        <button className="btn btn-outline-success me-2 text-spotify-green" onClick={getCurrentPlayingTrack}>
                            🎧 Vérifier la musique en cours
                        </button>
                        {currentTrack && (
                            <span className="fs-5 ms-2">🎶 Actuellement : <strong>{currentTrack.title}</strong> - {currentTrack.artist}</span>
                        )}
                    </div>

                    {currentTrack && (
                        <div className="text-center">
                            <button className="btn btn-outline-success me-2 text-spotify-green" onClick={getRecommendationsFromMistral}>
                                🔍 Obtenir des recommandations
                            </button>
                        </div>
                    )}

                    {recommendations.length > 0 && (
                        <div className="mt-3">
                            <h5 className="text-center text-spotify-green">🎼 Recommandations proposées :</h5>
                            <ul className="list-group">
                                {recommendations.map((track, index) => (
                                    <li key={index} className="list-group-item bg-dark text-light border-light" style={{ backgroundColor: "#282828", borderRadius: "8px", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                        {track}
                                    </li>
                                ))}
                            </ul>

                            <div className="text-center mt-3">
                                <button className="btn btn-outline-success text-spotify-green" onClick={addRecommendationsToQueue}>
                                    🎶 Ajouter à la suite de lecture
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AI;