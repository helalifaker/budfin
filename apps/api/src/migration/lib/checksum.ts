import { createHash } from 'node:crypto';

export function sha256(data: string): string {
	return createHash('sha256').update(data, 'utf-8').digest('hex');
}

export function columnChecksum(values: string[]): string {
	const sorted = [...values].sort();
	return sha256(sorted.join('|'));
}
