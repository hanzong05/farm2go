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
          // Verification fields
          verification_status: 'pending' | 'approved' | 'rejected' | 'not_submitted'
          id_document_url: string | null
          face_photo_url: string | null
          verification_submitted_at: string | null
          verification_approved_at: string | null
          verification_rejected_at: string | null
          verification_admin_notes: string | null
          id_document_type: string | null
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
          verification_status?: 'pending' | 'approved' | 'rejected' | 'not_submitted'
          id_document_url?: string | null
          face_photo_url?: string | null
          verification_submitted_at?: string | null
          verification_approved_at?: string | null
          verification_rejected_at?: string | null
          verification_admin_notes?: string | null
          id_document_type?: string | null
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
          verification_status?: 'pending' | 'approved' | 'rejected' | 'not_submitted'
          id_document_url?: string | null
          face_photo_url?: string | null
          verification_submitted_at?: string | null
          verification_approved_at?: string | null
          verification_rejected_at?: string | null
          verification_admin_notes?: string | null
          id_document_type?: string | null
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
          farmer_id: string
          product_id: string
          quantity: number
          total_price: number
          status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled'
          delivery_address: string
          notes: string | null
          purchase_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          farmer_id: string
          product_id: string
          quantity: number
          total_price: number
          status?: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled'
          delivery_address: string
          notes?: string | null
          purchase_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          farmer_id?: string
          product_id?: string
          quantity?: number
          total_price?: number
          status?: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled'
          delivery_address?: string
          notes?: string | null
          purchase_code?: string | null
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
      verification_submissions: {
        Row: {
          id: string
          user_id: string
          id_document_url: string
          face_photo_url: string
          id_document_type: string
          submission_notes: string | null
          status: 'pending' | 'approved' | 'rejected' | 'not_submitted'
          submitted_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          id_document_url: string
          face_photo_url: string
          id_document_type: string
          submission_notes?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'not_submitted'
          submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          id_document_url?: string
          face_photo_url?: string
          id_document_type?: string
          submission_notes?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'not_submitted'
          submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          admin_notes?: string | null
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
      verification_status: 'pending' | 'approved' | 'rejected' | 'not_submitted'
    }
  }
}