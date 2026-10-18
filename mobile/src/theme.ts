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
