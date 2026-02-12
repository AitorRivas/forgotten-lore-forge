import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scroll, Sparkles, Shield, Swords } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative text-center px-6 max-w-3xl"
        >
          <h1 className="font-display text-5xl md:text-7xl text-gold text-glow mb-4 leading-tight">
            Crónicas de Faerûn
          </h1>
          <p className="text-xl md:text-2xl text-foreground/80 mb-3 font-body">
            Motor narrativo para Dungeon Masters
          </p>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Genera misiones, campañas y contenido jugable ambientado en los Reinos Olvidados con inteligencia artificial
          </p>

          <button
            onClick={() => navigate("/auth")}
            className="bg-primary text-primary-foreground font-display text-lg px-10 py-4 rounded hover:bg-gold-dark transition-colors"
          >
            Comenzar Aventura
          </button>
        </motion.div>
      </div>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Scroll,
              title: "Narrativa Estructurada",
              desc: "Misiones con ganchos, NPCs, encuentros y consecuencias listas para mesa",
            },
            {
              icon: Sparkles,
              title: "IA Especializada",
              desc: "Generación basada en lore oficial de Forgotten Realms con continuidad entre sesiones",
            },
            {
              icon: Shield,
              title: "Elementos Diversos",
              desc: "Intriga política, puzzles, dilemas morales, combates y giros narrativos",
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="ornate-border rounded-lg p-6 parchment-bg text-center"
            >
              <feature.icon className="mx-auto mb-4 text-gold" size={32} />
              <h3 className="font-display text-lg text-gold-light mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Swords size={16} className="text-gold" />
          <span className="font-display text-sm">
            Crónicas de Faerûn · D&D 5e · Forgotten Realms
          </span>
        </div>
        <p className="text-muted-foreground/50 text-xs">
          © Creado por diFFFerent
        </p>
      </footer>
    </div>
  );
};

export default Index;
