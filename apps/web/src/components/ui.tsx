import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

// shadcn 스타일 초경량 primitives — 런타임 의존성 없음 (Tailwind만)

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-[20px] border border-white/8 bg-night-800/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)]', className)}>
      {children}
    </div>
  );
}

type BtnVariant = 'primary' | 'danger' | 'ghost' | 'outline';
export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const base =
    'flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[16px] font-bold transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none';
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-mint-400 text-[#052e1b] shadow-[0_6px_24px_rgba(52,211,153,0.35)] hover:bg-mint-500',
    danger: 'bg-rose-500 text-white shadow-[0_6px_24px_rgba(251,77,109,0.35)]',
    ghost: 'bg-white/8 text-white hover:bg-white/12',
    outline: 'border border-mint-400/40 text-mint-400 hover:bg-mint-400/10',
  };
  return <button className={cn(base, styles[variant], className)} {...props} />;
}

export function Field({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-mist-500">{label}</span>
      <input
        className={cn(
          'w-full rounded-2xl border border-white/10 bg-night-900 px-4 py-3.5 text-[16px] text-white outline-none',
          'placeholder:text-mist-500/60 focus:border-mint-400/60 focus:ring-2 focus:ring-mint-400/20',
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function StatusChip({ tone, children }: { tone: 'live' | 'wait' | 'bad'; children: ReactNode }) {
  const dot =
    tone === 'live' ? 'bg-mint-400' : tone === 'bad' ? 'bg-rose-500' : 'bg-amber-400 dot-breathe';
  const wrap =
    tone === 'live'
      ? 'border-mint-400/40 bg-mint-400/10 text-mint-400'
      : tone === 'bad'
        ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
        : 'border-amber-400/40 bg-amber-400/10 text-amber-300';
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-bold', wrap)}>
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      {children}
    </span>
  );
}
