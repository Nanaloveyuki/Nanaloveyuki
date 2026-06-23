const blackholePage = document.querySelector<HTMLElement>('[data-blackhole-page]');
const blackholeScene = blackholePage?.dataset.blackholeScene;

const loadBlackholeRuntime = async () => {
  if (blackholeScene === 'home') {
    await import('@blackhole/blackhole-demo.ts');
    return;
  }

  if (blackholeScene === 'projects' || blackholeScene === 'blog' || blackholeScene === 'tools') {
    await import('@blackhole/blackhole-orbit.ts');
  }
};

if (typeof window.requestIdleCallback === 'function') {
  window.requestIdleCallback(() => {
    void loadBlackholeRuntime();
  });
} else {
  window.addEventListener(
    'load',
    () => {
      void loadBlackholeRuntime();
    },
    { once: true },
  );
}
