import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './error-boundary';

function ThrowingComponent(): ReactNode {
	throw new Error('Test error');
}

describe('ErrorBoundary', () => {
	it('renders children when no error', () => {
		render(
			<ErrorBoundary>
				<div>Hello</div>
			</ErrorBoundary>
		);
		expect(screen.getByText('Hello')).toBeTruthy();
	});

	it('renders fallback UI when child throws', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		render(
			<ErrorBoundary>
				<ThrowingComponent />
			</ErrorBoundary>
		);
		expect(screen.getByText('Something went wrong')).toBeTruthy();
		expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy();
	});
});
