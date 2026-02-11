
-- Replace campaign_metadata with rich narrative context columns
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS campaign_metadata;

ALTER TABLE public.campaigns
  ADD COLUMN region TEXT,
  ADD COLUMN tone TEXT DEFAULT 'épico',
  ADD COLUMN current_act INTEGER DEFAULT 1,
  ADD COLUMN narrative_context JSONB DEFAULT '{
    "summary": "",
    "chapters": [],
    "important_events": [],
    "known_antagonists": [],
    "active_npcs": [],
    "party_decisions": [],
    "open_conflicts": [],
    "narrative_memory": [],
    "regions_explored": [],
    "loot_given": [],
    "plot_hooks_pending": []
  }'::jsonb;
