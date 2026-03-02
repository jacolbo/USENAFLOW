const pendingEmails = new Map<string, NodeJS.Timeout>();

export function scheduleEmail(
  key: string,
  delayMs: number,
  sendFn: () => Promise<void>
): void {
  if (pendingEmails.has(key)) {
    clearTimeout(pendingEmails.get(key)!);
    console.log(`[EmailQueue] Cancelled previous pending email for key: ${key}`);
  }

  const timer = setTimeout(async () => {
    pendingEmails.delete(key);
    console.log(`[EmailQueue] Delay elapsed, sending email for key: ${key}`);
    try {
      await sendFn();
    } catch (err) {
      console.error(`[EmailQueue] Error sending deferred email for key ${key}:`, err);
    }
  }, delayMs);

  pendingEmails.set(key, timer);
  console.log(
    `[EmailQueue] Email queued for key: ${key} — will send in ${Math.round(delayMs / 60000)} min(s)`
  );
}

export function cancelEmail(key: string): void {
  if (pendingEmails.has(key)) {
    clearTimeout(pendingEmails.get(key)!);
    pendingEmails.delete(key);
    console.log(`[EmailQueue] Cancelled email for key: ${key}`);
  }
}
