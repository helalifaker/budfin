export function getLastDuration(module: string): number | undefined {
	const stored = localStorage.getItem(`budfin-calc-duration-${module}`);
	return stored ? Number(stored) : undefined;
}

export function setLastDuration(module: string, ms: number): void {
	localStorage.setItem(`budfin-calc-duration-${module}`, String(ms));
}
