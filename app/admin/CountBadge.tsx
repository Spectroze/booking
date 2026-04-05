'use client';

/** Small red notification pill (e.g. pending count) — top-right of a relative parent */
export function CountBadge({
  count,
  className = '',
}: {
  count: number;
  className?: string;
}) {
  if (count < 1) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <span
      className={`pointer-events-none absolute -top-1.5 -right-1.5 z-10 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:ring-gray-900 sm:h-5 sm:min-w-[1.25rem] sm:text-[11px] ${className}`}
      aria-hidden
    >
      {label}
    </span>
  );
}
