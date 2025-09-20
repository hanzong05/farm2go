export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string | null
          middle_name: string | null
          last_name: string | null
          phone: string | null
          barangay: string | null
          user_type: 'farmer' | 'buyer' | 'admin' | 'super-admin'
          created_at: string
          updated_at: string
          // Farmer specific fields
          farm_name: string | null
          farm_size: string | null
        }
        Insert: {
          id: string
          email: string
          first_name?: string | null
          middle_name?: string | null
          last_name?: string | null
          phone?: string | null
          barangay?: string | null
          user_type: 'farmer' | 'buyer' | 'admin' | 'super-admin'
          created_at?: string
          updated_at?: string
          farm_name?: string | null
          farm_size?: string | null
        }
        Update: {
          id?: string
          email?: string
          first_name?: string | null
          middle_name?: string | null
          last_name?: string | null
          phone?: string | null
          barangay?: string | null
          user_type?: 'farmer' | 'buyer' | 'admin' | 'super-admin'
          created_at?: string
          updated_at?: string
          farm_name?: string | null
          farm_size?: string | null
        }
      }
      products: {
        Row: {
          id: string
          farmer_id: string
          name: string
          description: string | null
          price: number
          unit: string
          quantity_available: number
          category: string
          image_url: string | null
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farmer_id: string
          name: string
          description?: string | null
          price: number
          unit: string
          quantity_available: number
          category: string
          image_url?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farmer_id?: string
          name?: string
          description?: string | null
          price?: number
          unit?: string
          quantity_available?: number
          category?: string
          image_url?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          buyer_id: string
          total_amount: number
          status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled' | 'completed'
          delivery_address: string
          delivery_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          total_amount: number
          status?: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled' | 'completed'
          delivery_address: string
          delivery_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          total_amount?: number
          status?: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled' | 'completed'
          delivery_address?: string
          delivery_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          order_id: string
          amount: number
          status: 'pending' | 'completed' | 'failed' | 'refunded'
          payment_method: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          amount: number
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          payment_method?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          amount?: number
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          payment_method?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_type: 'farmer' | 'buyer' | 'admin' | 'super-admin'
      product_status: 'pending' | 'approved' | 'rejected'
      order_status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled' | 'completed'
      transaction_status: 'pending' | 'completed' | 'failed' | 'refunded'
    }
  }
}