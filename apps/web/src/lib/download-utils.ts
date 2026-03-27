export function sanitizeFilename(value: string): string {
	return value.replace(/\s+/g, '-').toLowerCase();
}

export function triggerDownload(filename: string, blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	// Defer revocation so the browser can process the download task
	// before the blob URL alias is released.
	setTimeout(() => URL.revokeObjectURL(url), 100);
}
