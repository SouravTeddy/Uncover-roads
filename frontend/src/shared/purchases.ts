import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

const RC_API_KEY_IOS = 'appl_OhaMzTztOPzXpYnkgDfJoHrkljw';

export async function initRevenueCat(userId?: string) {
  if (!Capacitor.isNativePlatform()) return;
  await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
  await Purchases.configure({ apiKey: RC_API_KEY_IOS });
  if (userId) {
    await Purchases.logIn({ appUserID: userId });
  }
}

export async function purchaseProMonthly(): Promise<'success' | 'cancelled' | 'error'> {
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      p => p.identifier === '$rc_monthly'
    );
    if (!pkg) return 'error';
    await Purchases.purchasePackage({ aPackage: pkg });
    return 'success';
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean };
    if (err?.userCancelled) return 'cancelled';
    return 'error';
  }
}

export async function purchaseTripPack(): Promise<'success' | 'cancelled' | 'error'> {
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      p => p.identifier === 'trip pack'
    );
    if (!pkg) return 'error';
    await Purchases.purchasePackage({ aPackage: pkg });
    return 'success';
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean };
    if (err?.userCancelled) return 'cancelled';
    return 'error';
  }
}

export async function checkProEntitlement(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.customerInfo.entitlements.active['pro'];
  } catch {
    return false;
  }
}
