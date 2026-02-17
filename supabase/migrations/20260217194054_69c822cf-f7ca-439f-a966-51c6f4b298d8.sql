
-- Create magic items table
CREATE TABLE public.objetos_magicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'objeto maravilloso',
  subtipo TEXT,
  rareza TEXT NOT NULL DEFAULT 'poco común',
  es_artefacto BOOLEAN NOT NULL DEFAULT false,
  categoria_artefacto TEXT,
  requiere_sintonizacion BOOLEAN NOT NULL DEFAULT false,
  clase_restringida TEXT,
  alineamiento_restringido TEXT,
  propiedades_magicas TEXT,
  bonificadores TEXT,
  habilidades_activas TEXT,
  habilidades_pasivas TEXT,
  cargas TEXT,
  forma_de_recarga TEXT,
  efectos_secundarios TEXT,
  maldiciones TEXT,
  crecimiento_escalable BOOLEAN NOT NULL DEFAULT false,
  condiciones_de_desbloqueo TEXT,
  historia_lore TEXT,
  origen TEXT,
  creador_original TEXT,
  rumores_asociados TEXT,
  ganchos_narrativos TEXT,
  notas_dm TEXT,
  contenido_completo TEXT,
  nivel_recomendado TEXT,
  tono TEXT,
  rol_objeto TEXT,
  region TEXT,
  mission_id UUID REFERENCES public.misiones(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.objetos_magicos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can create own objetos_magicos" ON public.objetos_magicos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own objetos_magicos" ON public.objetos_magicos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own objetos_magicos" ON public.objetos_magicos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own objetos_magicos" ON public.objetos_magicos FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_objetos_magicos_updated_at
  BEFORE UPDATE ON public.objetos_magicos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
