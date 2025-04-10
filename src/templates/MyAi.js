import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import SpotAi from '../images/SpotAI.png'
import { predictIntent } from '../hooks/useIntentModel';
import { callMistral } from '../functions/Mistral';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    getValidAccessToken,
    createSpotifyPlaylist
} from "../functions/Spotify"
import { getAccessToken } from '../functions/auth'; // Importer les fonctions d'authentification


const vocab = {
  "crée": 1, "une": 2, "playlist": 3, "de": 4, "rap": 5,
  "lance": 6, "chanson": 7, "ajoute": 8, "cette": 9,
  "musique": 10, "à": 11, "ma": 12, "joue": 13, "la": 14,
  "prochaine": 15, "je": 16, "veux": 17, "nouvelle": 18,
  "mets": 19, "création": 20
};

const tokenizer = (text) => {
  const words = text.toLowerCase().split(' ');
  const tokens = words.map(word => vocab[word] || 0);
  while (tokens.length < 10) tokens.push(0); // padding
  return tokens.slice(0, 10);
};

const detectGenre = (text) => {
  const genres = ["pop", "rap", "rock", "jazz", "classique", "électro", "metal", "lofi"];
  const lowerText = text.toLowerCase();
  return genres.find(g => lowerText.includes(g)) || "Pop";
};

function MyAi() {
  const [query, setQuery] = React.useState('');
  const [accessToken, setAccessToken] = useState(null);
  const [playlistSize, setPlaylistSize] = useState(10);
  const [playlistUrl, setPlaylistUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
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
                navigate("/my-ai");
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

  const handleKeyPress = async (e) => {
    if (e.key === 'Enter') {
      setIsLoading(true);
      try {
        const intentId = await predictIntent(query, tokenizer);
        console.log("🧠 Intent détecté :", intentId);
        if (intentId === 0) {
          const genre = detectGenre(query);
          await createPlaylistFromIntent(genre);
        } else if (intentId === 1) {
          alert("Je lance la chanson !");
        } else {
          alert("Commande non reconnue");
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const createPlaylistFromIntent = async (genre = "Pop") => {
    const messages = [
        { role: "system", content: "Tu es un expert en musique. En fonction des préférences de l'utilisateur, propose une liste de 10 morceaux adaptés." },
        {
            role: "user",
            content: `L'utilisateur a répondu :

        Génère une liste de 10 chansons qui correspondent à ${genre}, sous ce format :
        1. Titre : Nom de la chanson - Artiste : Nom Artiste
        2. Titre : Nom de la chanson - Artiste : Nom Artiste
        3. Titre : Nom de la chanson - Artiste : Nom Artiste
        ...etc.`
        }
    ];
    const tracks = await callMistral(messages);
    const url = await createSpotifyPlaylist(tracks, "Spot'AI", accessToken, playlistSize);
    if (url) {
      setPlaylistUrl(url);
    } else {
      alert("❌ Impossible de créer la playlist.");
    }
  }

  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100">
      <img src={SpotAi} alt="Spot'Ai Logo" style={{ height: '100px', marginBottom: '20px' }} />
      {isLoading && (
        <div className="mb-3 text-white">
          ⏳ Création de ta playlist en cours...
        </div>
      )}
      <input
        type="text"
        className="form-control text-center"
        placeholder="🔍 Rechercher dans My AI..."
        style={{ maxWidth: '400px' }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={handleKeyPress}
      />
      {playlistUrl && (
        <div className="mt-3">
          <a href={playlistUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success">
            🎧 Ouvrir la playlist sur Spotify
          </a>
        </div>
      )}
    </div>
  );
}

export default MyAi;