
-- =============================================
-- PHASE 1: Create new misiones table
-- =============================================
CREATE TABLE public.misiones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT,
  mission_parent_id UUID REFERENCES public.misiones(id) ON DELETE SET NULL,
  linked_missions_ids UUID[] DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'activa',
  nivel_recomendado TEXT,
  tags TEXT[] DEFAULT '{}',
  contenido TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for estado (instead of CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_mision_estado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado NOT IN ('activa', 'completada', 'archivada') THEN
    RAISE EXCEPTION 'Estado inválido: %. Debe ser activa, completada o archivada', NEW.estado;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_misiones_estado
BEFORE INSERT OR UPDATE ON public.misiones
FOR EACH ROW
EXECUTE FUNCTION public.validate_mision_estado();

-- Updated at trigger
CREATE TRIGGER update_misiones_updated_at
BEFORE UPDATE ON public.misiones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.misiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own misiones"
ON public.misiones FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own misiones"
ON public.misiones FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own misiones"
ON public.misiones FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own misiones"
ON public.misiones FOR DELETE
USING (auth.uid() = user_id);

-- =============================================
-- PHASE 2: Add mission_id to encounters
-- =============================================
ALTER TABLE public.encounters
ADD COLUMN mission_id UUID REFERENCES public.misiones(id) ON DELETE SET NULL;

-- =============================================
-- PHASE 3: Add mission_id to generated_content
-- =============================================
ALTER TABLE public.generated_content
ADD COLUMN mission_id UUID REFERENCES public.misiones(id) ON DELETE SET NULL;

-- =============================================
-- PHASE 4: Migrate existing campaigns to root misiones
-- =============================================
INSERT INTO public.misiones (user_id, titulo, descripcion, tipo, estado, nivel_recomendado, tags)
SELECT 
  user_id, 
  name, 
  description, 
  'raiz',
  CASE WHEN status = 'active' THEN 'activa' ELSE 'archivada' END,
  level_range,
  ARRAY[]::TEXT[]
FROM public.campaigns;

-- =============================================
-- PHASE 5: Drop old missions table (empty, replaced by misiones)
-- =============================================
DROP TABLE IF EXISTS public.missions;
