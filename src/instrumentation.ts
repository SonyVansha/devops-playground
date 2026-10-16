export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installShutdownHandler } = await import('./lib/shutdown.ts');
    installShutdownHandler();
    const { applyBehavior, behavior } = await import('./lib/behavior.ts');
    applyBehavior(behavior());
  }
}
