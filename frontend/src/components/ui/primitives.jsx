import { Fragment, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Search, X } from "lucide-react";
import { cn, statusTone } from "../../lib/utils";

export function Page({ title, subtitle, actions, children }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Card({ className, children }) {
  return <div className={cn("panel p-6", className)}>{children}</div>;
}

export function CardHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1">
        {eyebrow ? <div className="text-xs font-medium uppercase tracking-[0.12em] text-blue-600">{eyebrow}</div> : null}
        {title ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : null}
        {subtitle ? <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({
  className,
  children,
  variant = "primary",
  loading = false,
  icon: Icon,
  ...props
}) {
  const variants = {
    primary:
      "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-sm hover:shadow-md hover:shadow-blue-500/20",
    secondary:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Input({ label, error, className, ...props }) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span> : null}
      <input className={cn("input-base", className)} {...props} />
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </label>
  );
}

export function Select({ label, children, error, className, ...props }) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span> : null}
      <select className={cn("input-base", className)} {...props}>
        {children}
      </select>
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </label>
  );
}

export function Textarea({ label, error, className, ...props }) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span> : null}
      <textarea className={cn("input-base min-h-[120px] py-3", className)} {...props} />
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </label>
  );
}

export function Badge({ children, className, tone }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", tone || "", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Badge tone={statusTone(status)}>{status?.replace(/_/g, " ")}</Badge>;
}

export function StatCard({ title, value, hint, icon: Icon }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search" }) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input-base pl-11"
      />
    </div>
  );
}

export function EmptyState({ icon: Icon = AlertCircle, title, message, action }) {
  return (
    <div className="panel-muted flex min-h-[240px] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-2xl bg-white p-4 text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300">
        <Icon className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      </div>
      {action}
    </div>
  );
}

export function LoadingGrid({ count = 4 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="panel p-6">
          <div className="skeleton h-4 w-24" />
          <div className="mt-6 skeleton h-8 w-32" />
          <div className="mt-4 skeleton h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value, label, tone = "from-blue-600 to-indigo-500" }) {
  const width = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="space-y-2">
      {label ? <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400"><span>{label}</span><span>{width.toFixed(0)}%</span></div> : null}
      <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={cn("h-3 rounded-full bg-gradient-to-r transition-all duration-300 ease-in-out", tone)}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function Gauge({ value = 0, label, subtitle }) {
  const safeValue = Math.max(0, Math.min(100, Number(value)));
  const angle = useMemo(() => -90 + (safeValue / 100) * 180, [safeValue]);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-28 w-56 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 mx-auto h-56 w-56 rounded-full border-[18px] border-slate-200 dark:border-slate-800" />
        <div
          className="absolute inset-x-0 bottom-0 mx-auto h-56 w-56 rounded-full border-[18px] border-transparent border-t-blue-600 border-r-indigo-500 transition-all duration-300"
          style={{ transform: `rotate(${angle}deg)` }}
        />
        <div className="absolute inset-x-0 bottom-1 flex justify-center text-3xl font-semibold tracking-tight">{safeValue.toFixed(0)}%</div>
      </div>
      <div className="text-center">
        <div className="font-medium">{label}</div>
        {subtitle ? <div className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
      </div>
    </div>
  );
}

export function Timeline({ items = [] }) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={cn("h-3 w-3 rounded-full", item.active ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700")} />
            {index < items.length - 1 ? <div className="mt-2 h-full w-px bg-slate-200 dark:bg-slate-800" /> : null}
          </div>
          <div className="pb-5">
            <div className="font-medium">{item.label}</div>
            {item.caption ? <div className="text-sm text-slate-500 dark:text-slate-400">{item.caption}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      message={message || "The request did not complete successfully."}
      action={onRetry ? <Button onClick={onRetry}>Retry</Button> : null}
    />
  );
}

export function SuccessPill({ children }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
      <CheckCircle2 className="h-4 w-4" />
      {children}
    </div>
  );
}

export function Segmented({ items, value, onChange }) {
  return (
    <div className="inline-flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "rounded-2xl px-4 py-2 text-sm font-medium",
            value === item.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
              : "text-slate-500 dark:text-slate-400",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, title, subtitle, onClose, children, footer }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl transition-all duration-200 ease-in-out dark:bg-slate-900">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <button onClick={onClose} className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function KeyValue({ items = [] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="panel-muted p-4">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
          <div className="mt-2 text-sm font-medium">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function DataTable({ columns, rows, onRowClick, empty }) {
  if (!rows?.length) return empty;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <div className="max-h-[420px] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((row) => (
              <tr
                key={row.id || JSON.stringify(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "bg-white transition-all duration-200 ease-in-out hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80",
                  onRowClick ? "cursor-pointer" : "",
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-4 align-top text-slate-700 dark:text-slate-200">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function VirtualList({ items = [], rowHeight = 88, height = 480, renderItem, empty }) {
  const [scrollTop, setScrollTop] = useState(0);
  const visibleCount = Math.ceil(height / rowHeight) + 4;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const visibleItems = items.slice(start, start + visibleCount);
  const offsetY = start * rowHeight;

  if (!items.length) return empty;

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800" style={{ height }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <Fragment key={item.id || `${start + index}`}>{renderItem(item, start + index)}</Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
