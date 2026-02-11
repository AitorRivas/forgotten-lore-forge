
-- User context table to track narrative history and preferences
CREATE TABLE public.user_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  regions_used JSONB DEFAULT '[]'::jsonb,
  narrative_styles JSONB DEFAULT '[]'::jsonb,
  recent_themes JSONB DEFAULT '[]'::jsonb,
  npcs_created JSONB DEFAULT '[]'::jsonb,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own context" ON public.user_context FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own context" ON public.user_context FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own context" ON public.user_context FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add campaign_metadata JSONB column for campaign-specific tracking
ALTER TABLE public.campaigns ADD COLUMN campaign_metadata JSONB DEFAULT '{
  "regions": [],
  "themes": [],
  "villain_archetypes": [],
  "session_count": 0
}'::jsonb;

-- Function to auto-create user context on signup
CREATE OR REPLACE FUNCTION public.create_user_context()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_context (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-create context when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_context();
