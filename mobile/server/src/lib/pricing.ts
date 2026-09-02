import { prisma } from './prisma';
import { Vehicle } from '@prisma/client';

export interface PricingBreakdown {
  baseDailyRate: number;
  rentalDays: number;
  subtotal: number;
  appliedRuleName: string | null;
  appliedRuleDescription: string | null;
  pricingRuleId: string | null;
  multiplier: number;
  totalPrice: number;
}

/**
 * Calculates the number of days for a rental.
 * Minimum is 1 day.
 */
export function calculateRentalDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Set to midnight to count days accurately
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(1, diffDays);
}

/**
 * Calculates the booking price based on vehicle and dates.
 * Uses the highest applicable multiplier strategy.
 */
export async function calculateBookingPrice(
  vehicleId: string, 
  startDate: Date, 
  endDate: Date
): Promise<PricingBreakdown> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId }
  });

  if (!vehicle) {
    throw new Error('Vehicle not found');
  }

  const baseRate = Number(vehicle.dailyRate);
  const days = calculateRentalDays(startDate, endDate);
  const subtotal = baseRate * days;

  // 1. Fetch all active rules
  const activeRules = await prisma.pricingRule.findMany({
    where: { isActive: true }
  });

  let bestMultiplier = 1.0;
  let bestRuleName: string | null = null;
  let bestRuleId: string | null = null;
  let bestRuleDescription: string | null = null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // 2. Evaluate rules
  for (const rule of activeRules) {
    let applies = false;

    if (rule.type === 'SEASONAL') {
      // Check if any part of the rental overlaps with the seasonal range
      if (rule.startDate && rule.endDate) {
        const ruleStart = new Date(rule.startDate);
        const ruleEnd = new Date(rule.endDate);
        ruleStart.setHours(0, 0, 0, 0);
        ruleEnd.setHours(23, 59, 59, 999);
        
        // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
        if (start <= ruleEnd && end >= ruleStart) {
          applies = true;
        }
      }
    } else if (rule.type === 'WEEKEND') {
      // Check if any day in the range is a weekend
      let tempDate = new Date(start);
      tempDate.setHours(0, 0, 0, 0);
      const tempEnd = new Date(end);
      tempEnd.setHours(23, 59, 59, 999);

      while (tempDate <= tempEnd) {
        const day = tempDate.getDay();
        if (day === 0 || day === 6) { // 0 = Sunday, 6 = Saturday
          applies = true;
          break;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
    } else if (rule.type === 'CATEGORY') {
      const cat = rule.vehicleCategory ? rule.vehicleCategory.trim().toLowerCase() : '';
      if (
        !cat || 
        cat === 'all' || 
        cat === 'any' || 
        (vehicle.category && cat === vehicle.category.trim().toLowerCase())
      ) {
        applies = true;
      }
    } else if (rule.type === 'DEMAND') {
      // Demand rule based on fleet utilization
      if (rule.utilizationThreshold) {
        const totalVehicles = await prisma.vehicle.count({
          where: { status: { not: 'RETIRED' } }
        });
        const occupiedVehicles = await prisma.vehicle.count({
          where: { status: { in: ['RENTED', 'RESERVED', 'ACTIVE', 'READY_FOR_PICKUP'] } }
        });
        
        const utilization = totalVehicles > 0 ? occupiedVehicles / totalVehicles : 0;
        if (utilization >= rule.utilizationThreshold) {
          applies = true;
        }
      }
    }

    if (applies) {
      // Strategy: Choose highest multiplier
      if (rule.multiplier > bestMultiplier) {
        bestMultiplier = rule.multiplier;
        bestRuleName = rule.name;
        bestRuleId = rule.id;
        bestRuleDescription = rule.description ?? null;
      }
    }
  }

  const totalPrice = subtotal * bestMultiplier;

  return {
    baseDailyRate: baseRate,
    rentalDays: days,
    subtotal: subtotal,
    appliedRuleName: bestRuleName,
    appliedRuleDescription: bestRuleDescription,
    pricingRuleId: bestRuleId,
    multiplier: bestMultiplier,
    totalPrice: Math.round(totalPrice * 100) / 100 // Round to 2 decimal places
  };
}
