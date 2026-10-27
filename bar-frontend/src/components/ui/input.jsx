import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, currency = false, ...props }) {
  if (currency) {
    const original = props.onChange;
    const number = Number(props.value);
    props = {
      ...props,
      inputMode: "numeric",
      value:
        props.value === ""
          ? ""
          : Number.isFinite(number)
            ? number.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "",
      onChange: (event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
        original?.({
          target: {
            ...event.target,
            name: props.name,
            id: props.id,
            value: digits ? (Number(digits) / 100).toFixed(2) : "",
          },
        });
      },
    };
    type = "text";
    delete props.step;
    delete props.min;
    delete props.max;
  }
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
