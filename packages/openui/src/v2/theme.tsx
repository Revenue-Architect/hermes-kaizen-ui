import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { HermesThemeContext } from '@openuidev/react-ui/genui-lib';
import { PORTAL_CLASS } from './surface';

type Mode = 'light' | 'dark';
export interface DesktopLook { mode: Mode; palette: string[]; ramp: string[] }

// The library picks series colours from the *middle* of a palette outward (n=1: index 4; n=2: 3 and 5;
// n=3: 3-5; n=4: 3-6 ...). Index 4 is therefore the brand red and its neighbours are strong, distinguishable
// colours that keep >= 3:1 against the card (the earlier ramp put pale pink at index 4).
const LIGHT = ['#c4c4ca', '#6b6b73', '#8f1d16', '#3f3f46', '#cc3027', '#e8837b', '#8b8b94', '#d9a09a'];
const DARK = ['#52525b', '#71717a', '#ffc2bb', '#e4e4e7', '#cc3027', '#ff968c', '#a1a1aa', '#d97b72'];
// Sequential ramp for anything that reads the default palette as dark to light (heatmaps).
const RAMP_LIGHT = ['#8f1d16', '#b0261e', '#cc3027', '#e0665e', '#eb8f89', '#f2b4af', '#f8d3d0', '#fcebe9'];
const RAMP_DARK = ['#fcebe9', '#f8d3d0', '#f2b4af', '#eb8f89', '#e0665e', '#cc3027', '#b0261e', '#8f1d16'];
export const CATEGORICAL_KEYS = ['barChartPalette', 'horizontalBarChartPalette', 'lineChartPalette', 'areaChartPalette', 'pieChartPalette', 'radarChartPalette', 'radialChartPalette'] as const;

/** Chart colours are computed in JS by the library, so they cannot follow CSS variables on their own. */
export function readLook(root: HTMLElement = document.documentElement): DesktopLook {
  const mode: Mode = root.dataset.hermesMode === 'dark' ? 'dark' : 'light';
  const style = getComputedStyle(root);
  const pick = (name: string) => style.getPropertyValue(name).trim();
  const palette = [...(mode === 'dark' ? DARK : LIGHT)];
  // The fill is the real brand red in both modes (about 3.5:1 on the dark card); --kaizen-brand-ink is the lighter text colour.
  const brand = pick('--kaizen-brand');
  if (brand) palette[4] = brand;
  return { mode, palette, ramp: mode === 'dark' ? RAMP_DARK : RAMP_LIGHT };
}

export function chartTheme(look: DesktopLook): Record<string, string[]> {
  const theme: Record<string, string[]> = { defaultChartPalette: look.ramp };
  for (const key of CATEGORICAL_KEYS) theme[key] = look.palette;
  return theme;
}

export function useDesktopLook(): DesktopLook {
  const [look, setLook] = useState<DesktopLook>(() => (typeof document === 'undefined' ? { mode: 'light', palette: LIGHT, ramp: RAMP_LIGHT } : readLook()));
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const update = () => setLook((prev) => { const next = readLook(); return next.mode === prev.mode && next.palette.join() === prev.palette.join() ? prev : next; });
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-hermes-mode', 'data-hermes-theme'] });
    update();
    return () => observer.disconnect();
  }, []);
  return look;
}

export function DesktopTheme({ children }: { children: ReactNode }) {
  const look = useDesktopLook();
  const value = useMemo(() => ({ theme: chartTheme(look), mode: look.mode, portalThemeClassName: PORTAL_CLASS }), [look]);
  return <HermesThemeContext.Provider value={value}>{children}</HermesThemeContext.Provider>;
}
