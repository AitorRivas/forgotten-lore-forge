import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Scroll, BookOpen, Compass, Pencil, Eye, Save, Loader2, RefreshCw, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import CampaignContextPanel from "@/components/CampaignContextPanel";
import CampaignAnalysisPanel, { type CampaignAnalysis } from "@/components/CampaignAnalysisPanel";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  level_range: string;
  region: string | null;
  tone: string | null;
  current_act: number | null;
  narrative_context: any;
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
  const [userId, setUserId] = useState<string>("");
  const [showContext, setShowContext] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<CampaignAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingMission, setEditingMission] = useState(false);
  const [editedMissionContent, setEditedMissionContent] = useState("");
  const [savingMission, setSavingMission] = useState(false);
  const [editingGenerated, setEditingGenerated] = useState(false);
  const [editedGeneratedContent, setEditedGeneratedContent] = useState("");
  const [savingGenerated, setSavingGenerated] = useState(false);
  const [lastPromptUsed, setLastPromptUsed] = useState("");

  useEffect(() => {
    if (id) {
      const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);
      };
      getUser();
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
      setCampaign(data as Campaign);
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

  const analyzeCampaign = useCallback(async () => {
    if (!campaign) return;
    setAnalyzing(true);
    setShowAnalysis(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-campaign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ campaignId: campaign.id }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error analizando campaña");
      }
      const data = await resp.json();
      setAnalysis(data.analysis);
      toast.success("Análisis completado");
    } catch (e: any) {
      toast.error(e.message || "Error en el análisis");
    } finally {
      setAnalyzing(false);
    }
  }, [campaign]);

  const generateMission = useCallback(async () => {
    if (!campaign || !userId) return;
    setGenerating(true);
    setStreamContent("");
    setSelectedMission(null);
    setEditingGenerated(false);
    setEditedGeneratedContent("");
    setLastPromptUsed(customPrompt);

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
            campaignId: campaign.id,
            userId,
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

      toast.success("¡Contenido generado! Revísalo antes de guardar.");
      setCustomPrompt("");
    } catch (e: any) {
      toast.error(e.message || "Error generando misión");
    } finally {
      setGenerating(false);
    }
  }, [campaign, customPrompt, userId]);

  const saveGeneratedMission = useCallback(async () => {
    const contentToSave = editingGenerated ? editedGeneratedContent : streamContent;
    if (!contentToSave || !campaign) return;
    setSavingGenerated(true);

    try {
      const titleMatch = contentToSave.match(/##\s*🗡️\s*(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : "Misión sin título";

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { error } = await supabase.from("missions").insert({
        campaign_id: campaign.id,
        user_id: user.id,
        title,
        full_content: contentToSave,
        session_number: missions.length + 1,
      });

      if (error) throw new Error("Error guardando misión");

      // Update campaign context
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-context`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              campaignId: campaign.id,
              userId: user.id,
              missionTitle: title,
              missionContent: contentToSave,
            }),
          }
        );
      } catch (contextError) {
        console.error("Error updating context:", contextError);
      }

      toast.success("¡Misión guardada!");
      setStreamContent("");
      setEditingGenerated(false);
      fetchMissions();
      fetchCampaign();
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setSavingGenerated(false);
    }
  }, [streamContent, editedGeneratedContent, editingGenerated, campaign, missions]);

  const discardGenerated = useCallback(() => {
    setStreamContent("");
    setEditingGenerated(false);
    setEditedGeneratedContent("");
  }, []);

  if (loading || !campaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-flicker text-gold text-xl font-display">
          Descifrando pergaminos...
        </div>
      </div>
    );
  }

  const ctxData = campaign.narrative_context || {};
  const contextCount = [
    ctxData.active_npcs?.length || 0,
    ctxData.known_antagonists?.length || 0,
    ctxData.open_conflicts?.length || 0,
    ctxData.important_events?.length || 0,
  ].reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
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
                Nivel {campaign.level_range}
                {campaign.region && ` · ${campaign.region}`}
                {campaign.tone && ` · ${campaign.tone}`}
                {` · Acto ${campaign.current_act || 1}`}
                {` · ${missions.length} misiones`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (!showAnalysis) { setShowContext(false); analyzeCampaign(); } else { setShowAnalysis(false); } }}
              disabled={analyzing}
              className={`flex items-center gap-2 text-sm font-display px-3 py-1.5 rounded transition-colors ${
                showAnalysis ? "bg-primary text-primary-foreground" : "text-gold hover:text-gold-light border border-border"
              }`}
            >
              <Compass size={16} className={analyzing ? "animate-spin" : ""} />
              Análisis
            </button>
            <button
              onClick={() => { setShowAnalysis(false); setShowContext(!showContext); }}
              className={`flex items-center gap-2 text-sm font-display px-3 py-1.5 rounded transition-colors ${
                showContext ? "bg-primary text-primary-foreground" : "text-gold hover:text-gold-light border border-border"
              }`}
            >
              <BookOpen size={16} />
              Contexto
              {contextCount > 0 && (
                <span className="bg-secondary text-muted-foreground text-xs px-1.5 py-0.5 rounded">
                  {contextCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className={`grid gap-6 ${(showContext || showAnalysis) ? "grid-cols-1 lg:grid-cols-4" : "grid-cols-1 lg:grid-cols-3"}`}>
          {/* Sidebar - Generator + Missions */}
          <div className="lg:col-span-1 space-y-4">
            <div className="ornate-border rounded-lg p-5 parchment-bg">
              <h3 className="font-display text-lg text-gold mb-4">
                Generar Misión
              </h3>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Instrucciones adicionales (opcional)... Ej: 'Avanza el conflicto con el dragón' o 'Ambientada en Neverwinter'"
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
          <div className={showContext ? "lg:col-span-2" : "lg:col-span-2"}>
            {streamContent && !generating ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ornate-border rounded-lg p-6 parchment-bg"
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingGenerated(false)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display transition-colors ${!editingGenerated ? "bg-gold/20 text-gold border border-gold/40" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Eye size={13} /> Vista
                    </button>
                    <button
                      onClick={() => { setEditingGenerated(true); setEditedGeneratedContent(streamContent); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display transition-colors ${editingGenerated ? "bg-gold/20 text-gold border border-gold/40" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Pencil size={13} /> Editar
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setCustomPrompt(lastPromptUsed); generateMission(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent border border-border rounded text-xs text-foreground hover:border-gold/50 transition-colors"
                    >
                      <RefreshCw size={13} /> Regenerar
                    </button>
                    <button
                      onClick={discardGenerated}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X size={13} /> Descartar
                    </button>
                    <button
                      onClick={saveGeneratedMission}
                      disabled={savingGenerated}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-display hover:bg-gold-dark transition-colors disabled:opacity-50"
                    >
                      {savingGenerated ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      {savingGenerated ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
                {editingGenerated ? (
                  <textarea
                    value={editedGeneratedContent}
                    onChange={(e) => setEditedGeneratedContent(e.target.value)}
                    className="w-full min-h-[500px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y"
                  />
                ) : (
                  <div className="prose-fantasy">
                    <ReactMarkdown>{streamContent}</ReactMarkdown>
                  </div>
                )}
              </motion.div>
            ) : generating && streamContent ? (
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
                <div className="flex justify-between items-center mb-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingMission(false)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display transition-colors ${!editingMission ? "bg-gold/20 text-gold border border-gold/40" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Eye size={13} /> Vista
                    </button>
                    <button
                      onClick={() => { setEditingMission(true); setEditedMissionContent(selectedMission.full_content || ""); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display transition-colors ${editingMission ? "bg-gold/20 text-gold border border-gold/40" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Pencil size={13} /> Editar
                    </button>
                  </div>
                  {editingMission && (
                    <button
                      onClick={async () => {
                        setSavingMission(true);
                        const { error } = await supabase.from("missions").update({ full_content: editedMissionContent }).eq("id", selectedMission.id);
                        if (error) { toast.error("Error guardando"); }
                        else {
                          toast.success("Misión actualizada — será canon para futuras generaciones");
                          setSelectedMission({ ...selectedMission, full_content: editedMissionContent });
                          setMissions(prev => prev.map(m => m.id === selectedMission.id ? { ...m, full_content: editedMissionContent } : m));
                          setEditingMission(false);
                        }
                        setSavingMission(false);
                      }}
                      disabled={savingMission}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded text-xs text-foreground hover:border-gold/50 transition-colors disabled:opacity-50"
                    >
                      {savingMission ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      {savingMission ? "Guardando..." : "Guardar Cambios"}
                    </button>
                  )}
                </div>
                {editingMission ? (
                  <textarea
                    value={editedMissionContent}
                    onChange={(e) => setEditedMissionContent(e.target.value)}
                    className="w-full min-h-[500px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y"
                  />
                ) : (
                  <div className="prose-fantasy">
                    <ReactMarkdown>{selectedMission.full_content}</ReactMarkdown>
                  </div>
                )}
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
                    ? "Configura el contexto de campaña y genera contenido narrativo"
                    : "Elige una misión de la lista o genera una nueva"}
                </p>
              </div>
            )}
          </div>

          {/* Side Panel: Analysis or Context */}
          {(showAnalysis || showContext) && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-1 max-h-[calc(100vh-200px)] overflow-y-auto"
            >
              {showAnalysis ? (
                <CampaignAnalysisPanel
                  analysis={analysis}
                  loading={analyzing}
                  onAnalyze={analyzeCampaign}
                />
              ) : (
                <CampaignContextPanel
                  campaign={campaign}
                  onUpdated={fetchCampaign}
                />
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CampaignView;
