/** Optional UI refreshes only. Do not use for payments, auth or offline delivery. */
export function startVisiblePolling(refresh: (silent: boolean) => unknown | Promise<unknown>, intervalMs: number) {
  let active = true, busy = false, first = true, refreshOnReturn = false;
  let hidden = document.hidden;
  let timer: ReturnType<typeof setInterval> | undefined;
  const run = async (returned = false) => {
    if (!active || document.hidden) return;
    if (busy) {if (returned) refreshOnReturn = true; return;}
    busy = true;
    const silent = !first; first = false;
    try {await refresh(silent);}
    catch (error) {console.warn('Optional dashboard refresh failed:', error);}
    finally {
      busy = false;
      if (active && refreshOnReturn && !document.hidden) {
        refreshOnReturn = false;
        void run();
      }
    }
  };
  const start = () => {void run(true); timer = setInterval(() => {void run();}, intervalMs);};
  const visibilityChanged = () => {
    if (hidden === document.hidden) return;
    hidden = document.hidden;
    if (hidden) {clearInterval(timer); timer = undefined; refreshOnReturn = false;}
    else start();
  };
  if (!hidden) start();
  document.addEventListener('visibilitychange', visibilityChanged);
  return () => {
    active = false; refreshOnReturn = false;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', visibilityChanged);
  };
}
