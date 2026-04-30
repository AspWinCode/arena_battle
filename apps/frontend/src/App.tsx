import { Routes, Route, Navigate } from 'react-router-dom'
import JoinPage from './pages/JoinPage'
import BattlePage from './pages/BattlePage'
import LearnPage from './pages/LearnPage'
import LearningBattlePage from './pages/LearningBattlePage'
import TournamentsPage from './pages/TournamentsPage'
import TournamentDetailPage from './pages/TournamentDetailPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSessionNew from './pages/admin/AdminSessionNew'
import AdminSessionDetail from './pages/admin/AdminSessionDetail'
import AdminTournaments from './pages/admin/AdminTournaments'
import AdminTournamentNew from './pages/admin/AdminTournamentNew'
import AdminTournamentDetail from './pages/admin/AdminTournamentDetail'
import { ProtectedRoute } from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/join" replace />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/battle/:sessionId" element={<BattlePage />} />
      <Route path="/learn" element={<LearnPage />} />
      <Route path="/learn/:missionId" element={<LearningBattlePage />} />
      <Route path="/tournaments" element={<TournamentsPage />} />
      <Route path="/tournaments/:id" element={<TournamentDetailPage />} />

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/session/new" element={<ProtectedRoute><AdminSessionNew /></ProtectedRoute>} />
      <Route path="/admin/session/:id" element={<ProtectedRoute><AdminSessionDetail /></ProtectedRoute>} />
      <Route path="/admin/tournaments" element={<ProtectedRoute><AdminTournaments /></ProtectedRoute>} />
      <Route path="/admin/tournaments/new" element={<ProtectedRoute><AdminTournamentNew /></ProtectedRoute>} />
      <Route path="/admin/tournaments/:id" element={<ProtectedRoute><AdminTournamentDetail /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/join" replace />} />
    </Routes>
  )
}
