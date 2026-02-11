import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { MapPin, Pen, BookOpen, Users } from "lucide-react";

interface UserContext {
  regions_used: string[];
  narrative_styles: string[];
  recent_themes: string[];
  npcs_created: string[];
}

const ContextPanel = ({ userId }: { userId: string }) => {
  const [context, setContext] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const fetchContext = async () => {
      const { data, error } = await supabase
        .from("user_context")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        setContext({
          regions_used: (data.regions_used as string[]) || [],
          narrative_styles: (data.narrative_styles as string[]) || [],
          recent_themes: (data.recent_themes as string[]) || [],
          npcs_created: (data.npcs_created as string[]) || [],
        });
      }
      setLoading(false);
    };

    if (userId) {
      fetchContext();
    }
  }, [userId]);

  if (loading || !context) return null;

  const sections = [
    {
      icon: MapPin,
      title: "Regiones Exploradas",
      items: context.regions_used,
      color: "text-blue-400",
    },
    {
      icon: Pen,
      title: "Estilos Narrativos",
      items: context.narrative_styles,
      color: "text-purple-400",
    },
    {
      icon: BookOpen,
      title: "Temas Recientes",
      items: context.recent_themes,
      color: "text-amber-400",
    },
    {
      icon: Users,
      title: "NPCs Creados",
      items: context.npcs_created,
      color: "text-emerald-400",
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm text-muted-foreground uppercase tracking-wider">
        Biblioteca Personal
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="ornate-border rounded-lg p-3 parchment-bg"
          >
            <div className="flex items-center gap-2 mb-2">
              <section.icon size={14} className={section.color} />
              <span className="font-display text-xs text-foreground">
                {section.title}
              </span>
            </div>
            {section.items.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {section.items.slice(-3).map((item) => (
                  <span
                    key={item}
                    className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Genera misiones para llenar esta sección
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ContextPanel;
