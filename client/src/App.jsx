import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './layouts/PublicLayout';
import SidebarLayout from './layouts/SidebarLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import About from './pages/About';
import Projects from './pages/Projects';
import UploadAnalyze from './pages/UploadAnalyze';
import AnalysisDashboard from './pages/AnalysisDashboard';
import Trends from './pages/Trends';
import GapAnalysis from './pages/GapAnalysis';
import Novelty from './pages/Novelty';
import Report from './pages/Report';
import Recommendations from './pages/Recommendations';
import PlagiarismChecker from './pages/PlagiarismChecker';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/about" element={<About />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<PublicLayout />}>
              <Route path="/dashboard" element={<Projects />} />
            </Route>

            <Route path="/projects/:projectId" element={<SidebarLayout />}>
              <Route path="upload" element={<UploadAnalyze />} />
              <Route path="analysis" element={<AnalysisDashboard />} />
              <Route path="trends" element={<Trends />} />
              <Route path="gaps" element={<GapAnalysis />} />
              <Route path="recommendations" element={<Recommendations />} />
              <Route path="novelty" element={<Novelty />} />
              <Route path="plagiarism" element={<PlagiarismChecker />} />
              <Route path="report" element={<Report />} />
            </Route>

            <Route path="/analyze" element={<SidebarLayout />}>
              <Route index element={<UploadAnalyze />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
