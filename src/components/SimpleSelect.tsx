"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string };

/**
 * 旧・自作 <Select value options onChange> のドロップイン置き換え。
 * 内部は shadcn (Base UI) の Select。
 */
export default function SimpleSelect({
  value,
  options,
  onChange,
  placeholder,
  className,
  size = "sm",
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "default";
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger size={size} className={className}>
        <SelectValue placeholder={placeholder}>
          {(val: string) =>
            options.find((o) => o.value === val)?.label ?? placeholder ?? ""
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
