CREATE TABLE IF NOT EXISTS public.opportunity_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cost_impact NUMERIC DEFAULT 0,
    days_impact NUMERIC DEFAULT 0,
    is_locked BOOLEAN DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE public.opportunity_options ENABLE ROW LEVEL SECURITY;

-- Allow public access for local testing
CREATE POLICY "Enable all access for opportunity_options" ON public.opportunity_options
    AS PERMISSIVE FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
