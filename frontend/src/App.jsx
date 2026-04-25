// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StudySession from './pages/StudySession';
import DeckEditor from './pages/DeckEditor';
import './App.css';

// A simple component to protect private routes
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useContext(AuthContext);

  if (loading) return <div className="ma-loading">Loading...</div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function AppRoutes() {
  const { isAuthenticated } = useContext(AuthContext);

  return (
    <Routes>
      {/* If logged in, go to dashboard. Otherwise, show login */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />

      <Route path="/decks/new" element={
        <ProtectedRoute>
          <DeckEditor />
        </ProtectedRoute>
      } />

      <Route path="/study/:deckId" element={
        <ProtectedRoute>
          <StudySession />
        </ProtectedRoute>
      } />

      {/* Fallback route */}
      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
