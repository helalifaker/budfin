import { useState } from 'react';
import { ApiError } from '../../lib/api-client';
import { usePatchVersionStatus, useDeleteVersion } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from '../ui/alert-dialog';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '../ui/dialog';

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

function ErrorBanner({ message }: { message: string }) {
	return (
		<div
			className="mt-3 rounded-md bg-(--color-error-bg) px-4 py-3 text-(--text-sm) text-(--color-error)"
			role="alert"
		>
			{message}
		</div>
	);
}

// ---------- PublishDialog ----------

export function PublishDialog({ open, version, onClose, onSuccess }: BaseDialogProps) {
	const { mutateAsync, isPending } = usePatchVersionStatus();
	const [error, setError] = useState<string | null>(null);

	if (!version) return null;

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
		<AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Publish Version</AlertDialogTitle>
					<AlertDialogDescription>
						Publish version &lsquo;{version.name}&rsquo;? This makes it visible to all users.
					</AlertDialogDescription>
				</AlertDialogHeader>
				{error && <ErrorBanner message={error} />}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={handleConfirm} disabled={isPending}>
						{isPending ? 'Publishing...' : 'Publish'}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

// ---------- LockDialog ----------

export function LockDialog({ open, version, onClose, onSuccess }: BaseDialogProps) {
	const { mutateAsync, isPending } = usePatchVersionStatus();
	const [error, setError] = useState<string | null>(null);

	if (!version) return null;

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
		<AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Lock Version</AlertDialogTitle>
					<AlertDialogDescription>
						Lock version &lsquo;{version.name}&rsquo;? No further edits will be allowed.
					</AlertDialogDescription>
				</AlertDialogHeader>
				{error && <ErrorBanner message={error} />}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						disabled={isPending}
						className="bg-(--status-locked) hover:bg-[color-mix(in_srgb,var(--status-locked),black_15%)]"
					>
						{isPending ? 'Locking...' : 'Lock'}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

// ---------- ArchiveDialog ----------

export function ArchiveDialog({ open, version, onClose, onSuccess }: BaseDialogProps) {
	const { mutateAsync, isPending } = usePatchVersionStatus();
	const [error, setError] = useState<string | null>(null);

	if (!version) return null;

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
		<AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Archive Version</AlertDialogTitle>
					<AlertDialogDescription>
						Archive version &lsquo;{version.name}&rsquo;? It will be read-only and hidden from
						active views.
					</AlertDialogDescription>
				</AlertDialogHeader>
				{error && <ErrorBanner message={error} />}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						disabled={isPending}
						className="bg-(--text-secondary) hover:bg-[color-mix(in_srgb,var(--text-secondary),black_15%)]"
					>
						{isPending ? 'Archiving...' : 'Archive'}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

// ---------- RevertDialog ----------

function RevertDialogContent({ version, onClose, onSuccess }: InnerDialogProps) {
	const { mutateAsync, isPending } = usePatchVersionStatus();
	const [auditNote, setAuditNote] = useState('');
	const [error, setError] = useState<string | null>(null);

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
		<Dialog open onOpenChange={(v) => !v && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Revert to Draft</DialogTitle>
					<DialogDescription>
						Revert version &lsquo;{version.name}&rsquo; back to Draft status. An audit note is
						required to explain why.
					</DialogDescription>
				</DialogHeader>

				{error && <ErrorBanner message={error} />}

				<div>
					<label htmlFor="revert-audit-note" className="block text-(--text-sm) font-medium">
						Audit Note (min 10 characters){' '}
						<span aria-hidden="true" className="text-(--color-error)">
							*
						</span>
					</label>
					<Textarea
						id="revert-audit-note"
						rows={4}
						maxLength={500}
						aria-required="true"
						aria-describedby="revert-char-count"
						value={auditNote}
						onChange={(e) => setAuditNote(e.target.value)}
						className={'mt-1 ' + (noteLength > 0 && !isValid ? 'border-(--color-warning)' : '')}
						placeholder="Explain the reason for reverting..."
					/>
					<p
						id="revert-char-count"
						className={
							'mt-1 text-(--text-xs) ' +
							(isValid ? 'text-(--text-muted)' : 'text-(--color-warning)')
						}
					>
						{noteLength}/10 minimum characters
					</p>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={isPending}>
						Cancel
					</Button>
					<Button
						onClick={handleConfirm}
						disabled={!isValid || isPending}
						loading={isPending}
						className="bg-(--color-warning) hover:bg-[color-mix(in_srgb,var(--color-warning),black_15%)]"
					>
						Revert to Draft
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function RevertDialog({ open, version, onClose, onSuccess }: BaseDialogProps) {
	if (!open || !version) return null;
	return <RevertDialogContent version={version} onClose={onClose} onSuccess={onSuccess} />;
}

// ---------- DeleteDialog ----------

function DeleteDialogContent({ version, onClose, onSuccess }: InnerDialogProps) {
	const { mutateAsync, isPending } = useDeleteVersion();
	const [confirmText, setConfirmText] = useState('');
	const [error, setError] = useState<string | null>(null);

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
		<AlertDialog open onOpenChange={(v) => !v && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="text-(--color-error)">Delete Version</AlertDialogTitle>
					<AlertDialogDescription>
						This action is irreversible. All data associated with version &lsquo;
						{version.name}&rsquo; will be permanently deleted.
					</AlertDialogDescription>
				</AlertDialogHeader>

				{error && <ErrorBanner message={error} />}

				<div>
					<label htmlFor="delete-confirm-input" className="block text-(--text-sm) font-medium">
						Type the version name to confirm deletion:
					</label>
					<Input
						id="delete-confirm-input"
						type="text"
						autoComplete="off"
						aria-required="true"
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						className={
							'mt-1 ' + (confirmText.length > 0 && !canDelete ? 'border-(--color-error)' : '')
						}
						placeholder={version.name}
					/>
					{confirmText.length > 0 && !canDelete && (
						<p className="mt-1 text-(--text-xs) text-(--color-error)" role="alert">
							Name does not match. Please type exactly:{' '}
							<span className="font-medium">{version.name}</span>
						</p>
					)}
				</div>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						disabled={!canDelete || isPending}
						className="bg-(--color-error) hover:bg-[color-mix(in_srgb,var(--color-error),black_15%)]"
					>
						{isPending ? 'Deleting...' : 'Delete Version'}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export function DeleteDialog({ open, version, onClose, onSuccess }: BaseDialogProps) {
	if (!open || !version) return null;
	return <DeleteDialogContent version={version} onClose={onClose} onSuccess={onSuccess} />;
}
