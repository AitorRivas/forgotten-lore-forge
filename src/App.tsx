import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import MissionsDashboard from "./pages/MissionsDashboard";
import MissionDetail from "./pages/MissionDetail";
import Generators from "./pages/Generators";
import EncounterGenerator from "./pages/EncounterGenerator";
import SceneGenerator from "./pages/SceneGenerator";
import NpcGenerator from "./pages/NpcGenerator";
import MagicItemGenerator from "./pages/MagicItemGenerator";
import Library from "./pages/Library";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-flicker text-gold text-xl font-display">Cargando...</div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/auth" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><MissionsDashboard /></ProtectedRoute>} />
          <Route path="/mission/:id" element={<ProtectedRoute><MissionDetail /></ProtectedRoute>} />
          <Route path="/generators" element={<ProtectedRoute><Generators /></ProtectedRoute>} />
          <Route path="/encounter-generator" element={<ProtectedRoute><EncounterGenerator /></ProtectedRoute>} />
          <Route path="/scene-generator" element={<ProtectedRoute><SceneGenerator /></ProtectedRoute>} />
          <Route path="/npc-generator" element={<ProtectedRoute><NpcGenerator /></ProtectedRoute>} />
          <Route path="/magic-item-generator" element={<ProtectedRoute><MagicItemGenerator /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
