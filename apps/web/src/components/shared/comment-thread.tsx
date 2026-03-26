import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, CornerDownRight, Pencil, Trash2, Undo2 } from 'lucide-react';
import type { CommentResponse } from '@budfin/types';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../stores/auth-store';
import {
	useComments,
	useCreateComment,
	useEditComment,
	useResolveComment,
	useUnresolveComment,
	useDeleteComment,
} from '../../hooks/use-comments';

// ── Props ───────────────────────────────────────────────────────────────────

interface CommentThreadProps {
	versionId: number;
	targetType: string;
	targetId: string;
	className?: string;
}

// ── Single Comment ──────────────────────────────────────────────────────────

interface CommentItemProps {
	comment: CommentResponse;
	versionId: number;
	isReply?: boolean;
}

function CommentItem({ comment, versionId, isReply = false }: CommentItemProps) {
	const currentUser = useAuthStore((s) => s.user);
	const isAuthor = currentUser?.id === comment.authorId;
	const [isEditing, setIsEditing] = useState(false);
	const [editBody, setEditBody] = useState(comment.body);

	const editMutation = useEditComment(versionId);
	const deleteMutation = useDeleteComment(versionId);

	function handleSaveEdit() {
		const trimmed = editBody.trim();
		if (!trimmed || trimmed === comment.body) {
			setIsEditing(false);
			return;
		}
		editMutation.mutate(
			{ id: comment.id, body: trimmed },
			{
				onSuccess: () => setIsEditing(false),
			}
		);
	}

	function handleDelete() {
		deleteMutation.mutate(comment.id);
	}

	const relativeTime = formatDistanceToNow(new Date(comment.createdAt), {
		addSuffix: true,
	});

	return (
		<div className={cn('group', isReply && 'ml-6 mt-2')}>
			<div className="flex items-start gap-2">
				{isReply && <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-(--text-muted)" />}
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 text-xs">
						<span className="font-medium text-(--text-primary)">{comment.authorEmail}</span>
						<span className="text-(--text-muted)">{relativeTime}</span>
						{comment.resolvedAt && (
							<span className="rounded bg-(--badge-resolved-bg) px-1.5 py-0.5 text-(length:--text-2xs) font-medium text-(--badge-resolved)">
								Resolved
							</span>
						)}
					</div>
					{isEditing ? (
						<div className="mt-1 space-y-1.5">
							<Textarea
								value={editBody}
								onChange={(e) => setEditBody(e.target.value)}
								className="min-h-[60px] text-sm"
								autoFocus
							/>
							<div className="flex gap-1.5">
								<Button
									size="sm"
									variant="primary"
									onClick={handleSaveEdit}
									loading={editMutation.isPending}
								>
									Save
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										setIsEditing(false);
										setEditBody(comment.body);
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<p className="mt-0.5 whitespace-pre-wrap text-sm text-(--text-secondary)">
							{comment.body}
						</p>
					)}
					{!isEditing && isAuthor && (
						<div className="mt-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="inline-flex items-center gap-1 text-xs text-(--text-muted) hover:text-(--text-primary)"
								aria-label="Edit comment"
							>
								<Pencil className="h-3 w-3" />
								Edit
							</button>
							<button
								type="button"
								onClick={handleDelete}
								className="inline-flex items-center gap-1 text-xs text-(--text-muted) hover:text-(--color-error)"
								aria-label="Delete comment"
							>
								<Trash2 className="h-3 w-3" />
								Delete
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ── Root Comment with Replies ───────────────────────────────────────────────

interface RootCommentProps {
	comment: CommentResponse;
	versionId: number;
	targetType: string;
	targetId: string;
}

function RootComment({ comment, versionId, targetType, targetId }: RootCommentProps) {
	const [replyOpen, setReplyOpen] = useState(false);
	const [replyBody, setReplyBody] = useState('');

	const createMutation = useCreateComment(versionId);
	const resolveMutation = useResolveComment(versionId);
	const unresolveMutation = useUnresolveComment(versionId);

	function handleReply() {
		const trimmed = replyBody.trim();
		if (!trimmed) return;
		createMutation.mutate(
			{ targetType, targetId, parentId: comment.id, body: trimmed },
			{
				onSuccess: () => {
					setReplyBody('');
					setReplyOpen(false);
				},
			}
		);
	}

	function handleResolve() {
		resolveMutation.mutate(comment.id);
	}

	function handleUnresolve() {
		unresolveMutation.mutate(comment.id);
	}

	return (
		<div
			className={cn(
				'rounded-md border border-(--workspace-border) p-3',
				comment.resolvedAt && 'opacity-60'
			)}
		>
			<CommentItem comment={comment} versionId={versionId} />

			{/* Replies */}
			{comment.replies.length > 0 && (
				<div className="mt-2 space-y-1 border-l-2 border-(--workspace-border) pl-1">
					{comment.replies.map((reply) => (
						<CommentItem key={reply.id} comment={reply} versionId={versionId} isReply />
					))}
				</div>
			)}

			{/* Actions */}
			<div className="mt-2 flex items-center gap-2">
				{!replyOpen && (
					<button
						type="button"
						onClick={() => setReplyOpen(true)}
						className="text-xs text-(--accent-600) hover:text-(--accent-700)"
					>
						Reply
					</button>
				)}
				{comment.resolvedAt ? (
					<button
						type="button"
						onClick={handleUnresolve}
						className="inline-flex items-center gap-1 text-xs text-(--text-muted) hover:text-(--accent-600)"
						aria-label="Unresolve thread"
					>
						<Undo2 className="h-3 w-3" />
						Reopen
					</button>
				) : (
					<button
						type="button"
						onClick={handleResolve}
						className="inline-flex items-center gap-1 text-xs text-(--color-success) hover:text-(--color-success)"
						aria-label="Resolve thread"
					>
						<CheckCircle2 className="h-3 w-3" />
						Resolve
					</button>
				)}
			</div>

			{/* Reply input */}
			{replyOpen && (
				<div className="mt-2 space-y-1.5 ml-6">
					<Textarea
						placeholder="Write a reply..."
						value={replyBody}
						onChange={(e) => setReplyBody(e.target.value)}
						className="min-h-[60px] text-sm"
						autoFocus
					/>
					<div className="flex gap-1.5">
						<Button
							size="sm"
							variant="primary"
							onClick={handleReply}
							loading={createMutation.isPending}
							disabled={!replyBody.trim()}
						>
							Reply
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								setReplyOpen(false);
								setReplyBody('');
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

// ── Main Component ──────────────────────────────────────────────────────────

export function CommentThread({ versionId, targetType, targetId, className }: CommentThreadProps) {
	const [newBody, setNewBody] = useState('');
	const { data, isLoading } = useComments(versionId, targetType, targetId);
	const createMutation = useCreateComment(versionId);

	const comments = data?.comments ?? [];

	function handleCreate() {
		const trimmed = newBody.trim();
		if (!trimmed) return;
		createMutation.mutate(
			{ targetType, targetId, body: trimmed },
			{
				onSuccess: () => setNewBody(''),
			}
		);
	}

	return (
		<div className={cn('space-y-3', className)}>
			{/* New comment input */}
			<div className="space-y-1.5">
				<Textarea
					placeholder="Add a comment..."
					value={newBody}
					onChange={(e) => setNewBody(e.target.value)}
					className="min-h-[60px] text-sm"
				/>
				<Button
					size="sm"
					variant="primary"
					onClick={handleCreate}
					loading={createMutation.isPending}
					disabled={!newBody.trim()}
				>
					Comment
				</Button>
			</div>

			{/* Comments list */}
			{isLoading && <p className="text-xs text-(--text-muted)">Loading comments...</p>}

			{!isLoading && comments.length === 0 && (
				<p className="text-xs text-(--text-muted)">No comments yet.</p>
			)}

			{comments.map((comment) => (
				<RootComment
					key={comment.id}
					comment={comment}
					versionId={versionId}
					targetType={targetType}
					targetId={targetId}
				/>
			))}
		</div>
	);
}
