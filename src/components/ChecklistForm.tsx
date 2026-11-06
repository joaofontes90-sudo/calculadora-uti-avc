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
    <div className="space-y-3.5">
      {/* 6-Column Selector Dashboard with Pagination */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">
              Colunas de Checklist Diário (6 Colunas por Página)
            </h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Preencha as colunas do ciclo. Ao completar as 6 primeiras (1-6), avance para a próxima página.
            </p>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={handlePrevPage}
              className="px-2.5 py-1.5 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Página Anterior
            </button>

            <span className="px-3 py-1.5 rounded-xl text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-100">
              Página {currentPage} de {totalPages} (Cols. {startIndex + 1}–{startIndex + 6})
            </span>

            <button
              type="button"
              onClick={handleNextPage}
              className="px-2.5 py-1.5 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200"
            >
              Próxima Página
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 mt-2.5">
          {visibleChecklists.map((list, colOffset) => {
            const realIdx = startIndex + colOffset;
            const isActive = realIdx === activeIndex;
            const isFilled = !!list.checklistData;
            return (
              <button
                key={realIdx}
                type="button"
                onClick={() => setActiveIndex(realIdx)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between relative overflow-hidden group ${
                  isActive 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100' 
                    : isFilled
                      ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-500'
                }`}
              >
                {/* Active Indicator bar */}
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-300" />
                )}
                <div className="flex justify-between items-center w-full">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    Coluna {realIdx + 1}
                  </span>
                  {isFilled && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </div>
                <div className="mt-1">
                  <span className="text-[10px] font-black leading-tight block">
                    {list.checklistData || 'Vazia'}
                  </span>
                  <span className={`text-[8px] font-bold uppercase block mt-0.5 ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>
                    {isFilled ? 'Preenchida' : 'Aguardando'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
      
      {/* COLUNA 1: NEUROLOGIA, TERAPÊUTICA & CONDUTAS */}
      <div className="space-y-3">
        {/* CARD 1: AVALIAÇÃO NEUROLÓGICA & GERAL */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 space-y-2.5 shadow-sm text-left">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <Activity size={14} className="text-blue-600" />
            <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Avaliação Neurológica</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Data do Checklist</label>
              <input
                type="text"
                placeholder="DD/MM/AA"
                maxLength={8}
                value={patient.checklistData || ''}
                onChange={(e) => updatePatient({ ...patient, checklistData: handleDateMask(e.target.value) })}
                className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">NIHSS Atual</label>
              <input
                type="number"
                placeholder="Pontos"
                value={patient.checklistNihssAtual || ''}
                onChange={(e) => updatePatient({ ...patient, checklistNihssAtual: e.target.value })}
                className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Pupila</label>
              <input
                type="text"
                placeholder="Isocórica / Fotorreagente..."
                value={patient.checklistPup || ''}
                onChange={(e) => updatePatient({ ...patient, checklistPup: e.target.value })}
                className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  {patient.checklistGlasgow?.startsWith('RASS') ? 'RASS' : 'Glasgow'}
                </label>
                <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      if (patient.checklistGlasgow?.startsWith('RASS')) {
                        updatePatient({ ...patient, checklistGlasgow: '' });
                      }
                    }}
                    className={`px-1.5 py-0.2 text-[8px] font-black rounded transition-all ${
                      !patient.checklistGlasgow?.startsWith('RASS')
                        ? 'bg-blue-600 text-white'
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
                    className={`px-1.5 py-0.2 text-[8px] font-black rounded transition-all ${
                      patient.checklistGlasgow?.startsWith('RASS')
                        ? 'bg-blue-600 text-white'
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
                  placeholder="Valor (3-15)"
                  min="3"
                  max="15"
                  value={patient.checklistGlasgow || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistGlasgow: e.target.value })}
                  className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              ) : (
                <select
                  value={patient.checklistGlasgow || 'RASS: 0'}
                  onChange={(e) => updatePatient({ ...patient, checklistGlasgow: e.target.value })}
                  className={`w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                >
                  <option value="RASS: +4">RASS +4 (Combativo)</option>
                  <option value="RASS: +3">RASS +3 (Muito Agitado)</option>
                  <option value="RASS: +2">RASS +2 (Agitado)</option>
                  <option value="RASS: +1">RASS +1 (Inquieto)</option>
                  <option value="RASS: 0">RASS 0 (Alerta e Calmo)</option>
                  <option value="RASS: -1">RASS -1 (Sonolento)</option>
                  <option value="RASS: -2">RASS -2 (Sedação Leve)</option>
                  <option value="RASS: -3">RASS -3 (Sedação Moderada)</option>
                  <option value="RASS: -4">RASS -4 (Sedação Profunda)</option>
                  <option value="RASS: -5">RASS -5 (Indespertável)</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Respiração</label>
              <input
                type="text"
                placeholder="Sem alterações"
                value={patient.checklistResp || ''}
                onChange={(e) => updatePatient({ ...patient, checklistResp: e.target.value })}
                className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Déficit Motor</label>
              <input
                type="text"
                placeholder="Hemiparesia E / Sem déficit..."
                value={patient.checklistMotor || ''}
                onChange={(e) => updatePatient({ ...patient, checklistMotor: e.target.value })}
                className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
          </div>
        </div>

        {/* CARD 2: TERAPÊUTICA & MEDICAÇÕES */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 space-y-2.5 shadow-sm text-left">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <Pill size={14} className="text-blue-600" />
            <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Terapêutica & Medicações</span>
          </div>

          {/* ANTIBIÓTICO */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Antibioticoterapia</label>
            <div className="space-y-1.5">
              <div className="flex gap-1.5 items-center">
                <div className="flex gap-1 w-2/5 shrink-0">
                  {['Sim', 'Não'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updatePatient({ ...patient, checklistAntibiotico: patient.checklistAntibiotico === opt ? '' : (opt as any) })}
                      className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                        patient.checklistAntibiotico === opt
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
                {patient.checklistAntibiotico === 'Não' && (
                  <span className="text-[10px] text-slate-400 font-bold italic ml-1">Sem indicação no momento</span>
                )}
              </div>

              {patient.checklistAntibiotico !== 'Não' && (() => {
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
                  <div className="space-y-1.5 mt-1">
                    {displayList.map((abx, idx) => {
                      const parsed = parseAbxLine(abx);
                      return (
                        <div key={idx} className="flex gap-1.5 items-center">
                          <input
                            type="number"
                            min={0}
                            max={31}
                            placeholder="Dia (0-31)"
                            value={parsed.day}
                            onChange={(e) => handleAbxDayChange(idx, e.target.value)}
                            className={`w-24 shrink-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                          />
                          <input
                            type="text"
                            placeholder="Nome do antibiótico (Ex: Rocefin)"
                            value={parsed.name}
                            onChange={(e) => handleAbxNameChange(idx, e.target.value)}
                            className={`flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                          />
                          {displayList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAbx(idx)}
                              title="Remover este antibiótico"
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={handleAddAbx}
                      className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-2.5 py-1 rounded-xl transition-all border border-blue-200/60 shadow-xs"
                    >
                      <Plus size={12} />
                      <span>+ Adicionar antibiótico</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Antiagregante</label>
              <input
                type="text"
                placeholder="Qual / Dose / Horário"
                value={patient.checklistAntiagregante || ''}
                onChange={(e) => updatePatient({ ...patient, checklistAntiagregante: e.target.value })}
                className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Anticoagulante</label>
              <input
                type="text"
                placeholder="Qual / Dose / Horário"
                value={patient.checklistAnticoagulante || ''}
                onChange={(e) => updatePatient({ ...patient, checklistAnticoagulante: e.target.value })}
                className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
          </div>
        </div>

        {/* CARD 3: CONDUTAS, PLANTONISTA & APAGAR COLUNA */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 space-y-2.5 shadow-sm text-left">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <AlertCircle size={14} className="text-blue-600" />
            <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Condutas & Plantonista</span>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Condutas</label>
            <textarea
              placeholder="Descreva pendências, intercorrências e condutas do dia..."
              value={patient.checklistCondutas || ''}
              onChange={(e) => updatePatient({ ...patient, checklistCondutas: e.target.value })}
              rows={4}
              className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 custom-scrollbar ${theme.ringColor}`}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Médico Plantonista</label>
            <input
              type="text"
              placeholder="Dr(a). Nome do Médico"
              value={patient.checklistMedicoPlantonista || ''}
              onChange={(e) => updatePatient({ ...patient, checklistMedicoPlantonista: e.target.value })}
              className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
            />
          </div>

          {/* BOTÃO PARA APAGAR INFORMAÇÕES DESTA COLUNA */}
          <div className="pt-1 flex flex-col items-center gap-2">
            {!isConfirmingClearColumn ? (
              <button
                type="button"
                onClick={() => setIsConfirmingClearColumn(true)}
                className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]"
              >
                <Trash2 size={13} className="text-red-600 shrink-0" />
                <span>Limpar dados da Coluna {activeIndex + 1}</span>
              </button>
            ) : (
              <div className="w-full p-2.5 bg-red-50 border border-red-200 rounded-xl flex flex-col items-center justify-between gap-2 animate-in fade-in duration-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-red-950 text-xs font-bold text-center">
                  <AlertCircle size={15} className="text-red-600 shrink-0" />
                  <span>Apagar dados da <strong>Coluna {activeIndex + 1}</strong>?</span>
                </div>
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={handleClearCurrentColumn}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    Sim, apagar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearColumn(false)}
                    className="flex-1 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COLUNA 2: SUPORTE INTENSIVO & CUIDADOS CLÍNICOS */}
      <div className="space-y-3">
        {/* CARD 1: SUPORTE VENTILATÓRIO E DROGAS */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 space-y-2.5 shadow-sm text-left">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <Activity size={14} className="text-blue-600" />
            <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Suporte Ventilatório & Drogas</span>
          </div>

          {/* SEDAÇÃO */}
          <div>
            <div className="flex items-center justify-between mb-1 ml-1 pr-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Sedação</label>
              <button
                type="button"
                onClick={handleRefreshSedacao}
                title="Atualizar dose com as infusões ativas deste momento"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded-lg transition-colors border border-blue-200/60 shadow-xs"
              >
                <RefreshCw size={10} className="shrink-0" />
                <span>Atualizar</span>
              </button>
            </div>
            <div className="flex gap-1.5 mb-1.5">
              {['Sim', 'Não'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updatePatient({ ...patient, checklistSedacao: patient.checklistSedacao === opt ? '' : (opt as any) })}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                    patient.checklistSedacao === opt
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {opt.toUpperCase()}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Fármaco / Dose / RASS meta"
              value={patient.checklistSedacaoText || ''}
              onChange={(e) => updatePatient({ ...patient, checklistSedacaoText: e.target.value })}
              className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
            />
          </div>

          {/* ANALGESIA */}
          <div>
            <div className="flex items-center justify-between mb-1 ml-1 pr-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Analgesia</label>
              <button
                type="button"
                onClick={handleRefreshAnalgesia}
                title="Atualizar dose com as infusões ativas deste momento"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded-lg transition-colors border border-blue-200/60 shadow-xs"
              >
                <RefreshCw size={10} className="shrink-0" />
                <span>Atualizar</span>
              </button>
            </div>
            <div className="flex gap-1.5 mb-1.5">
              {['Sim', 'Não'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updatePatient({ ...patient, checklistAnalgesia: patient.checklistAnalgesia === opt ? '' : (opt as any) })}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                    patient.checklistAnalgesia === opt
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {opt.toUpperCase()}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Fármaco / Dose / Escala de Dor"
              value={patient.checklistAnalgesiaText || ''}
              onChange={(e) => updatePatient({ ...patient, checklistAnalgesiaText: e.target.value })}
              className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
            />
          </div>

          {/* DRUG VASOATIVAS (DVA) */}
          <div>
            <div className="flex items-center justify-between mb-1 ml-1 pr-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Drogas Vasoativas (DVA)</label>
              <button
                type="button"
                onClick={handleRefreshDva}
                title="Atualizar dose com as infusões ativas deste momento"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded-lg transition-colors border border-blue-200/60 shadow-xs"
              >
                <RefreshCw size={10} className="shrink-0" />
                <span>Atualizar</span>
              </button>
            </div>
            <div className="flex gap-1.5 mb-1.5">
              {['Sim', 'Não', 'NDA'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updatePatient({ ...patient, checklistDva: patient.checklistDva === opt ? '' : (opt as any) })}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                    patient.checklistDva === opt
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Fármaco / Vasopressor / Vazão / Alvo de PAM"
              value={patient.checklistDvaText || ''}
              onChange={(e) => updatePatient({ ...patient, checklistDvaText: e.target.value })}
              className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
            />
          </div>

          {/* BLOQUEADOR NEUROMUSCULAR */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Bloqueador Neuromuscular</label>
            <input
              type="text"
              placeholder="Qual / Dose / Observações"
              value={patient.checklistBloqueadorNeuromuscular || ''}
              onChange={(e) => updatePatient({ ...patient, checklistBloqueadorNeuromuscular: e.target.value })}
              className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
            />
          </div>

          {/* VENTILAÇÃO */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Ventilação (Selecione um ou mais)</label>
            <div className="grid grid-cols-3 gap-1 mb-1.5">
              {[
                { id: 'ar_ambiente', label: 'Ar Ambiente' },
                { id: 'venturi', label: 'Venturi' },
                { id: 'canula_nasal', label: 'Cânula Nasal' },
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
                    className={`py-1.5 px-1 rounded-xl text-[10px] font-black border transition-all text-center leading-tight ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="Observação / Outros Parâmetros"
              value={patient.checklistVentilacaoOutros || ''}
              onChange={(e) => updatePatient({ ...patient, checklistVentilacaoOutros: e.target.value })}
              className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
            />
          </div>

          {/* DIAS DE VM E DESMAME */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Dias de VM</label>
              <input
                type="number"
                placeholder="Nº dias"
                value={patient.checklistDiasVm || ''}
                onChange={(e) => updatePatient({ ...patient, checklistDiasVm: e.target.value })}
                className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Desmame VM ou O2</label>
              <div className="flex gap-1">
                {['Sim', 'Não', 'N/A'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updatePatient({ ...patient, checklistDesmameVm: patient.checklistDesmameVm === opt ? '' : (opt as any) })}
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                      patient.checklistDesmameVm === opt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: HEMODINÂMICA, LINHAS & CUIDADOS CLÍNICOS */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 space-y-2.5 shadow-sm text-left">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <Stethoscope size={14} className="text-blue-600" />
            <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Hemodinâmica & Cuidados</span>
          </div>

          {/* PAS x PAD */}
          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">PAS x PAD (Valores do Dia)</span>
            <div>
              <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5 ml-1">PAS - Pressão Arterial Sistólica</label>
              <input
                type="text"
                placeholder="PAS (Ex: 110 mmHg)"
                value={patient.checklistPas || ''}
                onChange={(e) => {
                  const newPas = e.target.value;
                  const combined = newPas || patient.checklistPad ? `${newPas || ''} x ${patient.checklistPad || ''}` : '';
                  updatePatient({ ...patient, checklistPas: newPas, checklistPasPad: combined });
                }}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
            <div>
              <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5 ml-1">PAD - Pressão Arterial Diastólica</label>
              <input
                type="text"
                placeholder="PAD (Ex: 70 mmHg)"
                value={patient.checklistPad || ''}
                onChange={(e) => {
                  const newPad = e.target.value;
                  const combined = patient.checklistPas || newPad ? `${patient.checklistPas || ''} x ${newPad || ''}` : '';
                  updatePatient({ ...patient, checklistPad: newPad, checklistPasPad: combined });
                }}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
          </div>

          {/* FEBRE */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Febre</label>
            <div className="flex gap-1.5">
              <div className="flex gap-1 w-1/2">
                {['Sim', 'Não'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updatePatient({ ...patient, checklistFebre: patient.checklistFebre === opt ? '' : (opt as any) })}
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                      patient.checklistFebre === opt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Ex: >37.8 °C"
                value={patient.checklistFebreTemp || ''}
                onChange={(e) => updatePatient({ ...patient, checklistFebreTemp: e.target.value })}
                className={`w-1/2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
          </div>

          {/* CONTROLE GLICÊMICO (HGT) */}
          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Controle Glicêmico (HGT)</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5 ml-1">Maior HGT &gt;</label>
                <input
                  type="number"
                  placeholder="Max"
                  value={patient.checklistHgtMaior || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistHgtMaior: e.target.value })}
                  className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
              <div>
                <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5 ml-1">Menor HGT &lt;</label>
                <input
                  type="number"
                  placeholder="Min"
                  value={patient.checklistHgtMenor || ''}
                  onChange={(e) => updatePatient({ ...patient, checklistHgtMenor: e.target.value })}
                  className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                />
              </div>
            </div>
          </div>

          {/* ACESSO VENOSO */}
          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Acesso Venoso</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Local (Ex: CVC Subclávia D)"
                value={patient.checklistAcessoLocal || ''}
                onChange={(e) => updatePatient({ ...patient, checklistAcessoLocal: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
              <input
                type="number"
                placeholder="Dia do acesso"
                value={patient.checklistAcessoDia || ''}
                onChange={(e) => updatePatient({ ...patient, checklistAcessoDia: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
          </div>

          {/* DIETA */}
          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Dieta</span>
              <div className="flex gap-1.5 w-24 shrink-0">
                {['Sim', 'Não'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updatePatient({ ...patient, checklistDieta: patient.checklistDieta === opt ? '' : (opt as any) })}
                    className={`flex-1 py-0.5 rounded-lg text-[9px] font-black border transition-all ${
                      patient.checklistDieta === opt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <input
                type="text"
                placeholder="Tipo da Dieta (Ex: Enteral 1.5kcal / Oral branda)"
                value={patient.checklistDietaTipo || ''}
                onChange={(e) => updatePatient({ ...patient, checklistDietaTipo: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
          </div>

          {/* BALANÇO HÍDRICO & DIURESE */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Balanço Hídrico (24h)</label>
              <input
                type="text"
                placeholder="Ex: +450 ml / -200 ml"
                value={patient.checklistBalançoHidrico || ''}
                onChange={(e) => updatePatient({ ...patient, checklistBalançoHidrico: e.target.value })}
                className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 leading-none">Diurese</label>
              <input
                type="text"
                placeholder="Ex: 1500 ml"
                value={patient.checklistDiurese || ''}
                onChange={(e) => updatePatient({ ...patient, checklistDiurese: e.target.value })}
                className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
          </div>

          {/* EVACUAÇÕES */}
          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Evacuações</span>
              <div className="flex gap-1.5 w-24 shrink-0">
                {['Sim', 'Não'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updatePatient({ ...patient, checklistEvacuacoes: patient.checklistEvacuacoes === opt ? '' : (opt as any) })}
                    className={`flex-1 py-0.5 rounded-lg text-[9px] font-black border transition-all ${
                      patient.checklistEvacuacoes === opt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              placeholder="Frequência / Aspecto"
              value={patient.checklistEvacuacoesAspecto || ''}
              onChange={(e) => updatePatient({ ...patient, checklistEvacuacoesAspecto: e.target.value })}
              className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
            />
          </div>

          {/* ESCARAS */}
          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Lesão por Pressão (Escaras)</span>
              <div className="flex gap-1.5 w-24 shrink-0">
                {['Sim', 'Não'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updatePatient({ ...patient, checklistEscaras: patient.checklistEscaras === opt ? '' : (opt as any) })}
                    className={`flex-1 py-0.5 rounded-lg text-[9px] font-black border transition-all ${
                      patient.checklistEscaras === opt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Região / Local"
                value={patient.checklistEscarasLocal || ''}
                onChange={(e) => updatePatient({ ...patient, checklistEscarasLocal: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="Estágio / Aspecto"
                value={patient.checklistEscarasAspecto || ''}
                onChange={(e) => updatePatient({ ...patient, checklistEscarasAspecto: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* COLUNA 3: LABORATÓRIO & MONITORIZAÇÃO */}
      <div className="space-y-3">
        {/* CARD 1: EXAMES, LABS E MONITORIZAÇÃO */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 space-y-2.5 shadow-sm text-left">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <Droplets size={14} className="text-blue-600" />
            <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Laboratório & Exames</span>
          </div>

          {/* GASOMETRIA */}
          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Gasometria</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="pH"
                value={patient.checklistPh || ''}
                onChange={(e) => updatePatient({ ...patient, checklistPh: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="PaO2 / PaCO2"
                value={patient.checklistPao2Paco2 || ''}
                onChange={(e) => updatePatient({ ...patient, checklistPao2Paco2: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="HCO3 / SaO2"
                value={patient.checklistHco3Sao2 || ''}
                onChange={(e) => updatePatient({ ...patient, checklistHco3Sao2: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="P/F ou S/F"
                value={patient.checklistPfSf || ''}
                onChange={(e) => updatePatient({ ...patient, checklistPfSf: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
          </div>

          {/* HEMOGRAMA */}
          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Hemograma</span>
            <div className="grid grid-cols-3 gap-1">
              <input
                type="text"
                placeholder="Hb"
                value={patient.checklistHb || ''}
                onChange={(e) => updatePatient({ ...patient, checklistHb: e.target.value })}
                className={`px-1.5 py-1 bg-white border border-slate-200 rounded-xl text-[11px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="Ht"
                value={patient.checklistHt || ''}
                onChange={(e) => updatePatient({ ...patient, checklistHt: e.target.value })}
                className={`px-1.5 py-1 bg-white border border-slate-200 rounded-xl text-[11px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="Plaquetas"
                value={patient.checklistPlaquetas || ''}
                onChange={(e) => updatePatient({ ...patient, checklistPlaquetas: e.target.value })}
                className={`px-1.5 py-1 bg-white border border-slate-200 rounded-xl text-[11px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Leucograma"
                value={patient.checklistLeucograma || ''}
                onChange={(e) => updatePatient({ ...patient, checklistLeucograma: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="Bastões"
                value={patient.checklistBastoes || ''}
                onChange={(e) => updatePatient({ ...patient, checklistBastoes: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
          </div>

          {/* BIOQUÍMICA */}
          <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Bioquímica</span>
            <div className="grid grid-cols-4 gap-1">
              <input
                type="text"
                placeholder="INR"
                value={patient.checklistInr || ''}
                onChange={(e) => updatePatient({ ...patient, checklistInr: e.target.value })}
                className={`px-1 py-1 bg-white border border-slate-200 rounded-xl text-[10px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="Na"
                value={patient.checklistSodio || ''}
                onChange={(e) => updatePatient({ ...patient, checklistSodio: e.target.value })}
                className={`px-1 py-1 bg-white border border-slate-200 rounded-xl text-[10px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="K"
                value={patient.checklistPotassio || ''}
                onChange={(e) => updatePatient({ ...patient, checklistPotassio: e.target.value })}
                className={`px-1 py-1 bg-white border border-slate-200 rounded-xl text-[10px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="Mg"
                value={patient.checklistMagnesio || ''}
                onChange={(e) => updatePatient({ ...patient, checklistMagnesio: e.target.value })}
                className={`px-1 py-1 bg-white border border-slate-200 rounded-xl text-[10px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
            <div className="grid grid-cols-4 gap-1">
              <input
                type="text"
                placeholder="P"
                value={patient.checklistFosforo || ''}
                onChange={(e) => updatePatient({ ...patient, checklistFosforo: e.target.value })}
                className={`px-1 py-1 bg-white border border-slate-200 rounded-xl text-[10px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="Trop."
                value={patient.checklistTroponina || ''}
                onChange={(e) => updatePatient({ ...patient, checklistTroponina: e.target.value })}
                className={`px-1 py-1 bg-white border border-slate-200 rounded-xl text-[10px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="Ureia"
                value={patient.checklistUreia || ''}
                onChange={(e) => updatePatient({ ...patient, checklistUreia: e.target.value })}
                className={`px-1 py-1 bg-white border border-slate-200 rounded-xl text-[10px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
              <input
                type="text"
                placeholder="Creat."
                value={patient.checklistCreatinina || ''}
                onChange={(e) => updatePatient({ ...patient, checklistCreatinina: e.target.value })}
                className={`px-1 py-1 bg-white border border-slate-200 rounded-xl text-[10px] focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
              />
            </div>
            <div className="pt-0.5">
              <input
                type="text"
                placeholder="Outros (bioquímica)"
                value={patient.checklistBioquimicaOutros || ''}
                onChange={(e) => updatePatient({ ...patient, checklistBioquimicaOutros: e.target.value })}
                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>
          </div>

          {/* OUTROS EXAMES */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-slate-50/50 rounded-xl border border-slate-200/40 flex flex-col justify-between items-center gap-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">ECG Exame</span>
              <div className="flex gap-1.5 w-full shrink-0">
                {['Sim', 'Não'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updatePatient({ ...patient, checklistEcgExame: patient.checklistEcgExame === opt ? '' : (opt as any) })}
                    className={`flex-1 py-0.5 rounded-lg text-[8px] font-black border transition-all ${
                      patient.checklistEcgExame === opt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-100'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2 bg-slate-50/50 rounded-xl border border-slate-200/40 flex flex-col justify-between items-center gap-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Eco / Doppler</span>
              <div className="flex gap-1.5 w-full shrink-0">
                {['Sim', 'Não'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updatePatient({ ...patient, checklistEcoDoppler: patient.checklistEcoDoppler === opt ? '' : (opt as any) })}
                    className={`flex-1 py-0.5 rounded-lg text-[8px] font-black border transition-all ${
                      patient.checklistEcoDoppler === opt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-100'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
