import React from 'react';
import { Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import {SPOTIFY_AUTH_URL } from '../functions/auth'; // Importer les fonctions d'authentification


const handleLogin = () => {
    window.location.href = SPOTIFY_AUTH_URL;
};

function Header() {
    return (
        <nav className="navbar navbar-expand-lg" style={{ background: "linear-gradient(to bottom, #121212, #181818)" }}>
            <Link to="/" className="navbar-brand" style={{ color: "#FFFFFF" }}>
                <img src="/SpotifyLogo.png" 
                     alt="Spotify Logo" 
                     height="40"
                     className="me-2 img-fluid"/>
                Spotif'AI
            </Link>
            
            <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span className="navbar-toggler-icon"></span>
            </button>

            <div className="collapse navbar-collapse" id="navbarNav">
                <ul className="navbar-nav ms-auto">
                    <li className="nav-item">
                    <Link to="/" className="nav-link text-spotify-green" style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: "18px" }} onMouseOver={e => e.currentTarget.style.opacity = 0.8} onMouseOut={e => e.currentTarget.style.opacity = 1}>🏠 Accueil</Link>
                    </li>
                    <li className="nav-item">
                    <Link to="/analytics" className="nav-link text-spotify-green" style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: "18px" }} onMouseOver={e => e.currentTarget.style.opacity = 0.8} onMouseOut={e => e.currentTarget.style.opacity = 1}>📊 Analytics</Link>
                    </li>
                    <li className="nav-item">
                    <Link to="/ai" className="nav-link text-spotify-green" style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: "18px" }} onMouseOver={e => e.currentTarget.style.opacity = 0.8} onMouseOut={e => e.currentTarget.style.opacity = 1}>🤖 AI</Link>
                    </li>
                    <li className="nav-item">
                    <button className="btn" style={{ backgroundColor: "#1DB954", borderRadius: "8px" }} onMouseOver={e => e.currentTarget.style.opacity = 0.8} onMouseOut={e => e.currentTarget.style.opacity = 1} onClick={handleLogin}>🎵 Se connecter</button>
                    </li>
                </ul>
            </div>
        </nav>
    );
}

export default Header;