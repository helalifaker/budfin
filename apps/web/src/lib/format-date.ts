import { format } from 'date-fns';
import { TZDate } from '@date-fns/tz';

const TIMEZONE = 'Asia/Riyadh';

export function formatDateTime(iso: string | null): string {
	if (!iso) return '\u2014';
	const date = new TZDate(iso, TIMEZONE);
	return format(date, 'dd MMM yyyy, HH:mm');
}

export function formatDate(iso: string | null): string {
	if (!iso) return '\u2014';
	const date = new TZDate(iso, TIMEZONE);
	return format(date, 'dd MMM yyyy');
}

export function getCurrentFiscalYear(): number {
	return new TZDate(Date.now(), TIMEZONE).getFullYear();
}
