import { useEffect, useState } from 'react';

export type OdometerValidation =
  | { ok: true; belowReference: boolean; referenceValue: number | null }
  | { ok: false; reason: 'empty' | 'invalid' };

/**
 * Shared mileage-input logic for the release and return vehicle-lifecycle forms.
 * web/src/pages/AdminActiveRentalsPage.tsx and BookingRequestsPage.tsx each
 * independently duplicated this (prefill + validation), which caused the same fix
 * to need applying twice in the last two sessions. Extracted here as the one
 * source of truth for the *numeric logic only* — each page keeps its own input
 * markup/styling and its own toast wording, since those already differ (casing,
 * placeholders, presence of a reference-value hint) and aren't part of what was
 * actually duplicated/buggy.
 *
 * mode: 'release' -> prefills from the vehicle's overall last-known mileage
 *                     (Vehicle.currentOdometerKm) — "0" for a never-rented
 *                     vehicle (the schema default), never a fabricated number.
 *       'return'  -> prefills from THIS booking's own release mileage
 *                     (Booking.releaseOdometerKm) — empty for a legacy booking
 *                     with none recorded, never a fabricated number.
 *
 * `active` gates whether the prefill applies right now (e.g. only while the
 * selected booking is in the status this mode expects) — false clears the value,
 * matching both pages' existing reset-on-deselect/reset-on-tab-change behavior.
 * The returned value/setValue are a normal controlled-input pair: fully editable
 * and clearable, never read-only.
 */
export function useOdometerPrefill(booking: any, mode: 'release' | 'return', active: boolean) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (active && booking) {
      const source = mode === 'release' ? booking.vehicle?.currentOdometerKm : booking.releaseOdometerKm;
      setValue(typeof source === 'number' ? String(source) : '');
    } else {
      setValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, active, mode]);

  const referenceValue: number | null =
    booking && typeof (mode === 'release' ? booking.vehicle?.currentOdometerKm : booking.releaseOdometerKm) === 'number'
      ? (mode === 'release' ? booking.vehicle.currentOdometerKm : booking.releaseOdometerKm)
      : null;

  const validate = (): OdometerValidation => {
    if (!value) return { ok: false, reason: 'empty' };
    const entered = Number(value);
    if (isNaN(entered) || entered < 0) return { ok: false, reason: 'invalid' };
    const belowReference = referenceValue !== null && entered < referenceValue;
    return { ok: true, belowReference, referenceValue };
  };

  return { value, setValue, validate };
}
