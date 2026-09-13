import mammoth from 'mammoth';

export interface ParsedEvolutionData {
  name: string;
  registro: string;
  dataNascimento: string;
  age: string;
  weight: string;
  gender: string;
  nomeMae: string;
  dataAdmissao: string;
  dataIctus: string;
  horaIctus: string;
  sintomasAdmissao: string;
  duracaoSintomas: string;
  nihssAdmissao: string;
  rankinAdm: string;
  paSistolica: string;
  paDiastolica: string;
  comorbidades: string;
  tcAdmissaoData: string;
  tcAdmissaoLaudo: string;
  angiotomoDescricao: string;
  ecgData: string;
  ecgLaudo: string;
  checklistGlasgow: string;
  checklistPup: string;
  trombolise: string;
  tromboliseDataHora: string;
  rawText: string;
}

export function formatToDDMMAA(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim().replace(/\./g, '/').replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2].length === 4 ? parts[2].slice(-2) : parts[2].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

export function parseMedicalEvolutionText(text: string): ParsedEvolutionData {
  const result: ParsedEvolutionData = {
    name: '',
    registro: '',
    dataNascimento: '',
    age: '',
    weight: '',
    gender: '',
    nomeMae: '',
    dataAdmissao: '',
    dataIctus: '',
    horaIctus: '',
    sintomasAdmissao: '',
    duracaoSintomas: '',
    nihssAdmissao: '',
    rankinAdm: '',
    paSistolica: '',
    paDiastolica: '',
    comorbidades: '',
    tcAdmissaoData: '',
    tcAdmissaoLaudo: '',
    angiotomoDescricao: '',
    ecgData: '',
    ecgLaudo: '',
    checklistGlasgow: '',
    checklistPup: '',
    trombolise: '',
    tromboliseDataHora: '',
    rawText: text
  };

  // 1. Nome do Paciente
  const nameMatch = text.match(/NOME:\s*([^\n\r\*]+)/i);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
  }

  // 2. Data de Nascimento
  const dnMatch = text.match(/DN:\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/i) || 
                  text.match(/(?:DATA DE NASCIMENTO|NASCIMENTO|D\.N\.):\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/i);
  if (dnMatch) {
    result.dataNascimento = formatToDDMMAA(dnMatch[1]);
  }

  // 3. Idade
  const ageMatch = text.match(/IDADE:\s*(\d+)/i) || text.match(/(\d+)\s*(?:ANOS|A)/i);
  if (ageMatch) {
    result.age = ageMatch[1].trim();
  }

  // 4. Peso
  const weightMatch = text.match(/PESO:\s*(\d+[\,\.]?\d*)\s*(?:KG)?/i);
  if (weightMatch) {
    result.weight = weightMatch[1].replace(',', '.').trim();
  }

  // 5. Nome da Mãe
  const maeMatch = text.match(/(?:^|\n)\s*(?:MÃE|M[AÃ]E|NOME DA M[AÃ]E|GENITORA|E)\s*:\s*([^\n\r\*]+)/i);
  if (maeMatch) {
    const maeName = maeMatch[1].trim();
    if (!maeName.toLowerCase().startsWith('has') && !maeName.toLowerCase().startsWith('avc')) {
      result.nomeMae = maeName;
    }
  }

  // 6. Registro / PE
  const regMatch = text.match(/(?:REGISTRO|PRONTU[AÁ]RIO|PE|REG\.?):\s*([0-9A-Za-z]+)/i);
  if (regMatch) {
    result.registro = regMatch[1].trim();
  }

  // 7. Data Admissao
  const admMatch = text.match(/ADM\.?\s*(?:UTI AVC|HOSPITAL)[^0-9]*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/i) ||
                   text.match(/DATA:\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/i);
  if (admMatch) {
    result.dataAdmissao = formatToDDMMAA(admMatch[1]);
  }

  // 8. Pressao Arterial (PAS / PAD)
  const pasMatch = text.match(/PAS:\s*(\d+)/i);
  const padMatch = text.match(/PAD:\s*(\d+)/i);
  if (pasMatch) result.paSistolica = pasMatch[1].trim();
  if (padMatch) result.paDiastolica = padMatch[1].trim();
  if (!result.paSistolica) {
    const paGenericMatch = text.match(/PA:\s*(\d+)\s*[xX\/]\s*(\d+)/i);
    if (paGenericMatch) {
      result.paSistolica = paGenericMatch[1].trim();
      result.paDiastolica = paGenericMatch[2].trim();
    }
  }

  // 9. NIHSS Admissao
  const nihssMatch = text.match(/ESCALA DE NIHSS[\s\S]*?ADM[^\d]*(\d+)/i) ||
                     text.match(/NIHSS\s*(?:ADM|ADMISS[AÃ]O)?\s*[:\-\>]?\s*(\d+)/i);
  if (nihssMatch) {
    result.nihssAdmissao = nihssMatch[1].trim();
  }

  // 10. Rankin
  const rankinMatch = text.match(/ESCALA DE RANKIN[\s\S]*?(?:PR[EÉ]VIO|PR[EÉ]VIA|ADM)?[^\d]*(\d+)/i) ||
                      text.match(/RANKIN[^\d]*(\d+)/i);
  if (rankinMatch) {
    result.rankinAdm = rankinMatch[1].trim();
  }

  // 11. Ictus (Data e Hora) & Sintomas
  const ictusMatch = text.match(/IN[IÍ]CIO S[UÚ]BITO [AÀ]S\s*(\d{1,2}[:hH]\d{2})h?\s*DO DIA\s*(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/i);
  if (ictusMatch) {
    result.horaIctus = ictusMatch[1].replace('h', ':').replace('H', ':');
    result.dataIctus = formatToDDMMAA(ictusMatch[2]);
  }
  const relatoMatch = text.match(/RELATO DE\s*([^,\.\n]+(?:,[^,\.\n]+)*?)\s*COM IN[IÍ]CIO/i);
  if (relatoMatch) {
    result.sintomasAdmissao = relatoMatch[1].trim();
  }

  // 12. Comorbidades
  const comorbMatch = text.match(/COMORBIDADES[\s\S]*?-\s*([^\n\r\*]+)/i);
  if (comorbMatch) {
    result.comorbidades = comorbMatch[1].trim();
  }

  // 13. Tomografia (não preencher automaticamente a partir da evolução)
  result.tcAdmissaoData = '';
  result.tcAdmissaoLaudo = '';
  result.angiotomoDescricao = '';

  // 14. ECG (não preencher automaticamente a partir da evolução)
  result.ecgData = '';
  result.ecgLaudo = '';

  // 15. Glasgow & Pupilas
  const glasgowMatch = text.match(/GLASGOW\s*(\d+)/i);
  if (glasgowMatch) result.checklistGlasgow = glasgowMatch[1].trim();
  const pupilasMatch = text.match(/PUPILAS\s*=\s*([^/\n]+)/i);
  if (pupilasMatch) result.checklistPup = pupilasMatch[1].trim();

  // 16. Infer Gender
  if (result.name) {
    const firstName = result.name.split(' ')[0].toUpperCase();
    if (firstName.endsWith('A') || firstName === 'SOLANGE' || firstName === 'MARIA' || firstName === 'ALICE' || firstName === 'BEATRIZ' || firstName === 'RAQUEL') {
      result.gender = 'Feminino';
    } else {
      result.gender = 'Masculino';
    }
  }

  return result;
}

export async function parseEvolutionDocxFile(file: File): Promise<ParsedEvolutionData> {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return parseMedicalEvolutionText(result.value);
  } catch (error) {
    // If it is a text file
    if (file.type.includes('text') || file.name.endsWith('.txt')) {
      const text = await file.text();
      return parseMedicalEvolutionText(text);
    }
    throw new Error('Não foi possível ler o arquivo. Certifique-se de que é um documento válido do Word (.docx) ou arquivo de texto.');
  }
}
