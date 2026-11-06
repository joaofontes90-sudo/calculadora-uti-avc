import React, { useState, useEffect, useRef } from 'react';
import { Patient, ArchivedPatient } from '../App';
import { 
  Save, 
  Download, 
  Upload, 
  Folder, 
  Check, 
  AlertCircle, 
  Loader2, 
  LogOut, 
  X, 
  Clock, 
  HardDrive, 
  ShieldCheck, 
  FileText,
  RotateCcw,
  Lock,
  Key
} from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  archivedPatients: ArchivedPatient[];
  onRestoreData: (restoredPatients: Patient[], restoredArchived?: ArchivedPatient[]) => void;
}

interface BackupItem {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  modifiedAt: string;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  patients,
  archivedPatients,
  onRestoreData,
}) => {
  const [backupDir, setBackupDir] = useState<string>('');
  const [backupsList, setBackupsList] = useState<BackupItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isExitScreenActive, setIsExitScreenActive] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchBackups = async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch('/api/backup/listar');
      const data = await res.json();
      if (data.success) {
        setBackupDir(data.backupDir || '');
        setBackupsList(data.backups || []);
      }
    } catch (err) {
      console.error('Erro ao listar backups:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsUnlocked(false);
      setPasswordInput('');
      setPasswordError('');
      setIsExitScreenActive(false);
      setStatusMessage(null);
      fetchBackups();
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

  // Função para salvar o backup localmente e disparar download no navegador
  const handleSaveBackup = async (isExiting = false) => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const payload = {
        patients,
        archivedPatients,
        timestamp: new Date().toISOString()
      };

      // 1. Envia para o servidor local salvar na pasta do computador (C:\Backups_UTI_AVC)
      const res = await fetch('/api/backup/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Falha ao salvar no disco local.');
      }

      // 2. Dispara download de segurança no navegador
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName || `backup_uti_avc_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: `Backup salvo com sucesso na pasta do computador (${data.backupDir}) e arquivo baixado!`
      });

      if (isExiting) {
        setIsExitScreenActive(true);
      } else {
        fetchBackups();
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Erro ao processar backup.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Restaurar a partir de um backup listado no disco
  const handleRestoreFromList = async (fileName: string) => {
    if (!confirm(`Deseja restaurar os dados do backup "${fileName}"? Os leitos atuais serão substituídos pelos dados do arquivo.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/backup/carregar?file=${encodeURIComponent(fileName)}`);
      const result = await res.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Falha ao carregar arquivo de backup.');
      }

      const { patients: restoredPatients, archivedPatients: restoredArchived } = result.data;
      if (!Array.isArray(restoredPatients)) {
        throw new Error('Formato de backup inválido: lista de pacientes não encontrada.');
      }

      onRestoreData(restoredPatients, restoredArchived || []);
      setStatusMessage({
        type: 'success',
        text: `Backup "${fileName}" restaurado com sucesso!`
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Erro ao restaurar backup.'
      });
    }
  };

  // Restaurar a partir de um arquivo .json selecionado pelo usuário
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const restoredPatients = parsed.patients || parsed;
        if (!Array.isArray(restoredPatients)) {
          throw new Error('Arquivo JSON inválido para a Calculadora UTI AVC.');
        }

        if (confirm(`Deseja restaurar os dados do arquivo selecionado (${file.name})?`)) {
          onRestoreData(restoredPatients, parsed.archivedPatients || []);
          setStatusMessage({
            type: 'success',
            text: `Arquivo "${file.name}" importado e restaurado com sucesso!`
          });
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: `Erro ao ler arquivo: ${err?.message || 'Arquivo JSON corrompido ou incompatível.'}`
        });
      }
    };
    reader.readAsText(file);
  };

  // Restaurar a partir de JSON colado (ex.: resgate do Google AI Studio / localStorage)
  const handleRestorePastedJson = () => {
    if (!pastedJson.trim()) {
      setStatusMessage({ type: 'error', text: 'Cole os dados copiados antes de clicar em Importar.' });
      return;
    }
    try {
      let parsed = JSON.parse(pastedJson.trim());
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }

      const restoredPatients = parsed.patients || parsed;
      if (!Array.isArray(restoredPatients)) {
        throw new Error('Formato inválido: não foi encontrada a lista de pacientes.');
      }

      let restoredArchived = parsed.archivedPatients || [];
      if (typeof restoredArchived === 'string') {
        try { restoredArchived = JSON.parse(restoredArchived); } catch { restoredArchived = []; }
      }

      onRestoreData(restoredPatients, Array.isArray(restoredArchived) ? restoredArchived : []);
      setPastedJson('');
      setShowPasteBox(false);
      setStatusMessage({
        type: 'success',
        text: 'Pacientes e checklists importados e salvos no servidor com sucesso!'
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Erro ao importar dados colados: ${err?.message || 'JSON inválido.'}`
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-200">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Central de Backup & Sair</h2>
              <p className="text-[11px] font-bold text-slate-400">Proteção e backup automático dos pacientes e checklists</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-left">
          {!isUnlocked ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 py-2">
              <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5">
                  <Lock size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-blue-950">
                    Acesso Restrito a Backup e Importação
                  </h3>
                  <p className="text-xs text-blue-800/90 leading-relaxed">
                    Informe a senha de administrador para acessar backups, importar dados ou restaurar arquivos.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                  <Key size={13} className="text-blue-600" />
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                {passwordError && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck size={14} />
                  <span>Acessar Backup / Importar</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Status Message */}
              {statusMessage && (
                <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 border ${
                  statusMessage.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : statusMessage.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Se a tela de saída estiver ativa */}
              {isExitScreenActive ? (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <Check size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-emerald-900 uppercase">Backup Concluído com Sucesso!</h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Seus dados foram salvos com segurança na pasta do seu computador:
                </p>
                <code className="block mt-2 p-2 bg-white rounded-lg text-emerald-900 font-mono text-xs border border-emerald-200">
                  {backupDir || 'C:\\Backups_UTI_AVC'}
                </code>
              </div>
              <p className="text-xs font-bold text-slate-500">
                Você já pode fechar esta aba do navegador com total tranquilidade.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-700 transition-all shadow-sm"
                >
                  Continuar Usando o Sistema
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Informações da Pasta Local */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-3">
                <Folder className="text-blue-600 shrink-0 mt-0.5" size={18} />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider block">Pasta de Backup no Disco</span>
                  <p className="text-xs font-mono font-bold text-slate-800 break-all mt-0.5">
                    {backupDir || 'C:\\Backups_UTI_AVC'}
                  </p>
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    Os backups são salvos em formato <code>.json</code> no seu computador, protegidos contra limpeza de histórico do navegador.
                  </p>
                </div>
              </div>

              {/* OPÇÃO 1: Sair do Sistema com ou sem Backup */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Ao fechar / encerrar a sessão:</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSaveBackup(true)}
                    disabled={isSaving}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase shadow-md transition-all active:scale-98 cursor-pointer hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Sair Salvando Backup</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('Deseja fechar sem gerar um novo arquivo de backup no disco?')) {
                        onClose();
                      }
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase shadow-xs transition-all active:scale-98 cursor-pointer"
                  >
                    <LogOut size={16} className="text-slate-500" />
                    <span>Sair sem Salvar</span>
                  </button>
                </div>
              </div>

              {/* OPÇÃO 2: Backup Imediato ou Importação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleSaveBackup(false)}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase shadow-sm transition-all active:scale-98 cursor-pointer hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  <span>Salvar Cópia Agora</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black uppercase shadow-xs transition-all active:scale-98 cursor-pointer"
                >
                  <Upload size={15} />
                  <span>Restaurar de Arquivo...</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".json"
                  className="hidden"
                />
              </div>

              {/* OPÇÃO 2.5: Resgatar Dados do Google AI Studio / Colar JSON do Navegador */}
              <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10.5px] font-black uppercase text-amber-800 tracking-wider block">
                      Resgatar Pacientes do Google AI Studio / Outro Navegador
                    </span>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Importe os pacientes e checklists de dias anteriores salvos no navegador antigo.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPasteBox(!showPasteBox)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10.5px] font-black uppercase transition-all shrink-0 cursor-pointer"
                  >
                    {showPasteBox ? 'Ocultar' : 'Colar Dados'}
                  </button>
                </div>

                {showPasteBox && (
                  <div className="space-y-2.5 pt-2 border-t border-amber-200/70">
                    <div className="bg-white p-2.5 rounded-lg border border-amber-200 text-[11px] text-slate-700 space-y-1.5">
                      <p className="font-bold text-slate-800">Passo a passo rápido no navegador onde está o Google AI Studio:</p>
                      <ol className="list-decimal list-inside space-y-1 text-[10.5px] text-slate-600">
                        <li>Abra o link antigo do <b>Google AI Studio</b> onde estão seus pacientes.</li>
                        <li>Aperte <b>F12</b> (ou clique com botão direito na tela → <b>Inspecionar</b>) e clique na aba <b>Console</b> (ou <b>Aplicativo → Armazenamento Local</b>).</li>
                        <li>No <b>Console</b>, cole o comando abaixo e aperte <b>Enter</b>:</li>
                      </ol>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 p-1.5 bg-slate-900 text-emerald-400 rounded text-[10px] font-mono overflow-x-auto select-all">
                          {`copy(JSON.stringify({patients:JSON.parse(localStorage.getItem('uti_avc_patients')||'[]'),archivedPatients:JSON.parse(localStorage.getItem('uti_avc_archived_patients')||'[]')}))`}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `copy(JSON.stringify({patients:JSON.parse(localStorage.getItem('uti_avc_patients')||'[]'),archivedPatients:JSON.parse(localStorage.getItem('uti_avc_archived_patients')||'[]')}))`
                            );
                            setStatusMessage({ type: 'info', text: 'Comando copiado! Cole no Console (F12) da aba do Google AI Studio e aperte Enter.' });
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px] font-bold shrink-0 cursor-pointer"
                        >
                          Copiar Comando
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={pastedJson}
                      onChange={(e) => setPastedJson(e.target.value)}
                      placeholder='Cole aqui (Ctrl+V) o texto copiado do Google AI Studio...'
                      rows={4}
                      className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleRestorePastedJson}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase shadow-sm transition-all cursor-pointer"
                    >
                      Importar Pacientes e Checklists Agora
                    </button>
                  </div>
                )}
              </div>

              {/* OPÇÃO 3: Lista de Backups Salvos na Pasta */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>Backups Salvos no Computador ({backupsList.length})</span>
                  </span>
                  <button
                    onClick={fetchBackups}
                    className="text-[10.5px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={11} />
                    <span>Atualizar lista</span>
                  </button>
                </div>

                {isLoadingList ? (
                  <div className="p-4 text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin text-blue-600" />
                    <span>Carregando backups da pasta...</span>
                  </div>
                ) : backupsList.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 font-bold border border-dashed border-slate-200">
                    Nenhum backup encontrado na pasta. Salve um novo backup acima!
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {backupsList.slice(0, 8).map((b) => (
                      <div 
                        key={b.fileName}
                        className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/60 transition-all text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <FileText size={15} className="text-blue-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-700 truncate font-mono text-[11px]">{b.fileName}</p>
                            <p className="text-[10px] text-slate-400">
                              {new Date(b.modifiedAt).toLocaleString('pt-BR')} • {(b.sizeBytes / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestoreFromList(b.fileName)}
                          className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-200 hover:border-blue-600 rounded-lg text-[10px] font-black uppercase transition-all shadow-xs shrink-0 cursor-pointer"
                        >
                          Restaurar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
            </>
          )}

        </div>

        {/* Footer */}
        {isUnlocked && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
