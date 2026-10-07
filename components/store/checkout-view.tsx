"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, MapPin, Pencil, Tag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressForm } from "@/components/store/address-form";
import { useOptionalCart } from "@/components/store/cart-provider";
import { CheckoutSteps } from "@/components/store/checkout-steps";
import { OrderSummary } from "@/components/store/order-summary";
import { Turnstile, type TurnstileHandle } from "@/components/store/turnstile";
import { getCheckoutQuote, placeOrder, verifyPayment } from "@/app/(store)/checkout/actions";
import type { SavedAddress } from "@/lib/account/queries";
import type { CartSnapshot } from "@/lib/cart/types";
import type { IndianState } from "@/lib/catalog/queries";
import type { QuoteSummary } from "@/lib/checkout/quote";
import { formatInr } from "@/lib/format";
import { lineTotalPaise } from "@/lib/pricing";
import { STORE_NAME } from "@/lib/site";
import type { AddressOutput } from "@/lib/validators/auth";
import { contactSchema, type ContactInput } from "@/lib/validators/checkout";

// Razorpay Checkout (loaded from Razorpay's script, no npm dependency on the client).
type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: "payment.failed", cb: () => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

type Contact = { email: string; phone: string };
type PlacedOrder = { orderId: string; orderNumber: string; totalPaise: number; key: string };

type Props = {
  cart: CartSnapshot;
  states: IndianState[];
  savedAddresses: SavedAddress[];
  defaultContact: { email: string; phone: string };
  defaultName: string;
};

export function CheckoutView({ cart, states, savedAddresses, defaultContact, defaultName }: Props) {
  const router = useRouter();
  const cartState = useOptionalCart();
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<Contact | null>(null);
  const [address, setAddress] = useState<AddressOutput | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | undefined>();
  const [couponError, setCouponError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteSummary | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  // Any change to what is being bought starts a new order; the old one expires on its own.
  const orderKey = JSON.stringify([contact, address, couponCode]);

  function refreshQuote(nextCoupon: string | undefined) {
    if (!address || !contact) return;
    startQuote(async () => {
      const result = await getCheckoutQuote({
        stateCode: address.stateCode,
        couponCode: nextCoupon,
        email: contact.email,
        phone: contact.phone,
      });
      if (!result.ok) {
        setQuote(null);
        setQuoteError(result.error);
        return;
      }
      setQuoteError(null);
      setQuote(result.quote);
      setCouponCode(result.quote.couponCode ?? undefined);
      setCouponError(result.couponError ?? null);
      if (nextCoupon && result.quote.couponCode) toast.success(`Coupon ${result.quote.couponCode} applied`);
    });
  }

  useEffect(() => {
    if (step === 2) refreshQuote(couponCode);
    // Re-quote when entering review or when the address changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, address?.stateCode]);

  async function startPayment(order: PlacedOrder) {
    const res = await fetch("/api/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.orderId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      keyId?: string;
      razorpayOrderId?: string;
      amountPaise?: number;
    };
    if (!res.ok || !data.razorpayOrderId) {
      if (data.code === "not_payable") setPlaced(null);
      throw new Error(data.error ?? "Couldn't start the payment. Please try again.");
    }
    if (!window.Razorpay) throw new Error("The payment window didn't load. Please check your connection.");

    const rzp = new window.Razorpay({
      key: data.keyId,
      order_id: data.razorpayOrderId,
      amount: data.amountPaise,
      currency: "INR",
      name: STORE_NAME,
      description: `Order ${order.orderNumber}`,
      prefill: { email: contact?.email, contact: contact?.phone, name: address?.name },
      // Shorter than the 30-minute stock reservation (AGENTS.md §5.4).
      timeout: 900,
      retry: { enabled: true },
      handler: async (response: RazorpaySuccess) => {
        await verifyPayment({
          orderId: order.orderId,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        }).catch(() => null);
        // The webhook confirms the order; the order page shows "confirming payment" meanwhile.
        router.push(`/orders/${order.orderId}?paid=1`);
      },
      modal: {
        ondismiss: () => {
          setPaying(false);
          setPayError("Payment was not completed. You can try again.");
        },
      },
    });
    rzp.on("payment.failed", () => setPayError("The payment failed. You can try again or use another method."));
    rzp.open();
  }

  async function pay() {
    setPayError(null);
    setPaying(true);
    try {
      let order = placed && placed.key === orderKey ? placed : null;
      if (!order) {
        if (!token) {
          setPayError("Please wait for the security check to finish, then try again.");
          setPaying(false);
          return;
        }
        const result = await placeOrder({
          contact,
          address,
          couponCode,
          turnstileToken: token,
        });
        turnstile.current?.reset();
        if (!result.ok) {
          setPaying(false);
          if (result.field === "coupon") {
            setCouponError(result.error);
            setCouponCode(undefined);
            refreshQuote(undefined);
          } else if (result.field === "cart") {
            toast.error(result.error);
            await cartState?.reload();
            router.push("/cart");
          } else {
            setPayError(result.error);
          }
          return;
        }
        order = { ...result, key: orderKey };
        setPlaced(order);
      }
      await startPayment(order);
    } catch (e) {
      setPaying(false);
      setPayError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-6">
        <CheckoutSteps current={step} />

        <StepSection
          index={0}
          step={step}
          title="Contact"
          summary={contact ? `${contact.email} · ${contact.phone}` : null}
          onEdit={() => setStep(0)}
        >
          <ContactForm
            defaultValues={contact ?? defaultContact}
            onSubmit={(values) => {
              setContact(values);
              setStep(1);
            }}
          />
        </StepSection>

        <StepSection
          index={1}
          step={step}
          title="Delivery address"
          summary={
            address
              ? `${address.name}, ${address.line1}, ${address.city}, ${
                  states.find((s) => s.code === address.stateCode)?.name ?? address.stateCode
                } ${address.pincode}`
              : null
          }
          onEdit={() => setStep(1)}
        >
          <AddressStep
            states={states}
            saved={savedAddresses}
            defaults={{ name: defaultName, phone: contact?.phone ?? defaultContact.phone }}
            current={address}
            onChoose={(a) => {
              setAddress(a);
              setStep(2);
            }}
          />
        </StepSection>

        <StepSection index={2} step={step} title="Review & pay" summary={null} onEdit={() => setStep(2)}>
          <div className="flex flex-col gap-5">
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const code = couponInput.trim().toUpperCase();
                if (code) refreshQuote(code);
              }}
            >
              <Label htmlFor="coupon">Coupon code</Label>
              <div className="flex gap-2">
                <Input
                  id="coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={30}
                  aria-invalid={couponError ? true : undefined}
                  aria-describedby={couponError ? "coupon-error" : undefined}
                  className="uppercase"
                />
                <Button type="submit" variant="outline" disabled={quoting || !couponInput.trim()}>
                  Apply
                </Button>
              </div>
              {couponCode && (
                <p className="flex items-center gap-2 text-sm text-sale">
                  <Tag aria-hidden className="size-4" />
                  {couponCode} applied
                  <button
                    type="button"
                    className="min-h-touch px-2 text-xs text-muted-foreground underline underline-offset-4"
                    onClick={() => {
                      setCouponCode(undefined);
                      setCouponInput("");
                      refreshQuote(undefined);
                    }}
                  >
                    Remove
                  </button>
                </p>
              )}
              {couponError && (
                <p id="coupon-error" className="text-sm text-destructive">
                  {couponError}
                </p>
              )}
            </form>

            {quoteError && <p className="text-sm text-destructive">{quoteError}</p>}

            <Turnstile ref={turnstile} action="checkout" onToken={setToken} />

            <Button size="lg" className="w-full" disabled={!quote || quoting || paying} onClick={pay}>
              <Lock aria-hidden />
              {paying ? "Opening payment…" : quote ? `Pay ${formatInr(quote.totalPaise)}` : "Pay"}
            </Button>
            {payError && (
              <p role="alert" className="text-sm text-destructive">
                {payError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Secure payment by Razorpay: UPI, cards, netbanking and wallets. Prepaid orders only.
            </p>
            {step === 2 && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />}
          </div>
        </StepSection>
      </div>

      <aside className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-soft lg:sticky lg:top-24">
        <h2 className="text-2xl font-semibold">Your order</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {cart.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span className="min-w-0">
                {line.title}
                <span className="block text-xs text-muted-foreground">
                  {line.colour} · {line.size} · Qty {line.qty}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{formatInr(lineTotalPaise(line))}</span>
            </li>
          ))}
        </ul>
        <div aria-live="polite" aria-busy={quoting}>
          {quote ? (
            <OrderSummary
              title="Price details"
              totals={{
                subtotalPaise: quote.subtotalPaise,
                discountPaise: quote.discountPaise,
                couponCode: quote.couponCode,
                shippingPaise: quote.shippingPaise,
                totalPaise: quote.totalPaise,
                cgstPaise: quote.cgstPaise,
                sgstPaise: quote.sgstPaise,
                igstPaise: quote.igstPaise,
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Subtotal {formatInr(cart.totals.subtotalPaise)}. Shipping and GST are shown once you add your address.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function StepSection({
  index,
  step,
  title,
  summary,
  onEdit,
  children,
}: {
  index: number;
  step: number;
  title: string;
  summary: string | null;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const active = step === index;
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-lg border border-border p-5", active ? "bg-card shadow-soft" : "bg-background")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className={cn("text-xl font-semibold", !active && step < index && "text-muted-foreground")}>
          {title}
        </h2>
        {!active && step > index && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil aria-hidden />
            Edit<span className="sr-only"> {title.toLowerCase()}</span>
          </Button>
        )}
      </div>
      {!active && step > index && summary && <p className="mt-1 text-sm text-muted-foreground">{summary}</p>}
      {active && <div className="mt-4">{children}</div>}
    </section>
  );
}

function ContactForm({ defaultValues, onSubmit }: { defaultValues: Contact; onSubmit: (c: Contact) => void }) {
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactInput, unknown, Contact>({ resolver: zodResolver(contactSchema), defaultValues });

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${id}-email-error` : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id={`${id}-email-error`} className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-phone`}>Mobile number</Label>
        <Input
          id={`${id}-phone`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? `${id}-phone-error` : undefined}
          {...register("phone")}
        />
        {errors.phone && (
          <p id={`${id}-phone-error`} className="text-xs text-destructive">
            {errors.phone.message}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        We&apos;ll send your order updates here. Your details are used only for this order.
      </p>
      <div className="sm:col-span-2">
        <Button type="submit">Continue</Button>
      </div>
    </form>
  );
}

function AddressStep({
  states,
  saved,
  defaults,
  current,
  onChoose,
}: {
  states: IndianState[];
  saved: SavedAddress[];
  defaults: { name: string; phone: string };
  current: AddressOutput | null;
  onChoose: (a: AddressOutput) => void;
}) {
  const [adding, setAdding] = useState(saved.length === 0);
  const [selected, setSelected] = useState<string | null>(saved.find((a) => a.isDefault)?.id ?? saved[0]?.id ?? null);

  if (adding) {
    return (
      <div className="flex flex-col gap-4">
        <AddressForm
          states={states}
          showDefaultToggle={false}
          submitLabel="Deliver here"
          defaultValues={
            current
              ? { ...current, line2: current.line2 ?? "" }
              : { name: defaults.name, phone: defaults.phone }
          }
          onSubmit={async (values) => {
            onChoose(values);
            return { ok: true };
          }}
          onCancel={saved.length > 0 ? () => setAdding(false) : undefined}
        />
      </div>
    );
  }

  const stateName = (code: string) => states.find((s) => s.code === code)?.name ?? code;
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Saved addresses</legend>
        {saved.map((a) => (
          <label
            key={a.id}
            className={cn(
              "flex cursor-pointer gap-3 rounded-md border p-4 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/60",
              selected === a.id ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <input
              type="radio"
              name="saved-address"
              value={a.id}
              checked={selected === a.id}
              onChange={() => setSelected(a.id)}
              className="mt-1 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{a.name}</span>
              <span className="text-foreground/80">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {stateName(a.stateCode)} {a.pincode}
              </span>
              <span className="text-muted-foreground">{a.phone}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!selected}
          onClick={() => {
            const a = saved.find((s) => s.id === selected);
            if (a) onChoose({ ...a, isDefault: false });
          }}
        >
          <MapPin aria-hidden />
          Deliver here
        </Button>
        <Button variant="outline" onClick={() => setAdding(true)}>
          Use a new address
        </Button>
      </div>
    </div>
  );
}
