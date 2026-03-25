export interface CommentResponse {
	id: number;
	versionId: number;
	targetType: string;
	targetId: string;
	parentId: number | null;
	authorId: number;
	authorEmail: string;
	body: string;
	resolvedAt: string | null;
	resolvedByEmail: string | null;
	createdAt: string;
	updatedAt: string;
	replies: CommentResponse[];
}

export interface CommentCountResponse {
	targetId: string;
	unresolvedCount: number;
}
