import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';
import type { CommentResponse, CommentCountResponse } from '@budfin/types';

// ── Query Keys ──────────────────────────────────────────────────────────────

function commentsKey(versionId: number | null, targetType: string, targetId: string) {
	return ['comments', versionId, targetType, targetId] as const;
}

function commentCountsKey(versionId: number | null, targetType: string) {
	return ['comments', 'counts', versionId, targetType] as const;
}

// ── Queries ─────────────────────────────────────────────────────────────────

interface CommentsListResponse {
	comments: CommentResponse[];
}

interface CommentCountsResponse {
	counts: CommentCountResponse[];
}

export function useComments(versionId: number | null, targetType: string, targetId: string) {
	return useQuery({
		queryKey: commentsKey(versionId, targetType, targetId),
		queryFn: () => {
			const params = new URLSearchParams({ targetType, targetId });
			return apiClient<CommentsListResponse>(
				`/versions/${versionId}/comments?${params.toString()}`
			);
		},
		enabled: versionId !== null && targetType.length > 0 && targetId.length > 0,
	});
}

export function useCommentCounts(versionId: number | null, targetType: string) {
	return useQuery({
		queryKey: commentCountsKey(versionId, targetType),
		queryFn: () => {
			const params = new URLSearchParams({ targetType });
			return apiClient<CommentCountsResponse>(
				`/versions/${versionId}/comments/counts?${params.toString()}`
			);
		},
		enabled: versionId !== null && targetType.length > 0,
	});
}

// ── Mutations ───────────────────────────────────────────────────────────────

interface CreateCommentPayload {
	targetType: string;
	targetId: string;
	parentId?: number | null;
	body: string;
}

interface SingleCommentResponse {
	comment: CommentResponse;
}

export function useCreateComment(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateCommentPayload) =>
			apiClient<SingleCommentResponse>(`/versions/${versionId}/comments`, {
				method: 'POST',
				body: JSON.stringify(payload),
			}),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: commentsKey(versionId, variables.targetType, variables.targetId),
			});
			queryClient.invalidateQueries({
				queryKey: commentCountsKey(versionId, variables.targetType),
			});
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create comment'),
	});
}

export function useEditComment(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }: { id: number; body: string }) =>
			apiClient<SingleCommentResponse>(`/versions/${versionId}/comments/${id}`, {
				method: 'PATCH',
				body: JSON.stringify({ body }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['comments', versionId] });
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to edit comment'),
	});
}

export function useResolveComment(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<SingleCommentResponse>(`/versions/${versionId}/comments/${id}/resolve`, {
				method: 'POST',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['comments', versionId] });
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to resolve comment'),
	});
}

export function useUnresolveComment(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<SingleCommentResponse>(`/versions/${versionId}/comments/${id}/unresolve`, {
				method: 'POST',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['comments', versionId] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'Failed to unresolve comment'),
	});
}

export function useDeleteComment(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<void>(`/versions/${versionId}/comments/${id}`, {
				method: 'DELETE',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['comments', versionId] });
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete comment'),
	});
}
