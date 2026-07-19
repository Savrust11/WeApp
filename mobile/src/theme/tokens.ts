/**
 * Design tokens — single source of truth, computed from the web app's CSS
 * variables in `client/src/index.css` so mobile renders identically to web.
 *
 * Web HSL  →  exact hex (do not "round" these; they match the browser output):
 *   --primary            270 40% 55%   → #8C5EBA  (Elegant Grape Purple)
 *   --primary-foreground  0  0% 100%   → #FFFFFF
 *   --secondary          145 30% 55%   → #6AAF86  (Natural Leaf Green)
 *   --secondary-foreground 145 40% 15% → #173624
 *   --background         270 15% 98%   → #FAF9FB  (warm lavender off-white)
 *   --foreground         270 10% 18%   → #2E2932
 *   --card                0  0% 100%   → #FFFFFF
 *   --muted              270 15% 96%   → #F5F3F6
 *   --muted-foreground   270 10% 50%   → #7F738C
 *   --accent             270 30% 95%   → #F2EEF6
 *   --accent-foreground  270 40% 40%   → #663D8F
 *   --destructive          0 84% 60%   → #EE4343
 *   --border             270 15% 91%   → #E8E5EB
 *   --radius             1.5rem        → 24px
 */

export const palette = {
  primary: '#8C5EBA',
  primaryForeground: '#FFFFFF',
  secondary: '#6AAF86',
  secondaryForeground: '#173624',
  background: '#FAF9FB',
  foreground: '#2E2932',
  card: '#FFFFFF',
  cardForeground: '#2E2932',
  muted: '#F5F3F6',
  mutedForeground: '#7F738C',
  accent: '#F2EEF6',
  accentForeground: '#663D8F',
  destructive: '#EE4343',
  destructiveForeground: '#FAFAFA',
  border: '#E8E5EB',
  input: '#E8E5EB',
  ring: '#8C5EBA',
  // status dots (web: tailwind.config.ts `status`)
  statusOnline: 'rgb(34 197 94)',
  statusAway: 'rgb(245 158 11)',
  statusBusy: 'rgb(239 68 68)',
  statusOffline: 'rgb(156 163 175)',
} as const;

/** Web --radius is 24px; tailwind lg/md/sm derive from it. */
export const radius = {
  sm: 12,
  md: 18,
  lg: 24, // default rounded-2xl / card
  xl: 32,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
} as const;

/**
 * Web fonts: M PLUS Rounded 1c (headings / --font-sans),
 * Nunito (body / --font-body). Keys match the names registered with
 * expo-font in App.tsx.
 */
export const fonts = {
  sans: 'MPLUSRounded1c_700Bold', // headings — bold/tracking-tight on web
  sansMedium: 'MPLUSRounded1c_500Medium',
  sansRegular: 'MPLUSRounded1c_400Regular',
  body: 'Nunito_400Regular',
  bodySemibold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
} as const;

/**
 * Web "Premium Soft" shadows from index.css `@layer utilities`.
 * RN approximations (single shadow; iOS honors radius/offset, Android uses
 * elevation). shadow-soft = the card/elevated look used across the web app.
 */
export const shadows = {
  soft: {
    shadowColor: '#805AAA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: {
    shadowColor: '#805AAA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

export type Palette = typeof palette;
