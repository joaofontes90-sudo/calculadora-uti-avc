import React from 'react';
import { 
  Activity, 
  Brain, 
  Stethoscope, 
  Droplets, 
  Plus, 
  Trash2,
  Scale, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Pill
} from 'lucide-react';
import { Patient, DailyChecklist, MEDS, calculateDose, getEffectiveUnit, formatDoseValue, ensureDailyChecklists } from '../App';

export function cleanAbxName(rawName: string): string {
  if (!rawName) return '';
  let cleaned = rawName.trim();
  // Strip leading "Dia X - ", "Dia X ", "DX - ", "DX ", "X - ", "X " where X is 0-31
  cleaned = cleaned.replace(/^(?:Dia\s*|D\s*)?\d{1,2}(?:\s*[-:|–\s]\s*|\s+)/i, '');
  return cleaned.trim();
}

export function parseAbxLine(line: string): { day: string; name: string } {
  if (!line || !line.trim()) return { day: '', name: '' };
  const trimmed = line.trim();

  // 1. Explicit "Dia 5 - Rocefin", "Dia 5 Rocefin", "D5 - Rocefin", "D5 Rocefin", "Dia 5", "D5"
  const explicitMatch = trimmed.match(/^(?:Dia\s*|D\s*)(\d{1,2})(?:\s*[-:|–\s]\s*|\s*)(.*)$/i);
  if (explicitMatch) {
    const dNum = parseInt(explicitMatch[1], 10);
    if (!isNaN(dNum) && dNum >= 0 && dNum <= 31) {
      const rawName = explicitMatch[2] ? explicitMatch[2].trim() : '';
      return { day: String(dNum), name: cleanAbxName(rawName) };
    }
  }

  // 2. Starts with a number 0-31: "5 - Rocefin", "5 Rocefin", "5: Rocefin"
  const numMatch = trimmed.match(/^(\d{1,2})(?:\s*[-:|–\s]\s*|\s*)(.*)$/);
  if (numMatch) {
    const dNum = parseInt(numMatch[1], 10);
    if (!isNaN(dNum) && dNum >= 0 && dNum <= 31) {
      const rawName = numMatch[2] ? numMatch[2].trim() : '';
      return { day: String(dNum), name: cleanAbxName(rawName) };
    }
  }

  // 3. Just a number "0" to "31"
  if (/^\d{1,2}$/.test(trimmed)) {
    const dNum = parseInt(trimmed, 10);
    if (!isNaN(dNum) && dNum >= 0 && dNum <= 31) {
      return { day: String(dNum), name: '' };
    }
  }

  // 4. Fallback: line is just the antibiotic name
  return { day: '', name: cleanAbxName(trimmed) };
}

export function formatAbxLine(day: string, name: string): string {
  const cleanName = cleanAbxName(name);
  const cleanDay = day !== '' && day !== null && day !== undefined ? String(day).trim() : '';
  if (cleanDay !== '' && cleanName) {
    return `Dia ${cleanDay} - ${cleanName}`;
  }
  if (cleanDay !== '') {
    return `Dia ${cleanDay}`;
  }
  return cleanName;
}

export function getAutoFilledColumn(prevList: DailyChecklist): Partial<DailyChecklist> {
  if (!prevList) return {};

  const incDay = (val?: string) => {
    if (!val) return '';
    const match = val.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      return val.replace(match[0], String(num + 1));
    }
    return val;
  };

  const incAbxText = (prevAbxText?: string) => {
    if (!prevAbxText || !prevAbxText.trim()) return '';
    const lines = prevAbxText.split('\n');
    const newLines = lines.map(line => {
      if (!line.trim()) return '';
      const { day, name } = parseAbxLine(line);
      if (!name && day === '') return '';
      const dayNum = day !== '' ? parseInt(day, 10) : 0;
      const nextDay = Math.min(31, dayNum + 1);
      return formatAbxLine(String(nextDay), name);
    }).filter(Boolean);
    return newLines.join('\n');
  };

  const autoAbxText = incAbxText(prevList.checklistAntibioticoText);
  const abxChoice = prevList.checklistAntibiotico === 'Não' 
    ? 'Não' 
    : (prevList.checklistAntibiotico === 'Sim' || autoAbxText ? 'Sim' : '');

  return {
    checklistNihssAtual: prevList.checklistNihssAtual || '',
    checklistGlasgow: prevList.checklistGlasgow || '',
    checklistPup: prevList.checklistPup || '',
    checklistResp: prevList.checklistResp || '',
    checklistMotor: prevList.checklistMotor || '',
    checklistPendencias: prevList.checklistPendencias || '',
    checklistIntercorrencias: prevList.checklistIntercorrencias || '',
    checklistCondutas: '',

    // Ventilação (manter selecionado os do dia anterior)
    checklistVentilacao: prevList.checklistVentilacao ? [...prevList.checklistVentilacao] : [],
    checklistVentilacaoOutros: prevList.checklistVentilacaoOutros || '',

    // Dias de VM (numero de dias de vm da coluna anterior + 1)
    checklistDiasVm: incDay(prevList.checklistDiasVm),

    // Antibioticoterapia (manter sim/não, nomes e dia + 1)
    checklistAntibiotico: abxChoice,
    checklistAntibioticoText: abxChoice === 'Não' ? '' : autoAbxText,

    // Acesso venoso (manter local selecionado) e dia do acesso (+ 1)
    checklistAcessoLocal: prevList.checklistAcessoLocal || '',
    checklistAcessoDia: incDay(prevList.checklistAcessoDia),

    // Dieta (manter selecionado os do dia anterior)
    checklistDieta: prevList.checklistDieta || '',
    checklistDietaTipo: prevList.checklistDietaTipo || '',
    checklistDietaInicio: prevList.checklistDietaInicio || '',

    // Antiagregante e Anticoagulante (manter do último checklist)
    checklistAntiagregante: prevList.checklistAntiagregante || '',
    checklistAnticoagulante: prevList.checklistAnticoagulante || '',

    // Lesão por Pressão / Escaras (manter do último checklist)
    checklistEscaras: prevList.checklistEscaras || '',
    checklistEscarasLocal: prevList.checklistEscarasLocal || '',
    checklistEscarasAspecto: prevList.checklistEscarasAspecto || '',
  };
}

interface ChecklistFormProps {
  patient: Patient;
  updatePatient: (p: Patient) => void;
  handleDateMask: (value: string) => string;
  theme: {
    ringColor: string;
  };
}

export const ChecklistForm: React.FC<ChecklistFormProps> = ({
  patient: patientRaw,
  updatePatient: updatePatientRaw,
  handleDateMask,
  theme,
}) => {
  const dailyChecklists = ensureDailyChecklists(patientRaw);

  const [activeIndex, setActiveIndex] = React.useState(() => {
    const firstEmpty = dailyChecklists.findIndex(item => !item.checklistData);
    return firstEmpty !== -1 ? firstEmpty : 0;
  });

  const [currentPage, setCurrentPage] = React.useState(() => {
    const firstEmpty = dailyChecklists.findIndex(item => !item.checklistData);
    const targetIndex = firstEmpty !== -1 ? firstEmpty : 0;
    return Math.floor(targetIndex / 6) + 1;
  });

  const [isConfirmingClearColumn, setIsConfirmingClearColumn] = React.useState(false);

  // Sync page when activeIndex changes
  React.useEffect(() => {
    const pageOfActive = Math.floor(activeIndex / 6) + 1;
    if (pageOfActive !== currentPage) {
      setCurrentPage(pageOfActive);
    }
  }, [activeIndex]);

  // Reset confirm state on column switch
  React.useEffect(() => {
    setIsConfirmingClearColumn(false);
  }, [activeIndex]);

  // Auto pre-fill antiplatelet, anticoagulant and continuous care when switching to an empty column
  React.useEffect(() => {
    if (activeIndex > 0) {
      const currentChk = dailyChecklists[activeIndex];
      const isColumnEmpty = !currentChk.checklistData && 
        !currentChk.checklistNihssAtual && 
        !currentChk.checklistGlasgow &&
        !currentChk.checklistAntiagregante &&
        !currentChk.checklistAnticoagulante;

      if (isColumnEmpty) {
        const prevList = [...dailyChecklists.slice(0, activeIndex)].reverse().find(item => Boolean(item.checklistData && item.checklistData.trim() !== '')) || dailyChecklists[activeIndex - 1];
        if (prevList) {
          const autoFilled = getAutoFilledColumn(prevList);
          const updatedLists = [...dailyChecklists];
          updatedLists[activeIndex] = {
            ...currentChk,
            ...autoFilled,
          };
          updatePatientRaw({
            ...patientRaw,
            dailyChecklists: updatedLists,
          });
        }
      }
    }
  }, [activeIndex]);

  const handleClearCurrentColumn = () => {
    const emptyChecklist: DailyChecklist = {
      checklistData: '',
      checklistNihssAtual: '',
      checklistGlasgow: '',
      checklistEcgCheck: '',
      checklistPup: '',
      checklistResp: '',
      checklistMotor: '',
      checklistSedacao: '',
      checklistSedacaoText: '',
      checklistAnalgesia: '',
      checklistAnalgesiaText: '',
      checklistDva: '',
      checklistDvaText: '',
      checklistBloqueadorNeuromuscular: '',
      checklistPasPad: '',
      checklistPas: '',
      checklistPad: '',
      checklistVentilacao: [],
      checklistVentilacaoOutros: '',
      checklistDiasVm: '',
      checklistDesmameVm: '',
      checklistFisioGrauForca: '',
      checklistFisioTonus: '',
      checklistContTroncoCervical: '',
      checklistFonoaudiologia: '',
      checklistDisfagiaLinguagem: '',
      checklistFebre: '',
      checklistFebreTemp: '',
      checklistAntibiotico: '',
      checklistAntibioticoText: '',
      checklistAntiagregante: '',
      checklistAnticoagulante: '',
      checklistAcessoLocal: '',
      checklistAcessoDia: '',
      checklistDieta: '',
      checklistDietaTipo: '',
      checklistDietaInicio: '',
      checklistEvacuacoes: '',
      checklistEvacuacoesAspecto: '',
      checklistEscaras: '',
      checklistEscarasLocal: '',
      checklistEscarasAspecto: '',
      checklistBalançoHidrico: '',
      checklistDiurese: '',
      checklistPh: '',
      checklistPao2: '',
      checklistPaco2: '',
      checklistHco3: '',
      checklistSao2: '',
      checklistPf: '',
      checklistSf: '',
      checklistPao2Paco2: '',
      checklistHco3Sao2: '',
      checklistPfSf: '',
      checklistHgtMaior: '',
      checklistHgtMenor: '',
      checklistHb: '',
      checklistHt: '',
      checklistPlaquetas: '',
      checklistLeucograma: '',
      checklistBastoes: '',
      checklistInr: '',
      checklistSodio: '',
      checklistPotassio: '',
      checklistPcr: '',
      checklistMagnesio: '',
      checklistFosforo: '',
      checklistTroponina: '',
      checklistUreia: '',
      checklistCreatinina: '',
      checklistBioquimicaOutros: '',
      checklistEcgExame: '',
      checklistEcoDoppler: '',
      checklistPendencias: '',
      checklistIntercorrencias: '',
      checklistCondutas: '',
      checklistMedicoPlantonista: '',
    };

    const updatedLists = [...dailyChecklists];
    updatedLists[activeIndex] = emptyChecklist;

    updatePatientRaw({
      ...patientRaw,
      dailyChecklists: updatedLists,
      ...(activeIndex === 0 ? emptyChecklist : {})
    });

    setIsConfirmingClearColumn(false);
  };

  const activeChecklist = dailyChecklists[activeIndex];

  // Proxy patient object so the rest of the form uses the active checklist fields
  const patient: Patient = {
    ...patientRaw,
    checklistData: activeChecklist.checklistData,
    checklistNihssAtual: activeChecklist.checklistNihssAtual,
    checklistGlasgow: activeChecklist.checklistGlasgow,
    checklistPup: activeChecklist.checklistPup,
    checklistResp: activeChecklist.checklistResp,
    checklistMotor: activeChecklist.checklistMotor,
    checklistSedacao: activeChecklist.checklistSedacao,
    checklistSedacaoText: activeChecklist.checklistSedacaoText,
    checklistAnalgesia: activeChecklist.checklistAnalgesia,
    checklistAnalgesiaText: activeChecklist.checklistAnalgesiaText,
    checklistDva: activeChecklist.checklistDva,
    checklistDvaText: activeChecklist.checklistDvaText,
    checklistBloqueadorNeuromuscular: activeChecklist.checklistBloqueadorNeuromuscular,
    checklistPasPad: activeChecklist.checklistPasPad,
    checklistPas: activeChecklist.checklistPas,
    checklistPad: activeChecklist.checklistPad,
    checklistVentilacao: activeChecklist.checklistVentilacao,
    checklistVentilacaoOutros: activeChecklist.checklistVentilacaoOutros,
    checklistDiasVm: activeChecklist.checklistDiasVm,
    checklistDesmameVm: activeChecklist.checklistDesmameVm,
    checklistFisioGrauForca: activeChecklist.checklistFisioGrauForca,
    checklistFisioTonus: activeChecklist.checklistFisioTonus,
    checklistContTroncoCervical: activeChecklist.checklistContTroncoCervical,
    checklistFonoaudiologia: activeChecklist.checklistFonoaudiologia,
    checklistDisfagiaLinguagem: activeChecklist.checklistDisfagiaLinguagem,
    checklistFebre: activeChecklist.checklistFebre,
    checklistFebreTemp: activeChecklist.checklistFebreTemp,
    checklistAntibiotico: activeChecklist.checklistAntibiotico,
    checklistAntibioticoText: activeChecklist.checklistAntibioticoText,
    checklistAntiagregante: activeChecklist.checklistAntiagregante,
    checklistAnticoagulante: activeChecklist.checklistAnticoagulante,
    checklistAcessoLocal: activeChecklist.checklistAcessoLocal,
    checklistAcessoDia: activeChecklist.checklistAcessoDia,
    checklistDieta: activeChecklist.checklistDieta,
    checklistDietaTipo: activeChecklist.checklistDietaTipo,
    checklistDietaInicio: activeChecklist.checklistDietaInicio,
    checklistEvacuacoes: activeChecklist.checklistEvacuacoes,
    checklistEvacuacoesAspecto: activeChecklist.checklistEvacuacoesAspecto,
    checklistEscaras: activeChecklist.checklistEscaras,
    checklistEscarasLocal: activeChecklist.checklistEscarasLocal,
    checklistEscarasAspecto: activeChecklist.checklistEscarasAspecto,
    checklistBalançoHidrico: activeChecklist.checklistBalançoHidrico,
    checklistDiurese: activeChecklist.checklistDiurese,
    checklistPh: activeChecklist.checklistPh,
    checklistPao2: activeChecklist.checklistPao2,
    checklistPaco2: activeChecklist.checklistPaco2,
    checklistHco3: activeChecklist.checklistHco3,
    checklistSao2: activeChecklist.checklistSao2,
    checklistPf: activeChecklist.checklistPf,
    checklistSf: activeChecklist.checklistSf,
    checklistPao2Paco2: activeChecklist.checklistPao2Paco2,
    checklistHco3Sao2: activeChecklist.checklistHco3Sao2,
    checklistPfSf: activeChecklist.checklistPfSf,
    checklistHgtMaior: activeChecklist.checklistHgtMaior,
    checklistHgtMenor: activeChecklist.checklistHgtMenor,
    checklistHb: activeChecklist.checklistHb,
    checklistHt: activeChecklist.checklistHt,
    checklistPlaquetas: activeChecklist.checklistPlaquetas,
    checklistLeucograma: activeChecklist.checklistLeucograma,
    checklistBastoes: activeChecklist.checklistBastoes,
    checklistInr: activeChecklist.checklistInr,
    checklistSodio: activeChecklist.checklistSodio,
    checklistPotassio: activeChecklist.checklistPotassio,
    checklistPcr: activeChecklist.checklistPcr,
    checklistMagnesio: activeChecklist.checklistMagnesio,
    checklistFosforo: activeChecklist.checklistFosforo,
    checklistTroponina: activeChecklist.checklistTroponina,
    checklistUreia: activeChecklist.checklistUreia,
    checklistCreatinina: activeChecklist.checklistCreatinina,
    checklistBioquimicaOutros: activeChecklist.checklistBioquimicaOutros,
    checklistEcgExame: activeChecklist.checklistEcgExame,
    checklistEcoDoppler: activeChecklist.checklistEcoDoppler,
    checklistPendencias: activeChecklist.checklistPendencias,
    checklistIntercorrencias: activeChecklist.checklistIntercorrencias,
    checklistCondutas: activeChecklist.checklistCondutas,
    checklistMedicoPlantonista: activeChecklist.checklistMedicoPlantonista,
  };

  const isColumnEmpty = (chk: DailyChecklist | undefined): boolean => {
    if (!chk) return true;
    const values = [
      chk.checklistData,
      chk.checklistNihssAtual,
      chk.checklistGlasgow,
      chk.checklistPup,
      chk.checklistResp,
      chk.checklistMotor,
      chk.checklistSedacao,
      chk.checklistSedacaoText,
      chk.checklistAnalgesia,
      chk.checklistAnalgesiaText,
      chk.checklistDva,
      chk.checklistDvaText,
      chk.checklistBloqueadorNeuromuscular,
      chk.checklistPasPad,
      chk.checklistPas,
      chk.checklistPad,
      chk.checklistDiasVm,
      chk.checklistDesmameVm,
      chk.checklistFebre,
      chk.checklistFebreTemp,
      chk.checklistAntibiotico,
      chk.checklistAntibioticoText,
      chk.checklistAntiagregante,
      chk.checklistAnticoagulante,
      chk.checklistAcessoLocal,
      chk.checklistAcessoDia,
      chk.checklistDieta,
      chk.checklistDietaTipo,
      chk.checklistDietaInicio,
      chk.checklistEvacuacoes,
      chk.checklistEscaras,
      chk.checklistBalançoHidrico,
      chk.checklistDiurese,
      chk.checklistPh,
      chk.checklistPao2,
      chk.checklistPaco2,
      chk.checklistHco3,
      chk.checklistSao2,
      chk.checklistPf,
      chk.checklistSf,
      chk.checklistPcr,
      chk.checklistPendencias,
      chk.checklistIntercorrencias,
      chk.checklistCondutas,
      chk.checklistMedicoPlantonista,
    ];
    const hasVentilacao = Array.isArray(chk.checklistVentilacao) && chk.checklistVentilacao.length > 0;
    return !hasVentilacao && values.every(v => !v || String(v).trim() === '');
  };

  // Proxy updatePatient function so updates write directly to the active checklist column
  const updatePatient = (updatedPatient: Patient) => {
    // Auto-fill strictly when user enters/types a date in an empty/new column for the first time
    const isEnteringDateInNewColumn = (!activeChecklist.checklistData || activeChecklist.checklistData.trim() === '') && 
      Boolean(updatedPatient.checklistData && updatedPatient.checklistData.trim() !== '');

    let autoFilledFields: Partial<DailyChecklist> = {};

    if (isEnteringDateInNewColumn) {
      // 1) Copy neurological assessment, ventilation, VM days, antibiotics, venous access, diet, antiplatelet, anticoagulant, pressure sores, and pending/conducts from previous column if activeIndex > 0
      if (activeIndex > 0) {
        const prevList = [...dailyChecklists.slice(0, activeIndex)].reverse().find(item => Boolean(item.checklistData && item.checklistData.trim() !== '')) || dailyChecklists[activeIndex - 1];
        if (prevList) {
          autoFilledFields = getAutoFilledColumn(prevList);
        }
      }

      // 2) Populate "Suporte Ventilatório & Drogas" from the current active continuous infusions of the patient at this exact moment
      const sedativeInfusions = (patientRaw.infusions || []).filter(inf => {
        const drug = MEDS.find(m => m.id === inf.drugId);
        return drug?.category === 'Sedativo' && parseFloat(inf.flowRate) > 0;
      });
      const hasSedation = sedativeInfusions.length > 0;
      const sedationText = sedativeInfusions.map(inf => {
        const drug = MEDS.find(m => m.id === inf.drugId)!;
        const dilution = drug.dilutions.find(d => d.id === inf.dilutionId);
        const w = parseFloat(patientRaw.weight) || 0;
        const flow = parseFloat(inf.flowRate) || 0;
        const dose = dilution ? calculateDose(flow, w, drug, dilution) : 0;
        const unit = dilution ? getEffectiveUnit(drug, dilution) : drug.unit;
        const doseStr = formatDoseValue(dose);
        return `${drug.name}: ${flow} ml/h (${doseStr} ${unit})`;
      }).join('; ');

      const analgesicInfusions = (patientRaw.infusions || []).filter(inf => {
        const drug = MEDS.find(m => m.id === inf.drugId);
        return drug?.category === 'Analgésico' && parseFloat(inf.flowRate) > 0;
      });
      const hasAnalgesia = analgesicInfusions.length > 0;
      const analgesiaText = analgesicInfusions.map(inf => {
        const drug = MEDS.find(m => m.id === inf.drugId)!;
        const dilution = drug.dilutions.find(d => d.id === inf.dilutionId);
        const w = parseFloat(patientRaw.weight) || 0;
        const flow = parseFloat(inf.flowRate) || 0;
        const dose = dilution ? calculateDose(flow, w, drug, dilution) : 0;
        const unit = dilution ? getEffectiveUnit(drug, dilution) : drug.unit;
        const doseStr = formatDoseValue(dose);
        return `${drug.name}: ${flow} ml/h (${doseStr} ${unit})`;
      }).join('; ');

      const dvaInfusions = (patientRaw.infusions || []).filter(inf => {
        const drug = MEDS.find(m => m.id === inf.drugId);
        return drug?.category === 'Vasoativa' && parseFloat(inf.flowRate) > 0;
      });
      const hasDva = dvaInfusions.length > 0;
      const dvaText = dvaInfusions.map(inf => {
        const drug = MEDS.find(m => m.id === inf.drugId)!;
        const dilution = drug.dilutions.find(d => d.id === inf.dilutionId);
        const w = parseFloat(patientRaw.weight) || 0;
        const flow = parseFloat(inf.flowRate) || 0;
        const dose = dilution ? calculateDose(flow, w, drug, dilution) : 0;
        const unit = dilution ? getEffectiveUnit(drug, dilution) : drug.unit;
        const doseStr = formatDoseValue(dose);
        return `${drug.name}: ${flow} ml/h (${doseStr} ${unit})`;
      }).join('; ');

      const nmBlockerInfusions = (patientRaw.infusions || []).filter(inf => {
        const drug = MEDS.find(m => m.id === inf.drugId);
        return drug?.category === 'Bloqueador Neuromuscular' && parseFloat(inf.flowRate) > 0;
      });
      const nmBlockerText = nmBlockerInfusions.map(inf => {
        const drug = MEDS.find(m => m.id === inf.drugId)!;
        const dilution = drug.dilutions.find(d => d.id === inf.dilutionId);
        const w = parseFloat(patientRaw.weight) || 0;
        const flow = parseFloat(inf.flowRate) || 0;
        const dose = dilution ? calculateDose(flow, w, drug, dilution) : 0;
        const unit = dilution ? getEffectiveUnit(drug, dilution) : drug.unit;
        const doseStr = formatDoseValue(dose);
        return `${drug.name}: ${flow} ml/h (${doseStr} ${unit})`;
      }).join('; ');

      autoFilledFields = {
        ...autoFilledFields,
        checklistSedacao: hasSedation ? 'Sim' : (autoFilledFields.checklistSedacao || 'Não'),
        checklistSedacaoText: sedationText || autoFilledFields.checklistSedacaoText || '',
        checklistAnalgesia: hasAnalgesia ? 'Sim' : (autoFilledFields.checklistAnalgesia || 'Não'),
        checklistAnalgesiaText: analgesiaText || autoFilledFields.checklistAnalgesiaText || '',
        checklistDva: hasDva ? 'Sim' : (autoFilledFields.checklistDva || 'Não'),
        checklistDvaText: dvaText || autoFilledFields.checklistDvaText || '',
        checklistBloqueadorNeuromuscular: nmBlockerText || autoFilledFields.checklistBloqueadorNeuromuscular || '',
      };
    }

    const getFieldVal = <K extends keyof DailyChecklist>(
      key: K,
      defaultValue: DailyChecklist[K]
    ): DailyChecklist[K] => {
      // If user explicitly changed this field in this interaction, prioritize user input
      if (updatedPatient[key] !== activeChecklist[key] && updatedPatient[key] !== undefined) {
        return updatedPatient[key] as DailyChecklist[K];
      }
      // Otherwise, if autoFilledFields has a value for this field, use it
      if (autoFilledFields[key] !== undefined) {
        return autoFilledFields[key] as DailyChecklist[K];
      }
      // Otherwise fallback to updatedPatient (or defaultValue)
      return updatedPatient[key] !== undefined ? (updatedPatient[key] as DailyChecklist[K]) : defaultValue;
    };

    const updatedFields: DailyChecklist = {
      checklistData: updatedPatient.checklistData,
      checklistNihssAtual: getFieldVal('checklistNihssAtual', ''),
      checklistGlasgow: getFieldVal('checklistGlasgow', ''),
      checklistPup: getFieldVal('checklistPup', ''),
      checklistResp: getFieldVal('checklistResp', ''),
      checklistMotor: getFieldVal('checklistMotor', ''),
      checklistSedacao: getFieldVal('checklistSedacao', ''),
      checklistSedacaoText: getFieldVal('checklistSedacaoText', ''),
      checklistAnalgesia: getFieldVal('checklistAnalgesia', ''),
      checklistAnalgesiaText: getFieldVal('checklistAnalgesiaText', ''),
      checklistDva: getFieldVal('checklistDva', ''),
      checklistDvaText: getFieldVal('checklistDvaText', ''),
      checklistBloqueadorNeuromuscular: getFieldVal('checklistBloqueadorNeuromuscular', ''),
      checklistPasPad: updatedPatient.checklistPasPad,
      checklistPas: updatedPatient.checklistPas,
      checklistPad: updatedPatient.checklistPad,
      checklistVentilacao: getFieldVal('checklistVentilacao', []),
      checklistVentilacaoOutros: getFieldVal('checklistVentilacaoOutros', ''),
      checklistDiasVm: getFieldVal('checklistDiasVm', ''),
      checklistDesmameVm: updatedPatient.checklistDesmameVm,
      checklistFisioGrauForca: updatedPatient.checklistFisioGrauForca,
      checklistFisioTonus: updatedPatient.checklistFisioTonus,
      checklistContTroncoCervical: updatedPatient.checklistContTroncoCervical,
      checklistFonoaudiologia: updatedPatient.checklistFonoaudiologia,
      checklistDisfagiaLinguagem: updatedPatient.checklistDisfagiaLinguagem,
      checklistFebre: updatedPatient.checklistFebre,
      checklistFebreTemp: updatedPatient.checklistFebreTemp,
      checklistAntibiotico: getFieldVal('checklistAntibiotico', ''),
      checklistAntibioticoText: getFieldVal('checklistAntibioticoText', ''),
      checklistAntiagregante: getFieldVal('checklistAntiagregante', ''),
      checklistAnticoagulante: getFieldVal('checklistAnticoagulante', ''),
      checklistAcessoLocal: getFieldVal('checklistAcessoLocal', ''),
      checklistAcessoDia: getFieldVal('checklistAcessoDia', ''),
      checklistDieta: getFieldVal('checklistDieta', ''),
      checklistDietaTipo: getFieldVal('checklistDietaTipo', ''),
      checklistDietaInicio: getFieldVal('checklistDietaInicio', ''),
      checklistEvacuacoes: updatedPatient.checklistEvacuacoes,
      checklistEvacuacoesAspecto: updatedPatient.checklistEvacuacoesAspecto,
      checklistEscaras: getFieldVal('checklistEscaras', ''),
      checklistEscarasLocal: getFieldVal('checklistEscarasLocal', ''),
      checklistEscarasAspecto: getFieldVal('checklistEscarasAspecto', ''),
      checklistBalançoHidrico: updatedPatient.checklistBalançoHidrico,
      checklistDiurese: updatedPatient.checklistDiurese,
      checklistPh: updatedPatient.checklistPh,
      checklistPao2: updatedPatient.checklistPao2,
      checklistPaco2: updatedPatient.checklistPaco2,
      checklistHco3: updatedPatient.checklistHco3,
      checklistSao2: updatedPatient.checklistSao2,
      checklistPf: updatedPatient.checklistPf,
      checklistSf: updatedPatient.checklistSf,
      checklistPao2Paco2: updatedPatient.checklistPao2Paco2,
      checklistHco3Sao2: updatedPatient.checklistHco3Sao2,
      checklistPfSf: updatedPatient.checklistPfSf,
      checklistHgtMaior: updatedPatient.checklistHgtMaior,
      checklistHgtMenor: updatedPatient.checklistHgtMenor,
      checklistHb: updatedPatient.checklistHb,
      checklistHt: updatedPatient.checklistHt,
      checklistPlaquetas: updatedPatient.checklistPlaquetas,
      checklistLeucograma: updatedPatient.checklistLeucograma,
      checklistBastoes: updatedPatient.checklistBastoes,
      checklistInr: updatedPatient.checklistInr,
      checklistSodio: updatedPatient.checklistSodio,
      checklistPotassio: updatedPatient.checklistPotassio,
      checklistPcr: updatedPatient.checklistPcr,
      checklistMagnesio: updatedPatient.checklistMagnesio,
      checklistFosforo: updatedPatient.checklistFosforo,
      checklistTroponina: updatedPatient.checklistTroponina,
      checklistUreia: updatedPatient.checklistUreia,
      checklistCreatinina: updatedPatient.checklistCreatinina,
      checklistBioquimicaOutros: updatedPatient.checklistBioquimicaOutros,
      checklistEcgExame: updatedPatient.checklistEcgExame,
      checklistEcoDoppler: updatedPatient.checklistEcoDoppler,
      checklistPendencias: getFieldVal('checklistPendencias', ''),
      checklistIntercorrencias: getFieldVal('checklistIntercorrencias', ''),
      checklistCondutas: getFieldVal('checklistCondutas', ''),
      checklistMedicoPlantonista: updatedPatient.checklistMedicoPlantonista,
    };
    const updatedLists = [...dailyChecklists];
    updatedLists[activeIndex] = updatedFields;
    updatePatientRaw({
      ...updatedPatient,
      dailyChecklists: updatedLists,
      // update root level with first element for safety
      ...updatedLists[0]
    });
  };

  const handleRefreshSedacao = () => {
    const sedativeInfusions = (patientRaw.infusions || []).filter(inf => {
      const drug = MEDS.find(m => m.id === inf.drugId);
      return drug?.category === 'Sedativo' && parseFloat(inf.flowRate) > 0;
    });
    const hasSedation = sedativeInfusions.length > 0;
    const sedationText = sedativeInfusions.map(inf => {
      const drug = MEDS.find(m => m.id === inf.drugId)!;
      const dilution = drug.dilutions.find(d => d.id === inf.dilutionId);
      const w = parseFloat(patientRaw.weight) || 0;
      const flow = parseFloat(inf.flowRate) || 0;
      const dose = dilution ? calculateDose(flow, w, drug, dilution) : 0;
      const unit = dilution ? getEffectiveUnit(drug, dilution) : drug.unit;
      const doseStr = formatDoseValue(dose);
      return `${drug.name}: ${flow} ml/h (${doseStr} ${unit})`;
    }).join('; ');

    updatePatient({
      ...patient,
      checklistSedacao: hasSedation ? 'Sim' : 'Não',
      checklistSedacaoText: sedationText || ''
    });
  };

  const handleRefreshAnalgesia = () => {
    const analgesicInfusions = (patientRaw.infusions || []).filter(inf => {
      const drug = MEDS.find(m => m.id === inf.drugId);
      return drug?.category === 'Analgésico' && parseFloat(inf.flowRate) > 0;
    });
    const hasAnalgesia = analgesicInfusions.length > 0;
    const analgesiaText = analgesicInfusions.map(inf => {
      const drug = MEDS.find(m => m.id === inf.drugId)!;
      const dilution = drug.dilutions.find(d => d.id === inf.dilutionId);
      const w = parseFloat(patientRaw.weight) || 0;
      const flow = parseFloat(inf.flowRate) || 0;
      const dose = dilution ? calculateDose(flow, w, drug, dilution) : 0;
      const unit = dilution ? getEffectiveUnit(drug, dilution) : drug.unit;
      const doseStr = formatDoseValue(dose);
      return `${drug.name}: ${flow} ml/h (${doseStr} ${unit})`;
    }).join('; ');

    updatePatient({
      ...patient,
      checklistAnalgesia: hasAnalgesia ? 'Sim' : 'Não',
      checklistAnalgesiaText: analgesiaText || ''
    });
  };

  const handleRefreshDva = () => {
    const dvaInfusions = (patientRaw.infusions || []).filter(inf => {
      const drug = MEDS.find(m => m.id === inf.drugId);
      return drug?.category === 'Vasoativa' && parseFloat(inf.flowRate) > 0;
    });
    const hasDva = dvaInfusions.length > 0;
    const dvaText = dvaInfusions.map(inf => {
      const drug = MEDS.find(m => m.id === inf.drugId)!;
      const dilution = drug.dilutions.find(d => d.id === inf.dilutionId);
      const w = parseFloat(patientRaw.weight) || 0;
      const flow = parseFloat(inf.flowRate) || 0;
      const dose = dilution ? calculateDose(flow, w, drug, dilution) : 0;
      const unit = dilution ? getEffectiveUnit(drug, dilution) : drug.unit;
      const doseStr = formatDoseValue(dose);
      return `${drug.name}: ${flow} ml/h (${doseStr} ${unit})`;
    }).join('; ');

    updatePatient({
      ...patient,
      checklistDva: hasDva ? 'Sim' : 'Não',
      checklistDvaText: dvaText || ''
    });
  };

  const totalPages = Math.max(1, Math.ceil(dailyChecklists.length / 6));
  const startIndex = (currentPage - 1) * 6;
  const endIndex = startIndex + 6;
  const visibleChecklists = dailyChecklists.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setActiveIndex((newPage - 1) * 6);
    }
  };

  const handleNextPage = () => {
    const nextPage = currentPage + 1;
    const neededLength = nextPage * 6;
    if (dailyChecklists.length < neededLength) {
      const updatedLists = [...dailyChecklists];
      while (updatedLists.length < neededLength) {
        updatedLists.push({});
      }
      updatePatientRaw({
        ...patientRaw,
        dailyChecklists: updatedLists,
      });
    }
    setCurrentPage(nextPage);
    setActiveIndex((nextPage - 1) * 6);
  };

  return (
    <div className="flex-1 flex flex-col justify-between gap-3 h-full">
      {/* Barra Superior do Checklist: Maior verticalmente, sem abreviações e foco na DATA */}
      <div className="bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <span className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
            Check-list Diário UAVC
          </span>

          {/* Controles de Paginação por extenso */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={handlePrevPage}
              className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <span className="px-3.5 py-1.5 rounded-lg text-xs font-black text-blue-700 bg-blue-50 border border-blue-200/70">
              Folha {currentPage} de {totalPages} (Colunas {startIndex + 1} a {startIndex + 6})
            </span>

            <button
              type="button"
              onClick={handleNextPage}
              className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 shadow-2xs cursor-pointer"
            >
              <span>Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 6 Botões de Evolução: Apenas a DATA bem visível nas preenchidas, ou "Coluna X" por extenso nas vazias */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 flex-1 max-w-4xl">
          {visibleChecklists.map((list, colOffset) => {
            const realIdx = startIndex + colOffset;
            const isActive = realIdx === activeIndex;
            const isFilled = !!list.checklistData && list.checklistData.trim() !== '';
            return (
              <button
                key={realIdx}
                type="button"
                onClick={() => setActiveIndex(realIdx)}
                className={`py-2 px-3 rounded-xl border text-center transition-all flex items-center justify-center cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm ring-2 ring-blue-300/70'
                    : isFilled
                      ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-400 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                {isFilled ? (
                  <span className={`text-sm font-black tracking-wide ${isActive ? 'text-white' : 'text-emerald-800'}`}>
                    {list.checklistData}
                  </span>
                ) : (
                  <span className={`text-xs font-black uppercase tracking-wider ${isActive ? 'text-white' : 'text-slate-500'}`}>
                    Coluna {realIdx + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          LINHA SUPERIOR: 3 QUADROS DE MESMO TAMANHO HORIZONTAL E VERTICAL (~20% MAIORES)
          1) AVALIAÇÃO NEUROLÓGICA (Azul claro discreto)
          2) TERAPÊUTICA & MEDICAÇÕES (Verde claro discreto)
          3) SUPORTE VENTILATÓRIO & DROGAS
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch flex-1">

        {/* QUADRO SUPERIOR 1: AVALIAÇÃO NEUROLÓGICA */}
        <div className="bg-blue-50/45 p-4 rounded-xl border border-blue-200/80 shadow-2xs flex flex-col justify-between h-full min-h-[340px] text-left">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-blue-200/60 shrink-0">
            <div className="flex items-center gap-1.5">
              <Activity size={15} className="text-blue-600" />
              <span className="text-xs font-black text-blue-800 uppercase tracking-wider">Avaliação Neurológica</span>
            </div>
            <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-md bg-white text-blue-700 border border-blue-200">
              {patient.checklistData ? patient.checklistData : `Coluna ${activeIndex + 1}`}
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-between gap-3">
            {/* Linha 1: Data do Checklist + NIHSS Atual + Glasgow/RASS */}
            <div className="grid grid-cols-12 gap-2.5 items-end">
              <div className="col-span-4">
                <label className="block text-[10.5px] font-black text-blue-800 uppercase tracking-wider mb-1.5 leading-none">Data Check</label>
                <input
                  type="text"
                  placeholder="DD/MM/AA"
                  maxLength={8}
                  value={patient.checklistData || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistData: handleDateMask(e.target.value) })}
                  className={`w-full px-2.5 py-2 bg-white border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-black text-slate-800 text-center ${theme.ringColor}`}
                />
              </div>

              <div className="col-span-3">
                <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">NIHSS Atual</label>
                <input
                  type="number"
                  placeholder="Pontos"
                  value={patient.checklistNihssAtual || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistNihssAtual: e.target.value })}
                  className={`w-full px-2.5 py-2 bg-white border border-blue-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>

              <div className="col-span-5">
                <div className="flex items-center justify-end mb-1.5">
                  <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-blue-200 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        if (patient.checklistGlasgow?.startsWith('RASS')) {
                          updatePatient({ ...patient, checklistGlasgow: '' });
                        }
                      }}
                      className={`flex-1 px-2 py-1 text-[10.5px] font-black rounded-md transition-all cursor-pointer ${
                        !patient.checklistGlasgow?.startsWith('RASS')
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Glasgow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!patient.checklistGlasgow?.startsWith('RASS')) {
                          updatePatient({ ...patient, checklistGlasgow: 'RASS: 0' });
                        }
                      }}
                      className={`flex-1 px-2 py-1 text-[10.5px] font-black rounded-md transition-all cursor-pointer ${
                        patient.checklistGlasgow?.startsWith('RASS')
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      RASS
                    </button>
                  </div>
                </div>

                {!patient.checklistGlasgow?.startsWith('RASS') ? (
                  <input
                    type="number"
                    placeholder="3-15"
                    min="3"
                    max="15"
                    value={patient.checklistGlasgow || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistGlasgow: e.target.value })}
                    className={`w-full px-2.5 py-2 bg-white border border-blue-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                  />
                ) : (
                  <select
                    value={patient.checklistGlasgow || 'RASS: 0'}
                    onChange={(e) => updatePatient({ ...patient, checklistGlasgow: e.target.value })}
                    className={`w-full px-2 py-2 bg-white border border-blue-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                  >
                    <option value="RASS: +4">RASS +4</option>
                    <option value="RASS: +3">RASS +3</option>
                    <option value="RASS: +2">RASS +2</option>
                    <option value="RASS: +1">RASS +1</option>
                    <option value="RASS: 0">RASS 0</option>
                    <option value="RASS: -1">RASS -1</option>
                    <option value="RASS: -2">RASS -2</option>
                    <option value="RASS: -3">RASS -3</option>
                    <option value="RASS: -4">RASS -4</option>
                    <option value="RASS: -5">RASS -5</option>
                  </select>
                )}
              </div>
            </div>

            {/* Linha 2: Pupila + Padrão Respiratório */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Pupila</label>
                <input
                  type="text"
                  placeholder="Ex: Isocórica / Fotorreagente"
                  value={patient.checklistPup || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistPup: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border border-blue-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Padrão Respiratório</label>
                <input
                  type="text"
                  placeholder="Ex: Eupneico / Sem alterações"
                  value={patient.checklistResp || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistResp: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border border-blue-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                />
              </div>
            </div>

            {/* Linha 3: Déficit Motor */}
            <div>
              <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Déficit Motor</label>
              <input
                type="text"
                placeholder="Ex: Hemiparesia D (MSD FM 3/5) / Sem déficit"
                value={patient.checklistMotor || ''}
                onChange={(e) => updatePatient({ ...patient, checklistMotor: e.target.value })}
                className={`w-full px-3 py-2 bg-white border border-blue-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
          </div>
        </div>

        {/* QUADRO SUPERIOR 2: TERAPÊUTICA & MEDICAÇÕES (Verde claro discreto, sem barra de rolagem precoce em ATB) */}
        <div className="bg-emerald-50/45 p-4 rounded-xl border border-emerald-200/80 shadow-2xs flex flex-col justify-between h-full min-h-[340px] text-left">
          {(() => {
            const rawText = patient.checklistAntibioticoText || '';
            const abxList = rawText.includes('\n') ? rawText.split('\n') : [rawText];
            const displayList = abxList.length > 0 ? abxList : [''];

            const handleAbxDayChange = (index: number, newDay: string) => {
              const currentParsed = parseAbxLine(displayList[index]);
              const formatted = formatAbxLine(newDay, currentParsed.name);
              const newList = [...displayList];
              newList[index] = formatted;
              updatePatient({ ...patient, checklistAntibioticoText: newList.join('\n'), checklistAntibiotico: 'Sim' });
            };

            const handleAbxNameChange = (index: number, newName: string) => {
              const currentParsed = parseAbxLine(displayList[index]);
              const formatted = formatAbxLine(currentParsed.day, newName);
              const newList = [...displayList];
              newList[index] = formatted;
              updatePatient({ ...patient, checklistAntibioticoText: newList.join('\n'), checklistAntibiotico: 'Sim' });
            };

            const handleAddAbx = () => {
              const newList = [...displayList, 'Dia 1 - '];
              updatePatient({ ...patient, checklistAntibioticoText: newList.join('\n'), checklistAntibiotico: 'Sim' });
            };

            const handleRemoveAbx = (index: number) => {
              const newList = displayList.filter((_, i) => i !== index);
              updatePatient({ ...patient, checklistAntibioticoText: newList.join('\n') });
            };

            return (
              <>
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-emerald-200/60 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Pill size={15} className="text-emerald-600" />
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">Terapêutica & Medicações</span>
                  </div>
                  {patient.checklistAntibiotico !== 'Não' && (
                    <button
                      type="button"
                      onClick={handleAddAbx}
                      className="flex items-center gap-1 text-[10.5px] font-black text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-100 px-2.5 py-1 rounded-md transition-all border border-emerald-200 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>+ ATB</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between gap-3">
                  {/* Linha 1: Antibiótico em Uso (Espaço amplo para múltiplos ATBs sem barra de rolagem) */}
                  <div>
                    <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Antibiótico em Uso</label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5 custom-scrollbar">
                      {patient.checklistAntibiotico === 'Não' ? (
                        <div className="flex items-center gap-2">
                          <div className="flex bg-white p-0.5 rounded-lg border border-emerald-200 shrink-0">
                            {['Sim', 'Não'].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => updatePatient({ ...patient, checklistAntibiotico: patient.checklistAntibiotico === opt ? '' : (opt as any) })}
                                className={`px-3 py-1.5 rounded-md text-[10.5px] font-black transition-all ${
                                  patient.checklistAntibiotico === opt
                                    ? opt === 'Sim'
                                      ? 'bg-blue-600 text-white shadow-2xs'
                                      : 'bg-red-600 text-white shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                          <span className="text-xs text-slate-400 font-bold italic">Sem antibiótico em uso</span>
                        </div>
                      ) : (
                        displayList.map((abx, idx) => {
                          const parsed = parseAbxLine(abx);
                          return (
                            <div key={idx} className="flex items-center gap-1.5">
                              {idx === 0 && (
                                <div className="flex bg-white p-0.5 rounded-lg border border-emerald-200 shrink-0">
                                  {['Sim', 'Não'].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => updatePatient({ ...patient, checklistAntibiotico: patient.checklistAntibiotico === opt ? '' : (opt as any) })}
                                      className={`px-2.5 py-1.5 rounded-md text-[10.5px] font-black transition-all ${
                                        patient.checklistAntibiotico === opt
                                          ? opt === 'Sim'
                                            ? 'bg-blue-600 text-white shadow-2xs'
                                            : 'bg-red-600 text-white shadow-2xs'
                                          : 'text-slate-500 hover:text-slate-800'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <input
                                type="text"
                                placeholder="Qual antibiótico? (Ex: Ceftriaxona)"
                                value={parsed.name}
                                onChange={(e) => handleAbxNameChange(idx, e.target.value)}
                                className={`flex-1 min-w-0 px-3 py-2 bg-white border border-emerald-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                              />
                              <input
                                type="number"
                                min={0}
                                max={31}
                                placeholder="Dia"
                                value={parsed.day}
                                onChange={(e) => handleAbxDayChange(idx, e.target.value)}
                                className={`w-16 shrink-0 px-1.5 py-2 bg-white border border-emerald-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                              />
                              {displayList.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAbx(idx)}
                                  title="Remover este antibiótico"
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Linha 2: Antiagregante Plaquetário */}
                  <div>
                    <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Antiagregante Plaquetário</label>
                    <input
                      type="text"
                      placeholder="Ex: AAS 100mg VO, Clopidogrel 75mg..."
                      value={patient.checklistAntiagregante || ''}
                      onChange={(e) => updatePatient({ ...patient, checklistAntiagregante: e.target.value })}
                      className={`w-full px-3 py-2 bg-white border border-emerald-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                    />
                  </div>

                  {/* Linha 3: Anticoagulante / Profilaxia TEV */}
                  <div>
                    <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Anticoagulante / Profilaxia TEV</label>
                    <input
                      type="text"
                      placeholder="Ex: Enoxaparina 40mg SC 1x/dia, HNF..."
                      value={patient.checklistAnticoagulante || ''}
                      onChange={(e) => updatePatient({ ...patient, checklistAnticoagulante: e.target.value })}
                      className={`w-full px-3 py-2 bg-white border border-emerald-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                    />
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* QUADRO SUPERIOR 3: SUPORTE VENTILATÓRIO & DROGAS (Mesmo tamanho horizontal e vertical) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-full min-h-[340px] text-left">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-1.5">
              <Activity size={15} className="text-indigo-600" />
              <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">Suporte Ventilatório & Drogas</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between gap-3">
            {/* Linha 1: Sedação e Analgesia lado a lado */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider leading-none">Sedação</span>
                    <button
                      type="button"
                      onClick={handleRefreshSedacao}
                      title="Atualizar com as infusões ativas"
                      className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-50 transition-colors"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                  <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
                    {['Sim', 'Não'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updatePatient({ ...patient, checklistSedacao: patient.checklistSedacao === opt ? '' : (opt as any) })}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-black transition-all ${
                          patient.checklistSedacao === opt
                            ? opt === 'Sim'
                              ? 'bg-blue-600 text-white'
                              : 'bg-red-600 text-white'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Fármaco / Dose / RASS"
                  value={patient.checklistSedacaoText || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistSedacaoText: e.target.value })}
                  className={`w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider leading-none">Analgesia</span>
                    <button
                      type="button"
                      onClick={handleRefreshAnalgesia}
                      title="Atualizar com as infusões ativas"
                      className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-50 transition-colors"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                  <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
                    {['Sim', 'Não'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updatePatient({ ...patient, checklistAnalgesia: patient.checklistAnalgesia === opt ? '' : (opt as any) })}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-black transition-all ${
                          patient.checklistAnalgesia === opt
                            ? opt === 'Sim'
                              ? 'bg-blue-600 text-white'
                              : 'bg-red-600 text-white'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Fármaco / Dose"
                  value={patient.checklistAnalgesiaText || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistAnalgesiaText: e.target.value })}
                  className={`w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                />
              </div>
            </div>

            {/* Linha 2: DVA + BNM + Desmame */}
            <div className="grid grid-cols-12 gap-2.5 items-end">
              <div className="col-span-5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider leading-none">DVA</span>
                    <button
                      type="button"
                      onClick={handleRefreshDva}
                      title="Atualizar com as infusões ativas"
                      className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-50 transition-colors"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                  <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
                    {['Sim', 'Não', 'NDA'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updatePatient({ ...patient, checklistDva: patient.checklistDva === opt ? '' : (opt as any) })}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all ${
                          patient.checklistDva === opt
                            ? opt === 'Sim'
                              ? 'bg-blue-600 text-white'
                              : opt === 'Não'
                                ? 'bg-red-600 text-white'
                                : 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Droga / Vazão / PAM"
                  value={patient.checklistDvaText || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistDvaText: e.target.value })}
                  className={`w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                />
              </div>

              <div className="col-span-4">
                <label className="block text-[10.5px] font-black text-slate-500 uppercase tracking-wider mb-1.5 leading-none">BNM (Bloqueador)</label>
                <input
                  type="text"
                  placeholder="Qual / Dose"
                  value={patient.checklistBloqueadorNeuromuscular || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistBloqueadorNeuromuscular: e.target.value })}
                  className={`w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                />
              </div>

              <div className="col-span-3">
                <label className="block text-[10.5px] font-black text-slate-500 uppercase tracking-wider mb-1.5 leading-none text-center">Desmame</label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  {['Sim', 'Não', 'N/A'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updatePatient({ ...patient, checklistDesmameVm: patient.checklistDesmameVm === opt ? '' : (opt as any) })}
                      className={`flex-1 py-1.5 rounded-md text-[9.5px] font-black transition-all ${
                        patient.checklistDesmameVm === opt
                          ? opt === 'Sim'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : opt === 'Não'
                              ? 'bg-red-600 text-white shadow-2xs'
                              : 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Linha 3: Ventilação (2 linhas com 3 itens em cada, Venturi por extenso) + Parâmetros + Dias VM */}
            <div className="grid grid-cols-12 gap-2.5 items-center pt-2 border-t border-slate-100">
              <div className="col-span-6 grid grid-cols-3 gap-1.5">
                {[
                  { id: 'ar_ambiente', label: 'A.A.' },
                  { id: 'venturi', label: 'Venturi' },
                  { id: 'canula_nasal', label: 'C.N.' },
                  { id: 'ventilacao_mecanica', label: 'VM' },
                  { id: 'tot', label: 'TOT' },
                  { id: 'tqt', label: 'TQT' }
                ].map((opt) => {
                  const isSelected = (patient.checklistVentilacao || []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const current = patient.checklistVentilacao || [];
                        const updated = isSelected
                          ? current.filter(x => x !== opt.id)
                          : [...current, opt.id];
                        updatePatient({ ...patient, checklistVentilacao: updated });
                      }}
                      className={`py-1.5 px-1.5 rounded-md text-[10.5px] font-black border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="col-span-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 leading-none">Obs / Parâmetros</label>
                <input
                  type="text"
                  placeholder="Obs / Parâm."
                  value={patient.checklistVentilacaoOutros || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistVentilacaoOutros: e.target.value })}
                  className={`w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 leading-none text-center">Dias VM</label>
                <input
                  type="number"
                  placeholder="Dias"
                  title="Dias de Ventilação Mecânica"
                  value={patient.checklistDiasVm || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistDiasVm: e.target.value })}
                  className={`w-full px-1.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* =====================================================================
          LINHA INFERIOR: 3 QUADROS ALINHADOS COM OS 3 DE CIMA (~20% MAIORES)
          1) HEMODINÂMICA & CUIDADOS (Vermelho claro discreto)
          2) LABORATÓRIO & EXAMES (Roxo claro discreto + Gasometria em quadro cinza embaixo)
          3) CONDUTAS & PLANTONISTA (Direita — amplo espaço sem rolagem)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch flex-1">

        {/* QUADRO INFERIOR 1 (Esquerda): HEMODINÂMICA & CUIDADOS */}
        <div className="bg-rose-50/45 p-4 rounded-xl border border-rose-200/80 shadow-2xs flex flex-col justify-between h-full min-h-[340px] text-left">
          <div className="flex items-center gap-1.5 pb-2 mb-2.5 border-b border-rose-200/60 shrink-0">
            <Stethoscope size={15} className="text-rose-600" />
            <span className="text-xs font-black text-rose-800 uppercase tracking-wider">Hemodinâmica & Cuidados</span>
          </div>

          <div className="flex-1 flex flex-col justify-between gap-2.5">
            {/* Linha 1: PAS | PAD | HGT (Máx / Mín) lado a lado sem setas de número */}
            <div className="grid grid-cols-3 gap-2.5 bg-white/70 p-2.5 rounded-lg border border-rose-200/70">
              <div>
                <label className="block text-[10px] font-black text-rose-800 uppercase tracking-wider mb-1 text-center leading-none">PAS (Sistólica)</label>
                <input
                  type="text"
                  placeholder="Ex: 110-140"
                  value={patient.checklistPas || ''}
                  onChange={(e) => {
                    const newPas = e.target.value;
                    const combined = newPas || patient.checklistPad ? `${newPas || ''} x ${patient.checklistPad || ''}` : '';
                    updatePatient({ ...patient, checklistPas: newPas, checklistPasPad: combined });
                  }}
                  className={`w-full px-2 py-1.5 bg-white border border-rose-200 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-rose-800 uppercase tracking-wider mb-1 text-center leading-none">PAD (Diastólica)</label>
                <input
                  type="text"
                  placeholder="Ex: 70-90"
                  value={patient.checklistPad || ''}
                  onChange={(e) => {
                    const newPad = e.target.value;
                    const combined = patient.checklistPas || newPad ? `${patient.checklistPas || ''} x ${newPad || ''}` : '';
                    updatePatient({ ...patient, checklistPad: newPad, checklistPasPad: combined });
                  }}
                  className={`w-full px-2 py-1.5 bg-white border border-rose-200 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-rose-800 uppercase tracking-wider mb-1 text-center leading-none">HGT (Máx / Mín)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Máx"
                    value={patient.checklistHgtMaior || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistHgtMaior: e.target.value })}
                    className={`w-full px-1 py-1.5 bg-white border border-rose-200 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                  />
                  <span className="text-xs text-slate-400 font-bold">/</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Mín"
                    value={patient.checklistHgtMenor || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistHgtMenor: e.target.value })}
                    className={`w-full px-1 py-1.5 bg-white border border-rose-200 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                  />
                </div>
              </div>
            </div>

            {/* Linha 2: Febre + BH 24h + Diurese */}
            <div className="grid grid-cols-12 gap-2.5 items-end">
              <div className="col-span-6">
                <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Febre / Temperatura</label>
                <div className="flex items-center gap-1.5">
                  <div className="flex bg-white p-0.5 rounded-lg border border-rose-200 shrink-0">
                    {['Sim', 'Não'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updatePatient({ ...patient, checklistFebre: patient.checklistFebre === opt ? '' : (opt as any) })}
                        className={`px-2.5 py-1.5 rounded-md text-[10px] font-black transition-all ${
                          patient.checklistFebre === opt
                            ? opt === 'Sim'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-red-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 38.2 °C"
                    value={patient.checklistFebreTemp || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistFebreTemp: e.target.value })}
                    className={`w-full px-2.5 py-1.5 bg-white border border-rose-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                  />
                </div>
              </div>

              <div className="col-span-3">
                <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">BH (24h)</label>
                <input
                  type="text"
                  placeholder="+450 ml"
                  value={patient.checklistBalançoHidrico || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistBalançoHidrico: e.target.value })}
                  className={`w-full px-2.5 py-1.5 bg-white border border-rose-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                />
              </div>

              <div className="col-span-3">
                <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Diurese</label>
                <input
                  type="text"
                  placeholder="1500 ml"
                  value={patient.checklistDiurese || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistDiurese: e.target.value })}
                  className={`w-full px-2.5 py-1.5 bg-white border border-rose-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                />
              </div>
            </div>

            {/* Linha 3: Acesso Venoso + Dieta */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Acesso Venoso (Local / Dia)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Local (Ex: AVP MSE)"
                    value={patient.checklistAcessoLocal || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistAcessoLocal: e.target.value })}
                    className={`flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-rose-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                  />
                  <input
                    type="number"
                    placeholder="Dia"
                    value={patient.checklistAcessoDia || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistAcessoDia: e.target.value })}
                    className={`w-14 shrink-0 px-1.5 py-1.5 bg-white border border-rose-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Dieta</label>
                <div className="flex items-center gap-1.5">
                  <div className="flex bg-white p-0.5 rounded-lg border border-rose-200 shrink-0">
                    {['Sim', 'Não'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updatePatient({ ...patient, checklistDieta: patient.checklistDieta === opt ? '' : (opt as any) })}
                        className={`px-2.5 py-1.5 rounded-md text-[10px] font-black transition-all ${
                          patient.checklistDieta === opt
                            ? opt === 'Sim'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-red-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Tipo (SNE, Oral...)"
                    value={patient.checklistDietaTipo || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistDietaTipo: e.target.value })}
                    className={`flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-rose-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                  />
                </div>
              </div>
            </div>

            {/* Linha 4: Evacuações + Escaras */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-rose-200/60">
              <div>
                <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Evacuações</label>
                <div className="flex items-center gap-1.5">
                  <div className="flex bg-white p-0.5 rounded-lg border border-rose-200 shrink-0">
                    {['Sim', 'Não'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updatePatient({ ...patient, checklistEvacuacoes: patient.checklistEvacuacoes === opt ? '' : (opt as any) })}
                        className={`px-2.5 py-1.5 rounded-md text-[10px] font-black transition-all ${
                          patient.checklistEvacuacoes === opt
                            ? opt === 'Sim'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-red-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Aspecto / Freq."
                    value={patient.checklistEvacuacoesAspecto || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistEvacuacoesAspecto: e.target.value })}
                    className={`flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-rose-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5 leading-none">Escaras (Local / Grau)</label>
                <div className="flex items-center gap-1.5">
                  <div className="flex bg-white p-0.5 rounded-lg border border-rose-200 shrink-0">
                    {['Sim', 'Não'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updatePatient({ ...patient, checklistEscaras: patient.checklistEscaras === opt ? '' : (opt as any) })}
                        className={`px-2.5 py-1.5 rounded-md text-[10px] font-black transition-all ${
                          patient.checklistEscaras === opt
                            ? opt === 'Sim'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-red-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Local"
                    value={patient.checklistEscarasLocal || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistEscarasLocal: e.target.value })}
                    className={`w-1/2 min-w-0 px-2 py-1.5 bg-white border border-rose-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                  />
                  <input
                    type="text"
                    placeholder="Grau"
                    value={patient.checklistEscarasAspecto || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistEscarasAspecto: e.target.value })}
                    className={`w-1/2 min-w-0 px-2 py-1.5 bg-white border border-rose-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* QUADRO INFERIOR 2 (Centro): LABORATÓRIO & EXAMES (Roxo claro discreto + Gasometria em quadro cinza na linha inferior) */}
        <div className="bg-purple-50/45 p-4 rounded-xl border border-purple-200/80 shadow-2xs flex flex-col justify-between h-full min-h-[340px] text-left">
          <div className="flex items-center gap-1.5 pb-2 mb-2.5 border-b border-purple-200/60 shrink-0">
            <Droplets size={15} className="text-purple-600" />
            <span className="text-xs font-black text-purple-800 uppercase tracking-wider">Laboratório & Exames</span>
          </div>

          <div className="flex-1 flex flex-col justify-between gap-2.5">
            {/* Linha 1: Hemograma (Hb, Ht, Plaq, Leuco, Bast) + INR em 1 linha, sem placeholder */}
            <div className="grid grid-cols-6 gap-2">
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">Hb</label>
                <input
                  type="text"
                  value={patient.checklistHb || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistHb: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">Ht</label>
                <input
                  type="text"
                  value={patient.checklistHt || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistHt: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">Plaq</label>
                <input
                  type="text"
                  value={patient.checklistPlaquetas || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistPlaquetas: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">Leuco</label>
                <input
                  type="text"
                  value={patient.checklistLeucograma || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistLeucograma: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">Bast</label>
                <input
                  type="text"
                  value={patient.checklistBastoes || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistBastoes: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">INR</label>
                <input
                  type="text"
                  value={patient.checklistInr || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistInr: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
            </div>

            {/* Linha 2: Bioquímica (Na, K, Ureia, Creat, PCR, Trop) em 1 linha, sem placeholder */}
            <div className="grid grid-cols-6 gap-2">
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">Na</label>
                <input
                  type="text"
                  value={patient.checklistSodio || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistSodio: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">K</label>
                <input
                  type="text"
                  value={patient.checklistPotassio || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistPotassio: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">Ureia</label>
                <input
                  type="text"
                  value={patient.checklistUreia || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistUreia: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">Creat</label>
                <input
                  type="text"
                  value={patient.checklistCreatinina || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistCreatinina: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">PCR</label>
                <input
                  type="text"
                  value={patient.checklistPcr || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistPcr: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-900 text-center mb-1">Trop</label>
                <input
                  type="text"
                  value={patient.checklistTroponina || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistTroponina: e.target.value })}
                  className={`w-full px-1.5 py-1.5 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
            </div>

            {/* Linha 3: Outros Exames ocupando toda a largura */}
            <div>
              <label className="block text-[10.5px] font-black text-purple-900 uppercase tracking-wider mb-1.5 leading-none">Outros Exames</label>
              <input
                type="text"
                value={patient.checklistBioquimicaOutros || ''}
                onChange={(e) => updatePatient({ ...patient, checklistBioquimicaOutros: e.target.value })}
                className={`w-full px-3 py-2 bg-white border border-purple-200/80 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>

            {/* Linha 4 (Inferior): GASOMETRIA ARTERIAL em quadro cinza destacado */}
            <div className="bg-slate-200/85 p-2.5 rounded-lg border border-slate-300 shadow-2xs">
              <span className="block text-[10.5px] font-black text-slate-800 uppercase tracking-wider mb-1.5 leading-none">
                Gasometria Arterial
              </span>
              <div className="grid grid-cols-7 gap-1.5">
                <div>
                  <label className="block text-[9.5px] font-black text-slate-700 text-center mb-0.5">pH</label>
                  <input
                    type="text"
                    value={patient.checklistPh || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistPh: e.target.value })}
                    className={`w-full px-1 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-800 text-center ${theme.ringColor}`}
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-700 text-center mb-0.5">PaO2</label>
                  <input
                    type="text"
                    value={patient.checklistPao2 || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistPao2: e.target.value })}
                    className={`w-full px-1 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-800 text-center ${theme.ringColor}`}
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-700 text-center mb-0.5">PaCO2</label>
                  <input
                    type="text"
                    value={patient.checklistPaco2 || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistPaco2: e.target.value })}
                    className={`w-full px-1 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-800 text-center ${theme.ringColor}`}
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-700 text-center mb-0.5">HCO3</label>
                  <input
                    type="text"
                    value={patient.checklistHco3 || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistHco3: e.target.value })}
                    className={`w-full px-1 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-800 text-center ${theme.ringColor}`}
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-700 text-center mb-0.5">SaO2</label>
                  <input
                    type="text"
                    value={patient.checklistSao2 || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistSao2: e.target.value })}
                    className={`w-full px-1 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-800 text-center ${theme.ringColor}`}
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-700 text-center mb-0.5">P/F</label>
                  <input
                    type="text"
                    value={patient.checklistPf || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistPf: e.target.value })}
                    className={`w-full px-1 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-800 text-center ${theme.ringColor}`}
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-700 text-center mb-0.5">S/F</label>
                  <input
                    type="text"
                    value={patient.checklistSf || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistSf: e.target.value })}
                    className={`w-full px-1 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-800 text-center ${theme.ringColor}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* QUADRO INFERIOR 3 (Direita): CONDUTAS & PLANTONISTA EM DESTAQUE */}
        <div className="bg-amber-50/20 p-4 rounded-xl border-2 border-amber-300/80 shadow-2xs flex flex-col justify-between h-full min-h-[340px] text-left">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-amber-200/80 shrink-0">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={15} className="text-amber-700" />
              <span className="text-xs font-black text-amber-800 uppercase tracking-wider">Condutas & Plantonista</span>
            </div>
            <span className="text-[10.5px] font-black uppercase px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
              Plano do Dia
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-between gap-2.5">
            <div className="flex-1 flex flex-col">
              <textarea
                placeholder="Descreva pendências, intercorrências e condutas do dia..."
                value={patient.checklistCondutas || ''}
                onChange={(e) => updatePatient({ ...patient, checklistCondutas: e.target.value })}
                rows={8}
                className={`w-full flex-1 min-h-[210px] p-3 bg-white border border-amber-300 rounded-lg text-xs leading-relaxed focus:outline-none focus:ring-2 transition-all font-bold text-slate-800 resize-none custom-scrollbar ${theme.ringColor}`}
              />
            </div>

            {/* Rodapé em 1 linha: Médico Plantonista + Limpar Coluna */}
            <div className="pt-2 border-t border-amber-200/70">
              {!isConfirmingClearColumn ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] font-black text-amber-900 uppercase tracking-wider shrink-0">Plantonista:</span>
                  <input
                    type="text"
                    placeholder="Dr(a). Nome do Médico"
                    value={patient.checklistMedicoPlantonista || ''}
                    onChange={(e) => updatePatient({ ...patient, checklistMedicoPlantonista: e.target.value })}
                    className={`flex-1 min-w-0 px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs focus:outline-none focus:ring-2 transition-all font-bold text-slate-800 ${theme.ringColor}`}
                  />
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearColumn(true)}
                    title={`Limpar dados da Coluna ${activeIndex + 1}`}
                    className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10.5px] font-black uppercase transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                  >
                    <Trash2 size={13} className="text-red-600 shrink-0" />
                    <span>Limpar Coluna {activeIndex + 1}</span>
                  </button>
                </div>
              ) : (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-red-900">
                    Apagar dados da <strong>Coluna {activeIndex + 1}</strong>?
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleClearCurrentColumn}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-black uppercase transition-all cursor-pointer"
                    >
                      Sim, apagar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingClearColumn(false)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
