import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAccessToken, getValidAccessToken } from './auth'; // Importer les fonctions d'authentification

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
      <div className="container-fluid bg-dark text-light min-vh-100">
            <div className="container py-4">
                <h2 className="text-center">🎶 Mes Playlists Spotify</h2>
                <div className="row mt-4">
                    {playlists.length > 0 ? (
                        playlists.map((playlist) => (
                            <div key={playlist.id} className="col-md-4 col-lg-3 mb-4">
                                <div className="card bg-secondary text-white h-100 shadow">
                                    <a href={playlist.external_urls.spotify} target="_blank" rel="noopener noreferrer">
                                        <img src={playlist.images.length > 0 ? playlist.images[0].url : 'https://via.placeholder.com/150'} 
                                             alt={playlist.name} 
                                             className="card-img-top"/>
                                    </a>
                                    <div className="card-body">
                                        <h5 className="card-title">{playlist.name}</h5>
                                        <p className="card-text">👤 {playlist.owner.display_name}</p>
                                        <p className="card-text">🎵 {playlist.tracks.total} titres</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center">Aucune playlist trouvée.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Accueil;