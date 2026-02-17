
-- Add new narrative fields to misiones table
ALTER TABLE public.misiones
  ADD COLUMN IF NOT EXISTS ubicacion_principal TEXT,
  ADD COLUMN IF NOT EXISTS sububicaciones TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tono TEXT,
  ADD COLUMN IF NOT EXISTS facciones_involucradas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pnj_clave TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS objeto_clave TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contexto_general TEXT,
  ADD COLUMN IF NOT EXISTS detonante TEXT,
  ADD COLUMN IF NOT EXISTS conflicto_central TEXT,
  ADD COLUMN IF NOT EXISTS trama_detallada TEXT,
  ADD COLUMN IF NOT EXISTS actos_o_fases JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS posibles_rutas JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS giros_argumentales JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS consecuencias_potenciales JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secretos_ocultos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eventos_dinamicos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recompensas_sugeridas JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS riesgos_escalada TEXT[] DEFAULT '{}';

-- Make titulo nullable (name is now auto-generable)
ALTER TABLE public.misiones ALTER COLUMN titulo DROP NOT NULL;
