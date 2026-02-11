
-- Table for storing all generated content in structured format
CREATE TABLE public.generated_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL, -- pc, npc, campaign-idea, campaign-structure, mission, session-script, validate-lore, structure-gameplay
  title TEXT NOT NULL,
  summary TEXT,
  editable_text TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  relationships JSONB DEFAULT '[]',
  reusable_elements JSONB DEFAULT '[]',
  narrative_hooks JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated content"
ON public.generated_content FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own generated content"
ON public.generated_content FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generated content"
ON public.generated_content FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated content"
ON public.generated_content FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_generated_content_updated_at
BEFORE UPDATE ON public.generated_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
