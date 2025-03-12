import { useEffect, useState } from 'react';
import { getValidAccessToken, TOKEN_MISTRALAI, SPOTIFY_API_BASE_URL } from './auth';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Analytics.css';

const DELAY = 200; // ⏳ Pause entre requêtes pour éviter la limite API

function Analytics() {
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(false);

  // États pour stocker les statistiques
  const [totalPlaylists, setTotalPlaylists] = useState(0);
  const [totalTracks, setTotalTracks] = useState(0);
  const [totalDurationHours, setTotalDurationHours] = useState(0);
  const [totalDurationMinutes, setTotalDurationMinutes] = useState(0);
  const [mostListenedGenre, setMostListenedGenre] = useState("");
  const [mostListenedArtist, setMostListenedArtist] = useState("");
  const [recommendedTracks, setRecommendedTracks] = useState([]);

  useEffect(() => {
    const fetchToken = async () => {
      const token = await getValidAccessToken();
      if (token) {
        setAccessToken(token);
        fetchSpotifyData(token);
      }
    };
    fetchToken();
  }, []);

  const fetchSpotifyData = async (token) => {
    try {
      console.log("🚀 Récupération des playlists Spotify...");
      setLoading(true);

      const playlistsResponse = await fetch(`${SPOTIFY_API_BASE_URL}/me/playlists`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const playlistsData = await playlistsResponse.json();

      const playlists = playlistsData.items || [];
      setTotalPlaylists(playlists.length);

      let totalTracksCount = 0;
      let totalDurationMs = 0;
      let allTracksInfo = [];

      for (const playlist of playlists) {
        console.log(`📂 Analyse de la playlist : ${playlist.name}`);
        await new Promise(resolve => setTimeout(resolve, DELAY));

        const playlistResponse = await fetch(`${SPOTIFY_API_BASE_URL}/playlists/${playlist.id}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const playlistData = await playlistResponse.json();

        totalTracksCount += playlistData.tracks.total;
        let playlistDurationMs = 0;

        for (const item of playlistData.tracks.items) {
          if (item.track) {
            playlistDurationMs += item.track.duration_ms;
            allTracksInfo.push({
              title: item.track.name,
              artist: item.track.artists.map(artist => artist.name).join(", "),
            });
          }
        }
        totalDurationMs += playlistDurationMs;
      }

      await analyzeMusicWithMistral(allTracksInfo);

      const totalMinutes = Math.floor(totalDurationMs / 60000);
      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;

      setTotalTracks(totalTracksCount);
      setTotalDurationHours(totalHours);
      setTotalDurationMinutes(remainingMinutes);
      setLoading(false);
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des playlists Spotify :", error);
      setLoading(false);
    }
  };

  const [mistralAnalysis, setMistralAnalysis] = useState(""); // Stocke l'analyse complète

  const analyzeMusicWithMistral = async (tracksInfo) => {
    try {
      console.log("🤖 Envoi des données à Mistral AI...");

      const mistralResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TOKEN_MISTRALAI}`
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [
            {
              role: "system",
              content: "Tu es un expert en analyse musicale. Analyse la liste de morceaux fournie et donne une analyse détaillée des tendances musicales de l'utilisateur."
            },
            {
              role: "user",
              content: `Voici la liste des morceaux et leurs artistes :\n\n${JSON.stringify(tracksInfo)}\n\n
                        Analyse ces morceaux et donne une réponse détaillée sous une forme naturelle et fluide, adaptée à un site web.
                        - Décris le genre musical dominant et pourquoi il ressort.
                        - Mentionne les artistes les plus écoutés et pourquoi.
                        - Détecte des tendances musicales intéressantes.
                        - Propose une recommandation musicale basée sur ces habitudes.
                        Réponds sous forme d'un texte fluide et engageant, sans format JSON.`
            }
          ],
          max_tokens: 300
        })
      });

      const mistralData = await mistralResponse.json();
      console.log("📊 Réponse complète de Mistral AI:", mistralData);

      if (mistralData.choices && mistralData.choices.length > 0) {
        let rawAnalysis = mistralData.choices[0].message.content;

        // Nettoyage du texte pour une meilleure lisibilité
        rawAnalysis = rawAnalysis.replace(/\n{2,}/g, "\n"); // Remplace les multiples sauts de ligne par un seul
        rawAnalysis = rawAnalysis.trim(); // Supprime les espaces inutiles en début et fin

        setMistralAnalysis(rawAnalysis);
        await fetchMusicRecommendations(rawAnalysis);
      } else {
        console.error("❌ Réponse invalide de Mistral AI");
        setMistralAnalysis("Je n'ai pas pu analyser correctement tes playlists.");
      }
    } catch (error) {
      console.error("❌ Erreur avec Mistral AI:", error);
      setMistralAnalysis("Une erreur est survenue lors de l'analyse.");
    }
  };
  const searchSpotifyTrack = async (trackName) => {
    if (!trackName) return null;

    try {
      console.log(`🔍 Recherche originale pour "${trackName}"`);

      // 🔹 Nettoyage de trackName
      let cleanTrackName = trackName.trim()
        .replace(/^["']|["']$/g, '') // Supprime les guillemets au début/fin
        .replace(/\s*-\s*/g, ' ')    // Remplace " - " par un espace simple
        .replace(/\s+/g, ' ');       // Supprime les espaces en trop

      console.log(`🎯 Nom nettoyé pour la requête : "${cleanTrackName}"`);

      // 🔹 Encodage propre pour l'URL
      const query = encodeURIComponent(cleanTrackName);
      const url = `${SPOTIFY_API_BASE_URL}/search?q=${query}&type=track&limit=1`;

      console.log(`🌐 URL Spotify Search : ${url}`);

      let response = await fetch(url, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });

      // 📌 Si le token a expiré, on le rafraîchit et refait la requête
      if (response.status === 401) {
        console.warn("🔄 Token expiré, tentative de rafraîchissement...");
        const newToken = await getValidAccessToken();

        if (!newToken) {
          console.error("❌ Impossible de rafraîchir le token !");
          return null;
        }

        // Mise à jour du token et relance de la requête
        setAccessToken(newToken);
        response = await fetch(url, {
          headers: { "Authorization": `Bearer ${newToken}` }
        });
      }

      const data = await response.json();

      if (data.tracks && data.tracks.items.length > 0) {
        const track = data.tracks.items[0]; // Prendre le premier résultat
        return {
          title: track.name,
          artist: track.artists.map(artist => artist.name).join(", "),
          url: track.external_urls.spotify
        };
      } else {
        console.warn(`⚠️ Aucun résultat trouvé pour "${trackName}"`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la recherche du titre "${trackName}" sur Spotify :`, error);
      return null;
    }
  };
  const fetchMusicRecommendations = async (userAnalysis) => {
    try {
      console.log("🎶 Génération de recommandations musicales...");

      // 🔹 Demander 5 recommandations de musiques à Mistral AI
      const mistralResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TOKEN_MISTRALAI}`
        },
        body: JSON.stringify({
          model: "mistral-medium",
          messages: [
            {
              role: "system",
              content: "Tu es un expert en musique. Propose 5 recommandations musicales adaptées aux goûts de l'utilisateur. Donne juste le nom est l'artiste"
            },
            {
              role: "user",
              content: `Analyse musicale : "${userAnalysis}"\nRecommande 5 morceaux sous ce format :\n- Titre1 - Artiste1\n- Titre2 - Artiste2\n- Titre3 - Artiste3\n- Titre4 - Artiste4\n- Titre5 - Artiste5`
            }
          ],
          max_tokens: 200
        })
      });

      const mistralData = await mistralResponse.json();
      let trackNames = [];
      console.log("📩 )))))))))Réponse brute de Mistral AI :", mistralData);
      trackNames = mistralData.choices[0].message.content
        .split("\n")
        .map(track => track.trim())
        .filter(track => track.length > 0);
      console.log('fffffffffff', trackNames)

      // 🔹 Recherche des 5 musiques sur Spotify
      const searchedTracks = [];
      if (!accessToken) {
        const token = await getValidAccessToken();
        console.log("New ToKEN ", token)
        if (token) {
          console.log("New Token SETTTTTTTTTTTTTTTTTTTT")
          setAccessToken(token);
        }
      }
      for (const track of trackNames) {
        const trackData = await searchSpotifyTrack(track);
        console.log(`🎧 -------------Musique trouvée sur Spotify :`, trackData);
        if (trackData) {
          searchedTracks.push(trackData);
        }
      }
      console.log("🎵++++++++++ Recommandations mises à jour :", searchedTracks);

      // 🔥 Mettre à jour l'état avec les 5 musiques finales
      setRecommendedTracks(searchedTracks);

    } catch (error) {
      console.error("❌ Erreur lors de la récupération des recommandations musicales :", error);
    }
  };
  return (
    <div className="container-fluid bg-dark text-light min-vh-100 py-5">
      <h2 className="text-center fw-bold fs-4">📊 Tableau de bord Spotify</h2>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement...</span>
          </div>
          <p className="mt-3">Analyse en cours...</p>
        </div>
      ) : null}

      <div className="row mt-4">
        <div className="col-md-4">
          <div className="card bg-info text-white text-center p-3">
            <h4>📂 Total Playlists</h4>
            <h2>{totalPlaylists}</h2>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card bg-success text-white text-center p-3">
            <h4>🎵 Total Titres</h4>
            <h2>{totalTracks}</h2>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card bg-secondary text-white text-center p-3">
            <h4>🕰️ Durée Totale des Musiques</h4>
            <h2>{totalDurationHours}h {totalDurationMinutes}min</h2>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="row mt-4">
          <div className="col-md-12">
            <div className="card bg-dark text-white p-4">
              <h4 className="text-warning text-center">🎵 Analyse musicale par Mistral AI</h4>
              <p className="fs-5 text-light">
                {mistralAnalysis || "Analyse en attente..."}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="row mt-4">
        <div className="col-md-12">
          <div className="card bg-dark text-white p-4">
            <h4 className="text-info text-center">🎶 Recommandations musicales</h4>
            {recommendedTracks.length > 0 ? (
              <ul className="list-group">
                {recommendedTracks.map((track, index) => (
                  <li key={index} className="list-group-item bg-dark text-light">
                    <strong>{track.title}</strong> - {track.artist}
                    {track.url && (
                      <a href={track.url} target="_blank" rel="noopener noreferrer" className="text-warning ms-2">
                        🎧 Écouter sur Spotify
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fs-5 text-light text-center">🔍 En attente de recommandations...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;