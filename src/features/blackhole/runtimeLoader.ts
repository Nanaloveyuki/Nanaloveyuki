const getBlackholeScene = () =>
  document.querySelector<HTMLElement>('[data-blackhole-page]')?.dataset.blackholeScene;

const loadBlackholeRuntime = async () => {
  const blackholeScene = getBlackholeScene();

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

document.addEventListener('astro:page-load', () => {
  void loadBlackholeRuntime();
});
