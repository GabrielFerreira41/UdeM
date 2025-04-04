import { Routes, Route } from 'react-router-dom';
import Accueil from './templates/Accueil';
import Ai from './templates/Ai';
import Analytics from './templates/Analytics';

function App() {
    return (
        <div className="container-fluid bg-dark text-light min-vh-100">
            <Routes>
                <Route path="/" element={<Accueil />} />
                <Route path="/ai" element={<Ai />} />
                <Route path="/analytics" element={<Analytics />} />
            </Routes>
        </div>
    );
}

export default App;