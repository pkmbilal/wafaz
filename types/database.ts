export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string;
          created_at: string;
          id: string;
          is_default: boolean;
          line1: string;
          line2: string | null;
          name: string;
          phone: string;
          pincode: string;
          state_code: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          city: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          line1: string;
          line2?: string | null;
          name: string;
          phone: string;
          pincode: string;
          state_code: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          city?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          line1?: string;
          line2?: string | null;
          name?: string;
          phone?: string;
          pincode?: string;
          state_code?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_state_code_fkey";
            columns: ["state_code"];
            isOneToOne: false;
            referencedRelation: "indian_states";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "addresses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_hook_events: {
        Row: {
          channel: string;
          created_at: string;
          error: string | null;
          id: string;
          provider_message_id: string | null;
          recipient_hash: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          provider_message_id?: string | null;
          recipient_hash: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          provider_message_id?: string | null;
          recipient_hash?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      banners: {
        Row: {
          created_at: string;
          ends_at: string | null;
          id: string;
          image_key: string;
          is_active: boolean;
          link: string | null;
          placement: string;
          sort_order: number;
          starts_at: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          image_key: string;
          is_active?: boolean;
          link?: string | null;
          placement?: string;
          sort_order?: number;
          starts_at?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          image_key?: string;
          is_active?: boolean;
          link?: string | null;
          placement?: string;
          sort_order?: number;
          starts_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          cart_id: string;
          created_at: string;
          id: string;
          qty: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          id?: string;
          qty: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          id?: string;
          qty?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      carts: {
        Row: {
          created_at: string;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          image_key: string | null;
          is_active: boolean;
          name: string;
          parent_id: string | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          image_key?: string | null;
          is_active?: boolean;
          name: string;
          parent_id?: string | null;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          image_key?: string | null;
          is_active?: boolean;
          name?: string;
          parent_id?: string | null;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_products: {
        Row: {
          collection_id: string;
          created_at: string;
          product_id: string;
          sort_order: number;
        };
        Insert: {
          collection_id: string;
          created_at?: string;
          product_id: string;
          sort_order?: number;
        };
        Update: {
          collection_id?: string;
          created_at?: string;
          product_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_products_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_key: string | null;
          is_active: boolean;
          kind: string;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_key?: string | null;
          is_active?: boolean;
          kind?: string;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_key?: string | null;
          is_active?: boolean;
          kind?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coupon_redemptions: {
        Row: {
          coupon_id: string;
          created_at: string;
          email_norm: string | null;
          id: string;
          order_id: string;
          phone_e164: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          coupon_id: string;
          created_at?: string;
          email_norm?: string | null;
          id?: string;
          order_id: string;
          phone_e164?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          coupon_id?: string;
          created_at?: string;
          email_norm?: string | null;
          id?: string;
          order_id?: string;
          phone_e164?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "coupons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      coupons: {
        Row: {
          code: string;
          created_at: string;
          ends_at: string | null;
          first_order_only: boolean;
          id: string;
          is_active: boolean;
          kind: string;
          max_discount_paise: number | null;
          max_uses: number | null;
          min_cart_paise: number;
          per_user_limit: number | null;
          starts_at: string | null;
          updated_at: string;
          used_count: number;
          value: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          ends_at?: string | null;
          first_order_only?: boolean;
          id?: string;
          is_active?: boolean;
          kind: string;
          max_discount_paise?: number | null;
          max_uses?: number | null;
          min_cart_paise?: number;
          per_user_limit?: number | null;
          starts_at?: string | null;
          updated_at?: string;
          used_count?: number;
          value: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          ends_at?: string | null;
          first_order_only?: boolean;
          id?: string;
          is_active?: boolean;
          kind?: string;
          max_discount_paise?: number | null;
          max_uses?: number | null;
          min_cart_paise?: number;
          per_user_limit?: number | null;
          starts_at?: string | null;
          updated_at?: string;
          used_count?: number;
          value?: number;
        };
        Relationships: [];
      };
      credit_notes: {
        Row: {
          created_at: string;
          fiscal_year: string;
          id: string;
          invoice_id: string;
          issued_at: string;
          lines: NonNullable<Json>;
          number: string;
          order_id: string;
          reason: string;
          refund_id: string;
          totals: NonNullable<Json>;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          fiscal_year: string;
          id?: string;
          invoice_id: string;
          issued_at?: string;
          lines: NonNullable<Json>;
          number: string;
          order_id: string;
          reason: string;
          refund_id: string;
          totals: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          fiscal_year?: string;
          id?: string;
          invoice_id?: string;
          issued_at?: string;
          lines?: NonNullable<Json>;
          number?: string;
          order_id?: string;
          reason?: string;
          refund_id?: string;
          totals?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_notes_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_refund_id_fkey";
            columns: ["refund_id"];
            isOneToOne: true;
            referencedRelation: "refunds";
            referencedColumns: ["id"];
          },
        ];
      };
      document_sequences: {
        Row: {
          created_at: string;
          doc_type: string;
          fiscal_year: string;
          last_value: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          doc_type: string;
          fiscal_year: string;
          last_value: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          doc_type?: string;
          fiscal_year?: string;
          last_value?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_events: {
        Row: {
          attempts: number;
          created_at: string;
          dedupe_key: string;
          error: string | null;
          id: string;
          kind: string;
          order_id: string | null;
          provider_message_id: string | null;
          recipient_hash: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          dedupe_key: string;
          error?: string | null;
          id?: string;
          kind: string;
          order_id?: string | null;
          provider_message_id?: string | null;
          recipient_hash: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string;
          error?: string | null;
          id?: string;
          kind?: string;
          order_id?: string | null;
          provider_message_id?: string | null;
          recipient_hash?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      indian_states: {
        Row: {
          code: string;
          created_at: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          buyer_snapshot: NonNullable<Json>;
          created_at: string;
          fiscal_year: string;
          id: string;
          issued_at: string;
          lines: NonNullable<Json>;
          number: string;
          order_id: string;
          place_of_supply_code: string;
          seller_snapshot: NonNullable<Json>;
          totals: NonNullable<Json>;
          updated_at: string;
        };
        Insert: {
          buyer_snapshot: NonNullable<Json>;
          created_at?: string;
          fiscal_year: string;
          id?: string;
          issued_at?: string;
          lines: NonNullable<Json>;
          number: string;
          order_id: string;
          place_of_supply_code: string;
          seller_snapshot: NonNullable<Json>;
          totals: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          buyer_snapshot?: NonNullable<Json>;
          created_at?: string;
          fiscal_year?: string;
          id?: string;
          issued_at?: string;
          lines?: NonNullable<Json>;
          number?: string;
          order_id?: string;
          place_of_supply_code?: string;
          seller_snapshot?: NonNullable<Json>;
          totals?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_place_of_supply_code_fkey";
            columns: ["place_of_supply_code"];
            isOneToOne: false;
            referencedRelation: "indian_states";
            referencedColumns: ["code"];
          },
        ];
      };
      order_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          field: string;
          from_value: string | null;
          id: string;
          note: string | null;
          order_id: string;
          to_value: string | null;
          updated_at: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          field: string;
          from_value?: string | null;
          id?: string;
          note?: string | null;
          order_id: string;
          to_value?: string | null;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          field?: string;
          from_value?: string | null;
          id?: string;
          note?: string | null;
          order_id?: string;
          to_value?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          cgst_paise: number;
          colour: string;
          created_at: string;
          gst_rate_bps: number;
          hsn_code: string;
          id: string;
          igst_paise: number;
          image_key: string | null;
          line_discount_paise: number;
          line_gross_paise: number;
          line_net_paise: number;
          mrp_paise: number;
          order_id: string;
          product_id: string;
          product_slug: string;
          product_title: string;
          qty: number;
          refunded_qty: number;
          sgst_paise: number;
          size: string;
          sku: string;
          taxable_paise: number;
          unit_price_paise: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          cgst_paise?: number;
          colour: string;
          created_at?: string;
          gst_rate_bps: number;
          hsn_code: string;
          id?: string;
          igst_paise?: number;
          image_key?: string | null;
          line_discount_paise?: number;
          line_gross_paise: number;
          line_net_paise: number;
          mrp_paise: number;
          order_id: string;
          product_id: string;
          product_slug: string;
          product_title: string;
          qty: number;
          refunded_qty?: number;
          sgst_paise?: number;
          size: string;
          sku: string;
          taxable_paise: number;
          unit_price_paise: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          cgst_paise?: number;
          colour?: string;
          created_at?: string;
          gst_rate_bps?: number;
          hsn_code?: string;
          id?: string;
          igst_paise?: number;
          image_key?: string | null;
          line_discount_paise?: number;
          line_gross_paise?: number;
          line_net_paise?: number;
          mrp_paise?: number;
          order_id?: string;
          product_id?: string;
          product_slug?: string;
          product_title?: string;
          qty?: number;
          refunded_qty?: number;
          sgst_paise?: number;
          size?: string;
          sku?: string;
          taxable_paise?: number;
          unit_price_paise?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          attention_reason: string | null;
          billing_address: NonNullable<Json>;
          cgst_paise: number;
          coupon_code: string | null;
          coupon_id: string | null;
          created_at: string;
          discount_paise: number;
          email: string;
          expires_at: string | null;
          fulfillment_status: string;
          id: string;
          igst_paise: number;
          needs_attention: boolean;
          number: string;
          order_status: string;
          payment_status: string;
          phone: string;
          place_of_supply_code: string;
          sgst_paise: number;
          shipping_address: NonNullable<Json>;
          shipping_gst_rate_bps: number;
          shipping_paise: number;
          shipping_taxable_paise: number;
          shipping_zone_id: string | null;
          subtotal_paise: number;
          taxable_total_paise: number;
          total_paise: number;
          total_weight_grams: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attention_reason?: string | null;
          billing_address: NonNullable<Json>;
          cgst_paise?: number;
          coupon_code?: string | null;
          coupon_id?: string | null;
          created_at?: string;
          discount_paise?: number;
          email: string;
          expires_at?: string | null;
          fulfillment_status?: string;
          id?: string;
          igst_paise?: number;
          needs_attention?: boolean;
          number?: string;
          order_status?: string;
          payment_status?: string;
          phone: string;
          place_of_supply_code: string;
          sgst_paise?: number;
          shipping_address: NonNullable<Json>;
          shipping_gst_rate_bps?: number;
          shipping_paise?: number;
          shipping_taxable_paise?: number;
          shipping_zone_id?: string | null;
          subtotal_paise: number;
          taxable_total_paise: number;
          total_paise: number;
          total_weight_grams: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attention_reason?: string | null;
          billing_address?: NonNullable<Json>;
          cgst_paise?: number;
          coupon_code?: string | null;
          coupon_id?: string | null;
          created_at?: string;
          discount_paise?: number;
          email?: string;
          expires_at?: string | null;
          fulfillment_status?: string;
          id?: string;
          igst_paise?: number;
          needs_attention?: boolean;
          number?: string;
          order_status?: string;
          payment_status?: string;
          phone?: string;
          place_of_supply_code?: string;
          sgst_paise?: number;
          shipping_address?: NonNullable<Json>;
          shipping_gst_rate_bps?: number;
          shipping_paise?: number;
          shipping_taxable_paise?: number;
          shipping_zone_id?: string | null;
          subtotal_paise?: number;
          taxable_total_paise?: number;
          total_paise?: number;
          total_weight_grams?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "coupons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_place_of_supply_code_fkey";
            columns: ["place_of_supply_code"];
            isOneToOne: false;
            referencedRelation: "indian_states";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "orders_shipping_zone_id_fkey";
            columns: ["shipping_zone_id"];
            isOneToOne: false;
            referencedRelation: "shipping_zones";
            referencedColumns: ["id"];
          },
        ];
      };
      pages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          is_published: boolean;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          id?: string;
          is_published?: boolean;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          is_published?: boolean;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_paise: number;
          created_at: string;
          id: string;
          method: string | null;
          order_id: string;
          raw: Json | null;
          razorpay_order_id: string;
          razorpay_payment_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_paise: number;
          created_at?: string;
          id?: string;
          method?: string | null;
          order_id: string;
          raw?: Json | null;
          razorpay_order_id: string;
          razorpay_payment_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_paise?: number;
          created_at?: string;
          id?: string;
          method?: string | null;
          order_id?: string;
          raw?: Json | null;
          razorpay_order_id?: string;
          razorpay_payment_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      product_media: {
        Row: {
          alt: string | null;
          colour: string | null;
          created_at: string;
          id: string;
          kind: string;
          product_id: string;
          r2_key: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          alt?: string | null;
          colour?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          product_id: string;
          r2_key: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          alt?: string | null;
          colour?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          product_id?: string;
          r2_key?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_tags: {
        Row: {
          created_at: string;
          product_id: string;
          tag_id: string;
        };
        Insert: {
          created_at?: string;
          product_id: string;
          tag_id: string;
        };
        Update: {
          created_at?: string;
          product_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          colour: string;
          colour_hex: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          mrp_paise: number;
          price_paise: number;
          product_id: string;
          reserved: number;
          size: string;
          sku: string;
          stock: number;
          updated_at: string;
          weight_grams: number;
        };
        Insert: {
          colour: string;
          colour_hex?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          mrp_paise: number;
          price_paise: number;
          product_id: string;
          reserved?: number;
          size: string;
          sku: string;
          stock?: number;
          updated_at?: string;
          weight_grams: number;
        };
        Update: {
          colour?: string;
          colour_hex?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          mrp_paise?: number;
          price_paise?: number;
          product_id?: string;
          reserved?: number;
          size?: string;
          sku?: string;
          stock?: number;
          updated_at?: string;
          weight_grams?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          care: string | null;
          category_id: string;
          country_of_origin: string;
          created_at: string;
          description: string | null;
          fabric: string | null;
          hsn_code: string;
          id: string;
          occasion: string | null;
          published_at: string | null;
          search: unknown;
          seo_description: string | null;
          seo_title: string | null;
          size_chart_id: string | null;
          slug: string;
          status: string;
          style: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          care?: string | null;
          category_id: string;
          country_of_origin?: string;
          created_at?: string;
          description?: string | null;
          fabric?: string | null;
          hsn_code: string;
          id?: string;
          occasion?: string | null;
          published_at?: string | null;
          search?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          size_chart_id?: string | null;
          slug: string;
          status?: string;
          style?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          care?: string | null;
          category_id?: string;
          country_of_origin?: string;
          created_at?: string;
          description?: string | null;
          fabric?: string | null;
          hsn_code?: string;
          id?: string;
          occasion?: string | null;
          published_at?: string | null;
          search?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          size_chart_id?: string | null;
          slug?: string;
          status?: string;
          style?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_size_chart_id_fkey";
            columns: ["size_chart_id"];
            isOneToOne: false;
            referencedRelation: "size_charts";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          deletion_requested_at: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          marketing_consent: boolean;
          marketing_consent_at: string | null;
          phone: string | null;
          role: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deletion_requested_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          marketing_consent?: boolean;
          marketing_consent_at?: string | null;
          phone?: string | null;
          role?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deletion_requested_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          marketing_consent?: boolean;
          marketing_consent_at?: string | null;
          phone?: string | null;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      refunds: {
        Row: {
          amount_paise: number;
          created_at: string;
          created_by: string | null;
          credit_lines: Json | null;
          credit_totals: Json | null;
          error: string | null;
          id: string;
          include_shipping: boolean;
          items: NonNullable<Json>;
          kind: string;
          order_id: string;
          payment_id: string;
          razorpay_refund_id: string | null;
          reason: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_paise: number;
          created_at?: string;
          created_by?: string | null;
          credit_lines?: Json | null;
          credit_totals?: Json | null;
          error?: string | null;
          id?: string;
          include_shipping?: boolean;
          items?: NonNullable<Json>;
          kind?: string;
          order_id: string;
          payment_id: string;
          razorpay_refund_id?: string | null;
          reason: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_paise?: number;
          created_at?: string;
          created_by?: string | null;
          credit_lines?: Json | null;
          credit_totals?: Json | null;
          error?: string | null;
          id?: string;
          include_shipping?: boolean;
          items?: NonNullable<Json>;
          kind?: string;
          order_id?: string;
          payment_id?: string;
          razorpay_refund_id?: string | null;
          reason?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      shipments: {
        Row: {
          courier: string;
          created_at: string;
          created_by: string | null;
          delivered_at: string | null;
          id: string;
          order_id: string;
          rto_at: string | null;
          rto_received_at: string | null;
          shipped_at: string;
          tracking_number: string;
          updated_at: string;
        };
        Insert: {
          courier: string;
          created_at?: string;
          created_by?: string | null;
          delivered_at?: string | null;
          id?: string;
          order_id: string;
          rto_at?: string | null;
          rto_received_at?: string | null;
          shipped_at?: string;
          tracking_number: string;
          updated_at?: string;
        };
        Update: {
          courier?: string;
          created_at?: string;
          created_by?: string | null;
          delivered_at?: string | null;
          id?: string;
          order_id?: string;
          rto_at?: string | null;
          rto_received_at?: string | null;
          shipped_at?: string;
          tracking_number?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      shipping_zones: {
        Row: {
          base_paise: number;
          base_weight_grams: number;
          created_at: string;
          free_above_paise: number | null;
          id: string;
          is_active: boolean;
          name: string;
          per_additional_500g_paise: number;
          state_codes: string[];
          updated_at: string;
        };
        Insert: {
          base_paise: number;
          base_weight_grams?: number;
          created_at?: string;
          free_above_paise?: number | null;
          id?: string;
          is_active?: boolean;
          name: string;
          per_additional_500g_paise?: number;
          state_codes: string[];
          updated_at?: string;
        };
        Update: {
          base_paise?: number;
          base_weight_grams?: number;
          created_at?: string;
          free_above_paise?: number | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          per_additional_500g_paise?: number;
          state_codes?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      size_charts: {
        Row: {
          created_at: string;
          data: NonNullable<Json>;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data: NonNullable<Json>;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_settings: {
        Row: {
          address_line1: string;
          address_line2: string | null;
          city: string;
          created_at: string;
          credit_note_prefix: string;
          einvoice_enabled: boolean;
          grievance_officer_email: string;
          grievance_officer_name: string;
          grievance_officer_phone: string;
          gstin: string | null;
          id: number;
          invoice_prefix: string;
          legal_name: string;
          low_stock_threshold: number;
          new_badge_days: number;
          pincode: string;
          shipping_tax_rate_bps: number | null;
          state: string;
          state_code: string;
          support_email: string;
          support_phone: string;
          tax_slab_basis: string;
          trade_name: string;
          updated_at: string;
        };
        Insert: {
          address_line1: string;
          address_line2?: string | null;
          city: string;
          created_at?: string;
          credit_note_prefix?: string;
          einvoice_enabled?: boolean;
          grievance_officer_email: string;
          grievance_officer_name: string;
          grievance_officer_phone: string;
          gstin?: string | null;
          id?: number;
          invoice_prefix?: string;
          legal_name: string;
          low_stock_threshold?: number;
          new_badge_days?: number;
          pincode: string;
          shipping_tax_rate_bps?: number | null;
          state: string;
          state_code?: string;
          support_email: string;
          support_phone: string;
          tax_slab_basis?: string;
          trade_name: string;
          updated_at?: string;
        };
        Update: {
          address_line1?: string;
          address_line2?: string | null;
          city?: string;
          created_at?: string;
          credit_note_prefix?: string;
          einvoice_enabled?: boolean;
          grievance_officer_email?: string;
          grievance_officer_name?: string;
          grievance_officer_phone?: string;
          gstin?: string | null;
          id?: number;
          invoice_prefix?: string;
          legal_name?: string;
          low_stock_threshold?: number;
          new_badge_days?: number;
          pincode?: string;
          shipping_tax_rate_bps?: number | null;
          state?: string;
          state_code?: string;
          support_email?: string;
          support_phone?: string;
          tax_slab_basis?: string;
          trade_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_settings_state_code_fkey";
            columns: ["state_code"];
            isOneToOne: false;
            referencedRelation: "indian_states";
            referencedColumns: ["code"];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tax_slabs: {
        Row: {
          created_at: string;
          effective_from: string;
          effective_to: string | null;
          hsn_code: string;
          id: string;
          max_unit_paise: number | null;
          min_unit_paise: number;
          rate_bps: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          effective_from: string;
          effective_to?: string | null;
          hsn_code: string;
          id?: string;
          max_unit_paise?: number | null;
          min_unit_paise?: number;
          rate_bps: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          effective_from?: string;
          effective_to?: string | null;
          hsn_code?: string;
          id?: string;
          max_unit_paise?: number | null;
          min_unit_paise?: number;
          rate_bps?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          attempts: number;
          created_at: string;
          error: string | null;
          event_id: string;
          event_type: string;
          id: string;
          payload: NonNullable<Json>;
          processed_at: string | null;
          provider: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          error?: string | null;
          event_id: string;
          event_type: string;
          id?: string;
          payload: NonNullable<Json>;
          processed_at?: string | null;
          provider?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          error?: string | null;
          event_id?: string;
          event_type?: string;
          id?: string;
          payload?: NonNullable<Json>;
          processed_at?: string | null;
          provider?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_store_settings: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          grievance_officer_email: string | null;
          grievance_officer_name: string | null;
          grievance_officer_phone: string | null;
          gstin: string | null;
          legal_name: string | null;
          new_badge_days: number | null;
          pincode: string | null;
          state: string | null;
          state_code: string | null;
          support_email: string | null;
          support_phone: string | null;
          trade_name: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_adjust_stock: {
        Args: { p_delta: number; p_variant_id: string };
        Returns: number;
      };
      admin_low_stock: {
        Args: Record<PropertyKey, never>;
        Returns: {
          available: number;
          colour: string;
          product_id: string;
          product_title: string;
          size: string;
          sku: string;
          variant_id: string;
        }[];
      };
      admin_reorder_media: {
        Args: { p_media_ids: string[]; p_product_id: string };
        Returns: undefined;
      };
      admin_save_variants: {
        Args: { p_product_id: string; p_variants: Json };
        Returns: undefined;
      };
      admin_set_collection_products: {
        Args: { p_collection_id: string; p_product_ids: string[] };
        Returns: undefined;
      };
      admin_set_product_collections: {
        Args: { p_collection_ids: string[]; p_product_id: string };
        Returns: undefined;
      };
      admin_set_product_tags: {
        Args: { p_product_id: string; p_tag_ids: string[] };
        Returns: undefined;
      };
      cart_add_item: {
        Args: { p_qty: number; p_variant_id: string };
        Returns: {
          available: number;
          qty: number;
          requested: number;
        }[];
      };
      cart_lines: {
        Args: Record<PropertyKey, never>;
        Returns: {
          available: number;
          colour: string;
          image_alt: string;
          image_key: string;
          item_id: string;
          mrp_paise: number;
          price_paise: number;
          product_slug: string;
          purchasable: boolean;
          qty: number;
          size: string;
          title: string;
          variant_id: string;
        }[];
      };
      cart_set_qty: {
        Args: { p_item_id: string; p_qty: number };
        Returns: number;
      };
      catalog_facets: {
        Args: {
          p_category_slug?: string;
          p_collection_slug?: string;
          p_query?: string;
        };
        Returns: Json;
      };
      catalog_products: {
        Args: {
          p_category_slug?: string;
          p_collection_slug?: string;
          p_colours?: string[];
          p_fabrics?: string[];
          p_limit?: number;
          p_max_paise?: number;
          p_min_paise?: number;
          p_offset?: number;
          p_query?: string;
          p_sizes?: string[];
          p_sort?: string;
        };
        Returns: {
          colours: Json;
          fabric: string;
          id: string;
          image_alt: string;
          image_key: string;
          in_stock: boolean;
          mrp_paise: number;
          price_paise: number;
          published_at: string;
          slug: string;
          title: string;
          total_count: number;
        }[];
      };
      check_my_rate_limit: {
        Args: { p_max: number; p_scope: string; p_window_seconds: number };
        Returns: boolean;
      };
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
      checkout_tax_settings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          shipping_tax_rate_bps: number;
          state_code: string;
          tax_slab_basis: string;
        }[];
      };
      commit_order_payment: {
        Args: {
          p_amount_paise: number;
          p_method?: string;
          p_order_id: string;
          p_raw?: Json;
          p_razorpay_order_id: string;
          p_razorpay_payment_id: string;
        };
        Returns: string;
      };
      complete_refund: {
        Args: {
          p_razorpay_refund_id: string;
          p_refund_id: string;
          p_status: string;
        };
        Returns: string;
      };
      coupon_for_checkout: {
        Args: { p_code: string; p_email: string; p_phone: string };
        Returns: {
          code: string;
          customer_uses: number;
          ends_at: string;
          exhausted: boolean;
          first_order_only: boolean;
          has_paid_order: boolean;
          id: string;
          is_active: boolean;
          kind: string;
          max_discount_paise: number;
          min_cart_paise: number;
          per_user_limit: number;
          starts_at: string;
          value: number;
        }[];
      };
      create_order_from_cart: {
        Args: {
          p_address: Json;
          p_coupon_code?: string;
          p_email: string;
          p_phone: string;
        };
        Returns: {
          order_id: string;
          order_number: string;
          total_paise: number;
        }[];
      };
      expire_pending_orders: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      fail_refund: {
        Args: { p_error: string; p_refund_id: string };
        Returns: undefined;
      };
      late_payment_commit: {
        Args: {
          p_amount_paise: number;
          p_method?: string;
          p_order_id: string;
          p_raw?: Json;
          p_razorpay_order_id: string;
          p_razorpay_payment_id: string;
        };
        Returns: boolean;
      };
      mark_order_delivered: {
        Args: { p_actor_id: string; p_order_id: string };
        Returns: undefined;
      };
      mark_order_rto: {
        Args: { p_actor_id: string; p_order_id: string };
        Returns: undefined;
      };
      mark_payment_failed: {
        Args: {
          p_order_id: string;
          p_raw?: Json;
          p_razorpay_order_id: string;
          p_razorpay_payment_id: string;
        };
        Returns: undefined;
      };
      merge_guest_into_user: {
        Args: { p_anon_uid: string; p_user_id: string };
        Returns: undefined;
      };
      next_document_number: {
        Args: { p_doc_type: string; p_issued_at: string };
        Returns: string;
      };
      order_payment_target: {
        Args: { p_order_id: string };
        Returns: {
          email: string;
          order_number: string;
          phone: string;
          razorpay_order_id: string;
          total_paise: number;
        }[];
      };
      prepare_refund: {
        Args: {
          p_actor_id: string;
          p_include_shipping: boolean;
          p_items: Json;
          p_kind: string;
          p_order_id: string;
          p_reason: string;
        };
        Returns: {
          amount_paise: number;
          order_number: string;
          razorpay_payment_id: string;
          refund_id: string;
        }[];
      };
      record_auto_refund: {
        Args: {
          p_amount_paise: number;
          p_order_id: string;
          p_razorpay_payment_id: string;
          p_razorpay_refund_id: string;
          p_status: string;
        };
        Returns: undefined;
      };
      record_razorpay_order: {
        Args: { p_order_id: string; p_razorpay_order_id: string };
        Returns: undefined;
      };
      record_refund_status: {
        Args: { p_razorpay_refund_id: string; p_status: string };
        Returns: string;
      };
      refund_preview: {
        Args: {
          p_include_shipping: boolean;
          p_items: Json;
          p_order_id: string;
        };
        Returns: Json;
      };
      reserve_stock: { Args: { p_order_id: string }; Returns: undefined };
      resolve_attention: {
        Args: { p_actor_id: string; p_note: string; p_order_id: string };
        Returns: undefined;
      };
      set_default_address: {
        Args: { p_address_id: string };
        Returns: undefined;
      };
      ship_order: {
        Args: {
          p_actor_id: string;
          p_courier: string;
          p_order_id: string;
          p_tracking_number: string;
        };
        Returns: undefined;
      };
      transition_order: {
        Args: {
          p_actor_id?: string;
          p_field: string;
          p_note?: string;
          p_order_id: string;
          p_to_value: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
