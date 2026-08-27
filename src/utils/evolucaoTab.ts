import { Patient, DailyChecklist } from '../App';

const getTodayFormatted = () => {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const getLatestFilledChecklist = (p: Patient): DailyChecklist => {
  if (p.dailyChecklists && Array.isArray(p.dailyChecklists)) {
    const firstEmptyIndex = p.dailyChecklists.findIndex(c => !c.checklistData);
    if (firstEmptyIndex > 0) {
      return p.dailyChecklists[firstEmptyIndex - 1];
    } else if (firstEmptyIndex === 0) {
      const filled = p.dailyChecklists.find(c => c.checklistData);
      if (filled) return filled;
    } else {
      return p.dailyChecklists[p.dailyChecklists.length - 1];
    }
  }
  return p as DailyChecklist;
};

export const openEvolucaoTab = (patient: Patient) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para este site para gerar o documento.');
    return;
  }

  const latestChecklist = getLatestFilledChecklist(patient);
  const todayStr = getTodayFormatted();

  // Extract variables
  const tcDatesList: string[] = [];
  if (patient.tcAdmissaoData) tcDatesList.push(patient.tcAdmissaoData);
  if (patient.tcControles && Array.isArray(patient.tcControles)) {
    patient.tcControles.forEach(c => {
      if (c.data) tcDatesList.push(c.data);
    });
  } else if (patient.tcControleData) {
    tcDatesList.push(patient.tcControleData);
  }
  const tcDatesStr = tcDatesList.length > 0 ? tcDatesList.join('; ') + ';' : '___';

  const nihssAtualStr = latestChecklist.checklistNihssAtual || '___';
  const glicemiaMax = latestChecklist.checklistHgtMaior ? `${latestChecklist.checklistHgtMaior} MG/DL` : '___';
  const glicemiaMin = latestChecklist.checklistHgtMenor ? `${latestChecklist.checklistHgtMenor} MG/DL` : '___';

  const atbStr = latestChecklist.checklistAntibiotico === 'Sim' && latestChecklist.checklistAntibioticoText
    ? latestChecklist.checklistAntibioticoText
    : 'FEZ USO: NADA / EM USO: NADA';

  const pasVal = latestChecklist.checklistPas || '___';
  const padVal = latestChecklist.checklistPad || '___';
  const paStr = pasVal === '___' && padVal === '___' ? '___' : `${pasVal} x ${padVal} MMHG`;

  let tempVal = latestChecklist.checklistFebreTemp || '___';
  if (tempVal !== '___' && !tempVal.toUpperCase().includes('°C')) {
    tempVal = `${tempVal}°C`;
  }
  const tempStr = latestChecklist.checklistFebre === 'Sim' && tempVal !== '___' ? `> ${tempVal}` : tempVal;

  let bhVal = latestChecklist.checklistBalançoHidrico || '___';
  if (bhVal !== '___') {
    const trimmed = bhVal.trim();
    if (/^\d/.test(trimmed)) {
      bhVal = `+ ${trimmed}`;
    }
    if (!bhVal.toUpperCase().includes('ML/24H')) {
      bhVal = `${bhVal} ML/24H`;
    }
  }

  let diureseVal = latestChecklist.checklistDiurese || '___';
  if (diureseVal !== '___') {
    if (!diureseVal.toUpperCase().includes('ML/24H')) {
      diureseVal = `${diureseVal} ML/24H`;
    }
  }

  const comorbidadesList = patient.comorbidades
    ? patient.comorbidades.split(/[,;\n]/).map(c => c.trim()).filter(Boolean)
    : [];
  const comorbidadesStr = comorbidadesList.length > 0 
    ? comorbidadesList.map(c => `- ${c.toUpperCase()}`).join('\n')
    : "- HAS\n- DM\n- OBESIDADE";

  const dispositivosList: string[] = [];
  if (latestChecklist.checklistAcessoLocal) {
    dispositivosList.push(latestChecklist.checklistAcessoLocal);
  } else {
    dispositivosList.push('AVP');
  }
  if (latestChecklist.checklistDietaTipo && latestChecklist.checklistDietaTipo.toLowerCase().includes('sng')) {
    dispositivosList.push('SNG');
  }
  if (latestChecklist.checklistDietaTipo && latestChecklist.checklistDietaTipo.toLowerCase().includes('sne')) {
    dispositivosList.push('SNE');
  }
  const dispositivosStr = dispositivosList.length > 0
    ? dispositivosList.map(d => `- ${d.toUpperCase()}`).join('\n')
    : "- AVP";

  // Calculate TFG
  const ageNum = parseInt(patient.age || '');
  const genderMap = patient.gender === 'Masculino' ? 'M' : patient.gender === 'Feminino' ? 'F' : null;
  let latestCrVal = '';
  let latestCrDate = '';
  if (patient.dailyChecklists && Array.isArray(patient.dailyChecklists)) {
    for (let i = patient.dailyChecklists.length - 1; i >= 0; i--) {
      const ch = patient.dailyChecklists[i];
      if (ch && ch.checklistCreatinina) {
        const val = parseFloat(ch.checklistCreatinina.replace(',', '.'));
        if (!isNaN(val) && val > 0) {
          latestCrVal = ch.checklistCreatinina;
          latestCrDate = ch.checklistData || '';
          break;
        }
      }
    }
  }

  let tfgDisplay = "Aguardando dados";
  if (genderMap && !isNaN(ageNum) && latestCrVal) {
    const crNum = parseFloat(latestCrVal.replace(',', '.'));
    const k = (genderMap === 'F') ? 0.7 : 0.9;
    const alfa = (genderMap === 'F') ? -0.241 : -0.302;
    const minCrK = Math.min(crNum / k, 1);
    const maxCrK = Math.max(crNum / k, 1);
    const fatorFeminino = (genderMap === 'F') ? 1.012 : 1;
    const etfg = 142 
        * Math.pow(minCrK, alfa) 
        * Math.pow(maxCrK, -1.200) 
        * Math.pow(0.9938, ageNum) 
        * fatorFeminino;
    tfgDisplay = `${Math.round(etfg)} mL/min/1.73m²`;
  }

  // Dynamic initial text paragraphs
  const initAdmissaoText = `ADMISSÃO: PACIENTE REGULADO VIA JOIN, PROVENIENTE DE ${patient.sintomasAdmissao?.includes('PROVENIENTE') ? '' : 'MUNICÍPIO DE ORIGEM'}, COM HISTÓRIA DE DÉFICIT NEUROLÓGICO SÚBITO INICIADO AS ${patient.horaIctus || '___'}, CARACTERIZADO POR: ${patient.sintomasAdmissao || 'DÉFICIT NEUROLÓGICO'}. CHEGA EM JANELA DE TEMPO PARA REALIZAÇÃO DE TROMBÓLISE. REALIZA TOMOGRAFIAS DE CRÂNIO NA ADMISSÃO, SENDO AVALIADO PELA NEUROLOGIA QUE RECOMENDA TRATAMENTO REPERFUSIONAL. ${patient.trombolise === 'Sim' ? `TROMBÓLISE REALIZADA: BÓLUS ÀS ${patient.tromboliseDataHora || '___'}. PROCEDIMENTO REALIZADO SEM INTERCORRÊNCIAS.` : 'TROMBÓLISE NÃO REALIZADA.'} FAZ USO DOMICILIAR DE: ${patient.comorbidades || 'MEDICAÇÕES DE USO DIÁRIO'}.`;

  const initEvolucaoText = `EVOLUÇÃO: PACIENTE EM LEITO ${patient.id}, ESTÁVEL CLINICAMENTE. DO PONTO DE VISTA HEMODINÂMICO, APRESENTA-SE ${latestChecklist.checklistDva === 'Sim' ? `INSTÁVEL, EM USO DE DVA (${latestChecklist.checklistDvaText || 'Drogas Vasoativas'})` : 'ESTÁVEL, SEM USO DE DRUGAS VASOATIVAS (DVA)'} COM BOM CONTROLE PRESSÓRICO. APRESENTA-SE EUPNEICO EM ${latestChecklist.checklistVentilacao && latestChecklist.checklistVentilacao.length > 0 ? `VENTILAÇÃO MECÂNICA (${latestChecklist.checklistVentilacao.join(', ')})` : 'AR AMBIENTE'}. DIETA: ${latestChecklist.checklistDieta === 'Sim' ? `DIETA ENTERAL EM CURSO (${latestChecklist.checklistDietaTipo || 'SNG'})` : 'DIETA ZERO'}. DIURESE REGISTRADA DE ${diureseVal} EM 24 HORAS. BALANÇO HÍDRICO DE ${bhVal}. APRESENTOU ${latestChecklist.checklistFebre === 'Sim' ? `EPISÓDIO FEBRIL ISOLADO (${tempStr})` : 'TEMPERATURA ESTÁVEL, AFEBRIL'}. EM USO DE ANTIBIOTICOTERAPIA: ${atbStr}. EXAME NEUROLÓGICO: GLASGOW ${latestChecklist.checklistGlasgow || '15'}, EXECUTANDO COMANDOS SIMPLES, NIHSS ATUAL ${nihssAtualStr}. EXAME DE IMAGEM ADMISSÃO E CONTROLE REALIZADOS NAS DATAS: ${tcDatesStr}. FUNÇÃO RENAL (CKD-EPI 2021) CALCULADA EM ${tfgDisplay}${latestCrVal ? ` (ÚLTIMO REGISTRO DE CREATININA: ${latestCrVal} mg/dL em ${latestCrDate})` : ''}.`;

  const initNeurocheck = `ECG ${latestChecklist.checklistGlasgow || '15'} // PUPILAS = ${latestChecklist.checklistPup || 'ISOCÓRICAS E FOTORREATIVAS'} // RESPIRAÇÃO: ${latestChecklist.checklistResp || 'SEM ALTERAÇÕES'} // DÉFICIT FOCAL: ${patient.sintomasAdmissao || 'MANTÉM AFASIA/HEMIPLEGIA'}`;
  const initSedacao = latestChecklist.checklistSedacao === 'Sim' ? (latestChecklist.checklistSedacaoText || 'ATIVA').toUpperCase() : 'AUSENTE';
  const initAnalgesia = latestChecklist.checklistAnalgesia === 'Sim' ? (latestChecklist.checklistAnalgesiaText || 'DIPIRONA').toUpperCase() : 'AUSENTE';
  const initDva = latestChecklist.checklistDva === 'Sim' ? (latestChecklist.checklistDvaText || 'ATIVA').toUpperCase() : 'AUSENTE';
  const initVentilacao = latestChecklist.checklistVentilacao && latestChecklist.checklistVentilacao.length > 0 ? latestChecklist.checklistVentilacao.join(', ').toUpperCase() : 'ESPONTÂNEA EM AR AMBIENTE';

  const initEcg = `ECG ${patient.ecgData || todayStr}: ${patient.ecgLaudo || 'SINUSAL'}`;
  const initRx = `RX TÓRAX ${todayStr}: SEM ALTERAÇÕES RELEVANTES`;
  const initAngiotomo = `ANGIOTOMOGRAFIA CERVICAL/CRÂNIO: ${patient.angiotomoDescricao || 'AGUARDANDO REALIZAÇÃO OU SEM ALTERAÇÕES SEVÉRAS.'}`;

  const initCondutas = `- VIGILÂNCIA NEUROLÓGICA / APLICAR NIHSS\n- VIGILÂNCIA INFECCIOSA\n- RECONCILIAÇÃO MEDICAMENTOSA\n- MANTER DIETA CONFORME PRESCRIÇÃO\n- ${latestChecklist.checklistCondutas || 'DEMAIS CUIDADOS DE UTI'}`;

  const initMedico = latestChecklist.checklistMedicoPlantonista ? latestChecklist.checklistMedicoPlantonista : 'MÉDICO PLANTONISTA - UTI AVC';

  const docName = (patient.name || 'Nome do Paciente').toUpperCase();
  const docRegistro = patient.registro || '__________';
  const docMae = (patient.nomeMae || 'Nome da Mãe').toUpperCase();
  const docDn = patient.dataNascimento || '___/___/___';
  const docIdade = patient.age ? `${patient.age} ANOS` : '___';
  const docPeso = patient.weight ? `${patient.weight} KG` : '___';
  const docData = todayStr;
  
  const docLeito = String(patient.id).padStart(2, '0');
  const docAdmHosp = patient.dataAdmissao || '___/___/___';
  const docAdmUti = patient.dataAdmissao || '___/___/___';
  const docHd = `AVCI, ICTUS ${patient.dataIctus || '___/___/___'}, ${patient.horaIctus || '___'}`;
  const docNihssAdm = `${patient.nihssAdmissao || '___'} PTS`;
  const docNihssAtual = `${nihssAtualStr} PTS`;
  const docRankin = `${patient.rankinAdm || '___'} PTS`;
  const docTrombolise = patient.trombolise === 'Sim' ? 'SIM' : 'NÃO';
  const docTromboliseBolus = patient.tromboliseDataHora || '___';
  
  const docGlicMax = glicemiaMax;
  const docGlicMin = glicemiaMin;
  const docTcDatas = tcDatesStr;
  const docTcAdmLaudo = patient.tcAdmissaoLaudo || 'SEM ALTERAÇÕES.';
  const docTcContLaudo = (patient.tcControles && patient.tcControles.length > 0)
    ? patient.tcControles.map((tc, idx) => `[TC Controle #${idx + 1} em ${tc.data || '__/__/__'}]: ${tc.laudo || 'Sem laudo.'}`).join(' / ')
    : (patient.tcControleLaudo || 'AGUARDANDO CONTROLE.');

  const docAtb = atbStr;
  const docPa = paStr;
  const docTemp = tempStr;
  const docBh = bhVal;
  const docDiurese = diureseVal;

  const docComorbidades = comorbidadesStr;
  const docDispositivos = dispositivosStr;

  const docAdmissaoText = initAdmissaoText;
  const docEvolucaoText = initEvolucaoText;

  const docNeurocheck = initNeurocheck;
  const docSedacao = initSedacao;
  const docAnalgesia = initAnalgesia;
  const docDva = initDva;
  const docVentilacao = initVentilacao;

  const docEcg = initEcg;
  const docRx = initRx;
  const docAngiotomo = initAngiotomo;

  const docCondutas = initCondutas;
  const docMedico = initMedico;

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Evolucao_Medica_Leito_${docLeito}_${docData.replace(/\//g, '_')}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.5;
      color: #000000;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .no-print-bar {
      background-color: #0f172a;
      color: #fff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .bar-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bar-title {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #c084fc;
    }
    .bar-subtitle {
      font-size: 11px;
      color: #cbd5e1;
    }
    .btn-group {
      display: flex;
      gap: 12px;
    }
    .btn {
      padding: 8px 16px;
      font-size: 11px;
      font-weight: 800;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      transition: transform 0.1s, background-color 0.2s;
    }
    .btn:active {
      transform: scale(0.97);
    }
    .btn-print {
      background-color: #10b981;
      color: #fff;
      border: 1px solid #059669;
    }
    .btn-print:hover {
      background-color: #059669;
    }
    .btn-pdf {
      background-color: #2563eb;
      color: #fff;
      border: 1px solid #1d4ed8;
    }
    .btn-pdf:hover {
      background-color: #1d4ed8;
    }
    
    .container {
      max-width: 820px;
      margin: 30px auto;
      background-color: #fff;
      border: 1px solid #e2e8f0;
      padding: 40px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
      border-radius: 12px;
    }

    .title-area {
      text-align: center;
      margin-top: 10px;
      margin-bottom: 25px;
      border-bottom: 2px solid #6b21a8;
      padding-bottom: 12px;
    }
    .title-area h3 {
      font-size: 18px;
      color: #6b21a8;
      margin: 0;
      font-weight: 900;
      letter-spacing: 0.1em;
    }
    .title-area h4 {
      font-size: 13px;
      margin: 4px 0 0 0;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.05em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th, td {
      border: 1px solid #000000;
      padding: 6px 10px;
      text-align: left;
      vertical-align: top;
      color: #000000;
      background-color: #ffffff; /* pure white */
    }
    .shading-gray {
      background-color: #ffffff; /* removed gray background */
    }
    .shading-blue {
      background-color: #ffffff; /* removed blue background */
    }
    .bold {
      font-weight: bold;
    }
    .text-center {
      text-align: center;
    }
    .text-justify {
      text-align: justify;
    }
    .highlight-blue {
      color: #000000; /* removed blue */
      font-weight: bold;
    }
    .highlight-red {
      color: #000000; /* removed red */
      font-weight: bold;
    }
    .highlight-yellow {
      background-color: #fef08a !important; /* Yellow background */
      color: #000000 !important;
      font-weight: bold;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .section-title {
      font-weight: 900;
      font-size: 12px;
      margin-top: 18px;
      margin-bottom: 6px;
      text-transform: uppercase;
      color: #000000; /* black */
      border-left: 3px solid #000000; /* black */
      padding-left: 8px;
    }
    .editable-area {
      border: 1px dashed #cbd5e1;
      padding: 3px 6px;
      min-height: 18px;
      border-radius: 4px;
      background-color: #ffffff; /* pure white */
      color: #000000;
      transition: border-color 0.15s;
    }
    .editable-area:hover {
      background-color: #f8fafc;
      border-color: #000000;
    }
    .editable-area:focus {
      outline: none;
      background-color: #ffffff;
      border: 1.5px solid #000000 !important;
    }

    .no-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* Tip Box styling */
    .tip-box {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #0f172a;
      color: #f8fafc;
      border: 1px solid #334155;
      padding: 16px;
      border-radius: 12px;
      width: 280px;
      font-size: 11px;
      line-height: 1.4;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      z-index: 2000;
      display: none;
      animation: fadeIn 0.3s forwards;
    }
    .tip-box-header {
      font-weight: 900;
      color: #c084fc;
      margin-bottom: 6px;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .tip-box-close {
      cursor: pointer;
      color: #94a3b8;
      font-size: 14px;
    }
    .tip-box-close:hover {
      color: #fff;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media print {
      @page {
        size: auto;
        margin: 15mm; /* standard margin that suppresses browser headers and footers */
      }
      body {
        background-color: #fff;
        margin: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print-bar, .tip-box {
        display: none !important;
      }
      .container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
        margin: 0;
      }
      .editable-area {
        border: none !important;
        background-color: transparent !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div class="bar-info">
      <span class="bar-title">Evolução Médica Editável — Leito ${docLeito}</span>
      <span class="bar-subtitle">Clique diretamente sobre qualquer campo para alterar o texto. Edição habilitada.</span>
    </div>
    <div class="btn-group">
      <button class="btn btn-print">
        <span>🖨️ Imprimir na Impressora</span>
      </button>
      <button class="btn btn-pdf">
        <span>💾 Salvar como PDF</span>
      </button>
    </div>
  </div>

  <div class="container">
    <!-- HEADER WITH LOGOS -->
    <table class="header-table-container" style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;">
      <tr style="border: none;">
        <td style="width: 20%; border: none; padding: 0; vertical-align: middle; text-align: left; background-color: #fff;">
          <img src="/logo1.png" alt="Brasão de Alagoas" style="height: 65px; width: auto; display: inline-block; vertical-align: middle;" />
        </td>
        <td style="width: 60%; border: none; padding: 0; text-align: center; vertical-align: middle; background-color: #fff;">
          <h1 style="font-size: 14px; margin: 0 0 3px 0; font-weight: 900; text-transform: uppercase; color: #000000; font-family: Arial, sans-serif; line-height: 1.2;">Estado de Alagoas</h1>
          <h2 style="font-size: 11px; margin: 0 0 3px 0; font-weight: 700; text-transform: uppercase; color: #000000; font-family: Arial, sans-serif; line-height: 1.2;">Secretaria de Estado da Saúde – SESAU</h2>
          <h2 style="font-size: 11px; margin: 0 0 4px 0; font-weight: 700; text-transform: uppercase; color: #000000; font-family: Arial, sans-serif; line-height: 1.2;">Hospital de Emergência Dr. Daniel Houly</h2>
          <p style="font-size: 8px; margin: 0; color: #000000; font-family: Arial, sans-serif; line-height: 1.2;">Rodovia AL 220 km 05 S/N, Senador Arnon de Melo, CEP: 57.315-745, Arapiraca-AL</p>
        </td>
        <td style="width: 20%; border: none; padding: 0; vertical-align: middle; text-align: right; background-color: #fff;">
          <img src="/logo2.png" alt="Hospital de Emergência Dr. Daniel Houly" style="height: 65px; width: auto; display: inline-block; vertical-align: middle;" />
        </td>
      </tr>
    </table>

    <div class="title-area">
      <h3>UTI AVC</h3>
      <h4>EVOLUÇÃO MÉDICA</h4>
    </div>

    <!-- PATIENT IDENTIFICATION -->
    <div class="no-break">
      <table>
        <tr>
          <td style="width: 70%;"><span class="bold">NOME:</span> <div class="editable-area bold" contenteditable="true" id="print-patient-name" style="display:inline-block; min-width:300px;">${docName}</div></td>
          <td style="width: 30%;"><span class="bold">REGISTRO:</span> <div class="editable-area bold" contenteditable="true" id="print-patient-registro" style="display:inline-block; min-width:100px;">${docRegistro}</div></td>
        </tr>
        <tr>
          <td colspan="2"><span class="bold">MÃE:</span> <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:400px;">${docMae}</div></td>
        </tr>
        <tr>
          <td colspan="2">
            <span class="bold">DN:</span> <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:90px;">${docDn}</div>
            <span class="bold" style="margin-left: 20px;">IDADE:</span> <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:80px;">${docIdade}</div>
            <span class="bold" style="margin-left: 20px;">PESO:</span> <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:80px;">${docPeso}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2"><span class="bold">DATA DA EVOLUÇÃO:</span> <div class="editable-area highlight-yellow" contenteditable="true" id="print-evolucao-data" style="display:inline-block; min-width:110px;">${docData}</div></td>
        </tr>
      </table>
    </div>

    <!-- TABLE 1: CLINICAL DETAILS -->
    <div class="no-break">
      <table>
        <tr>
          <td class="shading-gray text-center bold" style="width: 25%;">UTI AVC</td>
          <td class="shading-blue text-center bold" style="width: 25%; color: #000000;">LEITO <span id="print-leito-id">${docLeito}</span></td>
          <td class="shading-gray text-center bold" colspan="2" style="width: 50%;">HIPÓTESE DIAGNÓSTICA</td>
        </tr>
        <tr>
          <td colspan="2">
            <div class="bold">ADM. HOSP -----------&gt; <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:90px;">${docAdmHosp}</div></div>
            <div class="bold" style="margin-top:4px;">ADM. UTI AVC --------&gt; <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:90px;">${docAdmUti}</div></div>
          </td>
          <td colspan="2" class="bold">
            # HD = <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:250px;">${docHd}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2">
            <div>ESCALA DE NIHSS: ADM ------------- <div class="editable-area bold" contenteditable="true" style="display:inline-block; min-width:50px;">${docNihssAdm}</div></div>
            <div style="margin-top: 6px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ATUAL ------------ <div class="editable-area highlight-red" contenteditable="true" style="display:inline-block; min-width:50px;">${docNihssAtual}</div></div>
          </td>
          <td colspan="2" class="bold">
            # TROMBÓLISE: <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:60px;">${docTrombolise}</div> (BÓLUS: <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:120px;">${docTromboliseBolus}</div>)
          </td>
        </tr>
        <tr>
          <td colspan="2">
            ESCALA DE RANKIN: PRÉVIA = <div class="editable-area bold" contenteditable="true" style="display:inline-block; min-width:50px;">${docRankin}</div>
          </td>
          <td colspan="2"></td>
        </tr>
        <tr>
          <td colspan="2">
            <div><span class="bold">GLICEMIA &uarr; (MÁX):</span> <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:120px;">${docGlicMax}</div></div>
            <div style="margin-top:4px;"><span class="bold">GLICEMIA &darr; (MÍN):</span> <div class="editable-area" contenteditable="true" style="display:inline-block; min-width:120px;">${docGlicMin}</div></div>
          </td>
          <td colspan="2"></td>
        </tr>
        <tr>
          <td colspan="2">
            <span class="bold">TC DE CRÂNIO/CERVICAL ADMISSÃO E CONTROLE:</span><br>
            <span class="bold">DATA:</span> <div class="editable-area highlight-blue" contenteditable="true" style="display:inline-block; min-width:150px;">${docTcDatas}</div><br>
            <span style="font-size: 9px; color:#000;">TH ( &nbsp; ) SIM &nbsp; ( &nbsp; ) NÃO</span>
          </td>
          <td colspan="2">
            <div class="bold">- TC DE CRÂNIO ADMISSÃO${patient.tcAdmissaoData ? ` (${patient.tcAdmissaoData})` : ''}:</div>
            <div class="editable-area text-justify" contenteditable="true" style="font-size:11px; margin-bottom: 6px;">${docTcAdmLaudo}</div>
            <div class="bold">- TC DE CRÂNIO CONTROLE${(patient.tcControles && patient.tcControles.length > 0) ? '' : (patient.tcControleData ? ` (${patient.tcControleData})` : '')}:</div>
            <div class="editable-area text-justify" contenteditable="true" style="font-size:11px;">${docTcContLaudo}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- TABLE 2: METRICS & COMORBIDITIES -->
    <div class="no-break">
      <table>
        <tr>
          <td style="width: 50%;">
            <div style="margin-bottom: 4px; display:flex; align-items:center; gap:4px;"><span class="bold" style="color:#000000; width:130px;">ATB:</span> <div class="editable-area" contenteditable="true" style="flex:1;">${docAtb}</div></div>
            <div style="margin-bottom: 4px; display:flex; align-items:center; gap:4px;"><span class="bold" style="color:#000000; width:130px;">PRESSÃO ARTERIAL:</span> <div class="editable-area" contenteditable="true" style="flex:1;">${docPa}</div></div>
            <div style="margin-bottom: 4px; display:flex; align-items:center; gap:4px;"><span class="bold" style="color:#000000; width:130px;">TEMPERATURA:</span> <div class="editable-area" contenteditable="true" style="flex:1;">${docTemp}</div></div>
            <div style="margin-bottom: 4px; display:flex; align-items:center; gap:4px;"><span class="bold" style="color:#000000; width:130px;">BH:</span> <div class="editable-area" contenteditable="true" style="flex:1;">${docBh}</div></div>
            <div style="display:flex; align-items:center; gap:4px;"><span class="bold" style="color:#000000; width:130px;">DIURESE:</span> <div class="editable-area" contenteditable="true" style="flex:1;">${docDiurese}</div></div>
          </td>
          <td style="width: 25%;">
            <div class="bold text-center" style="margin-bottom:6px; border-bottom:1px solid #000000; padding-bottom:2px; color:#000000;">COMORBIDADES</div>
            <pre class="editable-area" contenteditable="true" style="font-family: inherit; font-size:10px; margin:0; white-space:pre-wrap;">${docComorbidades}</pre>
          </td>
          <td style="width: 25%;">
            <div class="bold text-center" style="margin-bottom:6px; border-bottom:1px solid #000000; padding-bottom:2px; color:#000000;">DISPOSITIVOS</div>
            <pre class="editable-area" contenteditable="true" style="font-family: inherit; font-size:10px; margin:0; white-space:pre-wrap;">${docDispositivos}</pre>
          </td>
        </tr>
      </table>
    </div>

    <!-- TEXT BLOCKS -->
    <div class="no-break">
      <div class="section-title">Histórico de Admissão</div>
      <div class="editable-area text-justify" contenteditable="true" style="font-size: 11.5px; margin-bottom: 12px; min-height:60px;">${docAdmissaoText}</div>
    </div>

    <div class="no-break">
      <div class="section-title">Evolução Diária</div>
      <div class="editable-area text-justify" contenteditable="true" style="font-size: 11.5px; margin-bottom: 12px; min-height:100px;">${docEvolucaoText}</div>
    </div>

    <!-- SYSTEM EVALUATIONS -->
    <div class="no-break">
      <div class="section-title">Avaliações Sistêmicas</div>
      <div style="font-size: 11px; line-height: 1.6;">
        <div style="display:flex; gap:4px;"><span class="bold" style="min-width:130px;"># NEUROCHECK:</span> <div class="editable-area" contenteditable="true" style="flex:1;">${docNeurocheck}</div></div>
        <div style="display:flex; gap:4px; margin-top:3px;"><span class="bold" style="min-width:130px;"># SEDAÇÃO =</span> <div class="editable-area" contenteditable="true" style="flex:1;">${docSedacao}</div></div>
        <div style="display:flex; gap:4px; margin-top:3px;"><span class="bold" style="min-width:130px;"># ANALGESIA =</span> <div class="editable-area" contenteditable="true" style="flex:1;">${docAnalgesia}</div></div>
        <div style="display:flex; gap:4px; margin-top:3px;"><span class="bold" style="min-width:130px;"># DVA =</span> <div class="editable-area" contenteditable="true" style="flex:1;">${docDva}</div></div>
        <div style="display:flex; gap:4px; margin-top:3px;"><span class="bold" style="min-width:130px;"># VENTILAÇÃO =</span> <div class="editable-area" contenteditable="true" style="flex:1;">${docVentilacao}</div></div>
      </div>
    </div>

    <!-- EXAMS -->
    <div class="no-break">
      <div class="section-title">Exames</div>
      <div style="font-size: 11px; line-height: 1.6;">
        <div style="display:flex; gap:6px; align-items:flex-start;">&bull; <div class="editable-area" contenteditable="true" style="flex:1;">${docEcg}</div></div>
        <div style="display:flex; gap:6px; align-items:flex-start; margin-top:3px;">&bull; <div class="editable-area" contenteditable="true" style="flex:1;">${docRx}</div></div>
        <div style="display:flex; gap:6px; align-items:flex-start; margin-top:3px;">&bull; <div class="editable-area" contenteditable="true" style="flex:1;">${docAngiotomo}</div></div>
      </div>
    </div>

    <!-- RECOMMENDATIONS / PLAN -->
    <div class="no-break">
      <div class="section-title"># Condutas</div>
      <pre class="editable-area" contenteditable="true" style="font-family: inherit; font-size:11px; line-height: 1.6; white-space:pre-wrap; margin: 0 0 20px 0; min-height:80px;">${docCondutas}</pre>
    </div>

    <!-- SIGNATURE -->
    <div class="no-break" style="text-align: right; margin-top: 30px; font-size: 11px;">
      <div style="color: #000000; margin-bottom:4px;">__________________________________________</div>
      <div class="bold" style="color: #000000;"><div class="editable-area" contenteditable="true" style="display:inline-block; text-align:right; min-width:200px;">${docMedico}</div></div>
    </div>
  </div>

  <!-- TIP BOX -->
  <div class="tip-box" id="tipBox">
    <div class="tip-box-header">
      <span>Como Salvar como PDF</span>
      <span class="tip-box-close">&times;</span>
    </div>
    Para salvar esta evolução como PDF, no painel de impressão que abrirá em seguida:
    <ol style="margin: 6px 0 0 0; padding-left: 18px; font-size:10.5px;">
      <li>No campo <b>"Destino"</b> (ou <b>"Impressora"</b>), selecione <b>"Salvar como PDF"</b>.</li>
      <li>Selecione <b>"Salvar"</b> e escolha a pasta em seu computador.</li>
    </ol>
  </div>

</body>
</html>`;

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Attach event listeners directly from parent window
  const doc = printWindow.document;
  const btnPrint = doc.querySelector('.btn-print');
  const btnPdf = doc.querySelector('.btn-pdf');
  const btnCloseTip = doc.querySelector('.tip-box-close');

  const getDynamicTitle = () => {
    try {
      const leitoEl = doc.getElementById('print-leito-id');
      const nameEl = doc.getElementById('print-patient-name');
      const regEl = doc.getElementById('print-patient-registro');
      const dataEl = doc.getElementById('print-evolucao-data');
      
      const leitoVal = leitoEl ? leitoEl.innerText.trim().toUpperCase() : docLeito;
      const nameVal = nameEl ? nameEl.innerText.trim().toUpperCase() : docName;
      const regVal = regEl ? regEl.innerText.trim().toUpperCase() : docRegistro;
      const dataVal = dataEl ? dataEl.innerText.trim().toUpperCase() : docData;
      
      let cleanLeito = leitoVal.replace(/^LEITO\s+/i, '').trim();
      if (/^\d+$/.test(cleanLeito)) {
        cleanLeito = cleanLeito.padStart(2, '0');
      }
      const formattedDate = dataVal.replace(/\//g, '.');
      
      return ("LEITO " + cleanLeito + " - " + nameVal + " - " + regVal + " - " + formattedDate).toUpperCase();
    } catch (e) {
      const formattedDate = docData.replace(/\//g, '.');
      return ("LEITO " + docLeito + " - " + docName + " - " + docRegistro + " - " + formattedDate).toUpperCase();
    }
  };

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      const tipBox = doc.getElementById('tipBox');
      if (tipBox) {
        (tipBox as HTMLElement).style.display = 'none';
      }
      const oldTitle = doc.title;
      doc.title = getDynamicTitle();
      printWindow.print();
      setTimeout(() => {
        doc.title = oldTitle;
      }, 150);
    });
  }

  if (btnPdf) {
    btnPdf.addEventListener('click', () => {
      const tipBox = doc.getElementById('tipBox');
      if (tipBox) {
        (tipBox as HTMLElement).style.display = 'block';
      }
      
      setTimeout(() => {
        const oldTitle = doc.title;
        doc.title = getDynamicTitle();
        printWindow.print();
        setTimeout(() => {
          doc.title = oldTitle;
        }, 150);
      }, 700);
    });
  }

  if (btnCloseTip) {
    btnCloseTip.addEventListener('click', () => {
      const tipBox = doc.getElementById('tipBox');
      if (tipBox) {
        (tipBox as HTMLElement).style.display = 'none';
      }
    });
  }
};
