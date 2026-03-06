import { Navigate } from 'react-router';
import { useAuthStore } from '../stores/auth-store';

export function LandingRedirect() {
	const user = useAuthStore((state) => state.user);

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	return <Navigate to={user.role === 'Admin' ? '/admin/users' : '/master-data/accounts'} replace />;
}
