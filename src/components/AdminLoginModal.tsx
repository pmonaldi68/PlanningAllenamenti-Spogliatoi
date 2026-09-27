import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, X, ShieldCheck } from 'lucide-react';
import { verifyAdminPassword, setAdminAuthenticated } from '../services/adminAuth';

interface AdminLoginModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPassword(password)) {
      setAdminAuthenticated(true);
      setError(false);
      setPassword('');
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-white relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center space-y-3 mb-6">
          <div className="relative w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-cyan-500 via-sky-400 to-blue-600 mx-auto shadow-lg shadow-cyan-500/20 overflow-hidden">
            <img
              src="/cynthia1920_logo.jpg"
              alt="CYNTHIA1920"
              className="w-full h-full object-cover rounded-full bg-slate-900"
              referrerPolicy="no-referrer"
            />
          </div>
          <h3 className="text-xl font-black text-white">Accesso Area Admin CYNTHIA1920</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Inserisci la password per gestire l'assegnazione degli spogliatoi, esportare i PDF ed effettuare la sincronizzazione.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <KeyRound size={13} className="text-amber-400" />
              Password Dirigente / Admin
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                placeholder="Inserisci password..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                className={`w-full bg-slate-800 border rounded-xl pl-3.5 pr-10 py-2.5 text-white text-sm focus:outline-none focus:ring-2 ${
                  error
                    ? 'border-rose-500 focus:ring-rose-500/40 text-rose-200'
                    : 'border-slate-700 focus:ring-amber-500/40'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-rose-400 mt-1.5 font-medium animate-pulse">
                Password errata. Riprova.
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck size={16} />
              Accedi come Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
