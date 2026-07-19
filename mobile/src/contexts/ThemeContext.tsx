import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette } from '../theme/tokens';

// ── Web-only dark mode CSS ────────────────────────────────────────────────────
//
// Strategy:
//  1. `body.weyu-dark * { color }` — one rule covers EVERY text node, whether
//     the color came from StyleSheet.create() (a CSS class) or an inline style.
//     CSS `color` does NOT affect color emoji: the OS renders emoji as full-color
//     glyphs that are immune to the CSS `color` property, so emoji stay vivid.
//  2. Backgrounds: we only darken pure white / near-white values.
//     Pastel log-button backgrounds (#FFF0F5, #FFF8E1 …) are deliberately left
//     untouched so emoji icons remain clearly visible on their coloured tiles.
//  3. White / colored text that was already light or red stays as-is via
//     more-specific `!important` rules that beat the broad `*` rule.
//
function injectWebDarkModeCSS() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('weyu-dark-mode-style')) return;

  const style = document.createElement('style');
  style.id = 'weyu-dark-mode-style';
  style.textContent = `
    /* ── 1. ALL text → crisp off-white (emoji unaffected — color fonts) ── */
    body.weyu-dark * {
      color: #F2F2F5 !important;
    }

    /* ── 2. Preserve text that was already white / semi-transparent white ── */
    body.weyu-dark [style*="color: rgb(255, 255, 255)"]  { color: #ffffff !important; }
    body.weyu-dark [style*="color: rgba(255, 255, 255"]  { color: rgba(255,255,255,0.9) !important; }

    /* ── 3. Keep destructive / red text visible ── */
    body.weyu-dark [style*="color: rgb(229, 57, 53)"]    { color: #FF6B6B !important; }

    /* ────────────────────────────────────────────────────────────────────────
       4. Background overrides — two complementary strategies:
          a) Inline styles  — caught by [style*="background-color: rgb(...)"]
          b) React Native Web compiled CSS classes — caught by .r-backgroundColor-HASH
             (RNW compiles StyleSheet.create() colors to deterministic atomic
              class names; we target the ones confirmed from DOM inspection.)
       ──────────────────────────────────────────────────────────────────────── */

    /* 4-a  Inline-style backgrounds (dynamic / merged styles) */
    body.weyu-dark [style*="background-color: rgb(255, 255, 255)"] { background-color: #1C1C2E !important; }
    body.weyu-dark [style*="background-color: rgb(249, 245, 255)"] { background-color: #12122A !important; }
    body.weyu-dark [style*="background-color: rgb(237, 231, 246)"] { background-color: #252040 !important; }
    body.weyu-dark [style*="background-color: rgb(240, 235, 249)"] { background-color: #252040 !important; }
    body.weyu-dark [style*="background-color: rgb(245, 245, 245)"] { background-color: #202030 !important; }
    body.weyu-dark [style*="background-color: rgb(250, 247, 255)"] { background-color: #12122A !important; }
    body.weyu-dark [style*="background-color: rgb(240, 240, 240)"] { background-color: #202030 !important; }
    body.weyu-dark [style*="background-color: rgb(238, 232, 252)"] { background-color: #252040 !important; }

    /* 4-b  RNW compiled-class backgrounds (hashes observed from DOM) */
    /* #ffffff  → r-backgroundColor-14lw9ot */
    body.weyu-dark .r-backgroundColor-14lw9ot { background-color: #1C1C2E !important; }
    /* #F9F5FF  → try r-backgroundColor variants we can infer from RNW */
    /* Apply a safe dark fallback to ALL compiled background classes that aren't
       accent / pastel colours — accomplished by combining with :not() guards */
    body.weyu-dark [class*="r-backgroundColor-"]:not([class*="r-backgroundColor-ir54aa"]):not([class*="r-backgroundColor-14lw9ot"]):not([class*="r-backgroundColor-1ws546s"]) {
      background-color: #1C1C2E !important;
    }
    /* Restore known accent & dot colours explicitly */
    body.weyu-dark .r-backgroundColor-ir54aa  { background-color: #7C5CBF !important; } /* purple #7C5CBF */
    body.weyu-dark .r-backgroundColor-1ws546s { background-color: #7C5CBF !important; } /* dot purple */

    /* 4-c  Pastel icon-button tiles (#FFF0F5 etc.) — kept intentionally
            so emoji stay vivid on their coloured tiles. */

    /* ── 5. Border colours ── */
    body.weyu-dark [style*="border-top-color: rgb(240, 240, 240)"]    { border-top-color:    #2A2A45 !important; }
    body.weyu-dark [style*="border-bottom-color: rgb(237, 231, 246)"] { border-bottom-color: #2A2A45 !important; }
    body.weyu-dark [style*="border-color: rgb(237, 231, 246)"]        { border-color:        #2A2A45 !important; }
    body.weyu-dark [style*="border-bottom-color: rgb(238, 238, 238)"] { border-bottom-color: #2A2A45 !important; }
    body.weyu-dark [style*="border-bottom-color: rgb(240, 235, 249)"] { border-bottom-color: #2A2A45 !important; }

    /* ── 6. Input / TextInput fields ── */
    body.weyu-dark input, body.weyu-dark textarea {
      background-color: #1C1C2E !important;
      color: #F2F2F5 !important;
      border-color: #3A3A55 !important;
    }
    body.weyu-dark input::placeholder, body.weyu-dark textarea::placeholder {
      color: #6B6B88 !important;
    }

    /* ── 7. Page chrome & scrollbars ── */
    body.weyu-dark { background-color: #0F0F1E !important; }
    body.weyu-dark ::-webkit-scrollbar       { background: #1C1C2E; }
    body.weyu-dark ::-webkit-scrollbar-thumb { background: #3A3A55; border-radius: 4px; }

    /* ── 8. Shadow suppression (light shadows look wrong on dark bg) ── */
    body.weyu-dark [style*="box-shadow"] { box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important; }

    /* ── 9. Switch / Toggle components ── */
    /* RNW renders Switch as [role="switch"][aria-checked] with track/thumb divs inside */
    /* Off state: dark grey track */
    body.weyu-dark [role="switch"] > div           { background-color: #3A3A55 !important; }
    /* On state: purple track */
    body.weyu-dark [role="switch"][aria-checked="true"] > div { background-color: #7C5CBF !important; }
    /* Thumb circle (1 or 2 levels inside) */
    body.weyu-dark [role="switch"] > div > div     { background-color: #EFEFEF !important; border-radius: 50% !important; }
    body.weyu-dark [role="switch"] > div > div > div { background-color: #EFEFEF !important; border-radius: 50% !important; }
  `;
  document.head.appendChild(style);
}

function applyWebBodyClass(isDark: boolean) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (isDark) {
    document.body.classList.add('weyu-dark');
  } else {
    document.body.classList.remove('weyu-dark');
  }
}

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface AppColors {
  background: string;
  card: string;
  cardAlt: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  border: string;
  inputBg: string;
  header: string;
  headerText: string;
  statusBar: 'light' | 'dark';
  // Web-parity additions (mirror client/src/index.css CSS variables)
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  primaryForeground: string;
}

// Light theme = exact web values (see src/theme/tokens.ts)
const LIGHT_COLORS: AppColors = {
  background: palette.background,        // #FAF9FB
  card: palette.card,                   // #FFFFFF
  cardAlt: palette.muted,               // #F5F3F6
  text: palette.foreground,             // #2E2932
  textSecondary: '#5C5560',             // foreground @ ~70% (web text-foreground/90→secondary)
  textMuted: palette.mutedForeground,   // #7F738C
  primary: palette.primary,             // #8C5EBA
  primaryLight: palette.accent,         // #F2EEF6
  border: palette.border,               // #E8E5EB
  inputBg: palette.muted,               // #F5F3F6
  header: palette.primary,              // #8C5EBA
  headerText: palette.primaryForeground,// #FFFFFF
  statusBar: 'light',
  secondary: palette.secondary,         // #6AAF86
  secondaryForeground: palette.secondaryForeground, // #173624
  accent: palette.accent,               // #F2EEF6
  accentForeground: palette.accentForeground,       // #663D8F
  destructive: palette.destructive,     // #EE4343
  primaryForeground: palette.primaryForeground,     // #FFFFFF
};

// Dark theme = WeYu/client/src/index.css `.dark` variables, computed to exact
// hex so dark mode matches the web project 1:1:
//   --primary 270 40% 70% #B294D1 | --secondary 145 30% 55% #6AAF86
//   --secondary-foreground 145 40% 90% #DBF0E4 | --background 240 10% 5% #0B0B0E
//   --foreground 270 8% 90% #E6E3E8 | --card 240 10% 10% #17171C
//   --muted 240 8% 16% #26262C | --muted-foreground 270 6% 58% #948D9A
//   --accent 270 18% 22% #382E42 | --accent-foreground 270 30% 80% #CCBDDB
//   --destructive 0 70% 50% #D92626 | --border/--input 240 8% 20% #2F2F37
const DARK_COLORS: AppColors = {
  background: '#0B0B0E',
  card: '#17171C',
  cardAlt: '#26262C',
  text: '#E6E3E8',
  textSecondary: '#BDB7C6',
  textMuted: '#948D9A',
  primary: '#B294D1',
  primaryLight: '#382E42',
  border: '#2F2F37',
  inputBg: '#2F2F37',
  header: '#B294D1',
  headerText: '#FFFFFF',
  statusBar: 'dark',
  secondary: '#6AAF86',
  secondaryForeground: '#DBF0E4',
  accent: '#382E42',
  accentForeground: '#CCBDDB',
  destructive: '#D92626',
  primaryForeground: '#FFFFFF',
};

interface ThemeContextValue {
  mode: ThemeMode;
  colors: AppColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: LIGHT_COLORS,
  isDark: false,
  setMode: () => {},
});

const STORAGE_KEY = '@weyu_theme_mode';

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  // auto: dark from 18:00 to 6:00
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [isDark, setIsDark] = useState(false);

  // Inject the CSS once on mount (no-op on native)
  useEffect(() => { injectWebDarkModeCSS(); }, []);

  // Toggle the body class whenever dark state changes
  useEffect(() => { applyWebBodyClass(isDark); }, [isDark]);

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        setModeState(saved);
        setIsDark(resolveIsDark(saved));
      }
    });
  }, []);

  // For auto mode: re-check every minute
  useEffect(() => {
    if (mode !== 'auto') return;
    const interval = setInterval(() => {
      setIsDark(resolveIsDark('auto'));
    }, 60_000);
    return () => clearInterval(interval);
  }, [mode]);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    setIsDark(resolveIsDark(newMode));
    await AsyncStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
