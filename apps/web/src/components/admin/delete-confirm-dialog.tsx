import { useEffect, useState } from 'react';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogAction,
	AlertDialogCancel,
} from '../ui/alert-dialog';
import { Input } from '../ui/input';

export type DeleteConfirmDialogProps = {
	open: boolean;
	entityCode: string;
	entityType: string;
	onConfirm: () => void;
	onCancel: () => void;
	loading: boolean;
};

export function DeleteConfirmDialog({
	open,
	entityCode,
	entityType,
	onConfirm,
	onCancel,
	loading,
}: DeleteConfirmDialogProps) {
	const [confirmText, setConfirmText] = useState('');

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state when dialog opens; sync with prop is intentional
		if (open) setConfirmText('');
	}, [open]);

	return (
		<AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="text-(--color-error)">Delete {entityType}</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. Type <strong className="font-mono">{entityCode}</strong>{' '}
						to confirm deletion.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="mt-2">
					<label htmlFor="delete-confirm" className="sr-only">
						Type code to confirm
					</label>
					<Input
						id="delete-confirm"
						type="text"
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						placeholder={entityCode}
						className="font-mono"
					/>
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className="bg-(--color-error) hover:bg-[color-mix(in_srgb,var(--color-error),black_15%)]"
						disabled={confirmText !== entityCode || loading}
						onClick={onConfirm}
					>
						{loading ? 'Deleting...' : 'Delete'}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
