import { describe, it, expect, beforeEach } from 'vitest';
import { useOpExDirtyStore } from './opex-dirty-store';

describe('opexDirtyStore', () => {
	beforeEach(() => {
		useOpExDirtyStore.getState().flush();
	});

	it('should track dirty cell changes', () => {
		const { setDirty } = useOpExDirtyStore.getState();
		setDirty(1, 3, '5000');
		expect(useOpExDirtyStore.getState().dirtyCount()).toBe(1);
		expect(useOpExDirtyStore.getState().getDirtyUpdates()).toEqual([
			{ lineItemId: 1, month: 3, amount: '5000' },
		]);
	});

	it('should overwrite same cell key', () => {
		const { setDirty } = useOpExDirtyStore.getState();
		setDirty(1, 3, '5000');
		setDirty(1, 3, '6000');
		expect(useOpExDirtyStore.getState().dirtyCount()).toBe(1);
		expect(useOpExDirtyStore.getState().getDirtyUpdates()[0]?.amount).toBe('6000');
	});

	it('should track multiple cells independently', () => {
		const { setDirty } = useOpExDirtyStore.getState();
		setDirty(1, 1, '100');
		setDirty(1, 2, '200');
		setDirty(2, 1, '300');
		expect(useOpExDirtyStore.getState().dirtyCount()).toBe(3);
	});

	it('should clear on flush', () => {
		const { setDirty, flush } = useOpExDirtyStore.getState();
		setDirty(1, 3, '5000');
		setDirty(2, 5, '8000');
		flush();
		expect(useOpExDirtyStore.getState().dirtyCount()).toBe(0);
		expect(useOpExDirtyStore.getState().getDirtyUpdates()).toEqual([]);
	});
});
