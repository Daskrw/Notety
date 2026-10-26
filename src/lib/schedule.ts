import type { ScheduleDayDetail } from './blocks';

export interface ShiftColorTheme {
  id: string;
  name: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  lightBgClass: string;
  badgeClass: string;
  hex: string;
}

export const SHIFT_COLOR_PALETTE: ShiftColorTheme[] = [
  {
    id: 'blue',
    name: 'น้ำเงิน (Blue)',
    bgClass: 'bg-blue-500',
    borderClass: 'border-blue-600',
    textClass: 'text-white',
    lightBgClass: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    hex: '#3b82f6',
  },
  {
    id: 'indigo',
    name: 'คราม (Indigo)',
    bgClass: 'bg-indigo-500',
    borderClass: 'border-indigo-600',
    textClass: 'text-white',
    lightBgClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    hex: '#6366f1',
  },
  {
    id: 'teal',
    name: 'เขียวหัวเป็ด (Teal)',
    bgClass: 'bg-teal-500',
    borderClass: 'border-teal-600',
    textClass: 'text-white',
    lightBgClass: 'bg-teal-50 text-teal-700 border-teal-200',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    hex: '#14b8a6',
  },
  {
    id: 'emerald',
    name: 'มรกต (Emerald)',
    bgClass: 'bg-emerald-500',
    borderClass: 'border-emerald-600',
    textClass: 'text-white',
    lightBgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    hex: '#10b981',
  },
  {
    id: 'amber',
    name: 'อำพัน / วันหยุด (Amber)',
    bgClass: 'bg-amber-400',
    borderClass: 'border-amber-500',
    textClass: 'text-stone-900',
    lightBgClass: 'bg-amber-50 text-amber-800 border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    hex: '#fbbf24',
  },
  {
    id: 'orange',
    name: 'ส้ม (Orange)',
    bgClass: 'bg-orange-500',
    borderClass: 'border-orange-600',
    textClass: 'text-white',
    lightBgClass: 'bg-orange-50 text-orange-700 border-orange-200',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    hex: '#f97316',
  },
  {
    id: 'rose',
    name: 'แดง / วันหยุดพิเศษ (Rose)',
    bgClass: 'bg-rose-500',
    borderClass: 'border-rose-600',
    textClass: 'text-white',
    lightBgClass: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    hex: '#f43f5e',
  },
  {
    id: 'violet',
    name: 'ม่วง (Violet)',
    bgClass: 'bg-purple-500',
    borderClass: 'border-purple-600',
    textClass: 'text-white',
    lightBgClass: 'bg-purple-50 text-purple-700 border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    hex: '#a855f7',
  },
  {
    id: 'slate',
    name: 'กะดึก / สเลท (Slate)',
    bgClass: 'bg-slate-600',
    borderClass: 'border-slate-700',
    textClass: 'text-white',
    lightBgClass: 'bg-slate-100 text-slate-800 border-slate-300',
    badgeClass: 'bg-slate-200 text-slate-900 border-slate-400',
    hex: '#475569',
  },
  {
    id: 'cyan',
    name: 'ฟ้าคราม (Cyan)',
    bgClass: 'bg-cyan-500',
    borderClass: 'border-cyan-600',
    textClass: 'text-white',
    lightBgClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    hex: '#06b6d4',
  },
];

const WORK_COLOR_ORDER = ['blue', 'indigo', 'teal', 'emerald', 'orange', 'slate', 'cyan', 'violet'];

/**
 * Deterministically compute a color for a schedule entry.
 * If detail has an explicit valid color, that color is returned.
 * If not, a deterministic color based on category and shift identifier is returned.
 */
export function getShiftColorTheme(detail?: ScheduleDayDetail | null): ShiftColorTheme {
  if (!detail) {
    return SHIFT_COLOR_PALETTE[0];
  }

  // 1. If explicit color is set
  if (detail.color) {
    const found = SHIFT_COLOR_PALETTE.find((c) => c.id === detail.color);
    if (found) return found;
  }

  // 2. Deterministic fallback based on category and content
  if (detail.category === 'holiday') {
    return SHIFT_COLOR_PALETTE.find((c) => c.id === 'rose') || SHIFT_COLOR_PALETTE[6];
  }
  if (detail.category === 'off') {
    return SHIFT_COLOR_PALETTE.find((c) => c.id === 'amber') || SHIFT_COLOR_PALETTE[4];
  }
  if (detail.category === 'custom') {
    return SHIFT_COLOR_PALETTE.find((c) => c.id === 'violet') || SHIFT_COLOR_PALETTE[7];
  }

  // Work category: compute deterministic hash from shiftTimes or title or date
  const seedString = (detail.shiftTimes || detail.title || 'work-shift').toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0;
  }
  const colorIndex = Math.abs(hash) % WORK_COLOR_ORDER.length;
  const targetId = WORK_COLOR_ORDER[colorIndex];
  return SHIFT_COLOR_PALETTE.find((c) => c.id === targetId) || SHIFT_COLOR_PALETTE[0];
}

/**
 * Parse any time representation into valid 24-hour [hours, minutes].
 * Strips AM/PM and clamps hours to [0..23] and minutes to [0..59].
 */
export function parse24HTime(timeStr?: string | null): [number, number] {
  if (!timeStr || typeof timeStr !== 'string') return [8, 0];

  const trimmed = timeStr.trim().toLowerCase();
  const isPM = trimmed.includes('pm');
  const isAM = trimmed.includes('am');

  const numbersOnly = trimmed.replace(/[^\d:]/g, '');
  const parts = numbersOnly.split(':');

  let hours = parseInt(parts[0] || '8', 10);
  let minutes = parseInt(parts[1] || '0', 10);

  if (isNaN(hours)) hours = 8;
  if (isNaN(minutes)) minutes = 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  // Strict 24-hour clamp
  hours = Math.max(0, Math.min(23, hours));
  minutes = Math.max(0, Math.min(59, minutes));

  return [hours, minutes];
}

/**
 * Format hours and minutes strictly into 24-hour `HH:mm` format.
 */
export function format24HTime(hours: number, minutes: number): string {
  const safeH = Math.max(0, Math.min(23, isNaN(hours) ? 0 : Math.floor(hours)));
  const safeM = Math.max(0, Math.min(59, isNaN(minutes) ? 0 : Math.floor(minutes)));
  return `${String(safeH).padStart(2, '0')}:${String(safeM).padStart(2, '0')}`;
}

/**
 * Normalize a shift string like "08:00 - 17:30" or "8:00 AM - 5:30 PM" into clean 24H "HH:mm - HH:mm".
 */
export function normalizeShiftTimes24H(shiftTimes?: string | null): string {
  if (!shiftTimes || typeof shiftTimes !== 'string') return '';
  const parts = shiftTimes.split('-');
  if (parts.length < 2) {
    const [h, m] = parse24HTime(parts[0]);
    return format24HTime(h, m);
  }
  const [startH, startM] = parse24HTime(parts[0]);
  const [endH, endM] = parse24HTime(parts[1]);
  return `${format24HTime(startH, startM)} - ${format24HTime(endH, endM)}`;
}

/**
 * Calculates duration and handles overnight shifts cleanly.
 * Example: 22:00 to 06:00 -> 8 hours, isOvernight = true
 */
export function calculateShiftDuration(startStr: string, endStr: string): {
  durationMinutes: number;
  hours: number;
  minutes: number;
  isOvernight: boolean;
  formattedDuration: string;
} {
  const [startH, startM] = parse24HTime(startStr);
  const [endH, endM] = parse24HTime(endStr);

  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  let diffMinutes = endTotal - startTotal;
  let isOvernight = false;

  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
    isOvernight = true;
  } else if (diffMinutes === 0 && startStr.trim() !== '') {
    // 24-hour continuous shift
    diffMinutes = 24 * 60;
    isOvernight = true;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  let formattedDuration = '';
  if (hours > 0 && minutes > 0) {
    formattedDuration = `${hours} ชม. ${minutes} น.`;
  } else if (hours > 0) {
    formattedDuration = `${hours} ชม.`;
  } else {
    formattedDuration = `${minutes} น.`;
  }

  if (isOvernight) {
    formattedDuration += ' (ข้ามวัน)';
  }

  return {
    durationMinutes: diffMinutes,
    hours,
    minutes,
    isOvernight,
    formattedDuration,
  };
}

/**
 * Helper to add 9 hours and 30 minutes in strict 24-hour modulo arithmetic.
 */
export function add9Hours30Mins(timeStr: string): string {
  const [hours, mins] = parse24HTime(timeStr);
  let totalMins = hours * 60 + mins + 9 * 60 + 30;
  totalMins = totalMins % (24 * 60);
  const endH = Math.floor(totalMins / 60);
  const endM = totalMins % 60;
  return format24HTime(endH, endM);
}

/**
 * Preset common work shifts for Thai workplaces
 */
export interface CommonShiftPreset {
  label: string;
  shortLabel: string;
  start: string;
  end: string;
  color: string;
}

export const COMMON_SHIFT_PRESETS: CommonShiftPreset[] = [
  { label: 'กะเช้า (08:00 - 17:30)', shortLabel: 'เช้า 08:00', start: '08:00', end: '17:30', color: 'blue' },
  { label: 'กะปกติ (08:30 - 17:30)', shortLabel: 'ปกติ 08:30', start: '08:30', end: '17:30', color: 'indigo' },
  { label: 'กะสาย (09:00 - 18:00)', shortLabel: 'สาย 09:00', start: '09:00', end: '18:00', color: 'cyan' },
  { label: 'กะบ่าย (13:00 - 22:00)', shortLabel: 'บ่าย 13:00', start: '13:00', end: '22:00', color: 'orange' },
  { label: 'กะดึก ข้ามวัน (22:00 - 06:00)', shortLabel: 'ดึก 22:00', start: '22:00', end: '06:00', color: 'slate' },
  { label: 'กะ 12 ชม. (08:00 - 20:00)', shortLabel: '12 ชม. 08:00', start: '08:00', end: '20:00', color: 'teal' },
  { label: 'กะดึก 12 ชม. (20:00 - 08:00)', shortLabel: 'ดึก 20:00', start: '20:00', end: '08:00', color: 'slate' },
];
