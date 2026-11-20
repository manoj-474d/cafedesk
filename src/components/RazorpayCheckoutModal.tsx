import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { useAuth, type AuthResponsePayload } from '../context/AuthContext';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (res: unknown) => void) => void;
    };
  }
}

type PayMethod = 'upi' | 'card' | 'netbanking';

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function RazorpayCheckoutModal() {
  const {
    authenticated,
    user,
    plans,
    checkoutPlan,
    closeCheckout,
    applyAuthPayload,
    razorpayEnabled,
  } = useAuth();

  const [method, setMethod] = useState<PayMethod>('upi');
  const [upiId, setUpiId] = useState('explorer@okaxis');
  const [cardLast4, setCardLast4] = useState('4242');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{
    receipt_number: string;
    amount_inr: number;
    plan_id: string;
    method: string;
    provider_payment_id: string;
  } | null>(null);

  useEffect(() => {
    setError('');
    setReceipt(null);
    setProcessing(false);
  }, [checkoutPlan]);

  if (!checkoutPlan) return null;

  const targetPlan = plans.find((p) => p.id === checkoutPlan);
  const days = targetPlan?.interval_days ?? (checkoutPlan === 'premium' ? 365 : 30);
  const isAnnual = checkoutPlan === 'premium' || days >= 300;
  const planName =
    targetPlan?.name || (isAnnual ? 'Cafe Desk Plus (Annual)' : 'Cafe Desk Plus (Monthly)');
  const amountInr = targetPlan?.price_inr ?? (isAnnual ? 499 : 79);
  const intervalLabel = days >= 300 ? 'yr' : days === 30 ? 'mo' : `${days}d`;
  const durationLabel = isAnnual
    ? `${days}-day Bengaluru access`
    : `${days}-day Bengaluru access · Cancel anytime`;

  const handlePayNow = async (simulateFailure = false) => {
    setProcessing(true);
    setError('');

    try {
      const orderRes = await fetch('/api/billing/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId: checkoutPlan, method }),
      });
      const orderData = (await orderRes.json()) as {
        error?: string;
        mode?: 'razorpay' | 'test';
        keyId?: string;
        orderId?: string;
        paymentId?: number;
        amountInr?: number;
        amountPaise?: number;
        currency?: string;
        testToken?: string;
      };

      if (!orderRes.ok || !orderData.orderId || !orderData.paymentId) {
        setError(orderData.error || 'Unable to start payment checkout.');
        setProcessing(false);
        return;
      }

      if (simulateFailure) {
        await fetch('/api/billing/checkout/fail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            paymentId: orderData.paymentId,
            reason: `Simulated ${method.toUpperCase()} payment decline`,
          }),
        });
        setError(
          `Payment was declined by bank (${method.toUpperCase()}). No amount was charged and your subscription remains unchanged.`
        );
        setProcessing(false);
        return;
      }

      if (orderData.mode === 'razorpay' && orderData.keyId) {
        const loaded = await loadRazorpayScript();
        if (!loaded || !window.Razorpay) {
          setError('Could not load Razorpay Checkout. Please check your connection.');
          setProcessing(false);
          return;
        }

        const rzp = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.amountPaise,
          currency: orderData.currency || 'INR',
          name: 'Cafe Desk',
          description: `${planName} Subscription`,
          order_id: orderData.orderId,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
          },
          theme: { color: '#b45309' },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            const verRes = await fetch('/api/billing/checkout/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: orderData.paymentId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                method,
              }),
            });
            const verData = (await verRes.json()) as AuthResponsePayload & {
              error?: string;
              payment?: {
                receipt_number: string;
                amount_inr: number;
                plan_id: string;
                method: string;
                provider_payment_id: string;
              };
            };
            if (!verRes.ok) {
              setError(verData.error || 'Payment verification failed.');
              setProcessing(false);
              return;
            }
            applyAuthPayload(verData);
            if (verData.payment) setReceipt(verData.payment);
            setProcessing(false);
          },
          modal: {
            ondismiss: async () => {
              await fetch('/api/billing/checkout/fail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  paymentId: orderData.paymentId,
                  reason: 'Checkout closed before completing payment',
                }),
              });
              setProcessing(false);
            },
          },
        });
        rzp.open();
        return;
      }

      // Server-signed Razorpay-compatible test verification flow
      const verifyRes = await fetch('/api/billing/checkout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: orderData.orderId,
          paymentId: orderData.paymentId,
          testToken: orderData.testToken,
          method,
        }),
      });
      const verifyData = (await verifyRes.json()) as AuthResponsePayload & {
        error?: string;
        payment?: {
          receipt_number: string;
          amount_inr: number;
          plan_id: string;
          method: string;
          provider_payment_id: string;
        };
      };

      if (!verifyRes.ok) {
        setError(verifyData.error || 'Payment verification failed.');
        setProcessing(false);
        return;
      }

      applyAuthPayload(verifyData);
      if (verifyData.payment) setReceipt(verifyData.payment);
      setProcessing(false);
    } catch {
      setError('Network error while connecting to payment service.');
      setProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      className="fixed inset-0 z-50 bg-[#1c1613]/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={closeCheckout}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#faf7f2] border border-[#e6ddd0] shadow-2xl overflow-hidden text-[#1c1613]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 bg-[#1c1613] text-[#faf7f2] flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#f59e0b]">
              Razorpay Subscription Checkout
            </p>
            <h2 id="checkout-modal-title" className="font-serif-display text-2xl font-bold text-white">
              {receipt ? 'Payment Confirmed' : `${planName} · ₹${amountInr}/${intervalLabel}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCheckout}
            aria-label="Close checkout"
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!authenticated ? (
            <div className="space-y-4 text-center py-4">
              <p className="text-sm text-[#5c4e45]">
                Create a free Cafe Desk account or sign in first so your subscription and payment
                receipt are saved to your profile.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  to={`/login?mode=signup&upgrade=${checkoutPlan}`}
                  onClick={closeCheckout}
                  className="px-5 py-2.5 rounded-lg bg-[#b45309] text-white text-sm font-semibold"
                >
                  Create Account &amp; Continue
                </Link>
                <Link
                  to={`/login?mode=login&upgrade=${checkoutPlan}`}
                  onClick={closeCheckout}
                  className="px-5 py-2.5 rounded-lg bg-white border border-[#d6cbba] text-[#1c1613] text-sm font-semibold"
                >
                  Sign In
                </Link>
              </div>
            </div>
          ) : receipt ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#1b4d3e] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#1b4d3e]">
                    {planName} is now active!
                  </p>
                  <p className="text-xs text-[#1c1613]">
                    All plan features have been unlocked across your Cafe Desk account.
                  </p>
                </div>
              </div>

              <dl className="p-4 rounded-xl bg-white border border-[#e6ddd0] space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-[#5c4e45]">Receipt No.</dt>
                  <dd className="font-mono-data font-bold">{receipt.receipt_number}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#5c4e45]">Amount Paid</dt>
                  <dd className="font-mono-data font-bold">₹{receipt.amount_inr}.00 INR</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#5c4e45]">Payment Method</dt>
                  <dd className="uppercase font-semibold">{receipt.method}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#5c4e45]">Transaction ID</dt>
                  <dd className="font-mono-data">{receipt.provider_payment_id}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/account"
                  onClick={closeCheckout}
                  className="flex-1 min-h-[42px] px-4 py-2 rounded-lg bg-[#1c1613] text-white text-sm font-semibold inline-flex items-center justify-center"
                >
                  Open My Account
                </Link>
                <button
                  type="button"
                  onClick={closeCheckout}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-white border border-[#d6cbba] text-sm font-semibold"
                >
                  Continue Exploring
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-xl bg-white border border-[#e6ddd0] flex items-center justify-between text-sm">
                <div>
                  <p className="font-bold text-[#1c1613]">{planName}</p>
                  <p className="text-xs text-[#5c4e45]">{durationLabel}</p>
                </div>
                <p className="font-mono-data text-xl font-bold text-[#b45309]">₹{amountInr}</p>
              </div>

              {/* Payment Method Tabs */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#5c4e45]">Select Payment Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'upi' as PayMethod, label: 'UPI / QR', icon: Smartphone },
                    { id: 'card' as PayMethod, label: 'Card', icon: CreditCard },
                    { id: 'netbanking' as PayMethod, label: 'NetBanking', icon: Building },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const active = method === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setMethod(opt.id)}
                        className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${
                          active
                            ? 'bg-[#1c1613] text-white border-[#1c1613]'
                            : 'bg-white text-[#1c1613] border-[#e6ddd0] hover:border-[#b45309]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {!razorpayEnabled && (
                <div className="p-3.5 rounded-xl bg-white border border-[#e6ddd0] space-y-3 text-xs">
                  {method === 'upi' && (
                    <div>
                      <label htmlFor="pay-upi" className="block font-semibold text-[#5c4e45] mb-1">
                        UPI ID (GPay, PhonePe, Paytm, BHIM)
                      </label>
                      <input
                        id="pay-upi"
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] font-mono-data text-xs"
                      />
                    </div>
                  )}
                  {method === 'card' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="col-span-2">
                        <label htmlFor="pay-card" className="block font-semibold text-[#5c4e45] mb-1">
                          Credit / Debit Card (Last 4 digits)
                        </label>
                        <input
                          id="pay-card"
                          type="text"
                          value={`•••• •••• •••• ${cardLast4}`}
                          onChange={(e) => setCardLast4(e.target.value.slice(-4) || '4242')}
                          className="w-full h-10 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] font-mono-data text-xs"
                        />
                      </div>
                    </div>
                  )}
                  {method === 'netbanking' && (
                    <div>
                      <label htmlFor="pay-bank" className="block font-semibold text-[#5c4e45] mb-1">
                        Select Indian Bank
                      </label>
                      <select
                        id="pay-bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-xs font-medium"
                      >
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="ICICI Bank">ICICI Bank</option>
                        <option value="State Bank of India">State Bank of India (SBI)</option>
                        <option value="Axis Bank">Axis Bank</option>
                        <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                      </select>
                    </div>
                  )}
                  <p className="text-[11px] text-[#5c4e45]">
                    Sandbox Test Checkout active — payments are cryptographically verified on server before activating your tier.
                  </p>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#991b1b] flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handlePayNow(false)}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying payment...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Pay ₹{amountInr} Securely ({method.toUpperCase()})</span>
                    </>
                  )}
                </button>

                {!razorpayEnabled && (
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => handlePayNow(true)}
                    className="w-full py-2 text-[11px] font-semibold text-[#5c4e45] hover:text-[#991b1b] underline underline-offset-4"
                  >
                    Test declined payment handling
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
