import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { cn } from '../../lib/cn';
import { useImportEmployees, type ImportValidateResponse } from '../../hooks/use-staffing';
import { Upload } from 'lucide-react';

export type EmployeeImportDialogProps = {
	open: boolean;
	onClose: () => void;
	versionId: number;
};

export function EmployeeImportDialog({ open, onClose, versionId }: EmployeeImportDialogProps) {
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<ImportValidateResponse | null>(null);
	const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
	const fileInputRef = useRef<HTMLInputElement>(null);
	const importMutation = useImportEmployees(versionId);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		if (f) setFile(f);
	};

	const handleValidate = async () => {
		if (!file) return;
		importMutation.mutate(
			{ file, mode: 'validate' },
			{
				onSuccess: (data) => {
					setPreview(data as ImportValidateResponse);
					setStep('preview');
				},
			}
		);
	};

	const handleCommit = async () => {
		if (!file) return;
		importMutation.mutate(
			{ file, mode: 'commit' },
			{
				onSuccess: () => {
					setStep('done');
				},
			}
		);
	};

	const handleClose = () => {
		setFile(null);
		setPreview(null);
		setStep('upload');
		importMutation.reset();
		onClose();
	};

	return (
		<Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
			<DialogContent className="max-w-lg" aria-label="Import employees">
				<DialogHeader>
					<DialogTitle>Import Employees from Excel</DialogTitle>
					<DialogDescription>
						Upload an xlsx file with employee data. Required columns: employee_code, name,
						function_role, department, joining_date, base_salary, housing_allowance,
						transport_allowance.
					</DialogDescription>
				</DialogHeader>

				{step === 'upload' && (
					<div className="space-y-4 pt-2">
						<div
							className={cn(
								'flex flex-col items-center gap-3 rounded-lg',
								'border-2 border-dashed border-[var(--workspace-border)]',
								'bg-[var(--workspace-bg-subtle)] p-8',
								'cursor-pointer hover:border-[var(--accent-500)]',
								'transition-colors'
							)}
							onClick={() => fileInputRef.current?.click()}
							onKeyDown={(e) => {
								if (e.key === 'Enter') fileInputRef.current?.click();
							}}
							role="button"
							tabIndex={0}
							aria-label="Select xlsx file"
						>
							<Upload className="h-8 w-8 text-[var(--text-muted)]" />
							<span className="text-sm text-[var(--text-muted)]">
								{file ? file.name : 'Click to select .xlsx file'}
							</span>
							<input
								ref={fileInputRef}
								type="file"
								accept=".xlsx,.xls"
								onChange={handleFileSelect}
								className="hidden"
								aria-label="File input"
							/>
						</div>

						{importMutation.isError && (
							<div
								className="rounded-lg border border-[var(--color-error)] bg-[var(--color-error-bg)] px-4 py-2 text-sm text-[var(--color-error)]"
								role="alert"
							>
								{importMutation.error instanceof Error
									? importMutation.error.message
									: 'Validation failed'}
							</div>
						)}

						<div className="flex justify-end gap-2">
							<Button variant="outline" size="sm" onClick={handleClose}>
								Cancel
							</Button>
							<Button
								size="sm"
								disabled={!file || importMutation.isPending}
								onClick={handleValidate}
							>
								{importMutation.isPending ? 'Validating...' : 'Validate'}
							</Button>
						</div>
					</div>
				)}

				{step === 'preview' && preview && (
					<div className="space-y-4 pt-2">
						<div className="grid grid-cols-3 gap-3 text-sm">
							<div className="rounded-lg bg-[var(--workspace-bg-subtle)] p-3 text-center">
								<div className="text-lg font-bold text-[var(--text-primary)]">
									{preview.totalRows}
								</div>
								<div className="text-xs text-[var(--text-muted)]">Total Rows</div>
							</div>
							<div className="rounded-lg bg-[var(--color-success-bg)] p-3 text-center">
								<div className="text-lg font-bold text-[var(--color-success)]">
									{preview.validRows}
								</div>
								<div className="text-xs text-[var(--text-muted)]">Valid</div>
							</div>
							<div className="rounded-lg bg-[var(--color-error-bg)] p-3 text-center">
								<div className="text-lg font-bold text-[var(--color-error)]">
									{preview.errors.length}
								</div>
								<div className="text-xs text-[var(--text-muted)]">Errors</div>
							</div>
						</div>

						{preview.errors.length > 0 && (
							<div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--color-error)] p-3 text-xs">
								{preview.errors.map((err, i) => (
									<div key={i} className="text-[var(--color-error)]">
										Row {err.row}, {err.field}: {err.message}
									</div>
								))}
							</div>
						)}

						{preview.conflictingCodes.length > 0 && (
							<div
								className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-bg)] px-4 py-2 text-sm text-[var(--color-warning)]"
								role="alert"
							>
								{preview.conflictingCodes.length} employee code(s) already exist:{' '}
								{preview.conflictingCodes.join(', ')}
							</div>
						)}

						{preview.duplicateWarnings.length > 0 && (
							<div className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-bg)] px-4 py-2 text-sm text-[var(--color-warning)]">
								{preview.duplicateWarnings.length} potential duplicate(s) detected
							</div>
						)}

						{preview.preview.length > 0 && (
							<div className="max-h-48 overflow-y-auto">
								<table className="w-full text-xs border-collapse">
									<thead>
										<tr className="bg-[var(--workspace-bg-subtle)]">
											<th className="px-2 py-1 text-left">Code</th>
											<th className="px-2 py-1 text-left">Name</th>
											<th className="px-2 py-1 text-left">Dept</th>
											<th className="px-2 py-1 text-left">Status</th>
										</tr>
									</thead>
									<tbody>
										{preview.preview.slice(0, 10).map((row, i) => (
											<tr key={i} className="border-t border-[var(--workspace-border)]">
												<td className="px-2 py-1">{row.employee_code}</td>
												<td className="px-2 py-1">{row.name}</td>
												<td className="px-2 py-1">{row.department}</td>
												<td className="px-2 py-1">{row.status}</td>
											</tr>
										))}
										{preview.preview.length > 10 && (
											<tr>
												<td colSpan={4} className="px-2 py-1 text-center text-[var(--text-muted)]">
													... and {preview.preview.length - 10} more
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						)}

						{importMutation.isError && (
							<div
								className="rounded-lg border border-[var(--color-error)] bg-[var(--color-error-bg)] px-4 py-2 text-sm text-[var(--color-error)]"
								role="alert"
							>
								{importMutation.error instanceof Error
									? importMutation.error.message
									: 'Import failed'}
							</div>
						)}

						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setStep('upload');
									setPreview(null);
									importMutation.reset();
								}}
							>
								Back
							</Button>
							<Button
								size="sm"
								disabled={
									preview.errors.length > 0 ||
									preview.conflictingCodes.length > 0 ||
									importMutation.isPending
								}
								onClick={handleCommit}
							>
								{importMutation.isPending
									? 'Importing...'
									: `Import ${preview.validRows} employees`}
							</Button>
						</div>
					</div>
				)}

				{step === 'done' && (
					<div className="space-y-4 pt-2 text-center">
						<div className="text-lg font-semibold text-[var(--color-success)]">Import Complete</div>
						<p className="text-sm text-[var(--text-muted)]">
							Employees have been imported. The staffing module is now marked as stale — run
							Calculate to update costs.
						</p>
						<Button size="sm" onClick={handleClose}>
							Close
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
