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
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      project_settings: {
        Row: {
          project_id: string
          categories: Json | null
          scopes: Json | null
          sidebar_items: Json | null
          disciplines: Json | null
          project_name: string | null
          location: string | null
          original_budget: number | null
          created_at: string
          updated_at: string
          enable_audit_logging: boolean | null
        }
        Insert: {
          project_id: string
          categories?: Json | null
          scopes?: Json | null
          sidebar_items?: Json | null
          disciplines?: Json | null
          project_name?: string | null
          location?: string | null
          original_budget?: number | null
          created_at?: string
          updated_at?: string
          enable_audit_logging?: boolean | null
        }
        Update: {
          project_id?: string
          categories?: Json | null
          scopes?: Json | null
          sidebar_items?: Json | null
          disciplines?: Json | null
          project_name?: string | null
          location?: string | null
          original_budget?: number | null
          created_at?: string
          updated_at?: string
          enable_audit_logging?: boolean | null
        }
      }
      project_sequences: {
        Row: {
          project_id: string
          current_value: number | null
        }
        Insert: {
          project_id: string
          current_value?: number | null
        }
        Update: {
          project_id?: string
          current_value?: number | null
        }
      }
      opportunities: {
        Row: {
          id: string
          project_id: string
          title: string
          location: string | null
          scope: string | null
          arch_plans_spec: string | null
          bok_standard: string | null
          existing_conditions: string | null
          mep_impact: string | null
          owner_goals: string | null
          backing_required: string | null
          coordination_required: string | null
          design_lock_phase: string | null
          final_direction: string | null
          assignee: string | null
          due_date: string | null
          status: string | null
          cost_impact: number | null
          days_impact: number | null
          design_markups: Json | null
          display_id: string | null
          priority: string | null
          created_at: string
          division: string | null
          record_type: string | null
          coordination_details: Json | null
        }
        Insert: {
          id?: string
          project_id: string
          title?: string
          location?: string | null
          scope?: string | null
          arch_plans_spec?: string | null
          bok_standard?: string | null
          existing_conditions?: string | null
          mep_impact?: string | null
          owner_goals?: string | null
          backing_required?: string | null
          coordination_required?: string | null
          design_lock_phase?: string | null
          final_direction?: string | null
          assignee?: string | null
          due_date?: string | null
          status?: string | null
          cost_impact?: number | null
          days_impact?: number | null
          design_markups?: Json | null
          display_id?: string | null
          priority?: string | null
          created_at?: string
          division?: string | null
          record_type?: string | null
          coordination_details?: Json | null
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          location?: string | null
          scope?: string | null
          arch_plans_spec?: string | null
          bok_standard?: string | null
          existing_conditions?: string | null
          mep_impact?: string | null
          owner_goals?: string | null
          backing_required?: string | null
          coordination_required?: string | null
          design_lock_phase?: string | null
          final_direction?: string | null
          assignee?: string | null
          due_date?: string | null
          status?: string | null
          cost_impact?: number | null
          days_impact?: number | null
          design_markups?: Json | null
          display_id?: string | null
          priority?: string | null
          created_at?: string
          division?: string | null
          record_type?: string | null
          coordination_details?: Json | null
        }
      }
      cost_codes: {
        Row: {
          code: string
          description: string
          is_division: boolean | null
          parent_division: string | null
          category_l: boolean | null
          category_m: boolean | null
          category_s: boolean | null
          category_o: boolean | null
        }
        Insert: {
          code: string
          description: string
          is_division?: boolean | null
          parent_division?: string | null
          category_l?: boolean | null
          category_m?: boolean | null
          category_s?: boolean | null
          category_o?: boolean | null
        }
        Update: {
          code?: string
          description?: string
          is_division?: boolean | null
          parent_division?: string | null
          category_l?: boolean | null
          category_m?: boolean | null
          category_s?: boolean | null
          category_o?: boolean | null
        }
      }
      opportunity_options: {
        Row: {
          id: string
          opportunity_id: string
          title: string
          cost_impact: number | null
          days_impact: number | null
          description: string | null
          category: string | null
          order_index: number | null
          is_locked: boolean | null
          include_in_budget: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          title: string
          cost_impact?: number | null
          days_impact?: number | null
          description?: string | null
          category?: string | null
          order_index?: number | null
          is_locked?: boolean | null
          include_in_budget?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string
          title?: string
          cost_impact?: number | null
          days_impact?: number | null
          description?: string | null
          category?: string | null
          order_index?: number | null
          is_locked?: boolean | null
          include_in_budget?: boolean | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          record_id: string
          table_name: string
          action_type: string
          old_payload: Json | null
          new_payload: Json | null
          user_id: string | null
          project_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          record_id: string
          table_name: string
          action_type: string
          old_payload?: Json | null
          new_payload?: Json | null
          user_id?: string | null
          project_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          record_id?: string
          table_name?: string
          action_type?: string
          old_payload?: Json | null
          new_payload?: Json | null
          user_id?: string | null
          project_id?: string | null
          created_at?: string
        }
      }
    }
  }
}
