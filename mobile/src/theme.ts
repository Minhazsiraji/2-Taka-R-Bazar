/**
 * The approved, permanent V1 Signature Teal palette for 2TBR mobile.
 * Source: owner-approved "V1 — Signature Teal" reference, 18 Oct 2026.
 * Distinct status colors (success, warning, error) are semantic and must not
 * be mistaken for sale/brand colors.
 */
export const brandV1={
 primary:'#007F83',
 accent:'#2CD6CE',
 text:'#17233B',
 background:'#F4F1F6',
 white:'#FFFFFF',
 accentPale:'#B8F6F1'
} as const;

export const palette={
 light:{
  background:brandV1.background,
  card:brandV1.white,
  text:brandV1.text,
  muted:'#5B6980',
  line:'#E3DFE8',
  field:'#F8F6FA',
  accent:brandV1.primary,
  highlight:brandV1.accent,
  brandText:'#006C70',
  onPrimary:brandV1.white,
  soft:'#DFF8F6',
  hero:brandV1.primary
 },
 dark:{
  background:'#0D1424',
  card:'#17233B',
  text:brandV1.background,
  muted:'#BEC9D9',
  line:'#37465C',
  field:'#23324A',
  accent:brandV1.accent,
  highlight:brandV1.accent,
  brandText:'#9CF6F0',
  onPrimary:brandV1.text,
  soft:'#164C50',
  hero:'#06494B'
 }
} as const;

export type AppTheme=typeof palette.light|typeof palette.dark;

// Static, layout-neutral white highlights; no blur views or animated shadows.
export const gloss={
 edge:'rgba(255,255,255,0.9)',
 rim:{borderColor:'rgba(255,255,255,0.9)',borderTopColor:'#FFFFFF',
  boxShadow:'0 0 0 0.5px rgba(255,255,255,0.42), 0 1px 3px rgba(23,35,59,0.1)'},
 glass:{backgroundColor:'rgba(0,65,70,0.34)',
  boxShadow:'inset 0 1px 2px rgba(255,255,255,0.32), 0 0 3px rgba(255,255,255,0.16)'},
 heroInk:{textShadowColor:'rgba(0,35,40,0.8)',textShadowOffset:{width:0,height:1},textShadowRadius:1},
 slogan:{light:brandV1.primary,dark:brandV1.accent}
} as const;

/**
 * Owner-approved unified glass treatment for every interactive surface.
 * Only color/edge/reflection changes here: no dimensions, content or routing.
 * Inset surfaces are intentionally nearly clear, so nested cards no longer
 * produce the unwanted opaque white/grey layer.
 */
export const glassSurfaces={
 light:{
  outer:{...gloss.rim,backgroundColor:'rgba(255,255,255,0.23)',borderWidth:1},
  inset:{...gloss.rim,backgroundColor:'rgba(255,255,255,0.09)',borderWidth:1},
  control:{...gloss.rim,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:1},
  selected:{...gloss.rim,backgroundColor:'rgba(0,127,131,0.10)',borderWidth:1}
 },
 dark:{
  outer:{...gloss.rim,backgroundColor:'rgba(255,255,255,0.075)',borderWidth:1},
  inset:{...gloss.rim,backgroundColor:'rgba(255,255,255,0.035)',borderWidth:1},
  control:{...gloss.rim,backgroundColor:'rgba(255,255,255,0.065)',borderWidth:1},
  selected:{...gloss.rim,backgroundColor:'rgba(44,214,206,0.13)',borderWidth:1}
 }
} as const;
