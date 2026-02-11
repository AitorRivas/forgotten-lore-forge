import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Scroll, LogOut } from "lucide-react";
import CreateCampaignDialog from "@/components/CreateCampaignDialog";
import ContextPanel from "@/components/ContextPanel";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  level_range: string;
  status: string;
  created_at: string;
}

const Dashboard = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Error cargando campañas");
    } else {
      setCampaigns(data || []);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="font-display text-2xl text-gold text-glow">
            Crónicas de Faerûn
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm">Salir</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            {userId && <ContextPanel userId={userId} />}
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-display text-3xl text-foreground">Tus Campañas</h2>
                <p className="text-muted-foreground mt-1">
                  Gestiona tus aventuras en los Reinos Olvidados
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-primary text-primary-foreground font-display px-5 py-2.5 rounded hover:bg-gold-dark transition-colors"
              >
                <Plus size={18} />
                Nueva Campaña
              </button>
            </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-20">
            <div className="animate-flicker text-gold text-xl">Consultando los archivos...</div>
          </div>
        ) : campaigns.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 ornate-border rounded-lg parchment-bg"
          >
            <Scroll className="mx-auto mb-4 text-gold" size={48} />
            <h3 className="font-display text-xl text-foreground mb-2">
              No hay campañas registradas
            </h3>
            <p className="text-muted-foreground mb-6">
              Comienza tu primera aventura en Faerûn
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-primary text-primary-foreground font-display px-6 py-2.5 rounded hover:bg-gold-dark transition-colors"
            >
              Crear Primera Campaña
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {campaigns.map((campaign, i) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => navigate(`/campaign/${campaign.id}`)}
                className="ornate-border rounded-lg p-5 parchment-bg cursor-pointer group"
              >
                <h3 className="font-display text-lg text-gold group-hover:text-gold-light transition-colors">
                  {campaign.name}
                </h3>
                {campaign.description && (
                  <p className="text-muted-foreground text-sm mt-2 line-clamp-2">
                    {campaign.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                  <span className="bg-secondary px-2 py-1 rounded">
                    Nivel {campaign.level_range}
                  </span>
                  <span className="capitalize">{campaign.status}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
          </div>
        </div>
      </main>

      <CreateCampaignDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchCampaigns}
      />
    </div>
  );
};

export default Dashboard;
