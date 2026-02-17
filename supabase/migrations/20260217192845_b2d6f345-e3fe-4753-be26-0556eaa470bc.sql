
-- Create scenes (escenas) table
CREATE TABLE public.escenas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT DEFAULT 'social',
  descripcion_narrativa TEXT,
  detonante TEXT,
  conflicto_central TEXT,
  posibles_resoluciones JSONB DEFAULT '[]'::jsonb,
  consecuencias_inmediatas TEXT,
  criaturas_involucradas JSONB DEFAULT '[]'::jsonb,
  pnj_involucrados JSONB DEFAULT '[]'::jsonb,
  localizacion TEXT,
  nivel_recomendado TEXT,
  tono TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  mission_id UUID REFERENCES public.misiones(id) ON DELETE SET NULL,
  notas_dm TEXT,
  giro_inesperado TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.escenas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own escenas" ON public.escenas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own escenas" ON public.escenas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own escenas" ON public.escenas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own escenas" ON public.escenas FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_escenas_updated_at BEFORE UPDATE ON public.escenas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create NPCs table
CREATE TABLE public.npcs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  raza TEXT,
  clase_arquetipo TEXT,
  alineamiento TEXT,
  trasfondo TEXT,
  localizacion TEXT,
  nivel TEXT,
  ca INTEGER,
  hp TEXT,
  velocidad TEXT,
  atributos JSONB DEFAULT '{"FUE":10,"DES":10,"CON":10,"INT":10,"SAB":10,"CAR":10}'::jsonb,
  competencias TEXT,
  habilidades TEXT,
  resistencias_inmunidades TEXT,
  sentidos TEXT,
  idiomas TEXT,
  rasgos_especiales TEXT,
  acciones TEXT,
  acciones_legendarias TEXT,
  acciones_guarida TEXT,
  reacciones TEXT,
  equipo TEXT,
  historia_lore TEXT,
  motivaciones TEXT,
  secretos TEXT,
  facciones TEXT,
  rol TEXT,
  importancia TEXT DEFAULT 'relevante',
  contenido_completo TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  mission_id UUID REFERENCES public.misiones(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own npcs" ON public.npcs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own npcs" ON public.npcs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own npcs" ON public.npcs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own npcs" ON public.npcs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_npcs_updated_at BEFORE UPDATE ON public.npcs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
