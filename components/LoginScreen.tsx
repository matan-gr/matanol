
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GcpCredentials } from '../types';
import { APP_NAME, APP_VERSION } from '../constants';
import { Button, Input } from './DesignSystem';
import { 
  Tags, ArrowRight, Key, Cloud, Lock, 
  Activity, CheckCircle2, Zap
} from 'lucide-react';

interface LoginScreenProps {
  onConnect: (creds: GcpCredentials) => Promise<void>;
  isConnecting: boolean;
  loadingStatus?: { progress: number, message: string };
  onDemo: () => void;
}

const ConnectionStep = ({ label, active, completed }: { label: string, active: boolean, completed: boolean }) => (
    <div className={`flex items-center gap-3 text-xs font-mono transition-colors duration-300 ${active ? 'text-indigo-400' : completed ? 'text-emerald-500' : 'text-slate-500'}`}>
        <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${active ? 'border-indigo-500 animate-pulse' : completed ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-800'}`}>
            {completed && <CheckCircle2 className="w-3 h-3" />}
            {active && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />}
        </div>
        <span>{label}</span>
    </div>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({ onConnect, isConnecting, loadingStatus, onDemo }) => {
  const [projectId, setProjectId] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectId && token) {
      onConnect({ projectId, accessToken: token });
    }
  };

  const progress = loadingStatus?.progress || 0;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-white font-sans overflow-hidden relative">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px]"></div>
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-125"></div>
      </div>

      <div className="w-full max-w-md p-6 relative z-10">
         
         <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0B1120] border border-slate-800/60 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
         >
            {/* Header */}
            <div className="p-8 text-center border-b border-slate-800/60 bg-gradient-to-b from-indigo-950/10 to-transparent">
               <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-lg shadow-indigo-500/20 transform rotate-3 relative group">
                  <Tags className="w-10 h-10 text-white" />
                  <div className="absolute -top-3 -right-3 bg-amber-400 rounded-full p-1.5 border-4 border-[#0B1120] shadow-sm animate-in zoom-in duration-500">
                     <Zap className="w-5 h-5 text-amber-900 fill-amber-900" />
                  </div>
               </div>
               <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
                  {APP_NAME}
               </h1>
               <p className="text-sm text-slate-400 font-medium">Lightning Fast Governance</p>
            </div>

            {/* Content Area */}
            <div className="p-8 bg-slate-900/50">
               <AnimatePresence mode="wait">
                  {isConnecting ? (
                     <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-6"
                     >
                        <div className="text-center mb-6">
                           <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-full mb-3">
                              <Activity className="w-6 h-6 text-indigo-400 animate-pulse" />
                           </div>
                           <h3 className="text-lg font-bold text-white">Connecting...</h3>
                           <p className="text-xs text-slate-500 font-mono mt-1 truncate">{loadingStatus?.message}</p>
                        </div>

                        <div className="space-y-4 px-4">
                           <ConnectionStep label="Validate OAuth Token" active={progress < 20} completed={progress >= 20} />
                           <ConnectionStep label="Verify IAM Permissions" active={progress >= 20 && progress < 40} completed={progress >= 40} />
                           <ConnectionStep label="Connect Resource Manager" active={progress >= 40 && progress < 70} completed={progress >= 70} />
                           <ConnectionStep label="Hydrate Governance Policy" active={progress >= 70 && progress < 100} completed={progress >= 100} />
                        </div>
                     </motion.div>
                  ) : (
                     <motion.form 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-5"
                        onSubmit={handleSubmit}
                        autoComplete="off"
                     >
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Workspace ID</label>
                           <Input 
                              value={projectId}
                              onChange={(e) => setProjectId(e.target.value)}
                              placeholder="gcp-project-id"
                              required
                              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-11 text-sm font-mono focus:border-indigo-500 focus:ring-indigo-500/20"
                              icon={<Cloud className="w-4 h-4 text-slate-500" />}
                              autoComplete="off"
                              name="project_id_field_no_fill"
                           />
                        </div>
                        
                        <div className="space-y-2">
                           <div className="flex justify-between items-center ml-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Access Token</label>
                              <a 
                                 href="https://developers.google.com/oauthplayground" 
                                 target="_blank" 
                                 rel="noreferrer"
                                 className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                              >
                                 Get Token <ArrowRight className="w-2.5 h-2.5" />
                              </a>
                           </div>
                           <Input 
                              type="password"
                              value={token}
                              onChange={(e) => setToken(e.target.value)}
                              placeholder="oauth2-token"
                              required
                              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-11 text-sm font-mono focus:border-indigo-500 focus:ring-indigo-500/20"
                              icon={<Key className="w-4 h-4 text-slate-500" />}
                              autoComplete="new-password"
                              data-lpignore="true"
                           />
                        </div>

                        <div className="pt-2">
                           <Button 
                              type="submit" 
                              className="w-full h-11 font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
                              rightIcon={<ArrowRight className="w-4 h-4" />}
                           >
                              Secure Connect
                           </Button>
                        </div>
                     </motion.form>
                  )}
               </AnimatePresence>
            </div>

            {/* Footer Actions */}
            {!isConnecting && (
               <div className="px-8 py-4 bg-[#080c17] border-t border-slate-800/60 flex justify-center">
                  <button 
                     type="button"
                     onClick={onDemo}
                     className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                     <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-emerald-500 transition-colors"></span>
                     Initialize Demo Environment
                  </button>
               </div>
            )}
         </motion.div>

         <div className="mt-6 text-center">
            <div className="flex justify-center gap-4 text-slate-600 mb-2">
               <div className="flex items-center gap-1.5 text-[10px] font-mono border border-slate-800 rounded px-2 py-1">
                  <Lock className="w-3 h-3" /> E2E Encrypted
               </div>
               <div className="flex items-center gap-1.5 text-[10px] font-mono border border-slate-800 rounded px-2 py-1">
                  v{APP_VERSION}
               </div>
            </div>
         </div>

      </div>
    </div>
  );
};
