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
      project_sheets: {
        Row: {
          id: string
          project_id: string
          sheet_name: string
          status: 'processing' | 'ready' | 'error'
          progress_percent: number
          original_width: number | null
          original_height: number | null
          max_zoom: number | null
          drawing_set_id: string | null
          discipline_id: string | null
          source_filename: string | null
          source_page_index: number | null
          staged_key: string | null
          status_message: string | null
          drawing_title: string | null
          revision: string | null
          drawing_date: string | null
          received_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          sheet_name: string
          status?: 'processing' | 'ready' | 'error'
          progress_percent?: number
          original_width?: number | null
          original_height?: number | null
          max_zoom?: number | null
          drawing_set_id?: string | null
          discipline_id?: string | null
          source_filename?: string | null
          source_page_index?: number | null
          staged_key?: string | null
          status_message?: string | null
          drawing_title?: string | null
          revision?: string | null
          drawing_date?: string | null
          received_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          sheet_name?: string
          status?: 'processing' | 'ready' | 'error'
          progress_percent?: number
          original_width?: number | null
          original_height?: number | null
          max_zoom?: number | null
          drawing_set_id?: string | null
          discipline_id?: string | null
          source_filename?: string | null
          source_page_index?: number | null
          staged_key?: string | null
          status_message?: string | null
          drawing_title?: string | null
          revision?: string | null
          drawing_date?: string | null
          received_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_drawing_sets: {
        Row: {
          id: string
          project_id: string
          set_name: string
          issue_date: string | null
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          set_name: string
          issue_date?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          set_name?: string
          issue_date?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      sheet_markups: {
        Row: {
          id: string
          sheet_id: string
          opportunity_id: string | null
          geometry: Json
          style: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sheet_id: string
          opportunity_id?: string | null
          geometry?: Json
          style?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sheet_id?: string
          opportunity_id?: string | null
          geometry?: Json
          style?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
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
          building_areas: Json | null
          sidebar_items: Json | null
          disciplines: Json | null
          project_name: string | null
          location: string | null
          original_budget: number | null
          created_at: string
          updated_at: string
          enable_audit_logging: boolean | null
          package_scopes: Json | null
          coord_groups: Json | null
          meeting_types: Json | null
        }
        Insert: {
          project_id: string
          categories?: Json | null
          building_areas?: Json | null
          sidebar_items?: Json | null
          disciplines?: Json | null
          project_name?: string | null
          location?: string | null
          original_budget?: number | null
          created_at?: string
          updated_at?: string
          enable_audit_logging?: boolean | null
          package_scopes?: Json | null
          coord_groups?: Json | null
          meeting_types?: Json | null
        }
        Update: {
          project_id?: string
          categories?: Json | null
          building_areas?: Json | null
          sidebar_items?: Json | null
          disciplines?: Json | null
          project_name?: string | null
          location?: string | null
          original_budget?: number | null
          created_at?: string
          updated_at?: string
          enable_audit_logging?: boolean | null
          package_scopes?: Json | null
          coord_groups?: Json | null
          meeting_types?: Json | null
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
          building_area: string | null
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
          coordination_status: string | null
          cost_impact: number | null
          days_impact: number | null
          design_markups: Json | null
          display_id: string | null
          priority: string | null
          created_at: string
          updated_at: string
          division: string | null
          record_type: string | null
          coordination_details: Json | null
          item_assumptions: string | null
          coord_group_id: string | null
          meeting_type: string | null
        }
        Insert: {
          id?: string
          project_id: string
          title?: string
          location?: string | null
          building_area?: string | null
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
          coordination_status?: string | null
          cost_impact?: number | null
          days_impact?: number | null
          design_markups?: Json | null
          display_id?: string | null
          priority?: string | null
          created_at?: string
          updated_at?: string
          division?: string | null
          record_type?: string | null
          coordination_details?: Json | null
          item_assumptions?: string | null
          coord_group_id?: string | null
          meeting_type?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          location?: string | null
          building_area?: string | null
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
          coordination_status?: string | null
          cost_impact?: number | null
          days_impact?: number | null
          design_markups?: Json | null
          display_id?: string | null
          priority?: string | null
          created_at?: string
          updated_at?: string
          division?: string | null
          record_type?: string | null
          coordination_details?: Json | null
          item_assumptions?: string | null
          coord_group_id?: string | null
          meeting_type?: string | null
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
          category_e: boolean | null
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
          category_e?: boolean | null
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
          category_e?: boolean | null
        }
      }
      permits: {
        Row: {
          id: string
          project_id: string
          display_id: string | null
          title: string
          description: string | null
          permit_type: string | null
          ahj: string | null
          status: string | null
          assignee: string | null
          date_submitted: string | null
          target_approval_date: string | null
          revision_number: number | null
          revision_history: Json | null
          is_deleted: boolean | null
          is_elevated_key_date: boolean | null
          issued_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          display_id?: string | null
          title: string
          description?: string | null
          permit_type?: string | null
          ahj?: string | null
          status?: string | null
          assignee?: string | null
          date_submitted?: string | null
          target_approval_date?: string | null
          revision_number?: number | null
          revision_history?: Json | null
          is_deleted?: boolean | null
          is_elevated_key_date?: boolean | null
          issued_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          display_id?: string | null
          title?: string
          description?: string | null
          permit_type?: string | null
          ahj?: string | null
          status?: string | null
          assignee?: string | null
          date_submitted?: string | null
          target_approval_date?: string | null
          revision_number?: number | null
          revision_history?: Json | null
          is_deleted?: boolean | null
          is_elevated_key_date?: boolean | null
          issued_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      permit_comments: {
        Row: {
          id: string
          project_id: string
          permit_id: string
          discipline: string | null
          comment_number: string | null
          comment_text: string | null
          response_text: string | null
          status: string | null
          assignee: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          permit_id: string
          discipline?: string | null
          comment_number?: string | null
          comment_text?: string | null
          response_text?: string | null
          status?: string | null
          assignee?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          permit_id?: string
          discipline?: string | null
          comment_number?: string | null
          comment_text?: string | null
          response_text?: string | null
          status?: string | null
          assignee?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      permit_task_links: {
        Row: {
          permit_id: string
          coordination_task_id: string
        }
        Insert: {
          permit_id: string
          coordination_task_id: string
        }
        Update: {
          permit_id?: string
          coordination_task_id?: string
        }
      }
      estimate_variance_notes: {
        Row: {
          id: string
          project_id: string
          estimate_version_id: string
          cost_code: string | null
          variance_note: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          estimate_version_id: string
          cost_code?: string | null
          variance_note?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          estimate_version_id?: string
          cost_code?: string | null
          variance_note?: string
          created_at?: string
          updated_at?: string
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
      project_members: {
        Row: {
          project_id: string
          user_id: string
          role: 'project_admin' | 'gc_admin' | 'design_team' | 'viewer'
        }
        Insert: {
          project_id: string
          user_id: string
          role: 'project_admin' | 'gc_admin' | 'design_team' | 'viewer'
        }
        Update: {
          project_id?: string
          user_id?: string
          role?: 'project_admin' | 'gc_admin' | 'design_team' | 'viewer'
        }
      }
      project_lessons: {
        Row: {
          id: string
          project_id: string
          display_id: string | null
          title: string
          what_happened: string | null
          root_cause: string | null
          recommendation: string
          category: string | null
          severity: string | null
          phase: string | null
          status: string | null
          template_id: string | null
          cost_code: string | null
          csi_number: string | null
          building_area: string | null
          discipline_id: string | null
          client_id: string | null
          author_id: string | null
          verified_by: string | null
          verified_at: string | null
          source_type: string | null
          ai_confidence: number | null
          ai_metadata: Json | null
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          display_id?: string | null
          title: string
          what_happened?: string | null
          root_cause?: string | null
          recommendation: string
          category?: string | null
          severity?: string | null
          phase?: string | null
          status?: string | null
          template_id?: string | null
          cost_code?: string | null
          csi_number?: string | null
          building_area?: string | null
          discipline_id?: string | null
          client_id?: string | null
          author_id?: string | null
          verified_by?: string | null
          verified_at?: string | null
          source_type?: string | null
          ai_confidence?: number | null
          ai_metadata?: Json | null
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          display_id?: string | null
          title?: string
          what_happened?: string | null
          root_cause?: string | null
          recommendation?: string
          category?: string | null
          severity?: string | null
          phase?: string | null
          status?: string | null
          template_id?: string | null
          cost_code?: string | null
          csi_number?: string | null
          building_area?: string | null
          discipline_id?: string | null
          client_id?: string | null
          author_id?: string | null
          verified_by?: string | null
          verified_at?: string | null
          source_type?: string | null
          ai_confidence?: number | null
          ai_metadata?: Json | null
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      lesson_opportunity_links: {
        Row: {
          lesson_id: string
          opportunity_id: string
        }
        Insert: {
          lesson_id: string
          opportunity_id: string
        }
        Update: {
          lesson_id?: string
          opportunity_id?: string
        }
      }
      lesson_attachments: {
        Row: {
          id: string
          lesson_id: string
          project_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          project_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          project_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
      }
      item_activity: {
        Row: {
          id: string
          project_id: string
          opportunity_id: string | null
          option_id: string | null
          lesson_id: string | null
          permit_id: string | null
          activity_type: string
          content: string
          mentions: Json | null
          author_id: string | null
          include_in_oac: boolean
          is_edited: boolean
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          opportunity_id?: string | null
          option_id?: string | null
          lesson_id?: string | null
          permit_id?: string | null
          activity_type: string
          content: string
          mentions?: Json | null
          author_id?: string | null
          include_in_oac?: boolean
          is_edited?: boolean
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          opportunity_id?: string | null
          option_id?: string | null
          lesson_id?: string | null
          permit_id?: string | null
          activity_type?: string
          content?: string
          mentions?: Json | null
          author_id?: string | null
          include_in_oac?: boolean
          is_edited?: boolean
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      project_csi_specs: {
        Row: {
          id: string
          project_id: string
          csi_number: string
          normalized_csi_number: string
          description: string | null
          cost_code: string | null
          source: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          csi_number: string
          normalized_csi_number: string
          description?: string | null
          cost_code?: string | null
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          csi_number?: string
          normalized_csi_number?: string
          description?: string | null
          cost_code?: string | null
          source?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      company_csi_defaults: {
        Row: {
          id: string
          csi_number: string
          normalized_csi_number: string
          description: string | null
          cost_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          csi_number: string
          normalized_csi_number: string
          description?: string | null
          cost_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          csi_number?: string
          normalized_csi_number?: string
          description?: string | null
          cost_code?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      global_csi_training_data: {
        Row: {
          normalized_csi_number: string
          global_cost_code_id: string
          latest_description: string | null
          latest_raw_csi_number: string | null
          match_count: number
          is_admin_verified: boolean
          last_seen_at: string
        }
        Insert: {
          normalized_csi_number: string
          global_cost_code_id: string
          latest_description?: string | null
          latest_raw_csi_number?: string | null
          match_count?: number
          is_admin_verified?: boolean
          last_seen_at?: string
        }
        Update: {
          normalized_csi_number?: string
          global_cost_code_id?: string
          latest_description?: string | null
          latest_raw_csi_number?: string | null
          match_count?: number
          is_admin_verified?: boolean
          last_seen_at?: string
        }
      }
      platform_admins: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
      }
      role_permissions: {
        Row: {
          role: 'project_admin' | 'gc_admin' | 'design_team' | 'viewer'
          can_lock_options: boolean
          can_unlock_options: boolean
          can_manage_team: boolean
          can_edit_project_settings: boolean
          can_manage_budget: boolean
          can_edit_records: boolean
          can_delete_records: boolean
          can_view_audit_logs: boolean
        }
        Insert: {
          role: 'project_admin' | 'gc_admin' | 'design_team' | 'viewer'
          can_lock_options?: boolean
          can_unlock_options?: boolean
          can_manage_team?: boolean
          can_edit_project_settings?: boolean
          can_manage_budget?: boolean
          can_edit_records?: boolean
          can_delete_records?: boolean
          can_view_audit_logs?: boolean
        }
        Update: {
          role?: 'project_admin' | 'gc_admin' | 'design_team' | 'viewer'
          can_lock_options?: boolean
          can_unlock_options?: boolean
          can_manage_team?: boolean
          can_edit_project_settings?: boolean
          can_manage_budget?: boolean
          can_edit_records?: boolean
          can_delete_records?: boolean
          can_view_audit_logs?: boolean
        }
      }
    }
  }
}
