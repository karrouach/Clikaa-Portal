// ─────────────────────────────────────────────────────────────────────────────
// Clikaa Portal — Supabase Database Types
// Hand-authored to match 001_initial_schema.sql.
// Structured to match the GenericSchema/GenericTable contract of
// @supabase/supabase-js v2.44+ (requires Views + Relationships fields).
// Regenerate with `supabase gen types typescript` once the Supabase CLI is set up.
// ─────────────────────────────────────────────────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface LineItem {
  description: string
  qty: number
  rate: number
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          role: 'admin' | 'client' | 'designer'
          title: string | null
          monthly_retainer?: number | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          avatar_url?: string | null
          role?: 'admin' | 'client' | 'designer'
          title?: string | null
          monthly_retainer?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          role?: 'admin' | 'client' | 'designer'
          title?: string | null
          monthly_retainer?: number | null
          created_at?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          logo_url: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          logo_url?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          logo_url?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'admin' | 'client' | 'designer'
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: 'admin' | 'client' | 'designer'
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'admin' | 'client' | 'designer'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workspace_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          id: string
          workspace_id: string
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'review' | 'done' | 'pending'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          position: number
          assignee_id: string | null
          created_by: string
          start_date: string | null
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'review' | 'done' | 'pending'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          position?: number
          assignee_id?: string | null
          created_by: string
          start_date?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'review' | 'done' | 'pending'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          position?: number
          assignee_id?: string | null
          created_by?: string
          start_date?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_assignee_id_fkey'
            columns: ['assignee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      comments: {
        Row: {
          id: string
          task_id: string
          author_id: string
          body: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          author_id: string
          body: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          author_id?: string
          body?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comments_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      attachments: {
        Row: {
          id: string
          task_id: string
          file_name: string
          storage_path: string
          file_size: number
          file_type: string
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          file_name: string
          storage_path: string
          file_size?: number
          file_type?: string
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          file_name?: string
          storage_path?: string
          file_size?: number
          file_type?: string
          uploaded_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'attachments_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attachments_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          message: string
          link: string | null
          read_status: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          link?: string | null
          read_status?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message?: string
          link?: string | null
          read_status?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      workspace_assets: {
        Row: {
          id: string
          workspace_id: string
          file_name: string
          storage_path: string
          file_size: number
          file_type: string
          category: 'logos' | 'guidelines' | 'source_files' | 'other'
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          file_name: string
          storage_path: string
          file_size?: number
          file_type?: string
          category?: 'logos' | 'guidelines' | 'source_files' | 'other'
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          file_name?: string
          storage_path?: string
          file_size?: number
          file_type?: string
          category?: 'logos' | 'guidelines' | 'source_files' | 'other'
          uploaded_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_assets_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workspace_assets_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      contract_templates: {
        Row: {
          id: string
          template_name: string
          body_text: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_name: string
          body_text?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          template_name?: string
          body_text?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          id: string
          workspace_id: string | null
          template_id: string | null
          title: string
          body_text: string
          status: 'draft' | 'pending_signature' | 'signed'
          client_signature_name: string | null
          signed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          template_id?: string | null
          title: string
          body_text?: string
          status?: 'draft' | 'pending_signature' | 'signed'
          client_signature_name?: string | null
          signed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          template_id?: string | null
          title?: string
          body_text?: string
          status?: 'draft' | 'pending_signature' | 'signed'
          client_signature_name?: string | null
          signed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contracts_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contracts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      conversations: {
        Row: {
          id: string
          workspace_id: string | null
          client_id: string
          subject: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          client_id: string
          subject?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          client_id?: string
          subject?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversations_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          body: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          body: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          body?: string
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          workspace_id: string | null
          invoice_number: string
          status: 'draft' | 'pending' | 'paid' | 'overdue' | 'failed' | 'cancelled'
          client_name: string | null
          issue_date: string | null
          due_date: string | null
          line_items: LineItem[]
          notes: string | null
          tax_pct: number
          subtotal: number
          total: number
          sent_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          invoice_number: string
          status?: 'draft' | 'pending' | 'paid' | 'overdue' | 'failed' | 'cancelled'
          client_name?: string | null
          issue_date?: string | null
          due_date?: string | null
          line_items?: LineItem[]
          notes?: string | null
          tax_pct?: number
          subtotal?: number
          total?: number
          sent_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          invoice_number?: string
          status?: 'draft' | 'pending' | 'paid' | 'overdue' | 'failed' | 'cancelled'
          client_name?: string | null
          issue_date?: string | null
          due_date?: string | null
          line_items?: LineItem[]
          notes?: string | null
          tax_pct?: number
          subtotal?: number
          total?: number
          sent_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      designer_invoices: {
        Row: {
          id: string
          designer_id: string
          invoice_number: string
          amount: number
          status: 'pending' | 'paid'
          period_start: string
          period_end: string
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          designer_id: string
          invoice_number: string
          amount: number
          status?: 'pending' | 'paid'
          period_start: string
          period_end: string
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          designer_id?: string
          invoice_number?: string
          amount?: number
          status?: 'pending' | 'paid'
          period_start?: string
          period_end?: string
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'designer_invoices_designer_id_fkey'
            columns: ['designer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    // Required by @supabase/supabase-js v2.44+ GenericSchema contract.
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_workspace_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      get_task_workspace_id: {
        Args: { p_task_id: string }
        Returns: string
      }
    }
  }
}

// ─── Convenience row types ────────────────────────────────────────────────────
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type WorkspaceAsset = Database['public']['Tables']['workspace_assets']['Row']
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type Attachment = Database['public']['Tables']['attachments']['Row']

// ─── Domain union types ───────────────────────────────────────────────────────
export type ContractTemplate = Database['public']['Tables']['contract_templates']['Row']
export type Contract = Database['public']['Tables']['contracts']['Row']
export type ContractStatus = Contract['status']

export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type DesignerInvoice = Database['public']['Tables']['designer_invoices']['Row']

export type TaskStatus = Task['status']
export type TaskPriority = Task['priority']
export type UserRole = 'admin' | 'client' | 'designer'

// ─── Extended/joined types used in the UI ────────────────────────────────────
export type WorkspaceWithRole = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  role: 'admin' | 'client'
}

export type TaskWithRelations = Task & {
  assignee: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
  created_by_profile: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
  comments: Comment[]
  attachments: Attachment[]
}

// Comment row joined with the author's profile fields.
// Matches the Supabase `.select('*, profiles (full_name, avatar_url, email)')` shape.
export type CommentWithAuthor = Comment & {
  profiles: {
    full_name: string
    avatar_url: string | null
    email: string
  } | null
}

// Attachment row joined with the uploader's profile fields.
// Matches `.select('*, profiles (full_name, email)')`.
export type AttachmentWithUploader = Attachment & {
  profiles: {
    full_name: string
    email: string
  } | null
}
