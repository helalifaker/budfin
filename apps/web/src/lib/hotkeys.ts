import { useEffect, useRef } from 'react';

type HotkeyModifier = 'meta' | 'ctrl' | 'alt' | 'shift';

interface ParsedHotkey {
	key: string;
	modifiers: Set<HotkeyModifier>;
}

/**
 * Parses a hotkey string like "meta+k" or "ctrl+shift+p" into a structured form.
 */
function parseHotkey(hotkey: string): ParsedHotkey {
	const parts = hotkey.toLowerCase().split('+');
	const modifiers = new Set<HotkeyModifier>();
	let key = '';

	for (const part of parts) {
		if (part === 'meta' || part === 'cmd' || part === 'command') {
			modifiers.add('meta');
		} else if (part === 'ctrl' || part === 'control') {
			modifiers.add('ctrl');
		} else if (part === 'alt' || part === 'option') {
			modifiers.add('alt');
		} else if (part === 'shift') {
			modifiers.add('shift');
		} else {
			key = part;
		}
	}

	return { key, modifiers };
}

function matchesHotkey(event: KeyboardEvent, parsed: ParsedHotkey): boolean {
	if (event.key.toLowerCase() !== parsed.key) return false;
	if (parsed.modifiers.has('meta') !== event.metaKey) return false;
	if (parsed.modifiers.has('ctrl') !== event.ctrlKey) return false;
	if (parsed.modifiers.has('alt') !== event.altKey) return false;
	if (parsed.modifiers.has('shift') !== event.shiftKey) return false;
	return true;
}

/**
 * Hook that listens for a keyboard shortcut and invokes a callback.
 *
 * @param hotkey - Key combination string, e.g. "meta+k", "ctrl+shift+p"
 * @param callback - Function to call when the hotkey is pressed
 * @param enabled - Whether the hotkey listener is active (default: true)
 *
 * @example
 * ```ts
 * useHotkey('meta+k', () => setOpen(true));
 * ```
 */
export function useHotkey(hotkey: string, callback: () => void, enabled = true) {
	const callbackRef = useRef(callback);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	useEffect(() => {
		if (!enabled) return;

		const parsed = parseHotkey(hotkey);

		function handler(event: KeyboardEvent) {
			// Ignore events from input, textarea, or contenteditable elements
			const target = event.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
				// Exception: allow meta+k even in inputs
				if (!(parsed.modifiers.has('meta') && parsed.key === 'k')) {
					return;
				}
			}

			if (matchesHotkey(event, parsed)) {
				event.preventDefault();
				callbackRef.current();
			}
		}

		document.addEventListener('keydown', handler);
		return () => {
			document.removeEventListener('keydown', handler);
		};
	}, [hotkey, enabled]);
}
