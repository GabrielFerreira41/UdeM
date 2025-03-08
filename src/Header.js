import React from 'react';
import { Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import {SPOTIFY_AUTH_URL } from './auth'; // Importer les fonctions d'authentification


const handleLogin = () => {
    window.location.href = SPOTIFY_AUTH_URL;
};

function Header() {
    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-4">
            <Link to="/" className="navbar-brand">
                <img src="./mistralAILogo.png" 
                     alt="Mistral AI Logo" 
                     height="40"
                     className="me-2"/>
                Mistral AI Music
            </Link>
            
            <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span className="navbar-toggler-icon"></span>
            </button>

            <div className="collapse navbar-collapse" id="navbarNav">
                <ul className="navbar-nav ms-auto">
                    <li className="nav-item">
                        <Link to="/" className="nav-link">🏠 Accueil</Link>
                    </li>
                    <li className="nav-item">
                        <Link to="/analytics" className="nav-link">📊 Analytics</Link>
                    </li>
                    <li className="nav-item">
                        <Link to="/ai" className="nav-link">🤖 AI</Link>
                    </li>
                    <li className="nav-item">
                        <button className="btn btn-success ms-3" onClick={handleLogin}>🎵 Se connecter</button>
                    </li>
                </ul>
            </div>
        </nav>
    );
}

export default Header;