import {
  Stethoscope,
  Heart,
  Scissors,
  Baby,
  HeartPulse,
  Brain,
  Bone,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

const BOARD_ICON_MAP: Record<string, LucideIcon> = {
  'Internal Medicine': Stethoscope,
  'Chest / Cardiology': Heart,
  Cardiology: Heart,
  Surgery: Scissors,
  Pediatrics: Baby,
  'Obstetrics & Gynecology': HeartPulse,
  Neurology: Brain,
  Orthopedics: Bone,
};

const BOARD_COLORS: Record<string, string> = {
  'Internal Medicine': 'text-teal-600 dark:text-teal-400',
  'Chest / Cardiology': 'text-rose-600 dark:text-rose-400',
  Cardiology: 'text-rose-600 dark:text-rose-400',
  Surgery: 'text-violet-600 dark:text-violet-400',
  Pediatrics: 'text-amber-600 dark:text-amber-400',
  'Obstetrics & Gynecology': 'text-pink-600 dark:text-pink-400',
  Neurology: 'text-indigo-600 dark:text-indigo-400',
  Orthopedics: 'text-slate-600 dark:text-slate-400',
};

interface BoardIconProps {
  nameEn: string;
  size?: number;
  className?: string;
}

export function BoardIcon({ nameEn, size = 18, className = '' }: BoardIconProps) {
  const Icon = BOARD_ICON_MAP[nameEn] ?? LayoutGrid;
  const color = BOARD_COLORS[nameEn] ?? 'text-teal-600 dark:text-teal-400';
  return <Icon size={size} strokeWidth={2} className={`${color} ${className}`} />;
}

export function getBoardIconBg(nameEn: string): string {
  const map: Record<string, string> = {
    'Internal Medicine': 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900/50',
    'Chest / Cardiology': 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/50',
    Cardiology: 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/50',
    Surgery: 'bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/50',
    Pediatrics: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50',
    'Obstetrics & Gynecology': 'bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/50',
    Neurology: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/50',
    Orthopedics: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  };
  return map[nameEn] ?? 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900/50';
}
