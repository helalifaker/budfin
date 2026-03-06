import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { LoginPage } from './pages/login';

describe('App', () => {
	it('renders login page at /login', () => {
		const router = createMemoryRouter([{ path: '/login', element: <LoginPage /> }], {
			initialEntries: ['/login'],
		});
		render(<RouterProvider router={router} />);
		expect(screen.getByText('BudFin')).toBeDefined();
		expect(screen.getByLabelText('Email')).toBeDefined();
		expect(screen.getByLabelText('Password')).toBeDefined();
		expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
	});
});
