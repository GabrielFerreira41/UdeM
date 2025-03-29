import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAccessToken } from "../functions/auth";
import {SPOTIFY_API_BASE,getValidAccessToken} from "../functions/Spotify"
const QueueDisplay = () => {
    const [accessToken, setAccessToken] = useState(null);
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(false);
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
                localStorage.setItem("spotify_access_token", token);
                navigate("/queue");
            }
        } catch (error) {
            console.error("❌ Erreur lors de l'obtention du token :", error);
        }
    };

    const fetchAccessToken = async () => {
        try {
            let token = localStorage.getItem("spotify_access_token");

            if (!token) {
                console.log("🔄 Aucun token trouvé, tentative de récupération...");
                token = await getValidAccessToken();
            }

            if (token) {
                setAccessToken(token);
                console.log("✅ Access Token récupéré et utilisé :", token);
                fetchQueue(token);
            } else {
                console.warn("⚠️ Impossible d'obtenir un token.");
            }
        } catch (error) {
            console.error("❌ Erreur lors de la récupération du token :", error);
        }
    };

    const fetchQueue = async (token) => {
        if (!token) {
            console.warn("⚠️ Aucun token d'accès disponible.");
            return;
        }

        try {
            console.log("📡 Récupération de la file d'attente Spotify...");
            setLoading(true);

            const response = await fetch(`${SPOTIFY_API_BASE}/me/player/queue`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.status === 401) {
                console.warn("🔄 Token expiré, tentative de récupération...");
                const newToken = await getValidAccessToken();
                if (newToken) {
                    setAccessToken(newToken);
                    return fetchQueue(newToken);
                }
                return;
            }

            if (response.status === 204) {
                console.warn("ℹ️ Aucune musique en attente.");
                setQueue([]);
                setLoading(false);
                return;
            }

            if (response.status !== 200) {
                console.error(`❌ Erreur API Spotify (Code: ${response.status})`);
                setQueue([]);
                setLoading(false);
                return;
            }

            const data = await response.json();
            console.log("🎶 Données reçues :", data);

            setQueue(data.queue || []);
            setLoading(false);
        } catch (error) {
            console.error("❌ Erreur lors de la récupération de la file d'attente :", error);
            setLoading(false);
        }
    };

    return (
    <div className="mt-3 h-50 overflow-auto">
            {loading ? (
                <p className="text-center text-muted">Chargement...</p>
            ) : (
                <ul className="list-group">
                    {queue.length > 0 ? (
                        queue.map((track, index) => (
                            <li key={index} className="list-group-item bg-dark text-white">
                                {track.name} - {track.artists.map(artist => artist.name).join(", ")}
                            </li>
                        ))
                    ) : (
                        <li className="list-group-item bg-dark text-white text-center">Aucune musique à suivre</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default QueueDisplay;