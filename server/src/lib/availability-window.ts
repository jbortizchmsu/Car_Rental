// GET /vehicles/available accepts either a bare "YYYY-MM-DD" date (what the web
// VehiclesPage's <input type="date"> sends) or a full datetime (what the booking flows send).
// A bare date used to go straight into `new Date(...)`, which parses it as UTC midnight —
// 8:00 AM in Philippine time — so the overlap check ran against 8 AM on the pickup day and
// 8 AM on the return day instead of anything resembling the real handover window.
//
// Bare dates are now interpreted as a concrete Philippine-time handover slot. 9:00 AM pickup /
// 5:00 PM return deliberately matches the default the booking modal prefills when a customer
// arrives from the vehicle list, so "shown as available" means exactly "the prefilled slot is
// bookable". The +08:00 offset is explicit rather than relying on process.env.TZ (forced to
// Asia/Manila in index.ts) so this stays correct even if that setting is ever removed.
// Full datetimes are passed through untouched, so callers that already send a time
// (e.g. the mobile booking screen) behave exactly as before.
const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const AVAILABILITY_PICKUP_TIME = '09:00:00';
export const AVAILABILITY_RETURN_TIME = '17:00:00';

export function parseAvailabilityBound(value: string, defaultTime: string): Date {
  return BARE_DATE.test(value) ? new Date(`${value}T${defaultTime}+08:00`) : new Date(value);
}
