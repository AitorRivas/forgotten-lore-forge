import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, LogOut } from "lucide-react";

interface Breadcrumb {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  breadcrumbs?: Breadcrumb[];
  backPath?: string;
  showLogout?: boolean;
  rightContent?: React.ReactNode;
}

const PageHeader = ({ title, subtitle, icon: Icon, breadcrumbs, backPath, showLogout, rightContent }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="border-b border-border px-4 py-3 sticky top-0 bg-background/95 backdrop-blur-sm z-40">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 overflow-x-auto">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5 shrink-0">
                {i > 0 && <ChevronRight size={12} />}
                {crumb.path ? (
                  <button onClick={() => navigate(crumb.path!)} className="hover:text-gold truncate max-w-[120px]">
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-foreground truncate">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Title row */}
        <div className="flex items-center gap-3">
          {backPath && (
            <button onClick={() => navigate(backPath)} className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg sm:text-2xl text-gold text-glow flex items-center gap-2 truncate">
              {Icon && <Icon size={20} className="shrink-0" />}
              {title}
            </h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {rightContent}
          {showLogout && (
            <button
              onClick={async () => {
                const { supabase } = await import("@/integrations/supabase/client");
                await supabase.auth.signOut();
                navigate("/auth");
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 shrink-0"
              title="Salir"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
