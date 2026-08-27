import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, AlertTriangle, Key, Link as LinkIcon, Server, MessageSquare, Eye, EyeOff, Info, Lock, ShieldCheck } from 'lucide-react';
import { getWhatsAppSettings, saveWhatsAppSettings, sendTextMessageToWhatsApp, WhatsAppSettings } from '../lib/whatsapp';

interface WhatsAppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const WhatsAppSettingsModal: React.FC<WhatsAppSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [apiUrl, setApiUrl] = useState('');
  const [instance, setInstance] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [targetNumber, setTargetNumber] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsUnlocked(false);
      setPasswordInput('');
      setPasswordError('');
      const saved = getWhatsAppSettings();
      if (saved) {
        setApiUrl(saved.apiUrl || '');
        setInstance(saved.instance || '');
        setApiKey(saved.apiKey || '');
        setTargetNumber(saved.targetNumber || '');
      } else {
        // Defaults suggested
        setApiUrl('https://evolution.clinicavelus.com.br');
      }
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === 'k5l6je') {
      setIsUnlocked(true);
      setPasswordError('');
    } else {
      setPasswordError('Senha incorreta. Tente novamente.');
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiUrl.trim() || !instance.trim() || !apiKey.trim() || !targetNumber.trim()) {
      setTestResult({
        success: false,
        message: 'Por favor, preencha todos os campos obrigatórios (URL, Instância, API Key e ID do Grupo/Número).'
      });
      return;
    }

    const newSettings: WhatsAppSettings = {
      apiUrl: apiUrl.trim(),
      instance: instance.trim(),
      apiKey: apiKey.trim(),
      targetNumber: targetNumber.trim()
    };

    saveWhatsAppSettings(newSettings);
    setTestResult({
      success: true,
      message: 'Configurações do WhatsApp salvas com sucesso!'
    });

    if (onSaved) onSaved();
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleTestConnection = async () => {
    if (!apiUrl.trim() || !instance.trim() || !apiKey.trim() || !targetNumber.trim()) {
      setTestResult({
        success: false,
        message: 'Preencha todos os campos antes de testar a conexão.'
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const tempSettings: WhatsAppSettings = {
      apiUrl: apiUrl.trim(),
      instance: instance.trim(),
      apiKey: apiKey.trim(),
      targetNumber: targetNumber.trim()
    };

    const res = await sendTextMessageToWhatsApp(
      tempSettings,
      '🧪 *Teste de Conexão - UTI UAVC*\n\nA integração do App Calculadora UTI com a sua Evolution API está funcionando perfeitamente! 🚀'
    );

    setTesting(false);
    setTestResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-md">
              <MessageSquare className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider">Configuração WhatsApp (Evolution API)</h2>
              <p className="text-[11px] text-emerald-100/90 font-medium">Envio direto de PDFs e Checklists para o seu grupo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-700 custom-scrollbar">
          {!isUnlocked ? (
            /* Password Challenge Screen */
            <form onSubmit={handlePasswordSubmit} className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
                  <Lock size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                    Acesso Restrito a Configurações
                  </h3>
                  <p className="text-xs text-emerald-800/90 leading-relaxed">
                    Informe a senha de administrador para acessar e alterar as chaves de API do WhatsApp.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                  <Key size={13} className="text-emerald-600" />
                  Senha de Acesso *
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Digite a senha..."
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                {passwordError && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1.5 flex items-center gap-1 animate-fadeIn">
                    <AlertTriangle size={12} />
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                >
                  <ShieldCheck size={14} />
                  <span>Acessar Configurações</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-bold flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <span>{testResult.message}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
            {/* API URL */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                <LinkIcon size={13} className="text-emerald-600" />
                URL da Evolution API *
              </label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://evolution.clinicavelus.com.br"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">Endereço base do seu servidor Evolution API (sem barra no final).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Instance Name */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                  <Server size={13} className="text-emerald-600" />
                  Nome da Instância *
                </label>
                <input
                  type="text"
                  value={instance}
                  onChange={(e) => setInstance(e.target.value)}
                  placeholder="instancia_uti"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <p className="text-[10px] text-slate-400 mt-1">Nome exato da instância conectada no WhatsApp.</p>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                  <Key size={13} className="text-emerald-600" />
                  API Key / Token Global *
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Sua Global API Key ou Token"
                    required
                    className="w-full px-3.5 py-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Chave de autenticação (apikey) configurada na Evolution.</p>
              </div>
            </div>

            {/* Target Group ID / Number */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                <MessageSquare size={13} className="text-emerald-600" />
                ID do Grupo do WhatsApp ou Número *
              </label>
              <input
                type="text"
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value)}
                placeholder="12036301234567890@g.us ou 5511999999999"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 space-y-1 mt-2">
                <div className="flex items-center gap-1 font-bold text-amber-900">
                  <Info size={13} />
                  <span>Como obter o ID do Grupo no WhatsApp:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                  <li>Grupos do WhatsApp possuem formato terminando em <strong>@g.us</strong> (ex: <code className="bg-amber-100 px-1 rounded">12036301234567890@g.us</code>).</li>
                  <li>Você pode encontrar o JID/ID do grupo no painel da Evolution API na aba <em>Groups / Fetch Groups</em> ou ao receber uma mensagem do grupo.</li>
                  <li>Para enviar para um número individual, use com DDI e DDD (ex: <code className="bg-amber-100 px-1 rounded">5511999999999</code>).</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send size={13} className={testing ? 'animate-bounce' : ''} />
                <span>{testing ? 'Testando...' : 'Testar Envio'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20"
                >
                  Salvar
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
      </div>
    </div>
  );
};
