import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-10 px-4";
const variants = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "bg-surface-2 text-ink hover:bg-line",
  ghost: "text-muted hover:text-ink hover:bg-surface-2",
  quiet: "text-accent hover:underline px-0 min-h-0",
};

export type Variant = keyof typeof variants;

export function Button({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={cx(base, variants[variant], className)} {...props} />;
}

export function LinkButton({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(base, variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-surface p-4", className)} {...props} />;
}

export function PageHeader({ title, intro, action }: { title: string; intro?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 text-sm text-muted">{body}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none";

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 text-sm text-warm">
      {children}
    </p>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>;
}
