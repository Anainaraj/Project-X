import { AuthProvider, useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'

function AppContent() {
  const { status } = useAuth()
  return status === 'authenticated' ? <DashboardPage /> : <LoginPage />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
