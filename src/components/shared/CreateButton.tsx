import { Plus } from "lucide-react";

interface CreateButtonProps {
  label: string;
  onClick: () => void;
}

/**
 * Fixed bottom create button — unified pattern across all entity pages.
 */
const CreateButton = ({ label, onClick }: CreateButtonProps) => (
  <button
    onClick={onClick}
    className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-3.5 rounded-lg hover:bg-gold-dark transition-colors shadow-lg z-50 text-base"
  >
    <Plus size={20} /> {label}
  </button>
);

export default CreateButton;
