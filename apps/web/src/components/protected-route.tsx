import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '../stores/auth-store'

export function ProtectedRoute({ roles }: { roles?: string[] }) {
	const { isAuthenticated, user } = useAuthStore()

	if (!isAuthenticated) return <Navigate to="/login" replace />
	if (roles && user && !roles.includes(user.role)) {
		return <Navigate to="/" replace />
	}

	return <Outlet />
}
