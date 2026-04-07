import { createClient } from '@supabase/supabase-js';
import { supabaseClientKey, supabaseUrl } from './env';

export const supabase = createClient(supabaseUrl, supabaseClientKey);

// Database types matching our schema
export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          name: string;
          category: 'alimento' | 'bebida' | 'descartavel' | 'limpeza' | 'outro';
          is_perishable: boolean;
          measurement_unit: 'kg' | 'g' | 'l' | 'ml' | 'un' | 'cx' | 'pct' | 'porcao';
          min_stock: number;
          safety_stock: number;
          current_stock: number;
          average_cost: number;
          barcode: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact: string | null;
          email: string | null;
          phone: string | null;
          rating: number | null;
          reliability: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>;
      };
      stock_entries: {
        Row: {
          id: string;
          product_id: string;
          supplier_id: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          batch_number: string;
          expiration_date: string | null;
          invoice_number: string | null;
          notes: string | null;
          entry_date: string;
          user_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['stock_entries']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['stock_entries']['Insert']>;
      };
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          movement_type: 'entrada' | 'saida' | 'ajuste' | 'desperdicio';
          quantity: number;
          reason: string;
          waste_reason: 'vencimento' | 'quebra' | 'mau_uso' | 'outro' | null;
          cost: number | null;
          batch_number: string | null;
          recipe_id: string | null;
          sale_id: string | null;
          movement_date: string;
          user_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['stock_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['stock_movements']['Insert']>;
      };
      recipes: {
        Row: {
          id: string;
          name: string;
          category: string;
          description: string | null;
          yield: number;
          yield_unit: string;
          total_cost: number;
          selling_price: number;
          markup: number;
          profit_margin: number;
          preparation_time: number | null;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['recipes']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['recipes']['Insert']>;
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          product_id: string;
          quantity: number;
          unit: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['recipe_ingredients']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['recipe_ingredients']['Insert']>;
      };
      price_history: {
        Row: {
          id: string;
          product_id: string;
          supplier_id: string;
          price: number;
          quantity: number;
          invoice_number: string | null;
          date: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['price_history']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['price_history']['Insert']>;
      };
      alerts: {
        Row: {
          id: string;
          alert_type: 'expiration' | 'low_stock' | 'price_change' | 'waste';
          severity: 'low' | 'medium' | 'high';
          product_id: string | null;
          message: string;
          data: any | null;
          is_read: boolean;
          alert_date: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['alerts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['alerts']['Insert']>;
      };
    };
  };
}
