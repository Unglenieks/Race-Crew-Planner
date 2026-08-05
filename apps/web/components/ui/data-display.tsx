import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  meta?: string;
  className?: string;
  onClick?: () => void;
}

function StatCard({
  label,
  value,
  subtext,
  meta,
  className,
  onClick,
}: StatCardProps) {
  const content = (
    <>
      <span className="block font-serif font-semibold text-3xl leading-none tracking-tight">
        {value}
      </span>
      <span className="block text-xs text-muted mt-1.5">{label}</span>
      {meta && (
        <span className="block text-[11px] font-mono text-green-ink uppercase tracking-wider mt-1.5">
          {meta}
        </span>
      )}
      {subtext && (
        <span className="block text-xs text-muted mt-0.5">{subtext}</span>
      )}
    </>
  );

  const classNames = cn(
    "rounded-xl border border-line bg-card p-3.5 text-left min-h-[76px]",
    onClick &&
      "cursor-pointer transition-colors hover:border-green focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2",
    className,
  );

  if (!onClick) {
    return <div className={classNames}>{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={classNames}>
      {content}
    </button>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("py-10 px-6 text-center", className)}>
      <b className="block text-base text-ink mb-1.5 tracking-tight">{title}</b>
      {description && (
        <p className="text-sm text-muted max-w-[46ch] mx-auto leading-relaxed mb-4">
          {description}
        </p>
      )}
      {action && <div className="flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export { StatCard, EmptyState };
