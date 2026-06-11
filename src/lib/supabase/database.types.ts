export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_subscriptions: {
        Row: {
          active: boolean
          amount_max: number | null
          amount_min: number | null
          cooldown_minutes: number
          created_at: string
          direction: string
          id: string
          last_notified_at: string | null
          rate_better_than: number | null
          user_id: string
        }
        Insert: {
          active?: boolean
          amount_max?: number | null
          amount_min?: number | null
          cooldown_minutes?: number
          created_at?: string
          direction: string
          id?: string
          last_notified_at?: string | null
          rate_better_than?: number | null
          user_id: string
        }
        Update: {
          active?: boolean
          amount_max?: number | null
          amount_min?: number | null
          cooldown_minutes?: number
          created_at?: string
          direction?: string
          id?: string
          last_notified_at?: string | null
          rate_better_than?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          delivered: boolean
          expires_at: string
          id: string
          phone: string
          telegram_user_id: number | null
          used: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          delivered?: boolean
          expires_at?: string
          id?: string
          phone: string
          telegram_user_id?: number | null
          used?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          delivered?: boolean
          expires_at?: string
          id?: string
          phone?: string
          telegram_user_id?: number | null
          used?: boolean
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          flagged: boolean
          flagged_reason: string | null
          id: string
          read_at: string | null
          sender_id: string
          transaction_id: string
        }
        Insert: {
          body: string
          created_at?: string
          flagged?: boolean
          flagged_reason?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
          transaction_id: string
        }
        Update: {
          body?: string
          created_at?: string
          flagged?: boolean
          flagged_reason?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          amount: number
          amount_currency: string
          boosted_until: string | null
          created_at: string
          direction: string
          expires_at: string
          id: string
          min_match_amount: number | null
          note: string | null
          rate: number | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          amount_currency: string
          boosted_until?: string | null
          created_at?: string
          direction: string
          expires_at?: string
          id?: string
          min_match_amount?: number | null
          note?: string | null
          rate?: number | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          amount_currency?: string
          boosted_until?: string | null
          created_at?: string
          direction?: string
          expires_at?: string
          id?: string
          min_match_amount?: number | null
          note?: string | null
          rate?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          alert_id: string | null
          channel: string
          created_at: string
          error_detail: string | null
          external_id: string | null
          id: string
          listing_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          alert_id?: string | null
          channel: string
          created_at?: string
          error_detail?: string | null
          external_id?: string | null
          id?: string
          listing_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          alert_id?: string | null
          channel?: string
          created_at?: string
          error_detail?: string | null
          external_id?: string | null
          id?: string
          listing_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alert_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_number: string
          bank_code: string | null
          bank_name: string
          created_at: string
          currency: string
          id: string
          is_default: boolean
          recipient_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          bank_code?: string | null
          bank_name: string
          created_at?: string
          currency: string
          id?: string
          is_default?: boolean
          recipient_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          bank_code?: string | null
          bank_name?: string
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          recipient_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_active_at: string
          phone: string | null
          phone_masked: string | null
          rating_avg: number | null
          rating_count: number
          verification_tier: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          last_active_at?: string
          phone?: string | null
          phone_masked?: string | null
          rating_avg?: number | null
          rating_count?: number
          verification_tier?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_active_at?: string
          phone?: string | null
          phone_masked?: string | null
          rating_avg?: number | null
          rating_count?: number
          verification_tier?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          ratee_id: string
          rater_id: string
          stars: number
          tags: string[]
          transaction_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id: string
          rater_id: string
          stars: number
          tags?: string[]
          transaction_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          stars?: number
          tags?: string[]
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount_claimed: number | null
          created_at: string
          currency: string
          id: string
          ocr_confidence: number | null
          ocr_data: Json | null
          ocr_status: string | null
          side: string
          storage_path: string
          transaction_id: string
          uploader_id: string
          verified: boolean
        }
        Insert: {
          amount_claimed?: number | null
          created_at?: string
          currency: string
          id?: string
          ocr_confidence?: number | null
          ocr_data?: Json | null
          ocr_status?: string | null
          side: string
          storage_path: string
          transaction_id: string
          uploader_id: string
          verified?: boolean
        }
        Update: {
          amount_claimed?: number | null
          created_at?: string
          currency?: string
          id?: string
          ocr_confidence?: number | null
          ocr_data?: Json | null
          ocr_status?: string | null
          side?: string
          storage_path?: string
          transaction_id?: string
          uploader_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          detail: Json | null
          event_type: string
          id: string
          ip: string | null
          phone: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event_type: string
          id?: string
          ip?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event_type?: string
          id?: string
          ip?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_links: {
        Row: {
          linked_at: string
          phone: string
          telegram_user_id: number
          telegram_username: string | null
        }
        Insert: {
          linked_at?: string
          phone: string
          telegram_user_id: number
          telegram_username?: string | null
        }
        Update: {
          linked_at?: string
          phone?: string
          telegram_user_id?: number
          telegram_username?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          amount_currency: string
          completed_at: string | null
          counterparty_confirmed_at: string | null
          counterparty_id: string
          counterparty_paid_at: string | null
          created_at: string
          direction: string
          dispute_description: string | null
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          initiator_confirmed_at: string | null
          initiator_id: string
          initiator_paid_at: string | null
          listing_id: string
          rate: number | null
          rate_locked_at: string
          status: string
        }
        Insert: {
          amount: number
          amount_currency: string
          completed_at?: string | null
          counterparty_confirmed_at?: string | null
          counterparty_id: string
          counterparty_paid_at?: string | null
          created_at?: string
          direction: string
          dispute_description?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          id?: string
          initiator_confirmed_at?: string | null
          initiator_id: string
          initiator_paid_at?: string | null
          listing_id: string
          rate?: number | null
          rate_locked_at?: string
          status?: string
        }
        Update: {
          amount?: number
          amount_currency?: string
          completed_at?: string | null
          counterparty_confirmed_at?: string | null
          counterparty_id?: string
          counterparty_paid_at?: string | null
          created_at?: string
          direction?: string
          dispute_description?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          id?: string
          initiator_confirmed_at?: string | null
          initiator_id?: string
          initiator_paid_at?: string | null
          listing_id?: string
          rate?: number | null
          rate_locked_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_disputed_by_fkey"
            columns: ["disputed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_transaction: {
        Args: { p_action: string; p_transaction_id: string }
        Returns: {
          amount: number
          amount_currency: string
          completed_at: string | null
          counterparty_confirmed_at: string | null
          counterparty_id: string
          counterparty_paid_at: string | null
          created_at: string
          direction: string
          dispute_description: string | null
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          initiator_confirmed_at: string | null
          initiator_id: string
          initiator_paid_at: string | null
          listing_id: string
          rate: number | null
          rate_locked_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cleanup_expired_auth_codes: { Args: never; Returns: undefined }
      create_transaction: {
        Args: { p_listing_id: string; p_rate?: number }
        Returns: {
          amount: number
          amount_currency: string
          completed_at: string | null
          counterparty_confirmed_at: string | null
          counterparty_id: string
          counterparty_paid_at: string | null
          created_at: string
          direction: string
          dispute_description: string | null
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          initiator_confirmed_at: string | null
          initiator_id: string
          initiator_paid_at: string | null
          listing_id: string
          rate: number | null
          rate_locked_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_alert_matches: {
        Args: { p_listing_id: string }
        Returns: {
          alert_id: string
          message_text: string
          telegram_user_id: number
          user_id: string
        }[]
      }
      find_transaction_event_notifications: {
        Args: { p_event_type: string; p_transaction_id: string }
        Returns: {
          message_text: string
          telegram_user_id: number
          user_id: string
        }[]
      }
      get_counterparty_payment_method: {
        Args: { p_transaction_id: string }
        Returns: {
          account_number: string
          bank_name: string
          currency: string
          recipient_name: string
        }[]
      }
      kz_iban_valid: { Args: { p_iban: string }; Returns: boolean }
      luhn_valid: { Args: { p_digits: string }; Returns: boolean }
      mark_messages_read: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      open_dispute: {
        Args: {
          p_description: string
          p_reason: string
          p_transaction_id: string
        }
        Returns: {
          amount: number
          amount_currency: string
          completed_at: string | null
          counterparty_confirmed_at: string | null
          counterparty_id: string
          counterparty_paid_at: string | null
          created_at: string
          direction: string
          dispute_description: string | null
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          initiator_confirmed_at: string | null
          initiator_id: string
          initiator_paid_at: string | null
          listing_id: string
          rate: number | null
          rate_locked_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_chat_message: {
        Args: { p_body: string; p_transaction_id: string }
        Returns: {
          body: string
          created_at: string
          flagged: boolean
          flagged_reason: string | null
          id: string
          read_at: string | null
          sender_id: string
          transaction_id: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_profile_identity: {
        Args: { p_avatar_path: string; p_display_name: string }
        Returns: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_active_at: string
          phone: string | null
          phone_masked: string | null
          rating_avg: number | null
          rating_count: number
          verification_tier: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_payment_method: {
        Args: {
          p_account_number: string
          p_bank_code: string
          p_bank_name: string
          p_currency: string
          p_recipient_name: string
        }
        Returns: {
          account_number: string
          bank_code: string | null
          bank_name: string
          created_at: string
          currency: string
          id: string
          is_default: boolean
          recipient_name: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_methods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
