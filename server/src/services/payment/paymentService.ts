import type { SubscriptionPlan } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { activatePlan, getActiveSubscription, getPlanConfig, isPaidPlan, PLAN_CATALOG } from '../subscriptionService.js';
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
  const provider = (process.env.PAYMENT_PROVIDER || 'paymob').toLowerCase();
  if (provider === 'none') return 'none';
  if (provider === 'mock' && process.env.NODE_ENV !== 'production') return 'mock';
  if (provider === 'paymob') return 'paymob';
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
      plan: planId,
      amountEgp: config.priceEgp,
      provider,
      merchantOrderId,
    },
  });

  if (provider === 'mock') {
    return { orderId: order.id, merchantOrderId: order.merchantOrderId, provider: 'mock' };
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

export async function completeMockCheckout(merchantOrderId: string, userId: string) {
  if (getPaymentProvider() !== 'mock') throw new Error('MOCK_NOT_ENABLED');
  const order = await prisma.paymentOrder.findUnique({ where: { merchantOrderId } });
  if (!order || order.userId !== userId) throw new Error('ORDER_NOT_FOUND');
  return finalizePaidOrder(order.id, 'mock-transaction');
}

export async function getOrderForUser(merchantOrderId: string, userId: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { merchantOrderId } });
  if (!order || order.userId !== userId) return null;
  const planConfig = PLAN_CATALOG[order.plan as keyof typeof PLAN_CATALOG];
  return {
    merchantOrderId: order.merchantOrderId,
    status: order.status,
    plan: order.plan,
    amountEgp: order.amountEgp,
    paidAt: order.paidAt,
    provider: order.provider,
    planLabelEn: planConfig?.labelEn,
    planLabelAr: planConfig?.labelAr,
  };
}

async function finalizePaidOrder(orderId: string, transactionId?: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('ORDER_NOT_FOUND');

  if (order.status === 'PAID') {
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

  await activatePlan(order.userId, order.plan);
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
