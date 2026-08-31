import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

/** RevenueCat entitlement identifier — must match the dashboard. */
export const PREMIUM_ENTITLEMENT = 'premium';

export const PLAN_KEYS = {
  monthly: 'monthly',
  yearly: 'yearly',
};

function publicIosKey() {
  return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || '';
}

function publicAndroidKey() {
  return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || '';
}

/** True when the SDK has a platform API key in env (ready to configure). */
export function isPurchasesConfigured() {
  if (Platform.OS === 'ios') return !!publicIosKey();
  if (Platform.OS === 'android') return !!publicAndroidKey();
  return false;
}

let configuredForUser = null;

export async function initPurchases(appUserId) {
  if (!isPurchasesConfigured()) return false;

  const apiKey = Platform.OS === 'ios' ? publicIosKey() : publicAndroidKey();
  if (!apiKey) return false;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  if (configuredForUser === appUserId) return true;

  Purchases.configure({ apiKey, appUserID: appUserId ? String(appUserId) : undefined });
  configuredForUser = appUserId ?? '__anonymous__';
  return true;
}

export async function logOutPurchases() {
  if (!isPurchasesConfigured()) return;
  try {
    await Purchases.logOut();
  } catch {
    // ignore — user may never have been identified
  }
  configuredForUser = null;
}

/** @returns {{ monthly: import('react-native-purchases').PurchasesPackage|null, yearly: import('react-native-purchases').PurchasesPackage|null, offeringId: string|null }} */
export async function fetchPremiumPackages() {
  if (!isPurchasesConfigured()) {
    return { monthly: null, yearly: null, offeringId: null };
  }

  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) {
    return { monthly: null, yearly: null, offeringId: null };
  }

  const packages = current.availablePackages ?? [];
  const monthly = packages.find((p) => p.packageType === 'MONTHLY') || packages.find((p) => /month/i.test(p.identifier)) || null;
  const yearly = packages.find((p) => p.packageType === 'ANNUAL') || packages.find((p) => /year|annual/i.test(p.identifier)) || null;

  return { monthly, yearly, offeringId: current.identifier };
}

export function formatPackagePrice(pkg) {
  if (!pkg?.product?.priceString) return null;
  return pkg.product.priceString;
}

export function formatPackagePerMonth(pkg, isYearly) {
  if (!isYearly || !pkg?.product?.price) return null;
  const perMonth = pkg.product.price / 12;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: pkg.product.currencyCode || 'USD',
      maximumFractionDigits: 2,
    }).format(perMonth);
  } catch {
    return `$${perMonth.toFixed(2)}`;
  }
}

export async function purchasePremiumPackage(pkg) {
  if (!pkg) throw new Error('No subscription plan is available right now.');
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]?.isActive === true;
}

export async function restorePremiumPurchases() {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]?.isActive === true;
}

export async function hasPremiumEntitlement() {
  if (!isPurchasesConfigured()) return false;
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]?.isActive === true;
}
