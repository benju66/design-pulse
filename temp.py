import sys

path = 'c:/Users/BUrness/Dev/design-pulse/designpulse-next/src/components/dashboard/GlobalSettingsModal.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    '  const toggleAdmin = useTogglePlatformAdmin();\n  const { session } = useAuth();\n  \n  const { data: rolePermissions',
    '  const toggleAdmin = useTogglePlatformAdmin();\n  const { session } = useAuth();\n  \n  const { data: myMemberships = [] } = useUserProjectMembers(session?.user?.id || null);\n  const isGcAdminAnywhere = myMemberships.some(m => m.role == \'gc_admin\');\n  const canAccessUsers = isPlatformAdmin || isGcAdminAnywhere;\n\n  const { data: rolePermissions'
)

text = text.replace(
    '''          {activeTab === 'users' && isPlatformAdmin && (
            <GlobalUserManagementTab 
              users={users || []} 
              usersLoading={usersLoading} 
              projects={projects || []}
              sessionUserId={session?.user?.id || ''}
              setIsDirty={setIsDirty}
              isDirty={isDirty}
            />
          )}

          {activeTab === 'users' && !isPlatformAdmin && (
             <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                <AlertCircle size={32} className="text-rose-500 mb-4 mt-12" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Access Denied</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  You must be a Platform Admin to view the Global User Directory.
                </p>
             </div>
          )}''',
    '''          {activeTab === 'users' && canAccessUsers && (
            <GlobalUserManagementTab 
              users={users || []} 
              usersLoading={usersLoading} 
              projects={projects || []}
              sessionUserId={session?.user?.id || ''}
              setIsDirty={setIsDirty}
              isDirty={isDirty}
              isPlatformAdmin={!!isPlatformAdmin}
            />
          )}

          {activeTab === 'users' && !canAccessUsers && (
             <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                <AlertCircle size={32} className="text-rose-500 mb-4 mt-12" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Access Denied</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  You must be a Platform Admin or GC Admin to view the Global User Directory.
                </p>
             </div>
          )}'''
)

text = text.replace(
    '  sessionUserId: string,\n  setIsDirty: (val: boolean) => void,\n  isDirty: boolean\n}) {',
    '  sessionUserId: string,\n  setIsDirty: (val: boolean) => void,\n  isDirty: boolean,\n  isPlatformAdmin: boolean\n}) {\n  const visibleProjects = React.useMemo(() => {\n    return isPlatformAdmin ? projects : projects.filter(p => !p.is_archived);\n  }, [projects, isPlatformAdmin]);'
)

text = text.replace(
    '                ) : projects.length === 0 ? (\n                  <div className="text-center py-8 text-sm text-slate-500">No projects found.</div>\n                ) : (\n                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50">\n                    {projects.map(project => {',
    '                ) : visibleProjects.length === 0 ? (\n                  <div className="text-center py-8 text-sm text-slate-500">No projects found.</div>\n                ) : (\n                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50">\n                    {visibleProjects.map(project => {'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
