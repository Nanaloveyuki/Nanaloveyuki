import type { FriendPlanet, FriendTooltipElements, PlanetPanelElements } from '@blackhole/types';

import { renderPlanetPanel } from './planetDetails';

export type PlanetDomBridge = {
  closePanel: () => void;
  openPanel: (friend: FriendPlanet) => void;
  syncTooltip: (friend: FriendPlanet | null, clientX?: number, clientY?: number) => void;
  clearTooltip: () => void;
};

export type CreatePlanetDomBridgeParams = {
  panel: PlanetPanelElements;
  tooltip: FriendTooltipElements;
  onPanelClose?: () => void;
};

export const createPlanetDomBridge = ({
  panel,
  tooltip,
  onPanelClose,
}: CreatePlanetDomBridgeParams): PlanetDomBridge => {
  const closePanel = () => {
    panel.panel?.setAttribute('hidden', '');
    panel.panel?.removeAttribute('data-active-planet');
    onPanelClose?.();
  };

  const openPanel = (friend: FriendPlanet) => {
    if (!panel.panel) {
      return;
    }

    renderPlanetPanel(panel, friend);
  };

  const clearTooltip = () => {
    tooltip.root?.setAttribute('hidden', '');
  };

  const syncTooltip = (friend: FriendPlanet | null, clientX?: number, clientY?: number) => {
    if (!tooltip.root || !friend) {
      clearTooltip();
      return;
    }

    if (tooltip.name) {
      tooltip.name.textContent = friend.name;
    }

    if (typeof clientX !== 'number' || typeof clientY !== 'number') {
      return;
    }

    tooltip.root.removeAttribute('hidden');
    const tooltipOffsetX = 18;
    const tooltipOffsetY = -20;
    tooltip.root.style.left = `${Math.max(16, Math.min(window.innerWidth - 16, clientX + tooltipOffsetX))}px`;
    tooltip.root.style.top = `${Math.max(16, Math.min(window.innerHeight - 16, clientY + tooltipOffsetY))}px`;
  };

  return {
    closePanel,
    openPanel,
    syncTooltip,
    clearTooltip,
  };
};
