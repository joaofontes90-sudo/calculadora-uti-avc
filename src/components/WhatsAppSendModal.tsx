import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, AlertTriangle, Loader2, Settings, MessageSquare, FileText, Upload, Printer, FileCheck } from 'lucide-react';
import { getWhatsAppSettings, sendMediaToWhatsApp, WhatsAppSettings } from '../lib/whatsapp';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface WhatsAppSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  getHtmlContent: () => string;
  title?: string;
  fileNamePrefix?: string;
  onOpenSettings: () => void;
  onPrintAll?: () => void;
}

export const WhatsAppSendModal: React.FC<WhatsAppSendModalProps> = ({
  isOpen,
  onClose,
  getHtmlContent,
  title = 'Enviar Checklists para o WhatsApp',
  fileNamePrefix = 'Checklists_UTI',
  onOpenSettings,
  onPrintAll
}) => {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [status, setStatus] = useState<'idle' | 'generating_pdf' | 'sending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [customCaption, setCustomCaption] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sendMode, setSendMode] = useState<'attached' | 'auto'>('attached');

  useEffect(() => {
    if (isOpen) {
      const currentSettings = getWhatsAppSettings();
      setSettings(currentSettings);
      setStatus('idle');
      setStatusMessage('');
      setErrorDetails('');
      setAttachedFile(null);
      setSendMode('attached');
      const dateStr = new Date().toLocaleDateString('pt-BR');
      setCustomCaption(`📄 *Checklists Diários de Pacientes - UTI UAVC*\n\n📅 Data: ${dateStr}\n🏥 Relatório de acompanhamento contínuo dos leitos.`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Por favor, selecione um arquivo em formato PDF.');
        return;
      }
      setAttachedFile(file);
      setSendMode('attached');
    }
  };

  const handleStartSend = async () => {
    if (!settings || !settings.apiUrl || !settings.instance || !settings.apiKey || !settings.targetNumber) {
      setStatus('error');
      setStatusMessage('Configurações do WhatsApp incompletas.');
      setErrorDetails('Por favor, cadastre a URL da Evolution API, Instância, API Key e ID do Grupo antes de enviar.');
      return;
    }

    try {
      let pdfBase64DataUri = '';
      const dateSuffix = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const fullFileName = attachedFile ? attachedFile.name : `${fileNamePrefix}_${dateSuffix}.pdf`;

      if (sendMode === 'attached' && attachedFile) {
        // Mode 1: Read attached original PDF file
        setStatus('sending');
        setStatusMessage('Lendo o arquivo PDF anexado...');

        pdfBase64DataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Falha ao ler o arquivo PDF selecionado.'));
          reader.readAsDataURL(attachedFile);
        });
      } else {
        // Mode 2: Auto-generate PDF
        setStatus('generating_pdf');
        setStatusMessage('Gerando documento PDF formatado dos checklists...');

        const rawHtml = getHtmlContent();
        if (!rawHtml) {
          throw new Error('Nenhum conteúdo de checklist disponível para gerar o PDF.');
        }

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '900px';
        iframe.style.height = '1400px';
        iframe.style.border = 'none';
        iframe.style.zIndex = '99999';
        iframe.style.background = '#f8fafc';
        iframe.style.pointerEvents = 'none';
        iframe.style.visibility = 'visible';

        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          throw new Error('Falha ao inicializar o ambiente de renderização do PDF.');
        }

        iframeDoc.open();
        iframeDoc.write(rawHtml);
        iframeDoc.close();

        // Remove print-only bars inside iframe
        const noPrintEls = iframeDoc.querySelectorAll('.no-print, .no-print-bar');
        noPrintEls.forEach((el) => el.remove());

        // Override CSS Grid with floats for html2canvas compatibility
        const overrideStyle = iframeDoc.createElement('style');
        overrideStyle.textContent = `
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          html, body {
            background-color: #f8fafc !important;
            margin: 0 !important;
            padding: 10px !important;
            width: 880px !important;
            font-family: 'Inter', -apple-system, sans-serif !important;
          }

          .page-container {
            max-width: 840px !important;
            width: 840px !important;
            margin: 0 auto 20px auto !important;
            border: 1px solid #cbd5e1 !important;
            padding: 20px !important;
            background: #ffffff !important;
            border-radius: 8px !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .page-container:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Float layout for html2canvas grid rendering */
          .grid {
            display: block !important;
            width: 100% !important;
            clear: both !important;
            margin-bottom: 6px !important;
          }

          .grid::after {
            content: "";
            display: table;
            clear: both;
          }

          .col-12 { width: 100% !important; float: left !important; clear: both !important; }
          .col-6  { width: 49% !important; float: left !important; margin-right: 2% !important; }
          .col-6:nth-child(2n) { margin-right: 0 !important; }
          .col-5  { width: 40% !important; float: left !important; margin-right: 1.5% !important; }
          .col-4  { width: 32% !important; float: left !important; margin-right: 1.33% !important; }
          .col-3  { width: 23.5% !important; float: left !important; margin-right: 1.33% !important; }
          .col-2  { width: 15% !important; float: left !important; margin-right: 1.33% !important; }
          .col-8  { width: 65% !important; float: left !important; margin-right: 1.5% !important; }

          .section-title {
            background-color: #f1f5f9 !important;
            border-left: 4px solid #1e40af !important;
            padding: 5px 8px !important;
            font-weight: 800 !important;
            font-size: 11px !important;
            text-transform: uppercase !important;
            color: #1e3a8a !important;
            margin-top: 12px !important;
            margin-bottom: 8px !important;
            clear: both !important;
          }

          .field {
            background-color: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
            margin-bottom: 4px !important;
          }

          .row-blue { background-color: #eff6ff !important; }
          .row-purple { background-color: #f5f3ff !important; }
          .row-yellow { background-color: #fffbeb !important; }
          .row-green { background-color: #f0fdf4 !important; }
        `;
        iframeDoc.head.appendChild(overrideStyle);

        if (iframeDoc.fonts && iframeDoc.fonts.ready) {
          await iframeDoc.fonts.ready;
        }
        await new Promise((resolve) => setTimeout(resolve, 600));

        const opt = {
          margin: [5, 5, 5, 5],
          filename: fullFileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#f8fafc',
            windowWidth: 880
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        };

        // @ts-ignore
        pdfBase64DataUri = await html2pdf().set(opt).from(iframeDoc.body).outputPdf('datauristring');

        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }

        if (!pdfBase64DataUri || pdfBase64DataUri.length < 5000) {
          throw new Error('O PDF gerado ficou em branco ou inválido. Tente anexar o PDF salvo pela impressão.');
        }
      }

      // Step: Sending via Evolution API
      setStatus('sending');
      setStatusMessage('Conectando à Evolution API e enviando o arquivo PDF para o WhatsApp...');

      const sendResult = await sendMediaToWhatsApp(
        settings,
        pdfBase64DataUri,
        fullFileName,
        customCaption
      );

      if (sendResult.success) {
        setStatus('success');
        setStatusMessage(sendResult.message || 'Checklists enviados com sucesso para o WhatsApp!');
      } else {
        setStatus('error');
        setStatusMessage('Falha ao enviar arquivo para o WhatsApp.');
        setErrorDetails(sendResult.message);
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMessage('Erro durante o envio do PDF.');
      setErrorDetails(err.message || 'Ocorreu um erro inesperado.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-emerald-100" />
            <h2 className="text-base font-black uppercase tracking-wider">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={status === 'generating_pdf' || status === 'sending'}
            className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {!settings || !settings.apiUrl || !settings.instance || !settings.apiKey || !settings.targetNumber ? (
            /* Settings missing notice */
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">Integração WhatsApp não configurada</h3>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Antes de enviar, é necessário cadastrar os dados da sua Evolution API (URL, Instância, API Key e o ID do Grupo de destino).
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 uppercase tracking-wider"
              >
                <Settings size={14} />
                <span>Configurar Evolution API Agora</span>
              </button>
            </div>
          ) : (
            <>
              {/* Ready / Idle state */}
              {status === 'idle' && (
                <div className="space-y-4">
                  {/* Destination summary */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Destino Configurado:</span>
                      <button
                        onClick={onOpenSettings}
                        className="text-emerald-600 hover:text-emerald-700 font-bold text-[10px] flex items-center gap-1 uppercase"
                      >
                        <Settings size={11} />
                        <span>Alterar Dados</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Instância:</span>
                        <strong className="font-mono text-[11px]">{settings.instance}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Grupo/Número:</span>
                        <strong className="font-mono text-[11px] truncate block">{settings.targetNumber}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Option 1: Attach printed PDF (Recommended) */}
                  <div className="p-4 bg-emerald-50/60 border-2 border-emerald-500/30 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                          Opção 1: Anexar PDF Original (100% Fidelidade de Layout)
                        </h3>
                      </div>
                      <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                        Recomendado
                      </span>
                    </div>

                    <p className="text-[11px] text-emerald-900 leading-relaxed">
                      Para enviar o PDF com <strong>exatamente o mesmo layout, cores e formatação</strong> do modo de impressão do navegador:
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {onPrintAll && (
                        <button
                          type="button"
                          onClick={onPrintAll}
                          className="flex-1 py-2 px-3 bg-white hover:bg-emerald-100/50 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-300 transition-all flex items-center justify-center gap-2 shadow-xs"
                        >
                          <Printer size={14} className="text-emerald-600" />
                          <span>1. Abrir e Salvar PDF</span>
                        </button>
                      )}

                      <label className={`flex-1 cursor-pointer py-2 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        attachedFile 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                          : 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-900 border-emerald-400'
                      }`}>
                        <Upload size={14} />
                        <span>{attachedFile ? 'Trocar PDF Anexado' : '2. Anexar PDF Salvo'}</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {attachedFile ? (
                      <div className="p-2.5 bg-white border border-emerald-300 rounded-lg flex items-center justify-between text-xs animate-fadeIn">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-bold text-slate-800 truncate">{attachedFile.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            ({(attachedFile.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setAttachedFile(null);
                            setSendMode('auto');
                          }}
                          className="text-xs text-rose-500 hover:text-rose-700 font-bold ml-2 shrink-0"
                        >
                          Remover
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-emerald-700 italic">
                        💡 Dica: Clique em "1. Abrir e Salvar PDF", no seu navegador selecione "Salvar como PDF", e em seguida anexe-o aqui.
                      </div>
                    )}
                  </div>

                  {/* Option 2: Auto generate */}
                  {!attachedFile && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 uppercase text-[10px]">
                          Opção 2: Gerar PDF Automático
                        </span>
                        <span className="text-[10px] text-slate-500">Sem anexar arquivo</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        O sistema converterá os checklists em PDF automaticamente antes do envio.
                      </p>
                    </div>
                  )}

                  {/* Message Caption */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Legenda / Mensagem do Envio:
                    </label>
                    <textarea
                      rows={3}
                      value={customCaption}
                      onChange={(e) => setCustomCaption(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all custom-scrollbar"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleStartSend}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
                    >
                      <Send size={14} />
                      <span>{attachedFile ? 'Enviar PDF Anexado' : 'Confirmar e Enviar PDF'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Progress states */}
              {(status === 'generating_pdf' || status === 'sending') && (
                <div className="py-8 text-center space-y-4">
                  <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                      {status === 'generating_pdf' ? 'Gerando Documento PDF...' : 'Enviando para o WhatsApp...'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">{statusMessage}</p>
                  </div>
                </div>
              )}

              {/* Success state */}
              {status === 'success' && (
                <div className="py-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 size={36} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-emerald-800">Envio Concluído!</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-sm mx-auto">{statusMessage}</p>
                  </div>

                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={onClose}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/20"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}

              {/* Error state */}
              {status === 'error' && (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                    <div className="flex items-start gap-2.5 text-rose-800">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-rose-900">{statusMessage}</h3>
                        {errorDetails && (
                          <p className="text-xs text-rose-700 mt-1 leading-relaxed font-mono bg-rose-100/60 p-2 rounded-lg border border-rose-200 break-words">
                            {errorDetails}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={onOpenSettings}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-all flex items-center gap-1.5"
                    >
                      <Settings size={13} />
                      <span>Revisar Configurações</span>
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-all"
                      >
                        Fechar
                      </button>
                      <button
                        onClick={handleStartSend}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all"
                      >
                        Tentar Novamente
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

