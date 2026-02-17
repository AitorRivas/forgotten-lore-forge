
CREATE TABLE public.encounters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'encuentro',
  nivel_grupo NUMERIC NOT NULL,
  numero_personajes INTEGER NOT NULL,
  dificultad INTEGER NOT NULL,
  criaturas_json JSONB DEFAULT '[]'::jsonb,
  estrategia_json JSONB DEFAULT '{}'::jsonb,
  texto_completo_editable TEXT NOT NULL,
  xp_total INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}'::text[],
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own encounters" ON public.encounters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own encounters" ON public.encounters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own encounters" ON public.encounters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own encounters" ON public.encounters FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_encounters_updated_at
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
