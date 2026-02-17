
-- Table to log AI provider errors for monitoring and debugging
CREATE TABLE public.logs_ia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  proveedor TEXT NOT NULL,
  tipo_error TEXT NOT NULL,
  detalles TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.logs_ia ENABLE ROW LEVEL SECURITY;

-- Edge functions insert with service role, so we need a permissive policy for service role
-- and a select policy for users to see their own logs
CREATE POLICY "Service role can insert logs"
ON public.logs_ia FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view own logs"
ON public.logs_ia FOR SELECT
USING (auth.uid()::text = user_id);

-- Index for querying by user and time
CREATE INDEX idx_logs_ia_user_created ON public.logs_ia (user_id, created_at DESC);
CREATE INDEX idx_logs_ia_proveedor ON public.logs_ia (proveedor);
