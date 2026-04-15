import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Mail, Loader2 } from 'lucide-react';
import { login } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';

export function LoginScreen() {
  const [email, setEmail] = useState('admin@fatboy.com');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Por favor ingrese correo y contraseña');
      return;
    }

    setIsLoading(true);
    try {
      // Send email instead of username to match NestJS LoginDto
      const response = await login({ email, password });
      setAuth(
        {
          ...response.user,
          id: String(response.user.id),
        },
        response.access_token,
      );
      toast.success(`Bienvenido, ${response.user.name}`);
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-surface flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center overflow-hidden obsidian-card px-8 pt-5 pb-8"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/10 via-primary to-primary/10"></div>
        
        <div className="mb-1 flex h-44 w-44 items-center justify-center">
          <img
            src="/icono.png"
            alt="Fatboy POS"
            className="h-full w-full object-contain drop-shadow-[0_0_24px_rgba(255,215,0,0.3)]"
          />
        </div>
        
        <h1 className="mb-0.5 font-headline text-2xl font-black uppercase tracking-tighter text-white">
          FATBOY POS
        </h1>
        <p className="obsidian-label mb-6">Acceso al Sistema • Terminal 01</p>
        
        <form onSubmit={handleLogin} className="w-full space-y-5">
          <div className="space-y-1.5">
            <label className="obsidian-label text-[9px]">Correo Electrónico / Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-outline group-focus-within:text-primary transition-colors" />
              </div>
              <input 
                type="email" 
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-none text-white font-headline px-10 py-3 focus:outline-none focus:border-primary focus:bg-surface-container-high transition-all lowercase tracking-wide placeholder:text-outline-variant/50 placeholder:normal-case placeholder:tracking-normal"
                placeholder="Ej. admin@fatboy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="obsidian-label text-[9px]">Contraseña / PIN</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-outline group-focus-within:text-primary transition-colors" />
              </div>
              <input 
                type="password" 
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-none text-white font-headline px-10 py-3 focus:outline-none focus:border-primary focus:bg-surface-container-high transition-all tracking-[0.3em] font-black"
                placeholder="••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>
          
          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full obsidian-btn-primary !py-3.5 text-xs flex justify-center items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Iniciar Sesión
                  <Lock className="w-3.5 h-3.5 group-hover:block hidden" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
      
      <p className="fixed bottom-6 text-outline-variant text-[8px] font-bold uppercase tracking-widest">
        Fatboy OS v2.1.0 • Terminal Segura
      </p>
    </div>
  );
}
