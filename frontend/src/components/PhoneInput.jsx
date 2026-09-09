import { useState } from "react";
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
import { countryOptions, combinePhone, normalizeNational } from "../lib/phone";

function splitNumber(value) {
  for (const country of countryOptions) {
    if (value && value.startsWith(country.code)) {
      return { code: country.code, national: value.slice(country.code.length) };
    }
  }
  return { code: countryOptions[0].code, national: value || "" };
}

export default function PhoneInput({ value, onChange, disabled }) {
  const [country, setCountry] = useState(() => splitNumber(value).code);
  const [national, setNational] = useState(() => splitNumber(value).national);

  function handleCountry(next) {
    setCountry(next);
    onChange(combinePhone(next, national));
  }

  function handleNational(e) {
    const fixed = normalizeNational(country, e.target.value);
    setNational(fixed);
    onChange(combinePhone(country, fixed));
  }

  const active = countryOptions.find((c) => c.code === country) || countryOptions[0];

  return (
    <div className="flex gap-2">
      <Root value={country} onValueChange={handleCountry} disabled={disabled}>
        <Trigger
          aria-label="Country code"
          className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <Value>{country}</Value>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Trigger>
        <Portal>
          <Content
            position="popper"
            sideOffset={4}
            className="z-50 max-h-72 min-w-36 overflow-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <Viewport>
              {countryOptions.map((c) => (
                <Item
                  key={c.code}
                  value={c.code}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 text-sm text-zinc-800 outline-none data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-900 dark:text-zinc-200 dark:data-[highlighted]:bg-indigo-950 dark:data-[highlighted]:text-indigo-200"
                >
                  <ItemText>
                    {c.code} {c.label}
                  </ItemText>
                  <ItemIndicator>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2.5 6.5L4.75 8.75L9.5 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
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
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </div>
  );
}