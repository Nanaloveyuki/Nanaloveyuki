import type { BodyPanelElements, BodyTooltipElements } from '@blackhole/types';

import { renderBodyPanel } from './bodyDetails';
import type { BodyPresentationSource } from './bodyPresentation';
import type { BodyEntry } from './bodyTypes';

export type BodyDomBridge = {
  closePanel: () => void;
  openPanel: (bodyEntry: BodyEntry) => void;
  syncTooltip: (
    presentation: BodyPresentationSource | null,
    clientX?: number,
    clientY?: number,
  ) => void;
  clearTooltip: () => void;
};

export type CreateBodyDomBridgeParams = {
  panel: BodyPanelElements;
  tooltip: BodyTooltipElements;
  onPanelClose?: () => void;
};

export const createBodyDomBridge = ({
  panel,
  tooltip,
  onPanelClose,
}: CreateBodyDomBridgeParams): BodyDomBridge => {
  const closePanel = () => {
    panel.panel?.setAttribute('hidden', '');
    panel.panel?.removeAttribute('data-active-planet');
    onPanelClose?.();
  };

  const openPanel = (bodyEntry: BodyEntry) => {
    if (!panel.panel) {
      return;
    }

    renderBodyPanel(panel, bodyEntry);
  };

  const clearTooltip = () => {
    tooltip.root?.setAttribute('hidden', '');
  };

  const syncTooltip = (
    presentation: BodyPresentationSource | null,
    clientX?: number,
    clientY?: number,
  ) => {
    if (!tooltip.root || !presentation) {
      clearTooltip();
      return;
    }

    if (tooltip.name) {
      tooltip.name.textContent = presentation.name;
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
