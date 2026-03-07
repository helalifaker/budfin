import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 3000,
		host: true,
		proxy: {
			'/api': process.env.API_PROXY_TARGET || 'http://localhost:3001',
		},
	},
});
