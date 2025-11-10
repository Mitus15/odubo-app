import { dispatchDueReminders } from '@/lib/momentsReminderDispatcher';

// Simple test: second invocation within window should skip work

describe('dispatchDueReminders self rate limit', () => {
  it('skips immediately when recently run', async () => {
    (globalThis as any).__momentsReminderLastRun = Date.now();
    const res = await dispatchDueReminders(new Date());
    expect(res.sent).toBe(0);
    expect(res.skipped).toBe(0);
    expect(res.failures).toBe(0);
  });
});
