import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

import { toast } from 'sonner';
import { ProjectSettings, Project, UserPermissions, ProjectMember } from '@/types/models';
import { DEFAULT_CATEGORIES, DEFAULT_SIDEBAR_ITEMS, DEFAULT_BUILDING_AREAS, DEFAULT_DISCIPLINES } from '@/lib/constants';
import { normalizeCategories } from '@/lib/normalizeSettings';
import { useAuth } from '@/providers/AuthProvider';
import { useIsPlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useRolePermissions } from '@/hooks/useGlobalQueries';

export const DEFAULT_PERMS: UserPermissions = {
  can_lock_options: false,
  can_unlock_options: false,
  can_manage_team: false,
  can_edit_project_settings: false,
  can_manage_budget: false,
  can_edit_records: false,
  can_delete_records: false,
  can_view_audit_logs: false,
};

export const ALL_PERMS: UserPermissions = {
  can_lock_options: true,
  can_unlock_options: true,
  can_manage_team: true,
  can_edit_project_settings: true,
  can_manage_budget: true,
  can_edit_records: true,
  can_delete_records: true,
  can_view_audit_logs: true,
};

export function useProjects() {
  return useQuery<Project[], Error>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, project_settings(project_name)')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.warn("Supabase Projects Error:", error);
        return [];
      }
      return data as Project[];
    }
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation<Project, Error, Partial<Project>>({
    mutationFn: async (newProject) => {
      const { data, error } = await supabase
        .rpc('create_new_project', { 
          p_name: newProject.name, 
          p_description: newProject.description || null,
          p_project_number: newProject.project_number || null,
          p_procore_project_id: newProject.procore_project_id || null,
          p_procore_company_id: newProject.procore_company_id || null
        })
        .single();
        
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      console.error('Create Project Error:', err);
      toast.error(`Failed to create project: ${err.message}`);
    }
  });
}

export function useUpdateProjectCore(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<Project, Error, Partial<Project>>({
    mutationFn: async (updates) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      console.error('Update Project Core Error:', err);
      toast.error(`Failed to update project details: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useDeleteProjectCore() {
  const queryClient = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (projectId) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      if (error) throw error;
      return projectId;
    },
    onSuccess: () => {
      toast.success('Project deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      console.error('Delete Project Error:', err);
      toast.error(`Failed to delete project: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useProjectSettings(projectId: string | null) {
  return useQuery<ProjectSettings, Error>({
    queryKey: ['project_settings', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("No Project ID");
      const { data, error } = await supabase
        .from('project_settings')
        .select('*')
        .eq('project_id', projectId)
        .limit(1);
        
      if (error) {
        console.warn("Supabase Error:", error);
      }
      
      const defaultSettings: Partial<ProjectSettings> = {
        categories: DEFAULT_CATEGORIES as unknown as any, 
        building_areas: DEFAULT_BUILDING_AREAS as unknown as any,
        sidebar_items: DEFAULT_SIDEBAR_ITEMS as unknown as any,
        disciplines: DEFAULT_DISCIPLINES as unknown as any,
        project_name: null,
        location: 'Not Set',
        original_budget: 0,
        enable_audit_logging: false,
        ve_column_order: []
      };

      const settings = data?.[0];
      
      if (!settings) return defaultSettings as ProjectSettings;

      return {
        ...settings,
        categories: normalizeCategories(settings.categories) as unknown as ProjectSettings['categories'],
        building_areas: (settings.building_areas as any[])?.length > 0 ? settings.building_areas : defaultSettings.building_areas,
        sidebar_items: (settings.sidebar_items as any[])?.length > 0 ? settings.sidebar_items : defaultSettings.sidebar_items,
        disciplines: (settings.disciplines as any[])?.length > 0 ? settings.disciplines : defaultSettings.disciplines,
        project_name: settings.project_name || null,
        location: settings.location || defaultSettings.location,
        original_budget: settings.original_budget ?? defaultSettings.original_budget,
        enable_audit_logging: settings.enable_audit_logging ?? defaultSettings.enable_audit_logging,
        ve_column_order: settings.ve_column_order ?? defaultSettings.ve_column_order
      } as ProjectSettings;
    },
    enabled: !!projectId
  });
}

export function useUpdateProjectSettings(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<ProjectSettings, Error, Partial<ProjectSettings>>({
    mutationFn: async (updates) => {
      const { data, error } = await supabase
        .from('project_settings')
        .upsert({ project_id: projectId, ...updates })
        .select()
        .single();
      if (error) throw error;
      return data as ProjectSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_settings', projectId] });
    },
    onError: (err) => {
      console.error('Update Project Settings Error:', err);
      toast.error(`Failed to update settings: ${err.message || 'Unknown error'}`);
    }
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ['project_members', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_project_members_with_email', { p_project_id: projectId });
      if (error) throw error;
      return data as ProjectMember[];
    },
    enabled: !!projectId,
  });
}

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
      const { error } = await supabase.from('project_members').insert({ project_id: projectId, user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_members', projectId] });
    },
    onError: (err) => {
      console.error('Add Member Error:', err);
      toast.error(`Failed to add member: ${err.message}`);
    }
  });
}

export function useUpdateProjectMemberRole(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
      const { error } = await supabase.from('project_members').update({ role }).eq('project_id', projectId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_members', projectId] });
    },
    onError: (err) => {
      console.error('Update Member Role Error:', err);
      toast.error(`Failed to update role: ${err.message}`);
    }
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_members', projectId] });
    },
    onError: (err) => {
      console.error('Remove Member Error:', err);
      toast.error(`Failed to remove member: ${err.message}`);
    }
  });
}

export function useCurrentUserPermissions(projectId: string | null): {
  permissions: UserPermissions;
  isLoading: boolean;
} {
  const { session } = useAuth();
  const { data: members, isLoading: membersLoading } = useProjectMembers(projectId || '');
  const { data: isPlatformAdmin, isLoading: adminLoading } = useIsPlatformAdmin();
  const { data: rolePermissions, isLoading: rolesLoading } = useRolePermissions();

  const isLoading = membersLoading || adminLoading || rolesLoading;

  if (!isLoading && isPlatformAdmin) {
    return { permissions: ALL_PERMS, isLoading: false };
  }

  if (isLoading || !session?.user?.id || !members || !rolePermissions) {
    return { permissions: DEFAULT_PERMS, isLoading };
  }

  const userMember = members.find(m => m.user_id === session.user.id);
  if (!userMember) return { permissions: DEFAULT_PERMS, isLoading: false };

  const found = rolePermissions.find(rp => rp.role === userMember.role);
  if (!found) return { permissions: DEFAULT_PERMS, isLoading: false };

  // Explicitly strip 'role' field per UserPermissions definition
  const { role: _, ...permissions } = found;
  return { permissions, isLoading: false };
}

