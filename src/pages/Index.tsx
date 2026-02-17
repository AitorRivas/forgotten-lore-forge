import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scroll, Sparkles, Shield, Swords, Users, Theater, BookOpen, Gem } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const ACTIONS = [
  { label: "Crear Misión", icon: Scroll, path: "/dashboard", desc: "Narrativa estructurada con submisiones y encuentros" },
  { label: "Crear Escena", icon: Theater, path: "/scene-generator", desc: "Eventos cerrados para improvisación inmediata" },
  { label: "Generar Encuentro", icon: Swords, path: "/encounter-generator", desc: "Encuentros balanceados con estrategia de DM" },
  { label: "Generar PNJ", icon: Users, path: "/npc-generator", desc: "Personajes completos con ficha 5e" },
  { label: "Objeto Mágico", icon: Gem, path: "/magic-item-generator", desc: "Objetos mágicos y artefactos con lore" },
  { label: "Biblioteca", icon: BookOpen, path: "/library", desc: "Consulta y edita todo tu contenido guardado" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative text-center px-6 max-w-2xl"
        >
          <h1 className="font-display text-4xl md:text-6xl text-gold text-glow mb-3 leading-tight">
            Crónicas de Faerûn
          </h1>
          <p className="text-lg md:text-xl text-foreground/80 mb-2 font-body">
            Generador Integral para D&D 5e
          </p>
          <p className="text-muted-foreground text-sm md:text-base mb-8 max-w-lg mx-auto">
            Misiones estructuradas · Escenas improvisadas · Encuentros balanceados · PNJ completos — todo basado en Reinos Olvidados
          </p>
        </motion.div>
      </div>

      {/* Action buttons - mobile first vertical layout */}
      <section className="max-w-lg mx-auto px-4 -mt-8 relative z-10 pb-10">
        <div className="space-y-3">
          {ACTIONS.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              onClick={() => navigate(action.path)}
              className="w-full ornate-border rounded-lg parchment-bg p-4 flex items-center gap-4 text-left hover:border-gold/60 transition-all active:scale-[0.98]"
            >
              <div className="shrink-0 w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                <action.icon size={22} className="text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-display text-base text-gold block">{action.label}</span>
                <span className="text-xs text-muted-foreground">{action.desc}</span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Login CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-8 text-center"
        >
          <button
            onClick={() => navigate("/auth")}
            className="bg-primary text-primary-foreground font-display text-base px-8 py-3.5 rounded-lg hover:bg-gold-dark transition-colors w-full"
          >
            Comenzar Aventura
          </button>
          <p className="text-muted-foreground/60 text-xs mt-3">
            Inicia sesión o regístrate para guardar contenido
          </p>
        </motion.div>
      </section>

      {/* Features row */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Sparkles, title: "IA Especializada", desc: "Genera contenido coherente con lore oficial de Forgotten Realms" },
            { icon: Shield, title: "5e Real", desc: "Fichas con estadísticas, CR, acciones y estrategia de combate" },
            { icon: Scroll, title: "Todo Guardado", desc: "Biblioteca personal editable, filtrable y optimizada para móvil" },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="ornate-border rounded-lg p-5 parchment-bg text-center"
            >
              <f.icon className="mx-auto mb-3 text-gold" size={28} />
              <h3 className="font-display text-sm text-gold-light mb-1">{f.title}</h3>
              <p className="text-muted-foreground text-xs">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center space-y-1">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Swords size={14} className="text-gold" />
          <span className="font-display text-xs">Crónicas de Faerûn · D&D 5e · Reinos Olvidados</span>
        </div>
        <p className="text-muted-foreground/50 text-[10px]">© Creado por diFFFerent</p>
      </footer>
    </div>
  );
};

export default Index;
