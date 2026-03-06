import { useAuthStore } from '../stores/auth-store';

const BASE_URL = '/api/v1';

interface ApiOptions extends RequestInit {
	skipAuth?: boolean;
}

export class ApiError extends Error {
	status: number;
	code: string;
	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

async function parseErrorResponse(response: Response): Promise<ApiError> {
	try {
		const body = await response.json();
		return new ApiError(
			response.status,
			body.code ?? 'UNKNOWN_ERROR',
			body.message ?? `API error: ${response.status}`
		);
	} catch {
		return new ApiError(response.status, 'UNKNOWN_ERROR', `API error: ${response.status}`);
	}
}

export async function apiClient<T>(path: string, options: ApiOptions = {}): Promise<T> {
	const { skipAuth, ...fetchOptions } = options;
	const headers = new Headers(fetchOptions.headers);

	if (!skipAuth) {
		const token = useAuthStore.getState().accessToken;
		if (token) {
			headers.set('Authorization', `Bearer ${token}`);
		}
	}

	if (fetchOptions.body && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	const response = await fetch(`${BASE_URL}${path}`, {
		...fetchOptions,
		headers,
		credentials: 'include',
	});

	if (response.status === 401 && !skipAuth) {
		const refreshed = await useAuthStore.getState().refresh();
		if (refreshed) {
			const newToken = useAuthStore.getState().accessToken;
			headers.set('Authorization', `Bearer ${newToken}`);
			const retryResponse = await fetch(`${BASE_URL}${path}`, {
				...fetchOptions,
				headers,
				credentials: 'include',
			});
			if (!retryResponse.ok) throw await parseErrorResponse(retryResponse);
			if (retryResponse.status === 204) return undefined as T;
			return retryResponse.json();
		}
		useAuthStore.getState().logout();
		throw await parseErrorResponse(response);
	}

	if (!response.ok) throw await parseErrorResponse(response);
	if (response.status === 204) return undefined as T;
	return response.json();
}
