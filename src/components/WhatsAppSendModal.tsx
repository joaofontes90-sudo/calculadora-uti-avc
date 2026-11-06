import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, AlertTriangle, Loader2, Settings, MessageSquare, FileText, ExternalLink, Copy, Check } from 'lucide-react';
import { getWhatsAppSettings, sendTextMessageToWhatsApp, WhatsAppSettings } from '../lib/whatsapp';

interface WhatsAppSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  getHtmlContent: () => string | null;
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
}) => {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [status, setStatus] = useState<'idle' | 'generating_pdf' | 'sending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [customCaption, setCustomCaption] = useState('');
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentSettings = getWhatsAppSettings();
      setSettings(currentSettings);
      setStatus('idle');
      setStatusMessage('');
      setErrorDetails('');
      setGeneratedPdfUrl('');
      setCopiedLink(false);
      const dateStr = new Date().toLocaleDateString('pt-BR');
      setCustomCaption(`📄 *Checklists Diários de Pacientes - UTI UAVC*\n📅 Data: ${dateStr}\n🏥 Relatório de acompanhamento contínuo dos leitos.`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartSend = async () => {
    if (!settings || !settings.apiUrl || !settings.instance || !settings.apiKey || !settings.targetNumber) {
      setStatus('error');
      setStatusMessage('Configurações do WhatsApp incompletas.');
      setErrorDetails('Por favor, cadastre a URL da Evolution API, Instância, API Key e ID do Grupo antes de enviar.');
      return;
    }

    try {
      setStatus('generating_pdf');
      setStatusMessage('Gerando o PDF dos checklists no servidor (idêntico ao Imprimir Todos)...');

      const rawHtml = getHtmlContent();
      if (!rawHtml) {
        throw new Error('Nenhum conteúdo de checklist disponível para gerar o PDF.');
      }

      const pdfRes = await fetch('/api/pdf/gerar-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent: rawHtml,
          fileNamePrefix,
        }),
      });

      const pdfData = await pdfRes.json();
      if (!pdfRes.ok || !pdfData?.success || !pdfData?.relativeUrl) {
        throw new Error(pdfData?.error || 'Falha ao gerar o PDF no servidor.');
      }

      const fullPdfUrl = `${window.location.origin}${pdfData.relativeUrl}`;
      setGeneratedPdfUrl(fullPdfUrl);

      setStatus('sending');
      setStatusMessage('Enviando mensagem com o link do PDF para o WhatsApp...');

      const textMessage = `${customCaption.trim()}\n\n🔗 *Acesse o PDF completo dos Checklists aqui:*\n${fullPdfUrl}`;

      const sendResult = await sendTextMessageToWhatsApp(settings, textMessage);

      if (sendResult.success) {
        setStatus('success');
        setStatusMessage('O PDF foi gerado no seu servidor e o link foi enviado com sucesso para o WhatsApp!');
      } else {
        setStatus('error');
        setStatusMessage('O PDF foi gerado no servidor, mas houve falha ao enviar o link para o WhatsApp.');
        setErrorDetails(sendResult.message);
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMessage('Erro durante a geração ou envio do link do PDF.');
      setErrorDetails(err.message || 'Ocorreu um erro inesperado.');
    }
  };

  const handleCopyLink = () => {
    if (!generatedPdfUrl) return;
    navigator.clipboard.writeText(generatedPdfUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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

                  {/* Info Box: How it works */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-900">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <h3 className="text-xs font-black uppercase tracking-wider">
                        Geração de PDF Hospedado + Envio de Link
                      </h3>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Ao confirmar, o servidor gerará automaticamente o PDF completo dos checklists do dia (exatamente igual ao <strong>Imprimir Todos</strong>), deixará o arquivo hospedado no seu servidor e enviará <strong>apenas o link em texto</strong> para o WhatsApp configurado.
                    </p>
                  </div>

                  {/* Message Caption */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Mensagem do Envio (o link do PDF será adicionado automaticamente abaixo):
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
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
                    >
                      <Send size={14} />
                      <span>Gerar PDF e Enviar Link no WhatsApp</span>
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
                      {status === 'generating_pdf' ? 'Gerando PDF no Servidor...' : 'Enviando Link para o WhatsApp...'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">{statusMessage}</p>
                  </div>
                </div>
              )}

              {/* Success state */}
              {status === 'success' && (
                <div className="py-4 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-emerald-800">Link Enviado com Sucesso!</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-sm mx-auto">{statusMessage}</p>
                  </div>

                  {generatedPdfUrl && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Link Público do PDF Gerado:</span>
                      <p className="text-[11px] font-mono text-emerald-700 break-all bg-white p-2 rounded-lg border border-slate-200">
                        {generatedPdfUrl}
                      </p>
                      <div className="flex gap-2">
                        <a
                          href={generatedPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <ExternalLink size={13} />
                          <span>Abrir PDF</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
                        </button>
                      </div>
                    </div>
                  )}

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

                  {generatedPdfUrl && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-500 block">
                        O PDF já foi gerado! Você também pode copiar o link manualmente:
                      </span>
                      <p className="text-[11px] font-mono text-emerald-700 break-all bg-white p-2 rounded-lg border border-slate-200">
                        {generatedPdfUrl}
                      </p>
                      <div className="flex gap-2">
                        <a
                          href={generatedPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <ExternalLink size={13} />
                          <span>Abrir PDF</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
                        </button>
                      </div>
                    </div>
                  )}

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
