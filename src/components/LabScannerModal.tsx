import React, { useEffect, useState, useRef } from 'react';
import { QrCode, Smartphone, Upload, CheckCircle2, AlertTriangle, Loader2, X, Key, Sparkles, RefreshCw } from 'lucide-react';

export interface ExtractedLabData {
  examDate?: string;
  resolvedColumnIndex?: number;
  checklistHb?: string;
  checklistHt?: string;
  checklistPlaquetas?: string;
  checklistLeucograma?: string;
  checklistBastoes?: string;
  checklistSodio?: string;
  checklistPotassio?: string;
  checklistUreia?: string;
  checklistCreatinina?: string;
}

interface LabScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedId: number;
  patientName: string;
  dayIndex: number;
  checklistDate?: string;
  onApplyExtractedLabs: (data: ExtractedLabData) => void;
}

export const LabScannerModal: React.FC<LabScannerModalProps> = ({
  isOpen,
  onClose,
  bedId,
  patientName,
  dayIndex,
  checklistDate,
  onApplyExtractedLabs,
}) => {
  const [sessionId, setSessionId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [hasApiKey, setHasApiKey] = useState(true);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const [status, setStatus] = useState<'loading_qr' | 'waiting' | 'processing' | 'done' | 'error'>('loading_qr');
  const [errorMsg, setErrorMsg] = useState('');
  const [extracted, setExtracted] = useState<ExtractedLabData | null>(null);
  const appliedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initSession = async () => {
    setStatus('loading_qr');
    setErrorMsg('');
    setExtracted(null);
    appliedRef.current = false;

    try {
      const res = await fetch('/api/lab-scanner/criar-sessao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: window.location.origin,
          bedId,
          patientName: patientName || `Leito ${bedId}`,
          dayIndex,
          checklistDate: checklistDate || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao gerar QR Code.');
      }
      setSessionId(data.sessionId);
      setQrDataUrl(data.qrDataUrl);
      setHasApiKey(Boolean(data.hasApiKey));
      if (!data.hasApiKey) {
        setShowKeyConfig(true);
      }
      setStatus('waiting');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Erro ao iniciar sessão de leitura.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      initSession();
    }
  }, [isOpen]);

  // Polling para detectar quando o celular envia a foto e a IA termina de ler
  useEffect(() => {
    if (!isOpen || !sessionId || (status !== 'waiting' && status !== 'processing')) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/lab-scanner/status?session=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (!data.success) return;

        if (data.status === 'processing') {
          setStatus('processing');
        } else if (data.status === 'done' && data.extractedData) {
          setExtracted(data.extractedData);
          setStatus('done');
          if (!appliedRef.current) {
            appliedRef.current = true;
            onApplyExtractedLabs(data.extractedData);
          }
        } else if (data.status === 'error') {
          setStatus('error');
          setErrorMsg(data.error || 'Erro ao processar foto.');
        }
      } catch (e) {}
    }, 1500);

    return () => clearInterval(timer);
  }, [isOpen, sessionId, status]);

  if (!isOpen) return null;

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetch('/api/lab-scanner/salvar-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setHasApiKey(true);
        setShowKeyConfig(false);
        setApiKeyInput('');
      }
    } catch (err) {
      alert('Erro ao salvar chave Gemini.');
    } finally {
      setSavingKey(false);
    }
  };

  const compressFile = (file: File): Promise<{ mimeType: string; base64Data: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
          resolve({ mimeType: 'image/jpeg', base64Data: dataUrl });
        };
        img.onerror = reject;
        img.src = ev.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setStatus('processing');
    setErrorMsg('');

    try {
      const images: { mimeType: string; base64Data: string }[] = [];
      for (const file of Array.from(files)) {
        const compressed = await compressFile(file);
        images.push(compressed);
      }

      const res = await fetch('/api/lab-scanner/processar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          images,
          bedId,
          dayIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao analisar foto.');
      }

      setExtracted(data.extractedData);
      setStatus('done');
      if (!appliedRef.current) {
        appliedRef.current = true;
        onApplyExtractedLabs(data.extractedData);
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Erro ao processar imagem.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const extractedEntries = extracted
    ? [
        ['Data do Exame', extracted.examDate],
        ['Hb', extracted.checklistHb],
        ['Ht', extracted.checklistHt],
        ['Plaquetas', extracted.checklistPlaquetas],
        ['Leucograma', extracted.checklistLeucograma],
        ['Bastões', extracted.checklistBastoes],
        ['Sódio (Na)', extracted.checklistSodio],
        ['Potássio (K)', extracted.checklistPotassio],
        ['Ureia', extracted.checklistUreia],
        ['Creatinina', extracted.checklistCreatinina],
      ].filter(([, val]) => val && String(val).trim() !== '')
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] text-left">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">
                Leitor IA de Exames (QR Code / Foto)
              </h3>
              <p className="text-[11px] text-blue-100 font-bold">
                Leito {bedId} ({patientName || 'Sem nome'})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 transition-colors cursor-pointer"
              title="Configurar Chave da API Google Gemini"
            >
              <Key size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Configuração da Chave Gemini */}
          {(!hasApiKey || showKeyConfig) && (
            <form onSubmit={handleSaveApiKey} className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-amber-900 flex items-center gap-1.5">
                  <Key size={13} className="text-amber-600" />
                  Chave da API Google Gemini (Google AI Studio)
                </span>
                {hasApiKey && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Já configurada
                  </span>
                )}
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Para a Inteligência Artificial ler as fotos dos exames, informe sua chave do Google AI Studio (ela ficará salva permanentemente no seu servidor):
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Cole aqui sua chave AIzaSy..."
                  className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={savingKey}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black uppercase transition-all shrink-0 cursor-pointer"
                >
                  {savingKey ? 'Salvando...' : 'Salvar Chave'}
                </button>
              </div>
            </form>
          )}

          {status === 'loading_qr' && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500 uppercase">Gerando QR Code exclusivo para este leito...</p>
            </div>
          )}

          {status === 'waiting' && (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center space-y-3">
                <div className="flex items-center gap-2 text-blue-700 font-black text-xs uppercase">
                  <Smartphone size={16} />
                  <span>Aponte a câmera do celular para o QR Code</span>
                </div>

                {qrDataUrl && (
                  <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                    <img src={qrDataUrl} alt="QR Code Exames" className="w-56 h-56 object-contain" />
                  </div>
                )}

                <p className="text-[11.5px] text-slate-600 max-w-sm leading-relaxed">
                  1. Escaneie o QR Code com a câmera do celular.<br />
                  2. Fotografe a folha A4 com os exames.<br />
                  3. Serão preenchidos automaticamente <strong>Hb, Ht, Plaquetas, Leucograma, Bastões, Na, K, Ureia e Creatinina</strong> na coluna da data do exame!
                </p>

                <div className="flex items-center gap-2 text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                  <Loader2 size={13} className="animate-spin" />
                  <span>Aguardando envio da foto pelo celular...</span>
                </div>
              </div>

              {/* Opção alternativa: Enviar foto direto pelo PC */}
              <div className="pt-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Upload size={14} />
                  <span>Ou selecionar foto(s) direto deste computador</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLocalFileSelect}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase text-slate-800">
                  Lendo Exames com Inteligência Artificial...
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Extraindo Hemograma (Hb, Ht, Plaquetas, Leucograma, Bastões), Na, K, Ureia, Creatinina e Data do Exame...
                </p>
              </div>
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
            </div>
          )}

          {status === 'done' && extracted && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black uppercase text-emerald-900">
                    Exames Preenchidos Automaticamente!
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Os valores abaixo foram preenchidos na coluna{extracted.examDate ? ` da data ${extracted.examDate}` : ''} (Dia {(extracted.resolvedColumnIndex ?? dayIndex) + 1}).
                  </p>
                </div>
              </div>

              {extractedEntries.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                  {extractedEntries.map(([label, val]) => (
                    <div
                      key={label}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <span className="text-[9.5px] font-black uppercase text-slate-400 block">{label}</span>
                      <span className="text-xs font-black text-slate-800">{val}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">
                  Nenhum valor numérico de exame foi identificado na imagem enviada.
                </p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={initSession}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Ler Outra Folha</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase shadow-md cursor-pointer"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black uppercase text-rose-900">Erro ao Processar Exames</h4>
                  <p className="text-xs text-rose-700 mt-1">{errorMsg}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={initSession}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase cursor-pointer"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
