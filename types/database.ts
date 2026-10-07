export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
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
      catalog_facets: {
        Args: { p_category_slug?: string; p_collection_slug?: string; p_query?: string };
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
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
      merge_guest_into_user: {
        Args: { p_anon_uid: string; p_user_id: string };
        Returns: undefined;
      };
      set_default_address: { Args: { p_address_id: string }; Returns: undefined };
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

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
