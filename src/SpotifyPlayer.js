import React, { useState, useEffect } from "react";
import { getAccessToken, getValidAccessToken, SPOTIFY_API_BASE_URL } from "./auth"; // Gestion des tokens
import "bootstrap/dist/css/bootstrap.min.css"; // Ajout de Bootstrap

const SpotifyPlayer = () => {
    const [accessToken, setAccessToken] = useState(null);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        fetchAccessToken();
    }, []);

    useEffect(() => {
        if (accessToken) {
            getCurrentPlayingTrack();
        }
    }, [accessToken]);

    // 🔹 Met à jour le timer en temps réel
    useEffect(() => {
        let interval = null;
        if (isPlaying) {
            interval = setInterval(() => {
                setProgress((prevProgress) => {
                    if (prevProgress + 1000 >= duration) {
                        clearInterval(interval);
                        return duration;
                    }
                    return prevProgress + 1000;
                });
            }, 1000);
        } else {
            clearInterval(interval);
        }

        return () => clearInterval(interval);
    }, [isPlaying, duration]);

    // 🔹 Rafraîchir la musique lorsque terminée
    useEffect(() => {
        if (progress >= duration && isPlaying) {
            console.log("⏭️ Chanson terminée, chargement de la suivante...");
            getCurrentPlayingTrack(); // Rafraîchir la musique suivante
        }
    }, [progress, duration, isPlaying]);

    // 🔹 Récupération et gestion du token
    const fetchAccessToken = async () => {
        let token = localStorage.getItem("spotify_access_token");
        if (!token) {
            token = await getValidAccessToken();
        }
        if (token) {
            setAccessToken(token);
        }
    };

    // 🔹 Récupérer la musique en cours de lecture
    const getCurrentPlayingTrack = async () => {
        if (!accessToken) return;

        try {
            const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            if (response.status === 204) {
                setCurrentTrack(null);
                setIsPlaying(false);
                return;
            }

            const data = await response.json();
            if (data && data.item) {
                setCurrentTrack({
                    title: data.item.name,
                    artist: data.item.artists.map(artist => artist.name).join(", "),
                    albumArt: data.item.album.images[0]?.url || "",
                });
                setProgress(data.progress_ms);
                setDuration(data.item.duration_ms);
                setIsPlaying(data.is_playing);
            }
        } catch (error) {
            console.error("Erreur lors de la récupération de la musique en cours :", error);
        }
    };

    // 🔹 Fonction Play/Pause
    const togglePlayPause = async () => {
        if (!accessToken) return;

        try {
            const url = isPlaying
                ? `${SPOTIFY_API_BASE_URL}/me/player/pause`
                : `${SPOTIFY_API_BASE_URL}/me/player/play`;

            await fetch(url, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            setIsPlaying(!isPlaying);
        } catch (error) {
            console.error("Erreur lors du changement de statut Play/Pause :", error);
        }
    };

    // 🔹 Fonction Suivant
    const nextTrack = async () => {
        if (!accessToken) return;

        try {
            await fetch(`${SPOTIFY_API_BASE_URL}/me/player/next`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            getCurrentPlayingTrack();
        } catch (error) {
            console.error("Erreur lors du passage à la musique suivante :", error);
        }
    };

    // 🔹 Fonction Précédent
    const previousTrack = async () => {
        if (!accessToken) return;

        try {
            await fetch(`${SPOTIFY_API_BASE_URL}/me/player/previous`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            getCurrentPlayingTrack();
        } catch (error) {
            console.error("Erreur lors du retour à la musique précédente :", error);
        }
    };

    // 🔹 Fonction pour afficher le temps formaté (mm:ss)
    const formatTime = (ms) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    return (
        <div className="container d-flex justify-content-center mt-4">
            <div className="card bg-dark text-white text-center p-3 w-100">
                {currentTrack ? (
                    <>
                        {/* Image de l'album */}
                        <img src={currentTrack.albumArt} alt="Cover" className="card-img-top mx-auto d-block rounded w-75" />

                        {/* Infos musique */}
                        <div className="card-body">
                            <h5 className="card-title">{currentTrack.title}</h5>
                            <p className="card-text">{currentTrack.artist}</p>

                            {/* Timer + Progress bar */}
                            <div className="d-flex justify-content-between">
                                <span className="text-muted">{formatTime(progress)}</span>
                                <span className="text-muted">{formatTime(duration)}</span>
                            </div>
                            <div className="progress">
                                <div className="progress-bar bg-success" role="progressbar"
                                    style={{ width: `${(progress / duration) * 100}%` }} />
                            </div>

                            {/* Boutons de contrôle */}
                            <div className="d-flex justify-content-center mt-3 gap-2">
                                <button className="btn btn-outline-light" onClick={previousTrack}>⏮️</button>
                                <button className="btn btn-light" onClick={togglePlayPause}>
                                    {isPlaying ? "⏸️" : "▶️"}
                                </button>
                                <button className="btn btn-outline-light" onClick={nextTrack}>⏭️</button>
                            </div>
                        </div>
                    </>
                ) : (
                    <p>Aucune musique en cours.</p>
                )}
            </div>
        </div>
    );
};

export default SpotifyPlayer;