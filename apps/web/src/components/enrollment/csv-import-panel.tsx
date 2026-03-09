import { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useImportHistorical, type ImportValidationResult } from '../../hooks/use-enrollment';
import { getCurrentFiscalYear } from '../../lib/format-date';
import { AlertTriangle, Check, Upload } from 'lucide-react';

interface CsvImportPanelProps {
	open: boolean;
	onClose: () => void;
}

const CURRENT_YEAR = getCurrentFiscalYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

export function CsvImportPanel({ open, onClose }: CsvImportPanelProps) {
	const [file, setFile] = useState<File | null>(null);
	const [year, setYear] = useState(String(CURRENT_YEAR - 1));
	const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
	const [importSuccess, setImportSuccess] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const importMutation = useImportHistorical();

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selected = e.target.files?.[0] ?? null;
		setFile(selected);
		setValidationResult(null);
		setImportSuccess(false);
	};

	const handleValidate = async () => {
		if (!file) return;
		const result = await importMutation.mutateAsync({
			file,
			mode: 'validate',
			academicYear: year,
		});
		setValidationResult(result as ImportValidationResult);
	};

	const handleImport = async () => {
		if (!file) return;
		await importMutation.mutateAsync({
			file,
			mode: 'commit',
			academicYear: year,
		});
		setImportSuccess(true);
		setValidationResult(null);
	};

	const handleClose = () => {
		setFile(null);
		setValidationResult(null);
		setImportSuccess(false);
		onClose();
	};

	return (
		<Sheet open={open} onOpenChange={handleClose}>
			<SheetContent side="right" className="w-120 overflow-y-auto sm:max-w-120">
				<SheetHeader>
					<SheetTitle>Import Historical Enrollment</SheetTitle>
					<SheetDescription>
						Upload a CSV file with grade_level and student_count columns.
					</SheetDescription>
				</SheetHeader>

				<div className="mt-6 space-y-4">
					{/* Year selector */}
					<div>
						<label
							htmlFor="import-year"
							className="mb-1 block text-[length:var(--text-sm)] font-medium text-(--text-primary)"
						>
							Academic Year
						</label>
						<Select value={year} onValueChange={setYear}>
							<SelectTrigger id="import-year" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{YEARS.map((y) => (
									<SelectItem key={y} value={String(y)}>
										{y}/{y + 1}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* File picker */}
					<div>
						<label
							htmlFor="csv-file"
							className="mb-1 block text-[length:var(--text-sm)] font-medium text-(--text-primary)"
						>
							CSV File
						</label>
						<input
							id="csv-file"
							ref={fileRef}
							type="file"
							accept=".csv"
							onChange={handleFileChange}
							className="block w-full text-[length:var(--text-sm)] text-(--text-muted) file:mr-4 file:rounded-(--radius-sm) file:border-0 file:bg-(--workspace-bg-muted) file:px-4 file:py-2 file:text-[length:var(--text-sm)] file:font-medium file:text-(--text-primary) hover:file:bg-(--workspace-bg-muted)"
						/>
						{file && (
							<p className="mt-1 text-[length:var(--text-xs)] text-(--text-muted)">
								Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
							</p>
						)}
					</div>

					{/* Actions */}
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={handleValidate}
							disabled={!file || importMutation.isPending}
						>
							<Upload className="mr-1.5 h-4 w-4" />
							Validate
						</Button>
						{validationResult && validationResult.validRows > 0 && (
							<>
								{validationResult.errors.length > 0 && (
									<p className="text-[length:var(--text-xs)] text-(--color-warning)">
										{validationResult.errors.length} row(s) will be skipped
									</p>
								)}
								<Button onClick={handleImport} disabled={importMutation.isPending}>
									{validationResult.errors.length > 0
										? `Import ${validationResult.validRows} Valid Rows`
										: 'Import'}
								</Button>
							</>
						)}
					</div>

					{/* Validation results */}
					{validationResult && (
						<div className="rounded-(--radius-lg) border p-4 space-y-3">
							<div className="flex items-center gap-2 text-[length:var(--text-sm)]">
								{validationResult.errors.length === 0 ? (
									<>
										<Check className="h-4 w-4 text-(--color-success)" />
										<span className="text-(--color-success)">
											All {validationResult.validRows} rows valid
										</span>
									</>
								) : (
									<>
										<AlertTriangle className="h-4 w-4 text-(--color-warning)" />
										<span className="text-(--color-warning)">
											{validationResult.validRows}/{validationResult.totalRows} valid,{' '}
											{validationResult.errors.length} errors
										</span>
									</>
								)}
							</div>

							{/* Preview table */}
							{validationResult.preview.length > 0 && (
								<div className="max-h-48 overflow-y-auto rounded-(--radius-md) border">
									<table className="w-full text-[length:var(--text-xs)]">
										<thead className="bg-(--workspace-bg-muted)">
											<tr>
												<th className="px-3 py-1.5 text-left font-medium">Grade</th>
												<th className="px-3 py-1.5 text-right font-medium">Count</th>
											</tr>
										</thead>
										<tbody>
											{validationResult.preview.map((row) => (
												<tr key={row.gradeLevel} className="border-t">
													<td className="px-3 py-1">{row.gradeLevel}</td>
													<td className="px-3 py-1 text-right tabular-nums">{row.headcount}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}

							{/* Error list */}
							{validationResult.errors.length > 0 && (
								<div className="max-h-32 overflow-y-auto text-[length:var(--text-xs)] text-(--color-error)">
									{validationResult.errors.map((err, i) => (
										<div key={i} className="py-0.5">
											Row {err.row}: {err.field} — {err.message}
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* Success */}
					{importSuccess && (
						<div className="flex items-center gap-2 rounded-(--radius-lg) bg-(--color-success-bg) px-4 py-3 text-[length:var(--text-sm)] text-(--color-success)">
							<Check className="h-4 w-4" />
							Import completed successfully
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
