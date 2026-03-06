import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/auth-store';

export function LoginPage() {
	const navigate = useNavigate();
	const login = useAuthStore((s) => s.login);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			await login(email, password);
			navigate('/admin/users', { replace: true });
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
			<div className="w-full max-w-sm">
				<h1 className="text-2xl font-bold text-gray-900 text-center mb-8">BudFin</h1>
				<form
					role="form"
					onSubmit={handleSubmit}
					className="bg-white rounded-lg shadow p-6 space-y-4"
				>
					<div>
						<label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
							Email
						</label>
						<input
							id="email"
							type="email"
							required
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
							Password
						</label>
						<input
							id="password"
							type="password"
							required
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					{error && (
						<p role="alert" className="text-sm text-red-600">
							{error}
						</p>
					)}
					<button
						type="submit"
						disabled={loading}
						className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{loading ? 'Signing in...' : 'Sign in'}
					</button>
				</form>
			</div>
		</div>
	);
}
