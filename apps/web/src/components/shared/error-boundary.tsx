import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		// eslint-disable-next-line no-console
		console.error('ErrorBoundary caught:', error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex min-h-screen items-center justify-center bg-(--workspace-bg)">
					<div className="flex max-w-md flex-col items-center gap-4 text-center">
						<AlertTriangle className="h-12 w-12 text-(--color-error)" />
						<h1 className="text-xl font-semibold text-(--text-primary)">Something went wrong</h1>
						<p className="text-sm text-(--text-muted)">
							An unexpected error occurred. Please reload the page to continue.
						</p>
						{import.meta.env.DEV && this.state.error && (
							<pre className="max-w-full overflow-auto rounded border p-3 text-left text-xs">
								{this.state.error.message}
							</pre>
						)}
						<Button onClick={() => window.location.reload()} variant="default">
							<RotateCcw className="mr-2 h-4 w-4" />
							Reload Page
						</Button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
