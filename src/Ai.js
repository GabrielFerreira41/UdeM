import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAccessToken, getValidAccessToken, TOKEN_MISTRALAI, SPOTIFY_API_BASE_URL } from './auth'; // Importer les fonctions d'authentification
import 'bootstrap/dist/css/bootstrap.min.css';

function AI() {
    const [userPrompt, setUserPrompt] = useState('');
    const [playlist, setPlaylist] = useState([]);
    const [accessToken, setAccessToken] = useState(null);
    const [playlistURL, setPlaylistURL] = useState(null);
    const [playlistSize, setPlaylistSize] = useState(10);
    const [userResponses, setUserResponses] = useState({
        mood: "",
        genre: "",
        situation: "",
        favoriteArtists: "",
        favoriteTrack: "",
        discoveryPreference: ""
    });
    const navigate = useNavigate();
    const location = useLocation();
    const [currentTrack, setCurrentTrack] = useState(null);
    const [recommendations, setRecommendations] = useState([]);

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
                    model: "open-codestral-mamba",
                    messages: [{ role: "user", content: `Génère une liste de ${playlistSize} musique qui correspondent au théme : ${userPrompt} , sous ce format :
                            1. Titre : Nom de la chanson - Artiste : Nom Artiste
                            2. Titre : Nom de la chanson - Artiste : Nom Artiste
                            3. Titre : Nom de la chanson - Artiste : Nom Artiste
                            ...etc.`  }],
                    max_tokens: 100000
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
        console.log(`🔍 Recherche originale pour "${trackName}"`);

        // Extraction du titre et de l'artiste avec gestion des guillemets
        const regex = /\d+\.\s*(?:Titre|Title)\s*:\s*"?(.+?)"?\s*-\s*(?:Artiste|Artistes|Artist|Artists)\s*:\s*"?(.+?)"?/;        
        const match = trackName.match(regex);
        console.log(trackName)
        if (!match) {
            console.warn(`⚠️ Format inattendu pour "${trackName}".`);
            return null;
        }

        const title = match[1].trim();
        const artist = match[2].trim();

        // Encodage de la requête pour Spotify
        const query = encodeURIComponent(`track:${title} artist:${artist}`);
        const url = `${SPOTIFY_API_BASE_URL}/search?q=${query}&type=track&limit=1`;

        console.log(`🌐 URL Spotify Search : ${url}`);

        const response = await fetch(url, {
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
            let count = 0;
            for (const track of tracks) {
                if (count >= playlistSize) break;
                const trackURI = await searchSpotifyTrack(track);
                if (trackURI) {
                    trackURIs.push(trackURI);
                    count++;
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
                        content: `
                        
                        Génère une liste de 10 chansons qui correspondent à "${currentTrack.title}" de ${currentTrack.artist}, sous ce format :
                            1. Titre : Nom de la chanson - Artiste : Nom Artiste
                            2. Titre : Nom de la chanson - Artiste : Nom Artiste
                            3. Titre : Nom de la chanson - Artiste : Nom Artiste
                            ...etc.` 
                    }],
                    max_tokens: 10000
                })
            });

            const data = await response.json();
            const rawTracks = data.choices[0]?.message?.content.split('\n') || [];
            const regex = /\d+\.\s*(?:Titre|Title)\s*:\s*"?(.+?)"?\s*-\s*(?:Artiste|Artistes|Artist|Artists)\s*:\s*"?(.+?)"?/;

            const tracks = rawTracks
                .map(track => track.trim())
                .filter(track => regex.test(track)); // ✅ Ne garde que les lignes qui matchent le regex
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
const handleChange = (e) => {
    const { name, value } = e.target;
    setUserResponses(prev => ({ ...prev, [name]: value }));
};

const generatePersonalizedPlaylist = async () => {
    if (!accessToken) {
        console.warn("⚠️ Veuillez vous connecter à Spotify.");
        return;
    }

    try {
        console.log("🔍 Envoi des préférences à Mistral AI...");
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN_MISTRALAI}`
            },
            body: JSON.stringify({
                model: "mistral-medium",
                messages: [
                    { role: "system", content: "Tu es un expert en musique. En fonction des préférences de l'utilisateur, propose une liste de 10 morceaux adaptés." },
                    { role: "user", content: `L'utilisateur a répondu :
                    - Humeur : ${userResponses.mood}
                    - Genre préféré : ${userResponses.genre}
                    - Situation : ${userResponses.situation}
                    - Artistes favoris : ${userResponses.favoriteArtists}
                    - Chanson favorite : ${userResponses.favoriteTrack}
                    - Découverte : ${userResponses.discoveryPreference}

                    Génère une liste de 10 chansons qui correspondent à ces goûts, sous ce format :
                    1. Titre : Nom de la chanson - Artiste : Nom Artiste
                    2. Titre : Nom de la chanson - Artiste : Nom Artiste
                    3. Titre : Nom de la chanson - Artiste : Nom Artiste
                    ...etc.` }
                ],
                max_tokens: 10000
            })
        });

        const data = await response.json();
        const rawTracks = data.choices[0]?.message?.content.split('\n') || [];
        const tracks = rawTracks.map(track => track.trim()).filter(track => track.length > 0);

        console.log("✅ Playlist recommandée par Mistral AI:", tracks);

        setPlaylist(tracks);
        await createSpotifyPlaylist(tracks, "Playlist Personnalisée");
    } catch (error) {
        console.error("❌ Erreur lors de la génération de la playlist avec Mistral AI:", error);
    }
};
    return (
        <div className="container-fluid min-vh-100 bg-dark" >
            <div className="container py-4">
                <h2 className="text-center text-spotify-green" style={{ color: "#FFFFFF" }}>🤖 AI Playlist Generator (Mistral AI)</h2>
                <p className="text-center" style={{ color: "#FFFFFF" }}>Entrez un thème et laissez Mistral AI générer une playlist Spotify 🎶</p>

                <div className="d-flex justify-content-center flex-column align-items-center">
                    <div className="w-50">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Ex: Soirée Chill, Workout, Années 80..."
                            value={userPrompt}
                            onChange={(e) => setUserPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && generatePlaylist()}
                        />
                    </div>
                    <div className="mt-3 text-white w-50">
                        <label className="form-label">🎚️ Nombre de morceaux à ajouter à la playlist : {playlistSize}</label>
                        <input 
                            type="range" 
                            className="form-range" 
                            min="1" 
                            max="50" 
                            value={playlistSize} 
                            onChange={(e) => setPlaylistSize(parseInt(e.target.value, 10))} 
                        />
                    </div>
                    <button className="btn btn-outline-success mt-3 text-spotify-green" onClick={generatePlaylist}>Générer 🎵</button>
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
                <h2 className="text-center text-spotify-green" style={{ color: "#FFFFFF" }}>🤖 Playlist Personaliser (Mistral AI)</h2>
                <div className="mt-4">
                    <form className="text-white">
                        <label className="form-label">1. Quelle est ton humeur ?</label>
                        <select className="form-select mb-3" name="mood" onChange={handleChange}>
                            <option>Choisir...</option>
                            <option>Positif</option>
                            <option>Détendu</option>
                            <option>Énergique</option>
                            <option>Mélancolique</option>
                            <option>Triste</option>
                        </select>

                        <label className="form-label">2. Quel est ton genre musical préféré ?</label>
                        <select className="form-select mb-3" name="genre" onChange={handleChange}>
                            <option>Choisir...</option>
                            <option>Rock</option>
                            <option>Hip-hop</option>
                            <option>Électro</option>
                            <option>Classique</option>
                            <option>Pop</option>
                        </select>

                        <label className="form-label">3. Quelle est ta situation actuelle ?</label>
                        <input type="text" className="form-control mb-3" name="situation" placeholder="Ex: En train de travailler, en fête, etc." onChange={handleChange} />

                        <label className="form-label">4. Quels sont tes artistes favoris ?</label>
                        <input type="text" className="form-control mb-3" name="favoriteArtists" placeholder="Ex: Artiste 1, Artiste 2" onChange={handleChange} />

                        <label className="form-label">5. Quelle est ta chanson favorite ?</label>
                        <input type="text" className="form-control mb-3" name="favoriteTrack" placeholder="Ex: Nom de la chanson" onChange={handleChange} />

                        <label className="form-label">6. Préférence de découverte musicale ?</label>
                        <select className="form-select mb-3" name="discoveryPreference" onChange={handleChange}>
                            <option>Choisir...</option>
                            <option>Découvertes récentes</option>
                            <option>Classiques intemporels</option>
                            <option>Indépendants</option>
                        </select>
                        

                        <button type="button" className="btn btn-outline-light w-100 mt-3" onClick={generatePersonalizedPlaylist}>
                            🎵 Générer ma Playlist
                        </button>
                    </form>

                    {playlistURL && (
                        <div className="text-center mt-4">
                            <a href={playlistURL} target="_blank" rel="noopener noreferrer" className="btn btn-outline-success">
                                🎵 Voir la playlist sur Spotify
                            </a>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

export default AI;