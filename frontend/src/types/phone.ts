/** Types for the phone-number helpers (`src/lib/phone.ts`). */

/** A supported dialling country. */
export interface CountryOption {
  /** Human-readable country name. */
  label: string;
  /** Dialling code including the plus sign, e.g. `+233`. */
  code: string;
  /** Example national number shown as the input placeholder. */
  placeholder: string;
  /** Expected number of digits for the national part. */
  length: number;
  /** When true a leading zero is kept (e.g. Côte d'Ivoire, Benin). */
  keepZero?: boolean;
}
