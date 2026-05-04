import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const companyId = searchParams.get('companyId');

  if (!projectId || !companyId) {
    return NextResponse.json({ error: 'Missing Procore IDs' }, { status: 400 });
  }

  try {
    // 1. Get a Server-to-Server Token using Client Credentials
    const tokenRes = await fetch('https://login.procore.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.NEXT_PUBLIC_PROCORE_CLIENT_ID,
        client_secret: process.env.PROCORE_CLIENT_SECRET,
      }),
    });
    
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Failed to get Procore DMSA token');

    // 2. Fetch the Project Details
    const projectRes = await fetch(`https://api.procore.com/rest/v1.1/projects/${projectId}?company_id=${companyId}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!projectRes.ok) throw new Error('Failed to fetch project from Procore');

    const procoreProject = await projectRes.json();

    // 3. Return the specific fields we need to auto-fill
    return NextResponse.json({
      name: procoreProject.name || '',
      project_number: procoreProject.project_number || '',
      description: procoreProject.description || ''
    });

  } catch (error) {
    console.error('Error fetching Procore project:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
