import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { ApiError } from '../../lib/api-client';
import { usePatchVersionStatus, useDeleteVersion } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';

// ---------- shared types ----------

type BaseDialogProps = {
	open: boolean;
	version: BudgetVersion | null;
	onClose: () => void;
	onSuccess: () => void;
};

type InnerDialogProps = {
	version: BudgetVersion;
	onClose: () => void;
	onSuccess: () => void;
};

// ---------- focus trap hook ----------

function useFocusTrap(
	ref: React.RefObject<HTMLElement | null>,
	open: boolean,
	onClose: () => void
) {
	useEffect(() => {
		if (!open) return;
		const el = ref.current;
		if (!el) return;

		const focusable = el.querySelectorAll<HTMLElement>(
			'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
		);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		first?.focus();

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onClose();
				return;
			}
			if (e.key !== 'Tab') return;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last?.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first?.focus();
			}
		}

		el.addEventListener('keydown', handleKeyDown);
		return () => el.removeEventListener('keydown', handleKeyDown);
	}, [ref, open, onClose]);
}

// ---------- shared error banner ----------

function ErrorBanner({ message }: { message: string }) {
	return (
		<div className="mx-6 mt-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
			{message}
		</div>
	);
}

// ---------- PublishDialog ----------

export function PublishDialog({ open, version, onClose, onSuccess }: BaseDialogProps) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = 'publish-dialog-title';
	const { mutateAsync, isPending } = usePatchVersionStatus();
	const [error, setError] = useState<string | null>(null);

	useFocusTrap(dialogRef, open, onClose);

	if (!open || !version) return null;

	async function handleConfirm() {
		setError(null);
		try {
			await mutateAsync({ id: version!.id, new_status: 'Published' });
			onSuccess();
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'An unexpected error occurred');
		}
	}

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div
					ref={dialogRef}
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="w-[480px] rounded-lg bg-white shadow-xl"
				>
					<div className="border-b px-6 py-4">
						<h2 id={titleId} className="text-lg font-semibold">
							Publish Version
						</h2>
					</div>

					{error && <ErrorBanner message={error} />}

					<div className="px-6 py-4">
						<p className="text-sm text-slate-700">
							Publish version &lsquo;{version.name}&rsquo;? This makes it visible to all users.
						</p>
					</div>

					<div className="flex items-center justify-end gap-3 border-t px-6 py-4">
						<button
							type="button"
							onClick={onClose}
							disabled={isPending}
							className={cn(
								'rounded-md border border-slate-300',
								'px-4 py-2 text-sm font-medium',
								'hover:bg-slate-50 disabled:opacity-50'
							)}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleConfirm}
							disabled={isPending}
							className={cn(
								'rounded-md bg-blue-600 px-4 py-2 text-sm',
								'font-medium text-white',
								'hover:bg-blue-700 disabled:opacity-50'
							)}
						>
							{isPending ? 'Publishing...' : 'Publish'}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

// ---------- LockDialog ----------

export function LockDialog({ open, version, onClose, onSuccess }: BaseDialogProps) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = 'lock-dialog-title';
	const { mutateAsync, isPending } = usePatchVersionStatus();
	const [error, setError] = useState<string | null>(null);

	useFocusTrap(dialogRef, open, onClose);

	if (!open || !version) return null;

	async function handleConfirm() {
		setError(null);
		try {
			await mutateAsync({ id: version!.id, new_status: 'Locked' });
			onSuccess();
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'An unexpected error occurred');
		}
	}

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div
					ref={dialogRef}
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="w-[480px] rounded-lg bg-white shadow-xl"
				>
					<div className="border-b px-6 py-4">
						<h2 id={titleId} className="text-lg font-semibold">
							Lock Version
						</h2>
					</div>

					{error && <ErrorBanner message={error} />}

					<div className="px-6 py-4">
						<p className="text-sm text-slate-700">
							Lock version &lsquo;{version.name}&rsquo;? No further edits will be allowed.
						</p>
					</div>

					<div className="flex items-center justify-end gap-3 border-t px-6 py-4">
						<button
							type="button"
							onClick={onClose}
							disabled={isPending}
							className={cn(
								'rounded-md border border-slate-300',
								'px-4 py-2 text-sm font-medium',
								'hover:bg-slate-50 disabled:opacity-50'
							)}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleConfirm}
							disabled={isPending}
							className={cn(
								'rounded-md bg-violet-600 px-4 py-2 text-sm',
								'font-medium text-white',
								'hover:bg-violet-700 disabled:opacity-50'
							)}
						>
							{isPending ? (
								'Locking...'
							) : (
								<span className="inline-flex items-center gap-1.5">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 20 20"
										fill="currentColor"
										className="h-4 w-4"
										aria-hidden="true"
									>
										<path
											fillRule="evenodd"
											d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
											clipRule="evenodd"
										/>
									</svg>
									Lock
								</span>
							)}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

// ---------- ArchiveDialog ----------

export function ArchiveDialog({ open, version, onClose, onSuccess }: BaseDialogProps) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = 'archive-dialog-title';
	const { mutateAsync, isPending } = usePatchVersionStatus();
	const [error, setError] = useState<string | null>(null);

	useFocusTrap(dialogRef, open, onClose);

	if (!open || !version) return null;

	async function handleConfirm() {
		setError(null);
		try {
			await mutateAsync({ id: version!.id, new_status: 'Archived' });
			onSuccess();
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'An unexpected error occurred');
		}
	}

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div
					ref={dialogRef}
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="w-[480px] rounded-lg bg-white shadow-xl"
				>
					<div className="border-b px-6 py-4">
						<h2 id={titleId} className="text-lg font-semibold">
							Archive Version
						</h2>
					</div>

					{error && <ErrorBanner message={error} />}

					<div className="px-6 py-4">
						<p className="text-sm text-slate-700">
							Archive version &lsquo;{version.name}&rsquo;? It will be read-only and hidden from
							active views.
						</p>
					</div>

					<div className="flex items-center justify-end gap-3 border-t px-6 py-4">
						<button
							type="button"
							onClick={onClose}
							disabled={isPending}
							className={cn(
								'rounded-md border border-slate-300',
								'px-4 py-2 text-sm font-medium',
								'hover:bg-slate-50 disabled:opacity-50'
							)}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleConfirm}
							disabled={isPending}
							className={cn(
								'rounded-md bg-slate-600 px-4 py-2 text-sm',
								'font-medium text-white',
								'hover:bg-slate-700 disabled:opacity-50'
							)}
						>
							{isPending ? 'Archiving...' : 'Archive'}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

// ---------- RevertDialog ----------
// Inner component mounts fresh each time the dialog opens,
// so useState('') naturally resets without useEffect.

function RevertDialogContent({ version, onClose, onSuccess }: InnerDialogProps) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = 'revert-dialog-title';
	const { mutateAsync, isPending } = usePatchVersionStatus();
	const [auditNote, setAuditNote] = useState('');
	const [error, setError] = useState<string | null>(null);

	useFocusTrap(dialogRef, true, onClose);

	const noteLength = auditNote.length;
	const isValid = noteLength >= 10;

	async function handleConfirm() {
		setError(null);
		try {
			await mutateAsync({
				id: version.id,
				new_status: 'Draft',
				audit_note: auditNote,
			});
			onSuccess();
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'An unexpected error occurred');
		}
	}

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div
					ref={dialogRef}
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="w-[480px] rounded-lg bg-white shadow-xl"
				>
					<div className="border-b px-6 py-4">
						<h2 id={titleId} className="text-lg font-semibold">
							Revert to Draft
						</h2>
					</div>

					{error && <ErrorBanner message={error} />}

					<div className="px-6 py-4">
						<p className="mb-4 text-sm text-slate-700">
							Revert version &lsquo;{version.name}&rsquo; back to Draft status. An audit note is
							required to explain why.
						</p>

						<div>
							<label htmlFor="revert-audit-note" className="block text-sm font-medium">
								Audit Note (min 10 characters){' '}
								<span aria-hidden="true" className="text-red-500">
									*
								</span>
							</label>
							<textarea
								id="revert-audit-note"
								rows={4}
								maxLength={500}
								aria-required="true"
								aria-describedby="revert-char-count"
								value={auditNote}
								onChange={(e) => setAuditNote(e.target.value)}
								className={cn(
									'mt-1 w-full rounded-md border px-3 py-2 text-sm',
									noteLength > 0 && !isValid ? 'border-amber-400' : 'border-slate-300'
								)}
								placeholder="Explain the reason for reverting..."
							/>
							<p
								id="revert-char-count"
								className={cn('mt-1 text-xs', isValid ? 'text-slate-500' : 'text-amber-600')}
							>
								{noteLength}/10 minimum characters
							</p>
						</div>
					</div>

					<div className="flex items-center justify-end gap-3 border-t px-6 py-4">
						<button
							type="button"
							onClick={onClose}
							disabled={isPending}
							className={cn(
								'rounded-md border border-slate-300',
								'px-4 py-2 text-sm font-medium',
								'hover:bg-slate-50 disabled:opacity-50'
							)}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleConfirm}
							disabled={!isValid || isPending}
							className={cn(
								'rounded-md bg-amber-600 px-4 py-2 text-sm',
								'font-medium text-white',
								'hover:bg-amber-700 disabled:opacity-50'
							)}
						>
							{isPending ? 'Reverting...' : 'Revert to Draft'}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

export function RevertDialog({ open, version, onClose, onSuccess }: BaseDialogProps) {
	if (!open || !version) return null;
	return <RevertDialogContent version={version} onClose={onClose} onSuccess={onSuccess} />;
}

// ---------- DeleteDialog ----------
// Inner component mounts fresh each time the dialog opens,
// so useState('') naturally resets without useEffect.

function DeleteDialogContent({ version, onClose, onSuccess }: InnerDialogProps) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = 'delete-dialog-title';
	const descId = 'delete-dialog-desc';
	const { mutateAsync, isPending } = useDeleteVersion();
	const [confirmText, setConfirmText] = useState('');
	const [error, setError] = useState<string | null>(null);

	useFocusTrap(dialogRef, true, onClose);

	const canDelete = confirmText === version.name;

	async function handleConfirm() {
		setError(null);
		try {
			await mutateAsync(version.id);
			onSuccess();
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'An unexpected error occurred');
		}
	}

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div
					ref={dialogRef}
					role="alertdialog"
					aria-modal="true"
					aria-labelledby={titleId}
					aria-describedby={descId}
					className="w-[480px] rounded-lg bg-white shadow-xl"
				>
					<div className="border-b px-6 py-4">
						<h2 id={titleId} className="text-lg font-semibold text-red-700">
							Delete Version
						</h2>
					</div>

					{error && <ErrorBanner message={error} />}

					<div className="px-6 py-4">
						<p id={descId} className="mb-4 text-sm text-slate-700">
							This action is irreversible. All data associated with version &lsquo;{version.name}
							&rsquo; will be permanently deleted.
						</p>

						<div>
							<label htmlFor="delete-confirm-input" className="block text-sm font-medium">
								Type the version name to confirm deletion:
							</label>
							<input
								id="delete-confirm-input"
								type="text"
								autoComplete="off"
								aria-required="true"
								value={confirmText}
								onChange={(e) => setConfirmText(e.target.value)}
								className={cn(
									'mt-1 w-full rounded-md border px-3 py-2 text-sm',
									confirmText.length > 0 && !canDelete ? 'border-red-300' : 'border-slate-300'
								)}
								placeholder={version.name}
							/>
							{confirmText.length > 0 && !canDelete && (
								<p className="mt-1 text-xs text-red-600" role="alert">
									Name does not match. Please type exactly:{' '}
									<span className="font-medium">{version.name}</span>
								</p>
							)}
						</div>
					</div>

					<div className="flex items-center justify-end gap-3 border-t px-6 py-4">
						<button
							type="button"
							onClick={onClose}
							disabled={isPending}
							className={cn(
								'rounded-md border border-slate-300',
								'px-4 py-2 text-sm font-medium',
								'hover:bg-slate-50 disabled:opacity-50'
							)}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleConfirm}
							disabled={!canDelete || isPending}
							className={cn(
								'rounded-md bg-red-600 px-4 py-2 text-sm',
								'font-medium text-white',
								'hover:bg-red-700 disabled:opacity-50'
							)}
						>
							{isPending ? 'Deleting...' : 'Delete Version'}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

export function DeleteDialog({ open, version, onClose, onSuccess }: BaseDialogProps) {
	if (!open || !version) return null;
	return <DeleteDialogContent version={version} onClose={onClose} onSuccess={onSuccess} />;
}
