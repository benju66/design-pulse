import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // 1. Parse the JSON state payload
  const state = searchParams.get('state');
  let redirectPath = '/dashboard';
  let isPopup = false;

  if (state) {
    try {
      const parsedState = JSON.parse(decodeURIComponent(state));
      redirectPath = parsedState.returnTo || '/dashboard';
      isPopup = parsedState.isPopup === true;
    } catch (e) {
      // Fallback in case of an older plain-text state string
      redirectPath = decodeURIComponent(state);
    }
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const baseUrl = `${proto}://${host}`;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=NoCode`);
  }

  try {
    // 1. MOVED TO PRODUCTION: login.procore.com
    const tokenRes = await fetch('https://login.procore.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.NEXT_PUBLIC_PROCORE_CLIENT_ID,
        client_secret: process.env.PROCORE_CLIENT_SECRET,
        code,
        redirect_uri: `${baseUrl}/api/auth/procore/callback`,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) throw new Error('Failed to get Procore token');

    // 2. MOVED TO PRODUCTION: api.procore.com
    const userRes = await fetch('https://api.procore.com/rest/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const procoreUser = await userRes.json();
    const email = procoreUser.login;

    // 3. THE SECURITY BOUNCER: RESTRICT TO COMPANY DOMAIN
    // Checks the Vercel environment variable first, falls back to a default if missing
    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || '@fpcinc.com';

    if (!email.toLowerCase().endsWith(allowedDomain)) {
      console.error(`Blocked unauthorized login attempt from: ${email}`);
      return NextResponse.redirect(`${baseUrl}/login?error=UnauthorizedDomain`);
    }

    // 4. Provision Supabase User
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );

    // Look up the user securely via the new RPC to avoid the 50-user pagination limit
    const { data: existingUserId, error: rpcError } = await supabaseAdmin.rpc('get_user_id_by_email', { p_email: email });
    if (rpcError) throw rpcError;

    if (!existingUserId) {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: {
          display_name: procoreUser.name,
          procore_id: procoreUser.id
        }
      });
      if (error) throw error;
    } else {
      // Sync their Procore metadata in case it changed or they were manually invited
      const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
        user_metadata: {
          display_name: procoreUser.name,
          procore_id: procoreUser.id
        }
      });
      if (error) throw error;
    }

    // ==========================================
    // 4. AUTOMATIC PROJECT SYNC LOGIC
    // ==========================================
    
    // Check if the redirect path contains project IDs passed from launch/route.ts
    const urlParams = new URLSearchParams(redirectPath.split('?')[1] || '');
    const syncProjectId = urlParams.get('link_procore_project');
    const syncCompanyId = urlParams.get('link_procore_company');

    let finalRedirectPath = redirectPath;

    if (syncProjectId && syncCompanyId) {
      // Fetch the specific project details using the v1.1 endpoint 
      const projectRes = await fetch(`https://api.procore.com/rest/v1.1/projects/${syncProjectId}?company_id=${syncCompanyId}`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      if (projectRes.ok) {
        const procoreProject = await projectRes.json();

        // Map the Procore JSON payload to your database schema
        const mappedProjectData = {
          procore_project_id: procoreProject.id.toString(), // The connected Procore ID
          name: procoreProject.name, // Project Name
          project_number: procoreProject.project_number, // Human Readable Number
          stage: procoreProject.project_stage?.name || 'Pre-Construction', // Stage of construction
          description: procoreProject.description || '',
          location: [procoreProject.address, procoreProject.city, procoreProject.state_code]
            .filter(Boolean)
            .join(', '), // Compiled location
          start_date: procoreProject.estimated_start_date || null, // Dates
          completion_date: procoreProject.estimated_completion_date || null,
          // Client info is often tied to the 'program' or 'office' objects depending on how your Procore instance is structured
          client_name: procoreProject.program?.name || 'TBD' 
        };

        // Upsert the project into the database
        const { data: newProject, error: projectError } = await supabaseAdmin
          .from('projects')
          .upsert(mappedProjectData, { onConflict: 'procore_project_id' })
          .select('id')
          .single();

        if (!projectError && newProject) {
          // Override the redirect to drop the user directly into the newly created project board
          finalRedirectPath = `/project/${newProject.id}`;
        } else {
          console.error("Failed to auto-create project:", projectError);
        }
      }
    }
    // ==========================================

    // 5. Generate Magic Link and Redirect
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: isPopup 
          ? `${baseUrl}/auth/success?returnTo=${encodeURIComponent(finalRedirectPath)}` 
          : `${baseUrl}${finalRedirectPath}`
      }
    });

    if (linkError) throw linkError;

    return NextResponse.redirect(linkData.properties.action_link);

  } catch (error) {
    console.error('Procore Auth Error:', error);
    return NextResponse.redirect(`${baseUrl}/login?error=ProcoreAuthFailed`);
  }
}
