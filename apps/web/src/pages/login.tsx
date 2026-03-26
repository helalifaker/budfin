import { useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '../lib/cn';
import { useAuthStore } from '../stores/auth-store';
import { AnimatedGradient } from '../components/shared/animated-gradient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

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
			navigate('/', { replace: true });
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
			<AnimatedGradient />

			<div
				className={cn('relative z-10 w-full max-w-sm', 'animate-scale-in')}
				style={{
					animationDuration: 'var(--duration-slow)',
					animationTimingFunction: 'var(--ease-out-expo)',
				}}
			>
				{/* Logo */}
				<div className="flex items-center justify-center gap-3 mb-8">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent-500)">
						<span className="text-lg font-bold text-(--text-on-dark)">B</span>
					</div>
					<span className="text-2xl font-bold text-(--text-on-dark)">BudFin</span>
				</div>

				{/* Glassmorphic card */}
				<form
					role="form"
					onSubmit={handleSubmit}
					className={cn(
						'rounded-2xl p-8 space-y-5',
						'bg-white/10 backdrop-blur-xl',
						'border border-white/20',
						'shadow-(--shadow-lg)'
					)}
				>
					<div className="text-center mb-6">
						<h1 className="text-(--text-xl) font-semibold text-(--text-on-dark)">Welcome back</h1>
						<p className="mt-1 text-(--text-sm) text-(--text-on-dark-muted)">
							Sign in to your account
						</p>
					</div>

					<div>
						<label
							htmlFor="email"
							className="block text-(--text-sm) font-medium text-white/80 mb-1.5"
						>
							Email
						</label>
						<Input
							id="email"
							type="email"
							required
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={cn(
								'bg-white/10 border-white/20 text-(--text-on-dark)',
								'placeholder:text-white/40',
								'focus:border-(--accent-400) focus:shadow-(--shadow-glow-accent)'
							)}
							placeholder="you@example.com"
						/>
					</div>

					<div>
						<label
							htmlFor="password"
							className="block text-(--text-sm) font-medium text-white/80 mb-1.5"
						>
							Password
						</label>
						<Input
							id="password"
							type="password"
							required
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={cn(
								'bg-white/10 border-white/20 text-(--text-on-dark)',
								'placeholder:text-white/40',
								'focus:border-(--accent-400) focus:shadow-(--shadow-glow-accent)'
							)}
							placeholder="Enter your password"
						/>
					</div>

					{error && (
						<div
							role="alert"
							className={cn(
								'rounded-md px-3 py-2',
								'bg-(--color-error)/15 border border-(--color-error)/30',
								'text-(--text-sm) text-(--text-on-dark)',
								'animate-shake'
							)}
						>
							{error}
						</div>
					)}

					<Button
						type="submit"
						variant="primary"
						disabled={loading}
						loading={loading}
						className={cn(
							'w-full h-10',
							'bg-(--accent-500) hover:bg-(--accent-600)',
							'active:scale-[0.98]',
							'transition-all duration-(--duration-fast)'
						)}
					>
						{loading ? 'Signing in...' : 'Sign in'}
					</Button>
				</form>
			</div>
		</div>
	);
}
