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
  RotateCcw
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
      setIsExitScreenActive(false);
      setStatusMessage(null);
      fetchBackups();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
