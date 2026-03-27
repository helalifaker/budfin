import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { ExportReportType, ExportFormat } from '@budfin/types';
import { useCreateExportJob, useExportJobStatus } from '../../hooks/use-export';
import { useWorkspaceContextStore } from '../../stores/workspace-context-store';
import { useAuthStore } from '../../stores/auth-store';
import { triggerDownload } from '../../lib/download-utils';
import { toast } from '../ui/toast-state';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { cn } from '../../lib/cn';

// ── Report Type Options ─────────────────────────────────────────────────────

const REPORT_TYPE_OPTIONS: Array<{ value: ExportReportType; label: string }> = [
	{ value: 'PNL', label: 'P&L Income Statement' },
	{ value: 'REVENUE', label: 'Revenue' },
	{ value: 'STAFFING', label: 'Staffing Costs' },
	{ value: 'OPEX', label: 'Operating Expenses' },
	{ value: 'ENROLLMENT', label: 'Enrollment' },
	{ value: 'DASHBOARD', label: 'Dashboard Summary' },
	{ value: 'FULL_BUDGET', label: 'Full Budget Report' },
];

// ── Component ───────────────────────────────────────────────────────────────

interface ExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Pre-select a report type when opening from a specific module. */
	defaultReportType?: ExportReportType;
}

export function ExportDialog({ open, onOpenChange, defaultReportType }: ExportDialogProps) {
	// Key increments each time the dialog opens, remounting ExportDialogBody
	// to reset all form state cleanly (no useEffect, no ref during render).
	const [openKey, setOpenKey] = useState(0);

	function handleOpenChange(next: boolean) {
		if (next) {
			setOpenKey((k) => k + 1);
		}
		onOpenChange(next);
	}

	const bodyProps = defaultReportType ? { onOpenChange, defaultReportType } : { onOpenChange };

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<ExportDialogBody key={openKey} {...bodyProps} />
		</Dialog>
	);
}

function ExportDialogBody({
	onOpenChange,
	defaultReportType,
}: {
	onOpenChange: (open: boolean) => void;
	defaultReportType?: ExportReportType;
}) {
	const versionId = useWorkspaceContextStore((s) => s.versionId);
	const comparisonVersionId = useWorkspaceContextStore((s) => s.comparisonVersionId);

	const [reportType, setReportType] = useState<ExportReportType>(defaultReportType ?? 'PNL');
	const [format, setFormat] = useState<ExportFormat>('PDF');
	const [activeJobId, setActiveJobId] = useState<number | null>(null);

	const createJob = useCreateExportJob();
	const { data: jobStatus } = useExportJobStatus(activeJobId);

	function handleExport() {
		if (!versionId) return;

		const params = comparisonVersionId
			? { versionId, reportType, format, comparisonVersionId }
			: { versionId, reportType, format };
		createJob.mutate(params, {
			onSuccess: (data) => {
				setActiveJobId(data.id);
			},
		});
	}

	async function handleDownload() {
		if (!jobStatus?.downloadUrl) return;
		try {
			const token = useAuthStore.getState().accessToken;
			const response = await fetch(jobStatus.downloadUrl, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				credentials: 'include',
			});
			if (!response.ok) throw new Error(`Download failed: ${response.status}`);
			const blob = await response.blob();
			const disposition = response.headers.get('Content-Disposition') ?? '';
			const nameMatch = /filename="([^"]+)"/.exec(disposition);
			const filename = nameMatch?.[1] ?? 'export';
			triggerDownload(filename, blob);
			onOpenChange(false);
		} catch {
			toast.error('Download failed. Please try again.');
		}
	}

	const isGenerating =
		activeJobId !== null && jobStatus?.status !== 'DONE' && jobStatus?.status !== 'FAILED';
	const isDone = jobStatus?.status === 'DONE';
	const isFailed = jobStatus?.status === 'FAILED';

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Export Report</DialogTitle>
				<DialogDescription>
					Generate a PDF or Excel report from the current budget version.
				</DialogDescription>
			</DialogHeader>

			<div className="space-y-4 py-2">
				{/* Report Type Selector */}
				<div className="space-y-1.5">
					<label
						htmlFor="export-report-type"
						className="text-(--text-sm) font-medium text-(--text-primary)"
					>
						Report Type
					</label>
					<Select
						value={reportType}
						onValueChange={(v) => setReportType(v as ExportReportType)}
						disabled={isGenerating || isDone}
					>
						<SelectTrigger id="export-report-type">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{REPORT_TYPE_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Format Toggle */}
				<div className="space-y-1.5">
					<label className="text-(--text-sm) font-medium text-(--text-primary)">Format</label>
					<ToggleGroup
						type="single"
						value={format}
						onValueChange={(v) => {
							if (v) setFormat(v as ExportFormat);
						}}
						aria-label="Export format"
						disabled={isGenerating || isDone}
					>
						<ToggleGroupItem value="PDF" className="gap-1.5">
							<FileText className="h-4 w-4" aria-hidden="true" />
							PDF
						</ToggleGroupItem>
						<ToggleGroupItem value="EXCEL" className="gap-1.5">
							<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
							Excel
						</ToggleGroupItem>
					</ToggleGroup>
				</div>

				{/* Progress Indicator */}
				{isGenerating && (
					<div
						className={cn(
							'flex items-center gap-3 rounded-lg',
							'border border-(--accent-200) bg-(--accent-50)',
							'px-4 py-3'
						)}
						role="status"
						aria-live="polite"
					>
						<Loader2 className="h-5 w-5 animate-spin text-(--accent-600)" aria-hidden="true" />
						<div>
							<p className="text-(--text-sm) font-medium text-(--accent-700)">
								Generating report...
							</p>
							<p className="text-(--text-xs) text-(--accent-500)">
								{jobStatus?.progress ?? 0}% complete
							</p>
						</div>
					</div>
				)}

				{/* Success */}
				{isDone && (
					<div
						className={cn(
							'flex items-center gap-3 rounded-lg',
							'border border-(--color-success)/20 bg-(--color-success-bg)',
							'px-4 py-3'
						)}
						role="status"
						aria-live="polite"
					>
						<CheckCircle2 className="h-5 w-5 text-(--color-success)" aria-hidden="true" />
						<div>
							<p className="text-(--text-sm) font-medium text-(--color-success)">Report ready</p>
							<p className="text-(--text-xs) text-(--text-muted)">
								Click Download to save the file.
							</p>
						</div>
					</div>
				)}

				{/* Failure */}
				{isFailed && (
					<div
						className={cn(
							'flex items-center gap-3 rounded-lg',
							'border border-(--color-error)/20 bg-(--color-error-bg)',
							'px-4 py-3'
						)}
						role="alert"
					>
						<XCircle className="h-5 w-5 text-(--color-error)" aria-hidden="true" />
						<div>
							<p className="text-(--text-sm) font-medium text-(--color-error)">Export failed</p>
							<p className="text-(--text-xs) text-(--text-muted)">
								{jobStatus?.errorMessage ?? 'An unknown error occurred.'}
							</p>
						</div>
					</div>
				)}
			</div>

			<DialogFooter>
				{isDone ? (
					<Button onClick={handleDownload}>
						<Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
						Download
					</Button>
				) : (
					<Button
						onClick={handleExport}
						disabled={!versionId || isGenerating || createJob.isPending}
					>
						{createJob.isPending || isGenerating ? (
							<>
								<Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
								Generating...
							</>
						) : (
							<>
								<Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
								Export
							</>
						)}
					</Button>
				)}
			</DialogFooter>
		</DialogContent>
	);
}
