import type { BlackholeWindow } from '@blackhole/types';

const getBlackholeScene = () =>
  document.querySelector<HTMLElement>('[data-blackhole-page]')?.dataset.blackholeScene;

const getRuntimeKind = () => {
  const blackholeScene = getBlackholeScene();

  if (blackholeScene === 'home') {
    return 'home';
  }

  if (blackholeScene === 'projects' || blackholeScene === 'blog' || blackholeScene === 'tools') {
    return 'orbit';
  }

  return 'none';
};

let loadSequence = 0;

const disposeBlackholeRuntime = () => {
  (window as BlackholeWindow).__BLACKHOLE_DISPOSE__?.();
};

const loadBlackholeRuntime = async () => {
  const sequence = ++loadSequence;
  const runtimeKind = getRuntimeKind();

  if (runtimeKind === 'none') {
    disposeBlackholeRuntime();
    return;
  }

  if (runtimeKind === 'home') {
    const { bootBlackholeDemo } = await import('@blackhole/blackhole-demo.ts');

    if (sequence !== loadSequence || getRuntimeKind() !== 'home') {
      return;
    }

    bootBlackholeDemo();
    return;
  }

  const { bootBlackholeOrbit } = await import('@blackhole/blackhole-orbit.ts');

  if (sequence !== loadSequence || getRuntimeKind() !== 'orbit') {
    return;
  }

  bootBlackholeOrbit();
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
