import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Sparkles, Users, UserPlus, Map, Castle, Swords, Loader2,
} from "lucide-react";

interface GeneratorModule {
  id: string;
  label: string;
  icon: React.ElementType;
  endpoint: string;
  placeholder: string;
  description: string;
}

const MODULES: GeneratorModule[] = [
  {
    id: "pc",
    label: "Personaje Jugador",
    icon: UserPlus,
    endpoint: "generate-pc",
    placeholder: "Ej: 'Elfa druida con pasado oscuro' o 'Enano forjador de runas nivel 5'",
    description: "Genera un PC completo con personalidad, historia, secretos y ganchos de campaña.",
  },
  {
    id: "npc",
    label: "PNJ",
    icon: Users,
    endpoint: "generate-npc",
    placeholder: "Ej: 'Tabernera con conexiones al mercado negro' o 'Sacerdote corrupto de Helm'",
    description: "Crea un PNJ profundo con motivaciones ocultas, traiciones posibles y ganchos de misión.",
  },
  {
    id: "campaign-idea",
    label: "Idea de Campaña",
    icon: Map,
    endpoint: "generate-campaign-idea",
    placeholder: "Ej: 'Campaña política en Waterdeep' o 'Horror cósmico en Undermountain nivel 5-15'",
    description: "Genera una campaña completa con antagonista, facciones, giros y dilemas morales.",
  },
  {
    id: "campaign-structure",
    label: "Estructura de Campaña",
    icon: Castle,
    endpoint: "generate-campaign-structure",
    placeholder: "Ej: 'Estructura completa para una campaña de 3 actos sobre la guerra de dragones'",
    description: "Construye actos, capítulos, misiones detalladas con finales múltiples.",
  },
  {
    id: "mission",
    label: "Misión",
    icon: Swords,
    endpoint: "generate-mission",
    placeholder: "Ej: 'Misión de infiltración en una fortaleza githyanki'",
    description: "Genera una misión standalone con encuentros, NPCs y consecuencias.",
  },
];

const Generators = () => {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState("");

  const generate = useCallback(async (module: GeneratorModule) => {
    setGenerating(true);
    setStreamContent("");

    try {
      const body: Record<string, string | undefined> = {
        customPrompt: customPrompt || undefined,
      };

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${module.endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Error generando contenido");
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

      toast.success("¡Contenido generado!");
      setCustomPrompt("");
    } catch (e: any) {
      toast.error(e.message || "Error generando contenido");
    } finally {
      setGenerating(false);
    }
  }, [customPrompt]);

  const currentModule = MODULES.find((m) => m.id === activeModule);

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
                Módulos Generadores
              </h1>
              <p className="text-sm text-muted-foreground">
                Herramientas de creación narrativa para el DM
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Module selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => {
                  setActiveModule(mod.id);
                  setStreamContent("");
                }}
                className={`ornate-border rounded-lg p-4 text-center transition-all ${
                  isActive
                    ? "border-gold/60 bg-secondary"
                    : "parchment-bg hover:border-gold/30"
                }`}
              >
                <Icon
                  size={24}
                  className={`mx-auto mb-2 ${isActive ? "text-gold" : "text-muted-foreground"}`}
                />
                <span
                  className={`font-display text-xs ${
                    isActive ? "text-gold" : "text-foreground"
                  }`}
                >
                  {mod.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active module */}
        {currentModule ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input */}
            <div className="lg:col-span-1">
              <div className="ornate-border rounded-lg p-5 parchment-bg">
                <div className="flex items-center gap-2 mb-2">
                  <currentModule.icon size={18} className="text-gold" />
                  <h3 className="font-display text-lg text-gold">
                    {currentModule.label}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {currentModule.description}
                </p>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={currentModule.placeholder}
                  rows={4}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold transition-colors resize-none mb-3"
                />
                <button
                  onClick={() => generate(currentModule)}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-2.5 rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {generating ? "Generando..." : "Generar"}
                </button>
              </div>
            </div>

            {/* Output */}
            <div className="lg:col-span-2">
              {streamContent ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="ornate-border rounded-lg p-6 parchment-bg"
                >
                  <div className="prose-fantasy">
                    <ReactMarkdown>{streamContent}</ReactMarkdown>
                  </div>
                </motion.div>
              ) : (
                <div className="ornate-border rounded-lg p-12 parchment-bg text-center">
                  <currentModule.icon
                    className="mx-auto mb-4 text-gold"
                    size={40}
                  />
                  <h3 className="font-display text-xl text-foreground mb-2">
                    {currentModule.label}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Describe lo que necesitas o genera contenido aleatorio
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="ornate-border rounded-lg p-16 parchment-bg text-center">
            <Sparkles className="mx-auto mb-4 text-gold" size={48} />
            <h3 className="font-display text-2xl text-foreground mb-3">
              Elige un Módulo
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Selecciona uno de los generadores para crear personajes, PNJs, ideas
              de campaña, estructuras narrativas o misiones independientes.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Generators;
