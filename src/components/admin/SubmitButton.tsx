"use client";

import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/Icon";

export function SubmitButton({
  children,
  pendingLabel,
  icon,
  variant = "primary",
  confirm,
  title,
  name,
  value,
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
  icon?: IconName;
  variant?: "primary" | "ghost" | "danger" | "icon";
  confirm?: string;
  title?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  const variants = {
    primary:
      "inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)]",
    ghost:
      "inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]",
    danger:
      "inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50",
    icon: "grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]",
  } as const;

  return (
    <button
      type="submit"
      name={name}
      value={value}
      title={title}
      aria-label={title}
      disabled={pending}
      onClick={(e) => {
        // A native confirm() is the one dialog that is safe here: it runs in
        // the user's own browser, in direct response to their click.
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={`${variants[variant]} transition-colors disabled:opacity-50`}
    >
      {icon && <Icon name={icon} width={15} height={15} />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
