"use client";

import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Turnstile } from "@/components/store/turnstile";
import { CartDrawer } from "@/components/store/cart-drawer";
import {
  addToCart,
  getCartSnapshot,
  removeCartItem,
  updateCartQty,
  type CartActionResult,
} from "@/app/(store)/cart/actions";
import { ensureGuestSession } from "@/lib/auth/guest";
import { EMPTY_CART, type CartSnapshot } from "@/lib/cart/types";
import { createClient } from "@/lib/supabase/browser";

// Client-side cart state for the storefront. Catalog pages stay cached: the cart is loaded from
// the browser only when a session already exists, and a guest session is created lazily on the
// first add to cart (AGENTS.md §5.3), after a Turnstile check.

type CartContextValue = {
  // null until the first load finishes.
  cart: CartSnapshot | null;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  add: (variantId: string, qty?: number) => Promise<boolean>;
  setQty: (itemId: string, qty: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  // After login/merge or sign-out, which happen outside this provider.
  reload: () => Promise<void>;
  clear: () => void;
  // Lets a server-rendered cart page seed the state before the browser load finishes.
  seed: (snapshot: CartSnapshot) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const CAPTCHA_TIMEOUT_MS = 30_000;

export function useCart(): CartContextValue {
  const value = use(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}

// For components that can also render outside the storefront (e.g. the login form).
export function useOptionalCart(): CartContextValue | null {
  return use(CartContext);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartSnapshot | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const tokenWaiter = useRef<((token: string | null) => void) | null>(null);

  const reload = useCallback(async () => {
    try {
      setCart(await getCartSnapshot());
    } catch {
      // Leave the last known cart; the next action refreshes it.
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Reads the session from cookies; never creates one.
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        if (data.session) void reload();
        else setCart((current) => current ?? EMPTY_CART);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  function announce(message: string) {
    // Re-set so screen readers repeat identical messages.
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(message));
  }

  function captchaToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => finish(null), CAPTCHA_TIMEOUT_MS);
      function finish(token: string | null) {
        clearTimeout(timer);
        tokenWaiter.current = null;
        setNeedsCaptcha(false);
        resolve(token);
      }
      tokenWaiter.current = finish;
      setNeedsCaptcha(true);
    });
  }

  async function ensureSession(): Promise<boolean> {
    const { data } = await createClient().auth.getSession();
    if (data.session) return true;
    const token = await captchaToken();
    if (!token) {
      toast.error("We couldn't verify your browser. Please try again.");
      return false;
    }
    const result = await ensureGuestSession(token);
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    return true;
  }

  function apply(result: CartActionResult) {
    if (result.cart) setCart(result.cart);
    if (!result.ok) {
      toast.error(result.error);
      announce(result.error);
    } else if (result.notice) {
      toast(result.notice);
      announce(result.notice);
    }
  }

  async function add(variantId: string, qty = 1): Promise<boolean> {
    try {
      if (!(await ensureSession())) return false;
      let result = await addToCart({ variantId, qty });
      if (!result.ok && result.code === "stale_session") {
        // Drop the dead session and start a fresh guest cart, once.
        await createClient().auth.signOut({ scope: "local" });
        if (!(await ensureSession())) return false;
        result = await addToCart({ variantId, qty });
      }
      apply(result);
      if (result.ok) {
        announce(`Added to cart. ${result.cart.totals.itemCount} items in your cart.`);
        setOpen(true);
      } else if (result.cart) {
        setOpen(true);
      }
      return result.ok;
    } catch {
      toast.error("Couldn't add to your cart. Please try again.");
      return false;
    }
  }

  async function setQty(itemId: string, qty: number) {
    try {
      const result = await updateCartQty({ itemId, qty });
      apply(result);
      if (result.ok && !result.notice) announce(`Cart updated. ${result.cart.totals.itemCount} items.`);
    } catch {
      toast.error("Couldn't update your cart. Please try again.");
    }
  }

  async function remove(itemId: string) {
    try {
      const result = await removeCartItem(itemId);
      apply(result);
      if (result.ok) announce(`Item removed. ${result.cart.totals.itemCount} items in your cart.`);
    } catch {
      toast.error("Couldn't remove the item. Please try again.");
    }
  }

  const value: CartContextValue = {
    cart,
    isOpen,
    setOpen,
    add,
    setQty,
    remove,
    reload,
    clear: () => setCart(EMPTY_CART),
    seed: (snapshot) => setCart((current) => current ?? snapshot),
  };

  return (
    <CartContext value={value}>
      {children}
      <CartDrawer />
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>
      {needsCaptcha && (
        // Invisible unless Cloudflare needs an interactive challenge.
        <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
          <Turnstile action="guest-signin" onToken={(token) => tokenWaiter.current?.(token)} />
        </div>
      )}
    </CartContext>
  );
}
