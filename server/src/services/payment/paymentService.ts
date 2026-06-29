import type { PaymentProductType, SubscriptionPlan } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { activatePlan, getActiveSubscription, getPlanConfig, isPaidPlan, PLAN_CATALOG } from '../subscriptionService.js';
import { getQbankModule, isPurchasableModule } from '../../data/qbankCatalog.js';
import { grantModuleAccess, userHasModuleAccess } from '../qbankService.js';
import {
  createPaymobCheckout,
  isPaymobConfigured,
  isPaymobSuccess,
  verifyPaymobTransactionHmac,
} from './paymobProvider.js';

export type PaymentProviderName = 'none' | 'mock' | 'paymob';

const PAID_PLAN_IDS = ['PACKAGE_50', 'PACKAGE_150', 'PACKAGE_300'] as const;
export type CheckoutPlanId = (typeof PAID_PLAN_IDS)[number];

export function getPaymentProvider(): PaymentProviderName {
  const requested = (process.env.PAYMENT_PROVIDER || 'paymob').toLowerCase();
  if (requested === 'none') return 'none';
  if (requested === 'mock') return 'mock';
  if (requested === 'paymob') {
    if (isPaymobConfigured()) return 'paymob';
    // Until Paymob keys are configured, allow instant plan activation.
    return process.env.PAYMENT_MOCK_FALLBACK === 'false' ? 'none' : 'mock';
  }
  return 'none';
}

export function isPaymentEnabled(): boolean {
  return getPaymentProvider() !== 'none';
}

export function isPaymentConfigured(): boolean {
  const provider = getPaymentProvider();
  if (provider === 'mock') return true;
  if (provider === 'paymob') return isPaymobConfigured();
  return false;
}

export function getPaymentPublicConfig() {
  const provider = getPaymentProvider();
  return {
    enabled: provider !== 'none',
    provider,
    configured: isPaymentConfigured(),
  };
}

function clientBaseUrl(): string {
  const url = process.env.CLIENT_URL || 'http://localhost:5173';
  return url.replace(/\/$/, '');
}

function serverBaseUrl(): string {
  if (process.env.PAYMENT_CALLBACK_BASE_URL) {
    return process.env.PAYMENT_CALLBACK_BASE_URL.replace(/\/$/, '');
  }
  const port = process.env.PORT || '5000';
  return `http://localhost:${port}`;
}

export function isCheckoutPlanId(planId: string): planId is CheckoutPlanId {
  return PAID_PLAN_IDS.includes(planId as CheckoutPlanId);
}

export async function createCheckout(userId: string, planId: CheckoutPlanId) {
  const config = getPlanConfig(planId as SubscriptionPlan);
  if (!config.priceEgp) throw new Error('INVALID_PLAN');

  const active = await getActiveSubscription(userId);
  if (active && isPaidPlan(active.plan)) {
    throw new Error('ALREADY_SUBSCRIBED');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  const merchantOrderId = `SZ-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const provider = getPaymentProvider();

  const order = await prisma.paymentOrder.create({
    data: {
      userId,
      productType: 'SUBSCRIPTION_PLAN',
      plan: planId,
      amountEgp: config.priceEgp,
      provider,
      merchantOrderId,
    },
  });

  if (provider === 'mock') {
    await finalizePaidOrder(order.id, 'mock-instant');
    return {
      orderId: order.id,
      merchantOrderId: order.merchantOrderId,
      provider: 'mock',
      status: 'PAID',
    };
  }

  if (provider === 'paymob') {
    if (!isPaymobConfigured()) {
      throw new Error('PAYMOB_NOT_CONFIGURED');
    }

    const paymob = await createPaymobCheckout({
      amountEgp: config.priceEgp,
      merchantOrderId: order.merchantOrderId,
      billing: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    });

    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { providerOrderId: paymob.providerOrderId },
    });

    return {
      orderId: order.id,
      merchantOrderId: order.merchantOrderId,
      provider: 'paymob',
      iframeUrl: paymob.checkoutUrl,
    };
  }

  throw new Error('PAYMENT_NOT_CONFIGURED');
}

export async function createModuleCheckout(userId: string, termId: string, moduleId: string) {
  if (!isPurchasableModule(termId, moduleId)) {
    throw new Error('INVALID_MODULE');
  }

  const mod = getQbankModule(termId, moduleId);
  if (!mod) throw new Error('INVALID_MODULE');

  const alreadyOwned = await userHasModuleAccess(userId, termId, moduleId);
  if (alreadyOwned) throw new Error('ALREADY_OWNED');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  const merchantOrderId = `SZ-QB-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const provider = getPaymentProvider();

  const order = await prisma.paymentOrder.create({
    data: {
      userId,
      productType: 'QBANK_MODULE',
      qbankTermId: termId,
      qbankModuleId: moduleId,
      amountEgp: mod.priceEgp,
      provider,
      merchantOrderId,
    },
  });

  if (provider === 'mock') {
    await finalizePaidOrder(order.id, 'mock-instant');
    return {
      orderId: order.id,
      merchantOrderId: order.merchantOrderId,
      provider: 'mock',
      status: 'PAID',
      termId,
      moduleId,
    };
  }

  if (provider === 'paymob') {
    if (!isPaymobConfigured()) {
      throw new Error('PAYMOB_NOT_CONFIGURED');
    }

    const paymob = await createPaymobCheckout({
      amountEgp: mod.priceEgp,
      merchantOrderId: order.merchantOrderId,
      billing: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    });

    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { providerOrderId: paymob.providerOrderId },
    });

    return {
      orderId: order.id,
      merchantOrderId: order.merchantOrderId,
      provider: 'paymob',
      iframeUrl: paymob.checkoutUrl,
      termId,
      moduleId,
    };
  }

  throw new Error('PAYMENT_NOT_CONFIGURED');
}

export async function completeMockCheckout(merchantOrderId: string, userId: string) {
  if (getPaymentProvider() !== 'mock') throw new Error('MOCK_NOT_ENABLED');
  const order = await prisma.paymentOrder.findUnique({ where: { merchantOrderId } });
  if (!order || order.userId !== userId) throw new Error('ORDER_NOT_FOUND');
  return finalizePaidOrder(order.id, 'mock-transaction');
}

export async function getOrderForUser(merchantOrderId: string, userId: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { merchantOrderId } });
  if (!order || order.userId !== userId) return null;

  const productType = order.productType as PaymentProductType;

  if (productType === 'QBANK_MODULE' && order.qbankTermId && order.qbankModuleId) {
    const mod = getQbankModule(order.qbankTermId, order.qbankModuleId);
    const labelEn = mod ? `QBank · ${mod.nameEn} (${order.qbankTermId})` : 'QBank Module';
    const labelAr = mod ? `بنك الأسئلة · ${mod.nameAr} (${order.qbankTermId})` : 'موديول بنك الأسئلة';
    return {
      merchantOrderId: order.merchantOrderId,
      status: order.status,
      productType,
      qbankTermId: order.qbankTermId,
      qbankModuleId: order.qbankModuleId,
      amountEgp: order.amountEgp,
      paidAt: order.paidAt,
      provider: order.provider,
      planLabelEn: labelEn,
      planLabelAr: labelAr,
    };
  }

  const planConfig = order.plan ? PLAN_CATALOG[order.plan as keyof typeof PLAN_CATALOG] : undefined;
  return {
    merchantOrderId: order.merchantOrderId,
    status: order.status,
    productType: productType || 'SUBSCRIPTION_PLAN',
    plan: order.plan,
    amountEgp: order.amountEgp,
    paidAt: order.paidAt,
    provider: order.provider,
    planLabelEn: planConfig?.labelEn,
    planLabelAr: planConfig?.labelAr,
  };
}

async function fulfillPaidOrder(order: {
  id: string;
  userId: string;
  productType: string;
  plan: string | null;
  qbankTermId: string | null;
  qbankModuleId: string | null;
}) {
  if (order.productType === 'QBANK_MODULE') {
    if (order.qbankTermId && order.qbankModuleId) {
      await grantModuleAccess(order.userId, order.qbankTermId, order.qbankModuleId);
    }
    return;
  }

  if (!order.plan) return;

  const active = await getActiveSubscription(order.userId);
  if (active && isPaidPlan(active.plan)) return;

  await activatePlan(order.userId, order.plan as import('@prisma/client').SubscriptionPlan);
}

async function finalizePaidOrder(orderId: string, transactionId?: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('ORDER_NOT_FOUND');

  if (order.status === 'PAID') {
    await fulfillPaidOrder(order);
    return order;
  }

  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: {
      status: 'PAID',
      transactionId: transactionId || order.transactionId,
      paidAt: new Date(),
      failureReason: null,
    },
  });

  await fulfillPaidOrder(order);

  return prisma.paymentOrder.findUnique({ where: { id: order.id } });
}

async function finalizeFailedOrder(orderId: string, reason: string) {
  return prisma.paymentOrder.update({
    where: { id: orderId },
    data: { status: 'FAILED', failureReason: reason },
  });
}

export async function handlePaymobWebhook(body: {
  type?: string;
  obj?: Record<string, unknown>;
  hmac?: string;
}) {
  if (body.type !== 'TRANSACTION' || !body.obj) return { ok: false as const };

  const transaction = body.obj as Parameters<typeof verifyPaymobTransactionHmac>[0];
  const hmac = body.hmac || '';
  if (!verifyPaymobTransactionHmac(transaction, hmac)) {
    return { ok: false as const, reason: 'INVALID_HMAC' as const };
  }

  const merchantOrderId = String(
    (transaction as { order?: { merchant_order_id?: string } }).order?.merchant_order_id ||
      (transaction as { merchant_order_id?: string }).merchant_order_id ||
      '',
  );

  let order = merchantOrderId
    ? await prisma.paymentOrder.findUnique({ where: { merchantOrderId } })
    : null;

  if (!order && transaction.order?.id) {
    order = await prisma.paymentOrder.findFirst({
      where: { providerOrderId: String(transaction.order.id) },
    });
  }

  if (!order) return { ok: false as const, reason: 'ORDER_NOT_FOUND' as const };

  if (isPaymobSuccess(transaction.success)) {
    await finalizePaidOrder(order.id, String(transaction.id ?? ''));
    return { ok: true as const, status: 'PAID' as const };
  }

  await finalizeFailedOrder(order.id, 'Payment declined');
  return { ok: true as const, status: 'FAILED' as const };
}

export async function handlePaymobReturn(query: Record<string, string | undefined>) {
  const merchantOrderId = query.merchant_order_id || '';
  const success = isPaymobSuccess(query.success);
  const transactionId = query.id || query.transaction_id;

  const order = await prisma.paymentOrder.findUnique({ where: { merchantOrderId } });
  if (!order) {
    return { redirect: `${clientBaseUrl()}/student/payment/failed?reason=order_not_found` };
  }

  if (success && order.status !== 'PAID') {
    await finalizePaidOrder(order.id, transactionId);
  } else if (!success && order.status === 'PENDING') {
    await finalizeFailedOrder(order.id, 'Payment cancelled or declined');
  }

  const target = success ? 'success' : 'failed';
  return {
    redirect: `${clientBaseUrl()}/student/payment/${target}?order=${encodeURIComponent(merchantOrderId)}`,
  };
}

export function getPaymobReturnUrl(): string {
  return `${serverBaseUrl()}/api/payments/return/paymob`;
}
