import React from 'react';
import ReactDOM from 'react-dom/client';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

import './index.css';
import App from './App';
import Header from './templates/Header';
import SpotifyPlayer from './templates/SpotifyPlayer';
import QueueDisplay from './templates/QueueDisplay'; // 🔹 Ajout de l'import

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    {/* 🔹 Header FIXE en haut */}
    <div className="fixed-top bg-dark text-white shadow p-2">
      <Header />
    </div>

    <div className="container-fluid mt-5">
      <div className="row">
        {/* 🔹 Barre de lecture Spotify FIXE à gauche */}
        <div className="col-md-3 position-fixed h-100 bg-dark text-white p-3 d-flex flex-column">
          <SpotifyPlayer />
          
          {/* 🔹 File d'attente sous le player */}
          <div className="mt-3 p-2 bg-secondary rounded">
            <QueueDisplay />
          </div>
        </div>

        {/* 🔹 Contenu principal SCROLLABLE à droite */}
        <div className="col-md-9 offset-md-3 h-100 overflow-auto bg-dark text-white p-4">
          <App />
        </div>
      </div>
    </div>
  </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
