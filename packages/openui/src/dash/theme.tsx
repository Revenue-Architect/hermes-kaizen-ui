import { useMemo, type ReactNode } from 'react';
import { ThemeProvider as DashboardThemeProvider } from '@openuidev/dashboard-library';
import { chartTheme, useDesktopLook } from '../v2/theme';

/**
 * Desktop theme tokens for the dashboard library: the same mapping src/v2/kaizen.css gives the react-ui library,
 * expressed as theme values so the dashboard's own ThemeProvider writes them onto `.openui-dashboard-theme`
 * and its portals. Every value reads Desktop's variables through the --hoi-* aliases (src/dash/styles.ts),
 * so light/dark and the selected theme follow live.
 */
export const DESKTOP_TOKENS: Record<string, string> = {
  background: "var(--hoi-ground)",
  foreground: "var(--hoi-surface)",
  popoverBackground: "var(--hoi-surface)",
  sunkLight: "color-mix(in srgb, var(--hoi-ink) 2%, transparent)",
  sunk: "color-mix(in srgb, var(--hoi-ink) 4%, transparent)",
  sunkDeep: "color-mix(in srgb, var(--hoi-ink) 8%, transparent)",
  elevatedLight: "color-mix(in srgb, var(--hoi-ink) 4%, transparent)",
  elevated: "color-mix(in srgb, var(--hoi-ink) 7%, transparent)",
  elevatedStrong: "color-mix(in srgb, var(--hoi-ink) 14%, transparent)",
  elevatedIntense: "color-mix(in srgb, var(--hoi-ink) 30%, transparent)",
  highlightSubtle: "color-mix(in srgb, var(--hoi-ink) 2%, transparent)",
  highlight: "color-mix(in srgb, var(--hoi-ink) 4%, transparent)",
  highlightStrong: "color-mix(in srgb, var(--hoi-ink) 8%, transparent)",
  highlightIntense: "color-mix(in srgb, var(--hoi-ink) 30%, transparent)",
  overlay: "color-mix(in srgb, #000 48%, transparent)",
  invertedBackground: "var(--hoi-ink)",
  textNeutralPrimary: "var(--hoi-ink)",
  textNeutralSecondary: "var(--hoi-muted)",
  textNeutralTertiary: "color-mix(in srgb, var(--hoi-muted) 62%, transparent)",
  textNeutralLink: "var(--hoi-brand-ink)",
  textBrand: "var(--hoi-brand-ink)",
  textAccentPrimary: "var(--hoi-on-brand)",
  textAccentSecondary: "color-mix(in srgb, var(--hoi-on-brand) 70%, transparent)",
  textAccentTertiary: "color-mix(in srgb, var(--hoi-on-brand) 40%, transparent)",
  interactiveAccentDefault: "var(--hoi-brand)",
  interactiveAccentHover: "color-mix(in srgb, var(--hoi-brand) 86%, var(--hoi-ink))",
  interactiveAccentPressed: "color-mix(in srgb, var(--hoi-brand) 76%, var(--hoi-ink))",
  interactiveAccentDisabled: "color-mix(in srgb, var(--hoi-brand) 40%, transparent)",
  borderAccent: "color-mix(in srgb, var(--hoi-brand) 18%, transparent)",
  borderAccentEmphasis: "color-mix(in srgb, var(--hoi-brand) 42%, transparent)",
  borderInfoEmphasis: "var(--hoi-brand)",
  textInfoPrimary: "var(--hoi-ink)",
  borderDefault: "var(--hoi-line)",
  borderInteractive: "var(--hoi-line)",
  borderInteractiveEmphasis: "color-mix(in srgb, var(--hoi-ink) 28%, transparent)",
  borderInteractiveSelected: "var(--hoi-brand)",
  shadowS: "none",
  shadowM: "none",
  shadowL: "0 2px 10px color-mix(in srgb, #000 8%, transparent)",
  shadowXl: "0 8px 24px color-mix(in srgb, #000 12%, transparent)",
  shadow2xl: "0 12px 32px color-mix(in srgb, #000 14%, transparent)",
  shadow3xl: "0 16px 40px color-mix(in srgb, #000 16%, transparent)",
  fontBody: "var(--hoi-font)",
  fontHeading: "var(--hoi-font)",
  fontLabel: "var(--hoi-font)",
  fontNumbers: "var(--hoi-font)",
  fontCode: "var(--hoi-mono)",
  fontVariationRegular: "normal",
  fontVariationMedium: "normal",  radiusXl: "12px",
  radius2xl: "16px",
  radius3xl: "16px",
};

/** Theme for every dashboard: Desktop tokens, its chart palette and Desktop's light/dark mode. */
export function DashboardTheme({ children }: { children: ReactNode }) {
  const look = useDesktopLook();
  const theme = useMemo(() => ({ ...DESKTOP_TOKENS, ...chartTheme(look) }) as Record<string, unknown>, [look]);
  return <DashboardThemeProvider mode={look.mode} lightTheme={theme as never} darkTheme={theme as never}>{children}</DashboardThemeProvider>;
}
