export interface WhatsAppSettings {
  apiUrl: string;
  instance: string;
  apiKey: string;
  targetNumber: string;
  captionPrefix?: string;
}

const SETTINGS_KEY = 'uti_whatsapp_settings';

export function getWhatsAppSettings(): WhatsAppSettings | null {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveWhatsAppSettings(settings: WhatsAppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface SendMediaResponse {
  success: boolean;
  message: string;
  rawResponse?: any;
}

export async function sendMediaToWhatsApp(
  settings: WhatsAppSettings,
  pdfBase64: string,
  fileName: string,
  caption: string
): Promise<SendMediaResponse> {
  const cleanUrl = settings.apiUrl.replace(/\/+$/, '');
  const cleanInstance = settings.instance.trim();
  const endpoint = `${cleanUrl}/message/sendMedia/${cleanInstance}`;

  let cleanNumber = settings.targetNumber.trim();
  if (!cleanNumber.includes('@')) {
    cleanNumber = cleanNumber.replace(/\D/g, '');
  }

  // Extract pure base64 string safely
  let pureBase64 = pdfBase64;
  if (pdfBase64.includes('base64,')) {
    pureBase64 = pdfBase64.split('base64,').pop() || '';
  }
  pureBase64 = pureBase64.trim();

  // Create clean data URI header (without extra filename parameters that break regex validation)
  const cleanDataUri = `data:application/pdf;base64,${pureBase64}`;

  // Strict payload following Evolution API v2 SendMediaDto (no forbidden extra properties)
  const primaryPayload = {
    number: cleanNumber,
    mediatype: 'document',
    mimetype: 'application/pdf',
    caption: caption,
    media: cleanDataUri,
    fileName: fileName
  };

  try {
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.apiKey.trim()
      },
      body: JSON.stringify(primaryPayload)
    });

    let resData = await response.json().catch(() => ({}));

    // Fallback: If 400 error occurs with data URI, try pure base64
    if (!response.ok && response.status === 400) {
      const fallbackPayload = {
        number: cleanNumber,
        mediatype: 'document',
        mimetype: 'application/pdf',
        caption: caption,
        media: pureBase64,
        fileName: fileName
      };

      const fallbackResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.apiKey.trim()
        },
        body: JSON.stringify(fallbackPayload)
      });

      const fallbackData = await fallbackResponse.json().catch(() => ({}));
      if (fallbackResponse.ok) {
        return {
          success: true,
          message: 'Mensagem e arquivo PDF enviados com sucesso para o WhatsApp!',
          rawResponse: fallbackData
        };
      } else {
        // Use details from the most informative error response
        resData = fallbackData.message ? fallbackData : resData;
      }
    }

    if (!response.ok) {
      let errMsg = resData.message || resData.error || resData.response?.message;
      if (!errMsg && Array.isArray(resData?.response?.message)) {
        errMsg = resData.response.message.join(', ');
      }
      if (!errMsg) {
        errMsg = `HTTP ${response.status}: ${response.statusText}`;
      }
      const detailStr = Array.isArray(errMsg) ? errMsg.join(', ') : (typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg));

      return {
        success: false,
        message: `Erro na Evolution API (${response.status}): ${detailStr}`,
        rawResponse: resData
      };
    }

    return {
      success: true,
      message: 'Mensagem e arquivo PDF enviados com sucesso para o WhatsApp!',
      rawResponse: resData
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Erro de conexão com a Evolution API: ${error.message || 'Verifique a URL da API e a conexão.'}`
    };
  }
}

export async function sendTextMessageToWhatsApp(
  settings: WhatsAppSettings,
  text: string
): Promise<SendMediaResponse> {
  const cleanUrl = settings.apiUrl.replace(/\/+$/, '');
  const cleanInstance = settings.instance.trim();
  const endpoint = `${cleanUrl}/message/sendText/${cleanInstance}`;

  let cleanNumber = settings.targetNumber.trim();
  if (!cleanNumber.includes('@')) {
    cleanNumber = cleanNumber.replace(/\D/g, '');
  }

  const payload = {
    number: cleanNumber,
    text: text
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.apiKey.trim()
      },
      body: JSON.stringify(payload)
    });

    const resData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = resData.message || resData.error || resData.response?.message || `HTTP ${response.status}: ${response.statusText}`;
      const detailStr = Array.isArray(errMsg) ? errMsg.join(', ') : (typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg));
      return {
        success: false,
        message: `Erro ao enviar teste (${response.status}): ${detailStr}`,
        rawResponse: resData
      };
    }

    return {
      success: true,
      message: 'Mensagem de teste enviada com sucesso!',
      rawResponse: resData
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Erro de conexão: ${error.message || 'Verifique a URL da API e a conexão.'}`
    };
  }
}
