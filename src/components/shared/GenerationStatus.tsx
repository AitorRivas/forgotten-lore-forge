import { motion } from "framer-motion";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface GenerationStatusProps {
  /** Current state */
  status: "idle" | "generating" | "saving" | "error" | "success";
  /** Entity being generated */
  entityName: string;
  /** Progress 0-100 (optional, for simulated progress) */
  progress?: number;
  /** Show service unavailable panel */
  serviceUnavailable?: boolean;
  /** Retry handler */
  onRetry?: () => void;
  /** Is retrying */
  retrying?: boolean;
  /** Placeholder icon for idle state */
  idleIcon?: React.ElementType;
  /** Idle description */
  idleDescription?: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  generating: "Generando contenido…",
  saving: "Guardando…",
  error: "Se ha producido un error. Intenta de nuevo.",
  success: "Contenido generado con éxito",
};

const GenerationStatus = ({
  status,
  entityName,
  progress,
  serviceUnavailable,
  onRetry,
  retrying,
  idleIcon: IdleIcon,
  idleDescription,
}: GenerationStatusProps) => {
  // Service unavailable panel
  if (serviceUnavailable) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ornate-border rounded-lg p-10 parchment-bg text-center space-y-4">
        <AlertTriangle className="mx-auto text-amber-400" size={40} />
        <h3 className="font-display text-lg text-foreground">Servicio temporalmente no disponible</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          El servicio de generación no está disponible en este momento. Inténtalo en unos minutos.
        </p>
        {onRetry && (
          <button onClick={onRetry} disabled={retrying}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-display rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50">
            {retrying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Reintentar
          </button>
        )}
      </motion.div>
    );
  }

  // Generating state with progress
  if (status === "generating") {
    return (
      <div className="ornate-border rounded-lg p-10 parchment-bg text-center space-y-4">
        <Loader2 size={36} className="mx-auto text-gold animate-spin" />
        <h3 className="font-display text-lg text-gold animate-pulse">
          Generando {entityName}…
        </h3>
        {progress !== undefined && progress > 0 && (
          <div className="max-w-xs mx-auto">
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
        <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos</p>
      </div>
    );
  }

  // Idle state
  if (status === "idle" && IdleIcon) {
    return (
      <div className="ornate-border rounded-lg p-12 parchment-bg text-center">
        <IdleIcon className="mx-auto mb-4 text-gold" size={48} />
        <h3 className="font-display text-xl text-foreground mb-2">{entityName}</h3>
        {idleDescription && (
          <p className="text-muted-foreground text-sm max-w-md mx-auto">{idleDescription}</p>
        )}
      </div>
    );
  }

  return null;
};

export default GenerationStatus;
