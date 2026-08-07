/**
 * Log-type → Lucide icon + EXACT colors, transcribed 1:1 from the canonical
 * web project: WeYu/client/src/lib/phases.ts (each action's
 * `color: "bg-X-50 text-X-N border-X-100"`). Hex = standard Tailwind v3 so
 * quick-action tiles render pixel-for-pixel like the WeYu web grid.
 *
 *   tile  = soft (bg-*-50)   border = bord (border-*-100)   icon/label = tint (text-*-N)
 *
 * Legacy mobile log-type ids (expressed/nail_cut/moisturize/appointment/…)
 * are aliased to their WeYu equivalents so existing mobile logging keeps
 * working while the visuals match WeYu.
 */
import React from 'react';
import {
  Milk, Baby, Moon, Apple, Cookie, Star, Bath, Blocks, School, Sparkles,
  Pill, Thermometer, Heart, UtensilsCrossed, Droplets, MessageCircle,
  ThumbsUp, Award, GraduationCap, Stethoscope, CalendarCheck, Scissors,
  Hand, GlassWater, Palette, Timer, Pencil, ClipboardList, NotebookPen,
  Footprints,
} from 'lucide-react-native';

type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type V = { icon: IconCmp; tint: string; soft: string; bord: string };

// Tailwind v3 hex (families used by WeYu phases.ts):
//  emerald 50 #ECFDF5 100 #D1FAE5 600 #059669 | sky 50 #F0F9FF 100 #E0F2FE 500 #0EA5E9 600 #0284C7
//  teal 50 #F0FDFA 100 #CCFBF1 600 #0D9488     | amber 50 #FFFBEB 100 #FEF3C7 600 #D97706
//  yellow 50 #FEFCE8 100 #FEF9C3 700 #A16207   | cyan 50 #ECFEFF 100 #CFFAFE 500 #06B6D4 600 #0891B2
//  green 50 #F0FDF4 100 #DCFCE7 600 #16A34A    | fuchsia 50 #FDF4FF 100 #FAE8FF 600 #C026D3
//  violet 50 #F5F3FF 100 #EDE9FE 500 #8B5CF6 600 #7C3AED | orange 50 #FFF7ED 100 #FFEDD5 600 #EA580C
//  pink 50 #FDF2F8 100 #FCE7F3 500 #EC4899     | purple 50 #FAF5FF 100 #F3E8FF 600 #9333EA
//  blue 50 #EFF6FF 100 #DBEAFE 500 #3B82F6 600 #2563EB | lime 50 #F7FEE7 100 #ECFCCB 600 #65A30D
//  slate 50 #F8FAFC 100 #F1F5F9 500 #64748B    | rose 50 #FFF1F2 100 #FFE4E6 400 #FB7185
//  red 50 #FEF2F2 100 #FEE2E2 400 #F87171 500 #EF4444 | indigo 50 #EEF2FF 100 #E0E7FF 500 #6366F1

const MAP: Record<string, V> = {
  // ── verbatim from WeYu/client/src/lib/phases.ts ──
  achievement:   { icon: Award,           tint: '#059669', soft: '#ECFDF5', bord: '#D1FAE5' }, // emerald-600
  bath:          { icon: Bath,            tint: '#0EA5E9', soft: '#F0F9FF', bord: '#E0F2FE' }, // sky-500
  clinic:        { icon: Stethoscope,     tint: '#0D9488', soft: '#F0FDFA', bord: '#CCFBF1' }, // teal-600
  diaper:        { icon: Baby,            tint: '#D97706', soft: '#FFFBEB', bord: '#FEF3C7' }, // amber-600
  discipline:    { icon: ThumbsUp,        tint: '#A16207', soft: '#FEFCE8', bord: '#FEF9C3' }, // yellow-700
  drink:         { icon: GlassWater,      tint: '#0891B2', soft: '#ECFEFF', bord: '#CFFAFE' }, // cyan-600
  express:       { icon: Timer,           tint: '#0D9488', soft: '#F0FDFA', bord: '#CCFBF1' }, // teal-600
  food:          { icon: Apple,           tint: '#16A34A', soft: '#F0FDF4', bord: '#DCFCE7' }, // green-600
  hobby:         { icon: Palette,         tint: '#C026D3', soft: '#FDF4FF', bord: '#FAE8FF' }, // fuchsia-600
  hold:          { icon: Heart,           tint: '#8B5CF6', soft: '#F5F3FF', bord: '#EDE9FE' }, // violet-500
  meal:          { icon: UtensilsCrossed, tint: '#EA580C', soft: '#FFF7ED', bord: '#FFEDD5' }, // orange-600
  medicine:      { icon: Pill,            tint: '#EC4899', soft: '#FDF2F8', bord: '#FCE7F3' }, // pink-500
  milestone:     { icon: Star,            tint: '#9333EA', soft: '#FAF5FF', bord: '#F3E8FF' }, // purple-600
  milk:          { icon: Milk,            tint: '#3B82F6', soft: '#EFF6FF', bord: '#DBEAFE' }, // blue-500
  nail_care:     { icon: Scissors,        tint: '#64748B', soft: '#F8FAFC', bord: '#F1F5F9' }, // slate-500
  play:          { icon: Blocks,          tint: '#65A30D', soft: '#F7FEE7', bord: '#ECFCCB' }, // lime-600
  schedule:      { icon: CalendarCheck,   tint: '#7C3AED', soft: '#F5F3FF', bord: '#EDE9FE' }, // violet-600
  school_prep:   { icon: GraduationCap,   tint: '#2563EB', soft: '#EFF6FF', bord: '#DBEAFE' }, // blue-600
  school_report: { icon: School,          tint: '#0284C7', soft: '#F0F9FF', bord: '#E0F2FE' }, // sky-600
  skincare:      { icon: Hand,            tint: '#FB7185', soft: '#FFF1F2', bord: '#FFE4E6' }, // rose-400
  sleep:         { icon: Moon,            tint: '#6366F1', soft: '#EEF2FF', bord: '#E0E7FF' }, // indigo-500
  snack:         { icon: Cookie,          tint: '#EC4899', soft: '#FDF2F8', bord: '#FCE7F3' }, // pink-500
  temperature:   { icon: Thermometer,     tint: '#F87171', soft: '#FEF2F2', bord: '#FEE2E2' }, // red-400
  thanks:        { icon: Heart,           tint: '#EF4444', soft: '#FEF2F2', bord: '#FEE2E2' }, // red-500
  toilet:        { icon: Droplets,        tint: '#0891B2', soft: '#ECFEFF', bord: '#CFFAFE' }, // cyan-600
  toothbrush:    { icon: Sparkles,        tint: '#06B6D4', soft: '#ECFEFF', bord: '#CFFAFE' }, // cyan-500
  walk:          { icon: Footprints,      tint: '#16A34A', soft: '#F0FDF4', bord: '#DCFCE7' }, // green-600 (web phases.ts:57)
  words:         { icon: MessageCircle,   tint: '#16A34A', soft: '#F0FDF4', bord: '#DCFCE7' }, // green-600

  // ── legacy mobile log-type ids → aliased to WeYu equivalents ──
  expressed:     { icon: Timer,           tint: '#0D9488', soft: '#F0FDFA', bord: '#CCFBF1' }, // = express
  nail_cut:      { icon: Scissors,        tint: '#64748B', soft: '#F8FAFC', bord: '#F1F5F9' }, // = nail_care
  moisturize:    { icon: Hand,            tint: '#FB7185', soft: '#FFF1F2', bord: '#FFE4E6' }, // = skincare
  appointment:   { icon: Stethoscope,     tint: '#0D9488', soft: '#F0FDFA', bord: '#CCFBF1' }, // = clinic
  thank_you:     { icon: Heart,           tint: '#EF4444', soft: '#FEF2F2', bord: '#FEE2E2' }, // = thanks
  word:          { icon: MessageCircle,   tint: '#16A34A', soft: '#F0FDF4', bord: '#DCFCE7' }, // = words
  school:        { icon: School,          tint: '#0284C7', soft: '#F0F9FF', bord: '#E0F2FE' }, // = school_report
  interest:      { icon: Palette,         tint: '#C026D3', soft: '#FDF4FF', bord: '#FAE8FF' }, // = hobby
  custom:        { icon: ClipboardList,   tint: '#9333EA', soft: '#FAF5FF', bord: '#F3E8FF' }, // purple-600
  growth_note:   { icon: NotebookPen,     tint: '#16A34A', soft: '#F0FDF4', bord: '#DCFCE7' }, // green-600
  symptom:       { icon: Stethoscope,     tint: '#EF4444', soft: '#FEF2F2', bord: '#FEE2E2' }, // red-500
};

const FALLBACK: V = { icon: Pencil, tint: '#7F738C', soft: '#F5F3F6', bord: '#E8E5EB' };

export function getLogVisual(type: string): V {
  return MAP[type] ?? FALLBACK;
}

export function LogIcon({
  type,
  size = 20,
  color,
  strokeWidth = 2.5,
}: {
  type: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const v = getLogVisual(type);
  const Cmp = v.icon;
  return <Cmp size={size} color={color ?? v.tint} strokeWidth={strokeWidth} />;
}
