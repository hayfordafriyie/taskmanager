import { useState } from "react";
import type { ChangeEvent } from "react";
import {
  Root,
  Trigger,
  Value,
  Portal,
  Content,
  Viewport,
  Item,
  ItemText,
  ItemIndicator,
} from "radix-ui/select";
import { ChevronDownIcon, CheckIcon } from "@radix-ui/react-icons";
import { countryOptions, combinePhone, normalizeNational } from "../lib/phone";
import type { CountryOption, SplitNumber } from "../types/phone";
import type { PhoneInputProps } from "../types/ui";

function splitNumber(value: string): SplitNumber {
  for (const country of countryOptions) {
    if (value && value.startsWith(country.code)) {
      return { code: country.code, national: value.slice(country.code.length) };
    }
  }
  return { code: countryOptions[0].code, national: value || "" };
}

export default function PhoneInput({
  value,
  onChange,
  disabled,
}: PhoneInputProps) {
  const [country, setCountry] = useState<string>(() => splitNumber(value).code);
  const [national, setNational] = useState<string>(
    () => splitNumber(value).national,
  );

  function handleCountry(next: string) {
    setCountry(next);
    onChange(combinePhone(next, national));
  }

  function handleNational(e: ChangeEvent<HTMLInputElement>) {
    const fixed = normalizeNational(country, e.target.value);
    setNational(fixed);
    onChange(combinePhone(country, fixed));
  }

  const active: CountryOption =
    countryOptions.find((c) => c.code === country) || countryOptions[0];

  return (
    <div className="flex gap-2">
      <Root value={country} onValueChange={handleCountry} disabled={disabled}>
        <Trigger
          aria-label="Country code"
          className="control flex items-center gap-1 rounded-[0.85rem] px-2.5 py-2.5 text-sm"
        >
          <Value>{country}</Value>
          <ChevronDownIcon width={12} height={12} className="opacity-60" />
        </Trigger>
        <Portal>
          <Content
            position="popper"
            sideOffset={4}
            className="glass-pop z-50 max-h-72 min-w-36 overflow-auto rounded-xl p-1"
          >
            <Viewport>
              {countryOptions.map((c) => (
                <Item
                  key={c.code}
                  value={c.code}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-[var(--accent-tint)] data-[highlighted]:text-[var(--ink)]"
                >
                  <ItemText>
                    {c.code} {c.label}
                  </ItemText>
                  <ItemIndicator>
                    <CheckIcon width={12} height={12} />
                  </ItemIndicator>
                </Item>
              ))}
            </Viewport>
          </Content>
        </Portal>
      </Root>
      <input
        type="tel"
        inputMode="numeric"
        value={national}
        onChange={handleNational}
        placeholder={active.placeholder}
        maxLength={active.length}
        disabled={disabled}
        className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
      />
    </div>
  );
}
