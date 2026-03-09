import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../stores/auth-store';

export function ProtectedRoute({ roles }: { roles?: string[] }) {
	const { isAuthenticated, isInitializing, user } = useAuthStore();

	if (isInitializing) {
		return (
			<div className="flex h-screen items-center justify-center">
				<p className="text-sm text-(--text-muted)">Loading...</p>
			</div>
		);
	}

	if (!isAuthenticated) return <Navigate to="/login" replace />;
	if (roles && user && !roles.includes(user.role)) {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
}
