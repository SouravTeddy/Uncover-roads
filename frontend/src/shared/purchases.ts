import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

const RC_API_KEY_IOS = 'appl_OhaMzTztOPzXpYnkgDfJoHrkljw';

function isIOS() {
  return Capacitor.getPlatform() === 'ios';
}

export async function initRevenueCat() {
  if (!isIOS()) return;
  await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
  await Purchases.configure({ apiKey: RC_API_KEY_IOS });
}

export async function loginRevenueCat(userId: string) {
  if (!isIOS()) return;
  await Purchases.logIn({ appUserID: userId }).catch(console.warn);
}

export async function purchaseProMonthly(): Promise<'success' | 'cancelled' | 'error'> {
  if (!isIOS()) return 'error';
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
  if (!isIOS()) return 'error';
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
  if (!isIOS()) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.customerInfo.entitlements.active['pro'];
  } catch {
    return false;
  }
}
