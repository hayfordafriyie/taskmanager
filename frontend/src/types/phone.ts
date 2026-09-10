/** Types for the phone-number helpers (`src/lib/phone.ts`). */

/**
 * A full number split into its dialling code and national part.
 *
 * `PhoneInput` keeps these two pieces in state so switching country does not
 * discard what the user already typed.
 */
export interface SplitNumber {
  /** Dialling code including the plus sign, e.g. `+233`. */
  code: string;
  /** Digits after the dialling code. */
  national: string;
}

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
