import { Navigate } from 'react-router-dom'
import { useAdminStore } from '../stores/adminStore'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAdminStore(s => s.isAuthenticated)
  if (!isAuthenticated()) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
