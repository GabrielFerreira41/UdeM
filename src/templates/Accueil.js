import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAccessToken } from '../functions/auth'; // Importer les fonctions d'authentification
import {getValidAccessToken} from "../functions/Spotify"

function Accueil() {
    const [playlists, setPlaylists] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Vérifier si un "code" est dans l'URL (après la redirection Spotify)
        const params = new URLSearchParams(location.search);
        const authorizationCode = params.get("code");

        if (authorizationCode) {
            // Échanger le code contre un access_token
            handleAuthorization(authorizationCode);
        } else {
            // Si pas de code, récupérer les playlists avec un token valide
            fetchPlaylists();
        }
    }, [location]);

    const handleAuthorization = async (code) => {
        const token = await getAccessToken(code);
        if (token) {
            localStorage.setItem("spotify_access_token", token);
            navigate("/"); // Nettoyer l'URL en retirant le code
            fetchPlaylists(); // Charger les playlists une fois authentifié
        }
    };
    
    const fetchPlaylists = async () => {
        try {
            let accessToken = localStorage.getItem("spotify_access_token");

            const response = await fetch("https://api.spotify.com/v1/me/playlists", {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            });

            const data = await response.json();
            setPlaylists(data.items || []);
        } catch (error) {
            console.error("Erreur lors de la récupération des playlists :", error);
        }
    };

    return (
        <div className="container-fluid min-vh-100 bg-dark text-white">
        <div className="container py-4">
            <h2 className="text-center fw-bold fs-4">🎶 Mes Playlists Spotify</h2>
            <div className="row mt-4">
                {playlists.length > 0 ? (
                    playlists.map((playlist) => (
                        <div key={playlist.id} className="col-md-4 col-lg-3 mb-4">
                            <div className="card bg-secondary text-light h-100 shadow-lg border-0">
                                <a href={playlist.external_urls.spotify} target="_blank" rel="noopener noreferrer">
                                    <img src={playlist.images.length > 0 ? playlist.images[0].url : 'https://via.placeholder.com/150'} 
                                         alt={playlist.name} 
                                         className="card-img-top rounded-top"/>
                                </a>
                                <div className="card-body">
                                    <h5 className="card-title fw-bold">{playlist.name}</h5>
                                    <p className="card-text text-muted">👤 {playlist.owner.display_name}</p>
                                    <p className="card-text text-muted">🎵 {playlist.tracks.total} titres</p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-muted fs-5">Aucune playlist trouvée.</p>
                )}
            </div>
        </div>
    </div>
    );
}

export default Accueil;