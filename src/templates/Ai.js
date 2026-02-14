import { callMistral } from '../functions/Mistral';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAccessToken } from '../functions/auth'; // Importer les fonctions d'authentification
import 'bootstrap/dist/css/bootstrap.min.css';
import {
    SPOTIFY_API_BASE,
    getValidAccessToken,
    searchSpotifyTrack,
    getCurrentTrackInfo,
    addTracksToQueue,
    createSpotifyPlaylist
} from "../functions/Spotify"

function AI() {
    const [userPrompt, setUserPrompt] = useState('');
    const [playlist, setPlaylist] = useState([]);
    const [accessToken, setAccessToken] = useState(null);
    const [promptPlaylistURL, setPromptPlaylistURL] = useState(null);
    const [personalizedPlaylistURL, setPersonalizedPlaylistURL] = useState(null);
    const [playlistSize, setPlaylistSize] = useState(10);
    const [loading, setLoading] = useState(false);
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
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);
    const [loadingPersonalized, setLoadingPersonalized] = useState(false);

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

        setLoading(true);
        try {
            console.log("🔍 Génération de la playlist via Mistral AI...");
            const messages = [{
                role: "user",
                content: `Génère une liste de ${playlistSize} musique qui correspondent au théme : ${userPrompt} , sous ce format :
              1. Titre : Nom de la chanson - Artiste : Nom Artiste
              2. Titre : Nom de la chanson - Artiste : Nom Artiste
              3. Titre : Nom de la chanson - Artiste : Nom Artiste
              ...etc.`
            }];

            const tracks = await callMistral(messages);

            console.log("✅ Playlist générée par Mistral AI:", tracks);

            setPlaylist(tracks);
            const url = await createSpotifyPlaylist(tracks, userPrompt, accessToken, playlistSize);
            if (url) setPromptPlaylistURL(url);
        } catch (error) {
            console.error("❌ Erreur lors de la génération de la playlist avec Mistral AI:", error);
        } finally {
            setLoading(false);
        }
    };



    // deuxiéme fonctionnalité ########




    // 🔹 Demander des recommandations similaires à Mistral AI
    const getRecommendationsFromMistral = async () => {
        if (!currentTrack) {
            console.warn("⚠️ Aucun titre en cours d'écoute.");
            return;
        }

        setLoadingRecommendations(true);
        try {
            console.log(`🔍 Demande de recommandations pour "${currentTrack.title}"`);

            const messages = [{
                role: "user",
                content: `Génère une liste de 10 chansons qui correspondent à "${currentTrack.title}" de ${currentTrack.artist}, sous ce format obligatoire :
              1. Titre : Nom de la chanson - Artiste : Nom Artiste
              2. Titre : Nom de la chanson - Artiste : Nom Artiste
              3. Titre : Nom de la chanson - Artiste : Nom Artiste
              ...etc.`
            }];

            const tracks = await callMistral(messages);
            const regex = /\d+\.\s*(?:Titre|Title)\s*:\s*"?(.+?)"?\s*-\s*(?:Artiste|Artistes|Artist|Artists)\s*:\s*"?(.+?)"?/;
            const validTracks = tracks.filter(track => regex.test(track));
            console.log(tracks)
            console.log(validTracks)
            console.log("✅ Recommandations obtenues :", validTracks);
            setRecommendations(validTracks);
        } catch (error) {
            console.error("❌ Erreur lors de la récupération des recommandations :", error);
        } finally {
            setLoadingRecommendations(false);
        }
    };

    // 🔹 Ajouter les recommandations à la suite de la musique en cours de lecture

    const handleChange = (e) => {
        const { name, value } = e.target;
        setUserResponses(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckCurrentTrack = async () => {
        const trackInfo = await getCurrentTrackInfo(accessToken);
        if (trackInfo) {
            setCurrentTrack(trackInfo);
            console.log("🎶 Musique en cours de lecture :", trackInfo);
        } else {
            console.warn("⚠️ Aucun morceau trouvé.");
        }
    };

    const generatePersonalizedPlaylist = async () => {
        if (!accessToken) {
            console.warn("⚠️ Veuillez vous connecter à Spotify.");
            return;
        }

        setLoadingPersonalized(true);
        try {
            console.log("🔍 Envoi des préférences à Mistral AI...");
            const messages = [
                { role: "system", content: "Tu es un expert en musique. En fonction des préférences de l'utilisateur, propose une liste de 10 morceaux adaptés." },
                {
                    role: "user",
                    content: `L'utilisateur a répondu :
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
                ...etc.`
                }
            ];

            const tracks = await callMistral(messages);
            console.log("✅ Playlist recommandée par Mistral AI:", tracks);

            setPlaylist(tracks);
            const url = await createSpotifyPlaylist(tracks, "Playlist Personnalisée", accessToken, playlistSize);
            if (url) setPersonalizedPlaylistURL(url);
        } catch (error) {
            console.error("❌ Erreur lors de la génération de la playlist avec Mistral AI:", error);
        } finally {
            setLoadingPersonalized(false);
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
                        <label className="form-label"> Nombre de morceaux à ajouter à la playlist : {playlistSize}</label>
                        <input
                            type="range"
                            className="form-range"
                            min="1"
                            max="50"
                            value={playlistSize}
                            onChange={(e) => setPlaylistSize(parseInt(e.target.value, 10))}
                        />
                    </div>
                {loading ? (
                    <div className="mt-3 text-white">
                        <div className="spinner-border text-success" role="status">
                            <span className="visually-hidden">Chargement...</span>
                        </div>
                        <p className="mt-2">Génération en cours...</p>
                    </div>
                ) : (
                    <button className="btn btn-outline-success mt-3 text-spotify-green" onClick={generatePlaylist}>Générer 🎵</button>
                )}
                </div>

                {promptPlaylistURL && (
                    <div className="text-center mt-4">
                        <a href={promptPlaylistURL} target="_blank" rel="noopener noreferrer" className="btn btn-outline-success text-spotify-green">
                            🎵 Voir la playlist sur Spotify
                        </a>
                    </div>
                )}

                <div className="mt-5 p-4" style={{ backgroundColor: "#282828", borderRadius: "8px", color: "#FFFFFF" }}>
                    <h3 className="text-center text-spotify-green">🎵 Recommandations Basées sur la Musique en Cours</h3>

                    <div className="text-center mb-3">
                        <button className="btn btn-outline-success me-2 text-spotify-green" onClick={handleCheckCurrentTrack}>
                            🎧 Vérifier la musique en cours
                        </button>
                        {currentTrack && (
                            <span className="fs-5 ms-2">🎶 Actuellement : <strong>{currentTrack.title}</strong> - {currentTrack.artist}</span>
                        )}
                    </div>

                    {currentTrack && (
                        <div className="text-center">
                            {loadingRecommendations ? (
                                <div className="text-white mt-3">
                                    <div className="spinner-border text-success" role="status">
                                        <span className="visually-hidden">Chargement...</span>
                                    </div>
                                    <p className="mt-2">Chargement des recommandations...</p>
                                </div>
                            ) : (
                                <button className="btn btn-outline-success me-2 text-spotify-green" onClick={getRecommendationsFromMistral}>
                                    🔍 Obtenir des recommandations
                                </button>
                            )}
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
                                <button className="btn btn-outline-success text-spotify-green" onClick={() => addTracksToQueue(recommendations, accessToken)}>
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


                        {loadingPersonalized ? (
                            <div className="text-center text-white mt-3">
                                <div className="spinner-border text-light" role="status">
                                    <span className="visually-hidden">Chargement...</span>
                                </div>
                                <p className="mt-2">Génération de la playlist personnalisée...</p>
                            </div>
                        ) : (
                            <button type="button" className="btn btn-outline-light w-100 mt-3" onClick={generatePersonalizedPlaylist}>
                                🎵 Générer ma Playlist
                            </button>
                        )}
                    </form>

                    {personalizedPlaylistURL && (
                        <div className="text-center mt-4">
                            <a href={personalizedPlaylistURL} target="_blank" rel="noopener noreferrer" className="btn btn-outline-success">
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