import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import JoinPage from './pages/JoinPage'
import BattlePage from './pages/BattlePage'
import LearnPage from './pages/LearnPage'
import LearningBattlePage from './pages/LearningBattlePage'
import SparringPage from './pages/SparringPage'
import DailyPage from './pages/DailyPage'
import LeaderboardPage from './pages/LeaderboardPage'
import TournamentsPage from './pages/TournamentsPage'
import TournamentDetailPage from './pages/TournamentDetailPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import PublicProfilePage from './pages/PublicProfilePage'
import ChallengePage from './pages/ChallengePage'
import NotificationsPage from './pages/NotificationsPage'
import SpectatorPage from './pages/SpectatorPage'
import ClansPage from './pages/ClansPage'
import ClanDetailPage from './pages/ClanDetailPage'
import CreateClanPage from './pages/CreateClanPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSessionNew from './pages/admin/AdminSessionNew'
import AdminSessionDetail from './pages/admin/AdminSessionDetail'
import AdminTournaments from './pages/admin/AdminTournaments'
import AdminTournamentNew from './pages/admin/AdminTournamentNew'
import AdminTournamentDetail from './pages/admin/AdminTournamentDetail'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import DemoBattlePage from './pages/DemoBattlePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import AchievementToast from './components/AchievementToast'

export default function App() {
  return (
    <>
    <AchievementToast />
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/demo"              element={<DemoBattlePage />} />
      <Route path="/battle/:sessionId" element={<BattlePage />} />
      <Route path="/learn" element={<LearnPage />} />
      <Route path="/learn/:missionId" element={<LearningBattlePage />} />
      <Route path="/sparring" element={<SparringPage />} />
      <Route path="/daily"       element={<DailyPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/tournaments" element={<TournamentsPage />} />
      <Route path="/tournaments/:id" element={<TournamentDetailPage />} />

      {/* User auth & profiles */}
      <Route path="/register"         element={<RegisterPage />} />
      <Route path="/login"            element={<LoginPage />} />
      <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
      <Route path="/profile"  element={<ProfilePage />} />
      <Route path="/profile/:username" element={<PublicProfilePage />} />
      <Route path="/challenge/:id" element={<ChallengePage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/spectate/:sessionId" element={<SpectatorPage />} />
      <Route path="/clans" element={<ClansPage />} />
      <Route path="/clans/create" element={<CreateClanPage />} />
      <Route path="/clans/:id" element={<ClanDetailPage />} />

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/session/new" element={<ProtectedRoute><AdminSessionNew /></ProtectedRoute>} />
      <Route path="/admin/session/:id" element={<ProtectedRoute><AdminSessionDetail /></ProtectedRoute>} />
      <Route path="/admin/tournaments" element={<ProtectedRoute><AdminTournaments /></ProtectedRoute>} />
      <Route path="/admin/tournaments/new" element={<ProtectedRoute><AdminTournamentNew /></ProtectedRoute>} />
      <Route path="/admin/tournaments/:id" element={<ProtectedRoute><AdminTournamentDetail /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
