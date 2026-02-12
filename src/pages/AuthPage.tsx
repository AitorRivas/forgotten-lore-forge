import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Login by nickname: look up email first
        const { data: emailData, error: lookupError } = await supabase.rpc(
          "get_email_by_nickname",
          { p_nickname: nickname }
        );
        if (lookupError || !emailData) {
          throw new Error("Aventurero no encontrado. Verifica tu nick.");
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: emailData as string,
          password,
        });
        if (error) throw error;
        toast.success("¡Bienvenido de vuelta, Dungeon Master!");
        navigate("/dashboard");
      } else {
        // Register: email + password + nickname
        if (!nickname.trim()) {
          throw new Error("El nick es obligatorio");
        }
        // Check nickname availability
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("nickname", nickname.trim())
          .maybeSingle();
        if (existing) {
          throw new Error("Ese nick ya está en uso. Elige otro.");
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;

        // Update profile nickname via edge function (uses service role)
        if (signUpData.user) {
          const updateRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-nickname`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                user_id: signUpData.user.id,
                nickname: nickname.trim(),
              }),
            }
          );

          if (!updateRes.ok) {
            const errorData = await updateRes.json();
            throw new Error("Error guardando nick: " + errorData.error);
          }
        }

        toast.success("¡Cuenta creada! Revisa tu email para verificar tu cuenta.");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="ornate-border rounded-lg p-8 parchment-bg">
          <h1 className="font-display text-3xl text-gold text-center mb-2 text-glow">
            Crónicas de Faerûn
          </h1>
          <p className="text-muted-foreground text-center mb-8 text-lg">
            {isLogin ? "Accede a tu grimorio" : "Inscribe tu nombre en los registros"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-display text-gold-light mb-1.5">
                Nick de Aventurero
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                required
                placeholder={isLogin ? "Tu nick" : "Elige tu nick"}
              />
            </div>
            {!isLogin && (
              <div>
                <label className="block text-sm font-display text-gold-light mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-display text-gold-light mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-display py-3 rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
            >
              {loading ? "Invocando..." : isLogin ? "Entrar" : "Registrarse"}
            </button>
          </form>

          <p className="text-center text-muted-foreground mt-6">
            {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-gold hover:text-gold-light transition-colors underline"
            >
              {isLogin ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
