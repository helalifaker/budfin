import { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useImportHistorical, type ImportValidationResult } from '../../hooks/use-enrollment';
import { AlertTriangle, Check, Upload } from 'lucide-react';

interface CsvImportPanelProps {
	open: boolean;
	onClose: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
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
			<SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Import Historical Enrollment</SheetTitle>
					<SheetDescription>
						Upload a CSV file with grade_level and student_count columns.
					</SheetDescription>
				</SheetHeader>

				<div className="mt-6 space-y-4">
					{/* Year selector */}
					<div>
						<label htmlFor="import-year" className="mb-1 block text-sm font-medium text-slate-700">
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
						<label htmlFor="csv-file" className="mb-1 block text-sm font-medium text-slate-700">
							CSV File
						</label>
						<input
							id="csv-file"
							ref={fileRef}
							type="file"
							accept=".csv"
							onChange={handleFileChange}
							className="block w-full text-sm text-slate-500 file:mr-4 file:rounded file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
						/>
						{file && (
							<p className="mt-1 text-xs text-slate-500">
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
						{validationResult && validationResult.errors.length === 0 && (
							<Button onClick={handleImport} disabled={importMutation.isPending}>
								Import
							</Button>
						)}
					</div>

					{/* Validation results */}
					{validationResult && (
						<div className="rounded-lg border p-4 space-y-3">
							<div className="flex items-center gap-2 text-sm">
								{validationResult.errors.length === 0 ? (
									<>
										<Check className="h-4 w-4 text-green-600" />
										<span className="text-green-800">
											All {validationResult.validRows} rows valid
										</span>
									</>
								) : (
									<>
										<AlertTriangle className="h-4 w-4 text-amber-500" />
										<span className="text-amber-800">
											{validationResult.validRows}/{validationResult.totalRows} valid,{' '}
											{validationResult.errors.length} errors
										</span>
									</>
								)}
							</div>

							{/* Preview table */}
							{validationResult.preview.length > 0 && (
								<div className="max-h-48 overflow-y-auto rounded border">
									<table className="w-full text-xs">
										<thead className="bg-slate-50">
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
								<div className="max-h-32 overflow-y-auto text-xs text-red-700">
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
						<div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
							<Check className="h-4 w-4" />
							Import completed successfully
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
