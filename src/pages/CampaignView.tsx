import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Scroll } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  level_range: string;
}

interface Mission {
  id: string;
  title: string;
  full_content: string | null;
  created_at: string;
  session_number: number | null;
}

const CampaignView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  useEffect(() => {
    if (id) {
      fetchCampaign();
      fetchMissions();
    }
  }, [id]);

  const fetchCampaign = async () => {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id!)
      .single();

    if (error) {
      toast.error("Campaña no encontrada");
      navigate("/dashboard");
    } else {
      setCampaign(data);
    }
  };

  const fetchMissions = async () => {
    const { data, error } = await supabase
      .from("missions")
      .select("*")
      .eq("campaign_id", id!)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error cargando misiones");
    } else {
      setMissions(data || []);
    }
    setLoading(false);
  };

  const generateMission = useCallback(async () => {
    if (!campaign) return;
    setGenerating(true);
    setStreamContent("");
    setSelectedMission(null);

    const previousMissions = missions.slice(0, 5).map((m) => m.title);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-mission`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            campaignName: campaign.name,
            campaignDescription: campaign.description,
            levelRange: campaign.level_range,
            previousMissions,
            customPrompt: customPrompt || undefined,
          }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Error generando misión");
      }

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              setStreamContent(fullContent);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save the mission
      const titleMatch = fullContent.match(/##\s*🗡️\s*(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : "Misión sin título";

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { error } = await supabase.from("missions").insert({
        campaign_id: campaign.id,
        user_id: user.id,
        title,
        full_content: fullContent,
        session_number: missions.length + 1,
      });

      if (error) {
        toast.error("Error guardando misión");
      } else {
        toast.success("¡Misión generada y guardada!");
        setCustomPrompt("");
        fetchMissions();
      }
    } catch (e: any) {
      toast.error(e.message || "Error generando misión");
    } finally {
      setGenerating(false);
    }
  }, [campaign, missions, customPrompt]);

  if (loading || !campaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-flicker text-gold text-xl font-display">
          Descifrando pergaminos...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl text-gold text-glow">
              {campaign.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Nivel {campaign.level_range} · {missions.length} misiones
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar - Missions List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="ornate-border rounded-lg p-5 parchment-bg">
              <h3 className="font-display text-lg text-gold mb-4">
                Generar Misión
              </h3>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Instrucciones adicionales (opcional)... Ej: 'Incluye un dragón ancestral' o 'Ambientada en Neverwinter'"
                rows={3}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold transition-colors resize-none mb-3"
              />
              <button
                onClick={generateMission}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-2.5 rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
              >
                <Sparkles size={16} className={generating ? "animate-spin" : ""} />
                {generating ? "Generando..." : "Generar Misión"}
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-sm text-muted-foreground uppercase tracking-wider">
                Misiones ({missions.length})
              </h3>
              {missions.map((mission) => (
                <button
                  key={mission.id}
                  onClick={() => {
                    setSelectedMission(mission);
                    setStreamContent("");
                  }}
                  className={`w-full text-left ornate-border rounded-lg p-3 transition-colors ${
                    selectedMission?.id === mission.id
                      ? "border-gold/60 bg-secondary"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Scroll size={14} className="text-gold shrink-0" />
                    <span className="font-display text-sm text-foreground truncate">
                      {mission.title}
                    </span>
                  </div>
                  {mission.session_number && (
                    <span className="text-xs text-muted-foreground ml-6">
                      Sesión #{mission.session_number}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {generating && streamContent ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ornate-border rounded-lg p-6 parchment-bg"
              >
                <div className="prose-fantasy">
                  <ReactMarkdown>{streamContent}</ReactMarkdown>
                </div>
              </motion.div>
            ) : selectedMission?.full_content ? (
              <motion.div
                key={selectedMission.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="ornate-border rounded-lg p-6 parchment-bg"
              >
                <div className="prose-fantasy">
                  <ReactMarkdown>{selectedMission.full_content}</ReactMarkdown>
                </div>
              </motion.div>
            ) : (
              <div className="ornate-border rounded-lg p-12 parchment-bg text-center">
                <Sparkles className="mx-auto mb-4 text-gold" size={40} />
                <h3 className="font-display text-xl text-foreground mb-2">
                  {missions.length === 0
                    ? "Genera tu primera misión"
                    : "Selecciona una misión"}
                </h3>
                <p className="text-muted-foreground">
                  {missions.length === 0
                    ? "Usa el generador para crear contenido narrativo para tu campaña"
                    : "Elige una misión de la lista o genera una nueva"}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CampaignView;
