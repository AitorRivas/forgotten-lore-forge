import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Scroll } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center ornate-border rounded-lg p-12 parchment-bg max-w-md">
        <Scroll className="mx-auto mb-4 text-gold" size={48} />
        <h1 className="font-display text-4xl text-gold text-glow mb-2">404</h1>
        <p className="text-foreground mb-1 font-display text-lg">Pergamino no encontrado</p>
        <p className="text-muted-foreground text-sm mb-6">Esta ruta no existe en los Reinos Olvidados</p>
        <button onClick={() => navigate("/")}
          className="bg-primary text-primary-foreground font-display px-6 py-3 rounded-lg hover:bg-gold-dark transition-colors">
          Volver al Inicio
        </button>
      </div>
    </div>
  );
};

export default NotFound;
