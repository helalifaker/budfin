import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PnlTemplate {
	id: number;
	name: string;
	isDefault: boolean;
	version: number;
	createdAt: string;
	updatedAt: string;
}

export interface PnlTemplateSection {
	id: number;
	templateId: number;
	sectionKey: string;
	displayLabel: string;
	displayOrder: number;
	isSubtotal: boolean;
	signConvention: 'POSITIVE' | 'NEGATIVE';
	mappings: PnlAccountMapping[];
}

export interface PnlAccountMapping {
	id: number;
	sectionId: number;
	accountCode: string;
	displayLabel: string | null;
	displayOrder: number;
	visibility: 'SHOW' | 'GROUP';
}

export interface TemplateMappingsResponse {
	id: number;
	name: string;
	isDefault: boolean;
	version: number;
	sections: PnlTemplateSection[];
}

export interface SectionInput {
	sectionKey: string;
	displayLabel: string;
	displayOrder: number;
	isSubtotal: boolean;
	signConvention: 'POSITIVE' | 'NEGATIVE';
	mappings: {
		accountCode: string;
		displayLabel?: string | null;
		displayOrder: number;
		visibility: 'SHOW' | 'GROUP';
	}[];
}

// ── Query Keys ───────────────────────────────────────────────────────────────

export const templateKeys = {
	all: ['pnl-templates'] as const,
	list: () => ['pnl-templates', 'list'] as const,
	mappings: (id: number) => ['pnl-templates', id, 'mappings'] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function usePnlTemplates() {
	return useQuery({
		queryKey: templateKeys.list(),
		queryFn: () => apiClient<{ templates: PnlTemplate[] }>('/master-data/pnl-templates'),
		select: (data) => data.templates,
	});
}

export function useTemplateMappings(templateId: number | undefined) {
	return useQuery({
		queryKey: templateKeys.mappings(templateId!),
		queryFn: () =>
			apiClient<TemplateMappingsResponse>(`/master-data/pnl-templates/${templateId}/mappings`),
		enabled: !!templateId,
	});
}

export function useCreateTemplate() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: { name: string; isDefault?: boolean }) =>
			apiClient<PnlTemplate>('/master-data/pnl-templates', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: templateKeys.all });
		},
	});
}

export function useUpdateTemplate() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...body
		}: {
			id: number;
			name: string;
			isDefault?: boolean;
			version: number;
		}) =>
			apiClient<PnlTemplate>(`/master-data/pnl-templates/${id}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: templateKeys.all });
		},
	});
}

export function useDeleteTemplate() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<void>(`/master-data/pnl-templates/${id}`, { method: 'DELETE' }),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: templateKeys.all });
		},
	});
}

export function useSaveMappings() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ templateId, sections }: { templateId: number; sections: SectionInput[] }) =>
			apiClient<TemplateMappingsResponse>(`/master-data/pnl-templates/${templateId}/mappings`, {
				method: 'PUT',
				body: JSON.stringify({ sections }),
			}),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: templateKeys.all });
		},
	});
}
