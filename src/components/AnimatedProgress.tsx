import { useMemo } from 'react';

interface AnimatedProgressProps {
  value: number;
  label?: string;
  statusText?: string;
  className?: string;
  showMeta?: boolean;
  size?: 'sm' | 'md';
}

export default function AnimatedProgress({
  value,
  label = 'Progress',
  statusText = 'Processing',
  className = '',
  showMeta = true,
  size = 'md',
}: AnimatedProgressProps) {
  const clampedValue = useMemo(() => Math.min(Math.max(value, 0), 100), [value]);
  const glowLeft = `${clampedValue}%`;
  const barHeightClass = size === 'sm' ? 'h-2' : 'h-4';
  const dotSizeClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const dotShadowClass =
    size === 'sm'
      ? 'shadow-[0_0_12px_rgba(99,102,241,0.8)]'
      : 'shadow-[0_0_18px_rgba(99,102,241,0.85)]';
  const showHeader = showMeta && Boolean(label);
  const showStatus = showMeta && Boolean(statusText);

  return (
    <div className={`w-full ${className}`}>
      {showHeader && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {label}
          </span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {clampedValue}%
          </span>
        </div>
      )}

      <div
        className={`relative ${barHeightClass} w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800`}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-70 blur-sm animate-progress-shimmer" />
        </div>

        <div
          className="relative h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 shadow-[0_8px_24px_rgba(59,130,246,0.35)] transition-[width] duration-700 ease-out"
          style={{ width: `${clampedValue}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/40 to-white/0 opacity-60 animate-progress-wave" />
        </div>

        <div
          className={`pointer-events-none absolute top-1/2 ${dotSizeClass} -translate-y-1/2 rounded-full bg-white/70 ${dotShadowClass} blur-[1px] animate-progress-pulse`}
          style={{ left: glowLeft, transform: 'translate(-50%, -50%)' }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-200 to-indigo-200 opacity-80 animate-progress-glow" />
        </div>
      </div>

      {showStatus && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{statusText}</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-30 animate-progress-dot [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-30 animate-progress-dot [animation-delay:200ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-30 animate-progress-dot [animation-delay:400ms]" />
          </span>
        </div>
      )}
    </div>
  );
}
