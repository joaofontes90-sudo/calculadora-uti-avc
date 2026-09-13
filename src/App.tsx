import React, { useEffect, useMemo, useState } from 'react';
import { 
  Activity, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Plus, 
  Trash2, 
  Scale, 
  Droplets,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  Save,
  Pill,
  Brain,
  Heart,
  ExternalLink,
  Search,
  Copy,
  Check,
  Edit2,
  Printer,
  Maximize2,
  ClipboardList,
  Ruler,
  FileText,
  ArrowLeftRight,
  MessageSquare,
  Settings,
  History,
  RotateCcw,
  Clock,
  Archive,
  UserCheck,
  FileUp,
  UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { ClinicalForm } from './components/ClinicalForm';
import { ChecklistForm } from './components/ChecklistForm';
import { generateEvolucaoDocx } from './utils/docxGenerator';
import { WhatsAppSettingsModal } from './components/WhatsAppSettingsModal';
import { WhatsAppSendModal } from './components/WhatsAppSendModal';
import { openEvolucaoTab } from './utils/evolucaoTab';
import { parseEvolutionDocxFile, ParsedEvolutionData } from './utils/evolutionParser';

// --- Constants & Types ---

type Unit = 'mcg/kg/h' | 'mg/kg/h' | 'mcg/kg/min' | 'mg/min' | 'UI/min' | 'U/min' | 'mcg/min' | 'mg/h' | 'mcg/h';

export interface Dilution {
  id: string;
  name: string;
  concentration: number; // in the unit specified by drug units relative to drug concentration
  info: string;
  unit?: Unit;
  minDose?: number;
  maxDose?: number;
}

export interface DrugDefinition {
  id: string;
  name: string;
  category: 'Sedativo' | 'Analgésico' | 'Vasoativa' | 'Bloqueador Neuromuscular';
  unit: Unit;
  minDose: number;
  maxDose: number;
  dilutions: Dilution[];
}

export const MEDS: DrugDefinition[] = [
  {
    id: 'midazolam',
    name: 'Midazolam',
    category: 'Sedativo',
    unit: 'mg/kg/h',
    minDose: 0.02,
    maxDose: 0.6,
    dilutions: [
      { id: 'mida_std', name: 'Padrão (1 mg/ml)', concentration: 1, info: '40 ml (200mg) + 160 ml SF' },
      { id: 'mida_conc', name: 'Concentrada (2 mg/ml)', concentration: 2, info: '40 ml (200mg) + 60 ml SF' },
      { id: 'mida_pure', name: 'Puro (5 mg/ml)', concentration: 5, info: '50 ml puro (original 5mg/ml)' },
    ]
  },
  {
    id: 'propofol',
    name: 'Propofol',
    category: 'Sedativo',
    unit: 'mcg/kg/min',
    minDose: 5,
    maxDose: 80,
    dilutions: [
      { id: 'prop_pure', name: 'Puro (10 mg/ml = 10.000 mcg/ml)', concentration: 10000, info: 'Puro 1% (apresentação padrão 10mg/ml)' }
    ]
  },
  {
    id: 'precedex',
    name: 'Precedex (Dexmedetomidina)',
    category: 'Sedativo',
    unit: 'mcg/kg/h',
    minDose: 0.2,
    maxDose: 1.5,
    dilutions: [
      { id: 'prec_std', name: 'Padrão (2 mcg/ml)', concentration: 2, info: '2 ml (200mcg) + 98 ml SF' },
      { id: 'prec_conc', name: 'Concentrada (4 mcg/ml)', concentration: 4, info: '4 ml (400mcg) + 96 ml SF' },
    ]
  },
  {
    id: 'fentanil',
    name: 'Fentanil',
    category: 'Analgésico',
    unit: 'mcg/kg/h',
    minDose: 0.5,
    maxDose: 5.0,
    dilutions: [
      { id: 'fent_std', name: 'Padrão (10 mcg/ml)', concentration: 10, info: '40 ml (2000mcg) + 160 ml SF' },
      { id: 'fent_conc', name: 'Concentrada (20 mcg/ml)', concentration: 20, info: '40 ml (2000mcg) + 60 ml SF' },
      { id: 'fent_pure', name: 'Puro (50 mcg/ml)', concentration: 50, info: '50 ml puro (original 50mcg/ml)' },
    ]
  },
  {
    id: 'ketamina',
    name: 'Cetamina / Ketamina',
    category: 'Analgésico',
    unit: 'mg/kg/h',
    minDose: 0.1,
    maxDose: 2.0,
    dilutions: [
      { id: 'keta_std', name: 'Padrão (5 mg/ml)', concentration: 5, info: '10 ml (500mg) + 90 ml SG 5%' }
    ]
  },
  {
    id: 'morfina',
    name: 'Morfina',
    category: 'Analgésico',
    unit: 'mg/h',
    minDose: 0.5,
    maxDose: 5.0,
    dilutions: [
      { id: 'morf_std', name: 'Morfina (0,2 mg/ml)', concentration: 0.2, info: 'MORFINA (10 MG/ML) 02 AMP + SF 0,9% 98 ML' }
    ]
  },
  {
    id: 'noradrenalina',
    name: 'Noradrenalina',
    category: 'Vasoativa',
    unit: 'mcg/kg/min',
    minDose: 0.01,
    maxDose: 3.0,
    dilutions: [
      { id: 'nora_std', name: '100 mcg/ml (Padrão)', concentration: 100, info: '5 ampolas (20mg) + 180 ml SG (Total 200ml)' },
      { id: 'nora_conc', name: '200 mcg/ml (Concentrada)', concentration: 200, info: '5 ampolas (20mg) + 80 ml SG (Total 100ml)' },
    ]
  },
  {
    id: 'vasopressina',
    name: 'Vasopressina',
    category: 'Vasoativa',
    unit: 'UI/min',
    minDose: 0.01,
    maxDose: 0.04,
    dilutions: [
      { id: 'vaso_std', name: 'Padrão (0,2 UI/ml)', concentration: 0.2, info: '1 ml (20U) + 99 ml SG 5%' }
    ]
  },
  {
    id: 'dobutamina',
    name: 'Dobutamina',
    category: 'Vasoativa',
    unit: 'mcg/kg/min',
    minDose: 2.5,
    maxDose: 20.0,
    dilutions: [
      { id: 'dobu_conc', name: 'Concentrada (4 mg/ml)', concentration: 4000, info: 'Diluição concentrada 4000 mcg/ml' }
    ]
  },
  {
    id: 'dopamina',
    name: 'Dopamina',
    category: 'Vasoativa',
    unit: 'mcg/kg/min',
    minDose: 2.0,
    maxDose: 20.0,
    dilutions: [
      { id: 'dopa_std', name: 'Padrão (1 mg/ml)', concentration: 1000, info: '5 ampolas (250mg/10ml) + 200 ml SG 5% (1000 mcg/ml)' },
      { id: 'dopa_conc', name: 'Concentrada (2 mg/ml)', concentration: 2000, info: '5 ampolas (250mg/10ml) + 75 ml SG 5% (2000 mcg/ml)' }
    ]
  },
  {
    id: 'nitroglicerina',
    name: 'Tridil (Nitroglicerina)',
    category: 'Vasoativa',
    unit: 'mcg/min',
    minDose: 5,
    maxDose: 200,
    dilutions: [
      { id: 'nitro_std', name: 'Tridil / Nitroglicerina (200 mcg/ml)', concentration: 200, info: 'nitroglicerina (50mg/10ml) 10ml + 240ml sg 5% (concentração final 200mcg/ml)' }
    ]
  },
  {
    id: 'nipride',
    name: 'Niprid (Nipride)',
    category: 'Vasoativa',
    unit: 'mcg/kg/min',
    minDose: 0.25,
    maxDose: 10.0,
    dilutions: [
      { id: 'nipride_std', name: 'Nipride (200 mcg/ml)', concentration: 200, info: 'nipride (50mg/2ml) 2ml + 248ml sg 5% (concentração final 200mcg/ml)' }
    ]
  },
  {
    id: 'adrenalina',
    name: 'Adrenalina',
    category: 'Vasoativa',
    unit: 'mcg/kg/min',
    minDose: 0.01,
    maxDose: 2.0,
    dilutions: [
      { id: 'adrenalina_std', name: 'Adrenalina (100 mcg/ml)', concentration: 100, info: 'adrenalina (1mg/1ml) 10ml + 90 ml sg 5% (concentração final 100mcg/ml)' }
    ]
  },
  {
    id: 'rocuronio',
    name: 'Rocurônio',
    category: 'Bloqueador Neuromuscular',
    unit: 'mg/kg/h',
    minDose: 0.3,
    maxDose: 0.6,
    dilutions: [
      { id: 'rocuronio_conc', name: 'Concentrada (2,5 mg/ml)', concentration: 2.5, info: 'rocurônio (50mg/5ml) 25ml + 75ml sg 5% (concentração final concentrada 2,5mg/ml)' },
      { id: 'rocuronio_std', name: 'Padrão (1 mg/ml)', concentration: 1.0, info: 'rocurônio (50mg/5ml) 25ml + 225ml sg 5% (concentração final padrão 1mg/ml)' }
    ]
  }
];

// --- Utility Components ---

const Card = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    id="card-container"
    onClick={onClick}
    className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 ${className}`}
  >
    {children}
  </div>
);

interface BadgeProps {
  children: React.ReactNode;
  color?: "blue" | "red" | "green" | "yellow" | "purple" | "gray";
  key?: React.Key;
}

const Badge = ({ children, color = "blue" }: BadgeProps) => {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    red: "bg-red-50 text-red-700 border-red-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    gray: "bg-slate-50 text-slate-500 border-slate-200",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border uppercase tracking-tighter ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
};

// --- Logic Helpers ---

export const getEffectiveUnit = (drug: DrugDefinition, dilution?: Dilution): Unit => {
  if (dilution && dilution.unit) return dilution.unit;
  return drug.unit;
};

export const getMinDose = (drug: DrugDefinition, dilution?: Dilution): number => {
  if (dilution && dilution.minDose !== undefined) return dilution.minDose;
  return drug.minDose;
};

export const getMaxDose = (drug: DrugDefinition, dilution?: Dilution): number => {
  if (dilution && dilution.maxDose !== undefined) return dilution.maxDose;
  return drug.maxDose;
};

export const formatDoseValue = (dose: number): string => {
  if (dose === 0) return '0,00';
  let str: string;
  if (dose < 0.01) {
    str = dose.toFixed(4);
  } else if (dose < 0.1) {
    str = dose.toFixed(3);
  } else {
    str = dose.toFixed(2);
  }
  return str.replace('.', ',');
};

export const calculateDose = (vazao: number, weight: number, drug: DrugDefinition, dilution: Dilution) => {
  if (!vazao || !drug || !dilution) return 0;
  
  const conc = dilution.concentration;
  const unit = getEffectiveUnit(drug, dilution);
  const isWeightNeeded = ['mcg/kg/h', 'mg/kg/h', 'mcg/kg/min'].includes(unit);
  
  if (isWeightNeeded && !weight) return 0;

  switch (unit) {
    case 'mg/h':
    case 'mcg/h':
      return vazao * conc;
    case 'mcg/kg/h':
    case 'mg/kg/h':
      return (vazao * conc) / weight;
    case 'mcg/kg/min':
      return (vazao * conc) / (weight * 60);
    case 'mg/min':
    case 'U/min':
    case 'UI/min':
    case 'mcg/min':
      return (vazao * conc) / 60;
    default:
      return 0;
  }
};

export const VENTILATION_LABELS: Record<string, string> = {
  ar_ambiente: 'Ar Ambiente',
  AA: 'Ar Ambiente',
  venturi: 'Venturi',
  VNT: 'Venturi',
  canula_nasal: 'Cânula Nasal',
  CN: 'Cânula Nasal',
  ventilacao_mecanica: 'VM',
  VM: 'VM',
  tot: 'TOT',
  tqt: 'TQT',
};

export const formatVentilacaoItem = (v: string): string => {
  if (!v) return '';
  if (VENTILATION_LABELS[v]) return VENTILATION_LABELS[v];
  return v
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// --- Daily Checklist Interface & Helper ---

export interface DailyChecklist {
  checklistData?: string;
  checklistNihssAtual?: string;
  checklistGlasgow?: string;
  checklistEcgCheck?: string;
  checklistPup?: string;
  checklistResp?: string;
  checklistMotor?: string;
  checklistSedacao?: 'Sim' | 'Não' | '';
  checklistSedacaoText?: string;
  checklistAnalgesia?: 'Sim' | 'Não' | '';
  checklistAnalgesiaText?: string;
  checklistDva?: 'Sim' | 'Não' | 'NDA' | '';
  checklistDvaText?: string;
  checklistBloqueadorNeuromuscular?: string;
  checklistPasPad?: string;
  checklistPas?: string;
  checklistPad?: string;
  checklistVentilacao?: string[];
  checklistVentilacaoOutros?: string;
  checklistDiasVm?: string;
  checklistDesmameVm?: 'Sim' | 'Não' | 'N/A' | '';
  checklistFisioGrauForca?: string;
  checklistFisioTonus?: string;
  checklistContTroncoCervical?: string;
  checklistFonoaudiologia?: string;
  checklistDisfagiaLinguagem?: string;
  checklistFebre?: 'Sim' | 'Não' | '';
  checklistFebreTemp?: string;
  checklistAntibiotico?: 'Sim' | 'Não' | '';
  checklistAntibioticoText?: string;
  checklistAntiagregante?: string;
  checklistAnticoagulante?: string;
  checklistAcessoLocal?: string;
  checklistAcessoDia?: string;
  checklistDieta?: 'Sim' | 'Não' | '';
  checklistDietaTipo?: string;
  checklistDietaInicio?: string;
  checklistEvacuacoes?: 'Sim' | 'Não' | '';
  checklistEvacuacoesAspecto?: string;
  checklistEscaras?: 'Sim' | 'Não' | '';
  checklistEscarasLocal?: string;
  checklistEscarasAspecto?: string;
  checklistBalançoHidrico?: string;
  checklistDiurese?: string;
  checklistPh?: string;
  checklistPao2Paco2?: string;
  checklistHco3Sao2?: string;
  checklistPfSf?: string;
  checklistHgtMaior?: string;
  checklistHgtMenor?: string;
  checklistHb?: string;
  checklistHt?: string;
  checklistPlaquetas?: string;
  checklistLeucograma?: string;
  checklistBastoes?: string;
  checklistInr?: string;
  checklistSodio?: string;
  checklistPotassio?: string;
  checklistMagnesio?: string;
  checklistFosforo?: string;
  checklistTroponina?: string;
  checklistUreia?: string;
  checklistCreatinina?: string;
  checklistBioquimicaOutros?: string;
  checklistEcgExame?: 'Sim' | 'Não' | '';
  checklistEcoDoppler?: 'Sim' | 'Não' | '';
  checklistPendencias?: string;
  checklistIntercorrencias?: string;
  checklistCondutas?: string;
  checklistMedicoPlantonista?: string;
}

export const ensureDailyChecklists = (p: Patient): DailyChecklist[] => {
  if (!p.dailyChecklists || !Array.isArray(p.dailyChecklists)) {
    const firstChecklist: DailyChecklist = {
      checklistData: p.checklistData,
      checklistNihssAtual: p.checklistNihssAtual,
      checklistGlasgow: p.checklistGlasgow,
      checklistPup: p.checklistPup,
      checklistResp: p.checklistResp,
      checklistMotor: p.checklistMotor,
      checklistSedacao: p.checklistSedacao,
      checklistSedacaoText: p.checklistSedacaoText,
      checklistAnalgesia: p.checklistAnalgesia,
      checklistAnalgesiaText: p.checklistAnalgesiaText,
      checklistDva: p.checklistDva,
      checklistDvaText: p.checklistDvaText,
      checklistBloqueadorNeuromuscular: p.checklistBloqueadorNeuromuscular,
      checklistPasPad: p.checklistPasPad,
      checklistPas: p.checklistPas,
      checklistPad: p.checklistPad,
      checklistVentilacao: p.checklistVentilacao,
      checklistVentilacaoOutros: p.checklistVentilacaoOutros,
      checklistDiasVm: p.checklistDiasVm,
      checklistDesmameVm: p.checklistDesmameVm,
      checklistFisioGrauForca: p.checklistFisioGrauForca,
      checklistFisioTonus: p.checklistFisioTonus,
      checklistContTroncoCervical: p.checklistContTroncoCervical,
      checklistFonoaudiologia: p.checklistFonoaudiologia,
      checklistDisfagiaLinguagem: p.checklistDisfagiaLinguagem,
      checklistFebre: p.checklistFebre,
      checklistFebreTemp: p.checklistFebreTemp,
      checklistAntibiotico: p.checklistAntibiotico,
      checklistAntibioticoText: p.checklistAntibioticoText,
      checklistAntiagregante: p.checklistAntiagregante,
      checklistAnticoagulante: p.checklistAnticoagulante,
      checklistAcessoLocal: p.checklistAcessoLocal,
      checklistAcessoDia: p.checklistAcessoDia,
      checklistDieta: p.checklistDieta,
      checklistDietaTipo: p.checklistDietaTipo,
      checklistDietaInicio: p.checklistDietaInicio,
      checklistEvacuacoes: p.checklistEvacuacoes,
      checklistEvacuacoesAspecto: p.checklistEvacuacoesAspecto,
      checklistEscaras: p.checklistEscaras,
      checklistEscarasLocal: p.checklistEscarasLocal,
      checklistEscarasAspecto: p.checklistEscarasAspecto,
      checklistBalançoHidrico: p.checklistBalançoHidrico,
      checklistDiurese: p.checklistDiurese,
      checklistPh: p.checklistPh,
      checklistPao2Paco2: p.checklistPao2Paco2,
      checklistHco3Sao2: p.checklistHco3Sao2,
      checklistPfSf: p.checklistPfSf,
      checklistHgtMaior: p.checklistHgtMaior,
      checklistHgtMenor: p.checklistHgtMenor,
      checklistHb: p.checklistHb,
      checklistHt: p.checklistHt,
      checklistPlaquetas: p.checklistPlaquetas,
      checklistLeucograma: p.checklistLeucograma,
      checklistBastoes: p.checklistBastoes,
      checklistInr: p.checklistInr,
      checklistSodio: p.checklistSodio,
      checklistPotassio: p.checklistPotassio,
      checklistMagnesio: p.checklistMagnesio,
      checklistFosforo: p.checklistFosforo,
      checklistTroponina: p.checklistTroponina,
      checklistUreia: p.checklistUreia,
      checklistCreatinina: p.checklistCreatinina,
      checklistBioquimicaOutros: p.checklistBioquimicaOutros,
      checklistEcgExame: p.checklistEcgExame,
      checklistEcoDoppler: p.checklistEcoDoppler,
      checklistPendencias: p.checklistPendencias,
      checklistIntercorrencias: p.checklistIntercorrencias,
      checklistCondutas: p.checklistCondutas,
      checklistMedicoPlantonista: p.checklistMedicoPlantonista,
    };
    const lists = [firstChecklist];
    for (let i = 1; i < 6; i++) {
      lists.push({});
    }
    return lists;
  }
  const lists = [...p.dailyChecklists];
  while (lists.length % 6 !== 0 || lists.length < 6) {
    lists.push({});
  }
  return lists;
};

export const getLastFilledPageLists = (lists: DailyChecklist[]): { pageLists: DailyChecklist[]; startColumn: number } => {
  if (!lists || lists.length === 0) {
    return { pageLists: [], startColumn: 1 };
  }

  const totalPages = Math.max(1, Math.ceil(lists.length / 6));
  let lastFilledPageIndex = 0;

  for (let pIndex = 0; pIndex < totalPages; pIndex++) {
    const pageSlice = lists.slice(pIndex * 6, pIndex * 6 + 6);
    const hasData = pageSlice.some(item => {
      if (!item) return false;
      return Object.values(item).some(v => {
        if (Array.isArray(v)) return v.length > 0;
        return v !== undefined && v !== null && String(v).trim() !== '';
      });
    });
    if (hasData) {
      lastFilledPageIndex = pIndex;
    }
  }

  const startIndex = lastFilledPageIndex * 6;
  const pageLists = lists.slice(startIndex, startIndex + 6);

  while (pageLists.length < 6) {
    pageLists.push({});
  }

  return {
    pageLists,
    startColumn: startIndex + 1,
  };
};

export const isCranialTc = (laudo?: string, defaultIfEmpty = true): boolean => {
  if (!laudo || !laudo.trim()) return defaultIfEmpty;
  const upper = laudo.toUpperCase();
  const hasCranial = /CR[AÁÂ]NIO|ENC[EÉ]FAL|CEREBR|VENTR[IÍ]CUL|CISTERN|MEN[IÍ]NG|SUBARACN|ISQUEMIA CEREBRAL|AVC/i.test(upper);
  const hasNonCranial = /T[OÓ]RAX|ABDOM|PELV|PULM[AÃ]O|PULMONAR|PLEUR|MEDIAST|LOMBAR|CERVICAL|DORSAL/i.test(upper);
  if (hasNonCranial && !hasCranial) return false;
  return true;
};

export const getFirstAndLastCranialTcs = (p: Patient) => {
  let firstData = '';
  let firstLaudo = '';
  let firstLabel = 'TC de Crânio Admissão';

  let lastData = '';
  let lastLaudo = '';
  let lastLabel = 'TC de Crânio Controle';

  // 1. Verifica se a TC de Admissão é de crânio
  if (isCranialTc(p.tcAdmissaoLaudo)) {
    firstData = p.tcAdmissaoData || '';
    firstLaudo = p.tcAdmissaoLaudo || '';
  }

  // 2. Filtra todas as tomografias de controle que sejam de crânio (exclui tórax/abdome)
  const cranialControles = (p.tcControles || [])
    .map((tc, idx) => ({ tc, idx }))
    .filter(item => Boolean(item.tc.data || item.tc.laudo) && isCranialTc(item.tc.laudo));

  // Se a admissão não foi de crânio mas há controles de crânio, usa o primeiro controle como primeiro
  if (!firstData && !firstLaudo && cranialControles.length > 0) {
    const first = cranialControles[0];
    firstData = first.tc.data || '';
    firstLaudo = first.tc.laudo || '';
    firstLabel = `TC de Crânio #${first.idx + 1} (Primeira)`;

    if (cranialControles.length > 1) {
      const last = cranialControles[cranialControles.length - 1];
      lastData = last.tc.data || '';
      lastLaudo = last.tc.laudo || '';
      lastLabel = `TC de Crânio #${last.idx + 1} (Última)`;
    }
  } else if (cranialControles.length > 0) {
    const last = cranialControles[cranialControles.length - 1];
    lastData = last.tc.data || '';
    lastLaudo = last.tc.laudo || '';
    lastLabel = cranialControles.length > 1
      ? `TC de Crânio Controle #${last.idx + 1} (Última)`
      : `TC de Crânio Controle #${last.idx + 1}`;
  } else if (p.tcControleData || p.tcControleLaudo) {
    if (isCranialTc(p.tcControleLaudo)) {
      lastData = p.tcControleData || '';
      lastLaudo = p.tcControleLaudo || '';
    }
  }

  return {
    firstData,
    firstLaudo,
    firstLabel,
    lastData,
    lastLaudo,
    lastLabel
  };
};

// --- Main Patient Component ---

export interface TcControleItem {
  id: string;
  data: string;
  laudo: string;
}

export interface InfusionRow {
  id: string;
  drugId: string;
  dilutionId: string;
  flowRate: string; // string to handle input empty states
  isMinimized?: boolean;
}

export interface Patient {
  id: number;
  weight: string;
  height?: string;
  infusions: InfusionRow[];
  isExpanded: boolean;
  dailyChecklists?: DailyChecklist[];
  name?: string;
  age?: string;
  tcControles?: TcControleItem[];

  gender?: 'Masculino' | 'Feminino' | '';
  registro?: string;
  nomeMae?: string;
  dataNascimento?: string;
  dataIctus?: string;
  horaIctus?: string;
  trombolise?: 'Sim' | 'Não' | '';
  tromboliseDataHora?: string;
  dataAdmissao?: string;
  nihssAdmissao?: string;
  rankinAdm?: string;
  rankinAlta?: string;
  sintomasAdmissao?: string;
  paSistolica?: string;
  paDiastolica?: string;
  duracaoSintomas?: '< 10 min' | '10-59 min' | '> 60 min' | '';
  comorbidades?: string;
  tcAdmissaoData?: string;
  tcAdmissaoLaudo?: string;
  angiotomoDescricao?: string;
  tcControleData?: string;
  tcControleLaudo?: string;
  ecgData?: string;
  ecgLaudo?: string;
  // --- Checklist Fields ---
  checklistData?: string;
  checklistNihssAtual?: string;
  checklistGlasgow?: string;
  checklistEcgCheck?: string;
  checklistPup?: string;
  checklistResp?: string;
  checklistMotor?: string;
  checklistSedacao?: 'Sim' | 'Não' | '';
  checklistSedacaoText?: string;
  checklistAnalgesia?: 'Sim' | 'Não' | '';
  checklistAnalgesiaText?: string;
  checklistDva?: 'Sim' | 'Não' | 'NDA' | '';
  checklistDvaText?: string;
  checklistBloqueadorNeuromuscular?: string;
  checklistPasPad?: string;
  checklistPas?: string;
  checklistPad?: string;
  checklistVentilacao?: string[];
  checklistVentilacaoOutros?: string;
  checklistDiasVm?: string;
  checklistDesmameVm?: 'Sim' | 'Não' | 'N/A' | '';
  checklistFisioGrauForca?: string;
  checklistFisioTonus?: string;
  checklistContTroncoCervical?: string;
  checklistFonoaudiologia?: string;
  checklistDisfagiaLinguagem?: string;
  checklistFebre?: 'Sim' | 'Não' | '';
  checklistFebreTemp?: string;
  checklistAntibiotico?: 'Sim' | 'Não' | '';
  checklistAntibioticoText?: string;
  checklistAntiagregante?: string;
  checklistAnticoagulante?: string;
  checklistAcessoLocal?: string;
  checklistAcessoDia?: string;
  checklistDieta?: 'Sim' | 'Não' | '';
  checklistDietaTipo?: string;
  checklistDietaInicio?: string;
  checklistEvacuacoes?: 'Sim' | 'Não' | '';
  checklistEvacuacoesAspecto?: string;
  checklistEscaras?: 'Sim' | 'Não' | '';
  checklistEscarasLocal?: string;
  checklistEscarasAspecto?: string;
  checklistBalançoHidrico?: string;
  checklistDiurese?: string;
  checklistPh?: string;
  checklistPao2Paco2?: string;
  checklistHco3Sao2?: string;
  checklistPfSf?: string;
  checklistHgtMaior?: string;
  checklistHgtMenor?: string;
  checklistHb?: string;
  checklistHt?: string;
  checklistPlaquetas?: string;
  checklistLeucograma?: string;
  checklistBastoes?: string;
  checklistInr?: string;
  checklistSodio?: string;
  checklistPotassio?: string;
  checklistMagnesio?: string;
  checklistFosforo?: string;
  checklistTroponina?: string;
  checklistUreia?: string;
  checklistCreatinina?: string;
  checklistBioquimicaOutros?: string;
  checklistEcgExame?: 'Sim' | 'Não' | '';
  checklistEcoDoppler?: 'Sim' | 'Não' | '';
  checklistPendencias?: string;
  checklistIntercorrencias?: string;
  checklistCondutas?: string;
  checklistMedicoPlantonista?: string;
}

export interface ArchivedPatient {
  archiveId: string;
  deletedAt: number; // timestamp in ms (Date.now())
  deletedDateFormatted: string; // "DD/MM/AA HH:mm"
  originalBedId: number;
  patient: Patient;
}

export const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

export const formatDateTimeDDMMAA = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${h}:${min}`;
};

export const KidneyIcon = ({ 
  size = 14, 
  fillColor = "#cbd5e1", 
  strokeColor = "#0f172a",
  className = "" 
}: { 
  size?: number; 
  fillColor?: string; 
  strokeColor?: string;
  className?: string;
}) => (
  <svg
    viewBox="0 0 512 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, minWidth: size, minHeight: size }}
  >
    {/* Interior Fill with dynamic status color */}
    <path
      d="M 90.500 65.508 C 80.369 67.167, 73.102 69.417, 65.500 73.249 C 36.051 88.093, 16.164 117.600, 6.551 160.713 C -0.666 193.076, -1.834 233.637, 3.663 261 C 17.307 328.913, 64.176 383.892, 108.500 383.977 C 116.734 383.992, 132.162 381.531, 140 378.952 C 167.240 369.987, 185.645 349.678, 190.406 323.331 C 191.699 316.175, 191.828 320.828, 191.910 377.300 C 192.009 445.229, 191.838 443.314, 198.083 446.543 C 200.615 447.853, 204.357 448.067, 220.150 447.810 L 239.168 447.500 L 242.084 444.234 L 245 440.968 245 359.595 C 245 271.758, 244.964 271.065, 239.569 255.202 C 228.609 222.979, 203.216 195.509, 172 182.104 C 166.775 179.861, 162.597 177.682, 162.716 177.262 C 162.834 176.843, 164.046 173.271, 165.408 169.324 C 169.095 158.643, 170.247 150.880, 170.203 137 C 170.126 112.263, 163.709 94.501, 149.909 80.830 C 135.612 66.667, 115.343 61.439, 90.500 65.508 M 390.500 65.649 C 370.124 69.973, 353.936 84.468, 346.926 104.664 C 343.238 115.289, 341.837 124.125, 341.797 137 C 341.753 150.880, 342.905 158.643, 346.592 169.324 C 347.954 173.271, 349.166 176.843, 349.284 177.262 C 349.403 177.682, 345.225 179.861, 340 182.104 C 308.784 195.509, 283.391 222.979, 272.431 255.202 C 267.036 271.065, 267 271.758, 267 359.595 L 267 440.968 269.916 444.234 L 272.832 447.500 291.850 447.810 C 307.643 448.067, 311.385 447.853, 313.917 446.543 C 320.162 443.314, 319.991 445.229, 320.090 377.300 C 320.172 320.828, 320.301 316.175, 321.594 323.331 C 326.355 349.678, 344.760 369.987, 372 378.952 C 379.838 381.531, 395.266 383.992, 403.500 383.977 C 447.824 383.892, 494.693 328.913, 508.337 261 C 511.032 247.584, 512.296 229.267, 511.683 212.500 C 509.081 141.297, 486.710 93.506, 446.500 73.251 C 430.490 65.187, 407.429 62.056, 390.500 65.649"
      fill={fillColor}
      fillRule="evenodd"
    />
    {/* Stroke Outline matching original image */}
    <path
      d="M 88.633 65.553 C 52.153 72.801, 26.187 98.326, 11.938 140.943 C 2.432 169.374, -2.285 213.149, 0.931 243.084 C 8.142 310.210, 50.557 372.533, 95.894 382.620 C 109.666 385.684, 132.010 382.872, 148.015 376.061 C 163.483 369.479, 176.972 356.986, 183.908 342.819 C 187.910 334.644, 190.775 325.538, 191.232 319.540 C 191.359 317.868, 191.696 344.728, 191.982 379.228 L 192.500 441.956 195.270 444.728 L 198.041 447.500 216.698 447.814 C 226.960 447.986, 236.330 447.883, 237.521 447.584 C 238.712 447.285, 240.882 445.845, 242.343 444.384 L 245 441.727 245 359.452 C 245 270.338, 245.015 270.622, 239.443 254.379 C 231.627 231.597, 214.338 208.485, 194.800 194.698 C 186.876 189.106, 172.925 181.657, 167.122 179.919 C 164.855 179.239, 163 178.330, 163 177.899 C 163 177.467, 164.321 173.151, 165.936 168.307 C 173.471 145.704, 171.884 117.822, 161.887 97.154 C 154.103 81.062, 138.917 69.161, 121.500 65.504 C 112.913 63.702, 97.837 63.724, 88.633 65.553 M 390 65.497 C 372.831 69.364, 357.775 81.314, 350.113 97.154 C 340.116 117.822, 338.529 145.704, 346.064 168.307 C 347.679 173.151, 349 177.467, 349 177.899 C 349 178.330, 347.145 179.239, 344.878 179.919 C 342.610 180.598, 336.963 183.137, 332.328 185.562 C 304.360 200.191, 282.521 225.336, 272.557 254.379 C 266.985 270.622, 267 270.338, 267 359.452 L 267 441.727 269.657 444.384 C 271.118 445.845, 273.288 447.285, 274.479 447.584 C 275.670 447.883, 285.040 447.986, 295.302 447.814 L 313.959 447.500 316.730 444.728 L 319.500 441.956 320.018 379.228 C 320.304 344.728, 320.641 317.868, 320.768 319.540 C 321.696 331.713, 329.398 348.204, 338.822 358.194 C 353.733 374.001, 372.673 382.141, 398.063 383.654 C 420.750 385.007, 439.466 376.632, 459.996 355.941 C 482.506 333.254, 499.571 300.693, 507.397 265.500 C 515.510 229.013, 512.518 178.198, 500.062 140.943 C 486.654 100.841, 462.678 75.736, 429.329 66.879 C 419 64.136, 399.141 63.438, 390 65.497 M 98.981 86.111 C 81.779 87.512, 69.471 93.404, 56.496 106.448 C 35.168 127.890, 24.082 160.685, 22.168 208 C 20.639 245.779, 25.446 271.545, 39.467 300.729 C 47.302 317.037, 55.662 328.808, 68.432 341.510 C 77.763 350.792, 80.896 353.225, 88.394 357.010 L 97.287 361.500 110.894 361.423 C 123.367 361.353, 125.291 361.084, 134 358.196 C 144.746 354.632, 151.389 350.529, 158.157 343.275 C 166.548 334.283, 170.057 324.323, 170.057 309.500 C 170.057 292.944, 166.567 284.583, 148.173 257.069 C 134.631 236.812, 132.010 232.153, 129.612 224.068 C 125.959 211.757, 128.205 199.629, 137.931 179.145 C 147.342 159.326, 149.429 150.645, 148.665 134.500 C 148.057 121.665, 146.701 115.338, 142.739 106.839 C 135.366 91.028, 121.171 84.304, 98.981 86.111 M 398.612 86.180 C 385.336 87.493, 374.836 94.884, 369.261 106.839 C 365.299 115.338, 363.943 121.665, 363.335 134.500 C 362.571 150.645, 364.658 159.326, 374.069 179.145 C 383.795 199.629, 386.041 211.757, 382.388 224.068 C 379.990 232.153, 377.369 236.812, 363.827 257.069 C 345.433 284.583, 341.943 292.944, 341.943 309.500 C 341.943 324.323, 345.452 334.283, 353.843 343.275 C 360.611 350.529, 367.254 354.632, 378 358.196 C 386.709 361.084, 388.633 361.353, 401.106 361.423 L 414.713 361.500 423.606 357.010 C 431.104 353.225, 434.237 350.792, 443.568 341.510 C 456.338 328.808, 464.698 317.037, 472.533 300.729 C 486.554 271.545, 491.361 245.779, 489.832 208 C 488.410 172.845, 481.601 145.048, 469.135 123.500 C 462.797 112.544, 448.947 98.658, 439.500 93.788 C 426.928 87.307, 413.146 84.743, 398.612 86.180 M 151.845 200.683 C 151.208 202.232, 150.488 206.441, 150.243 210.035 L 149.799 216.570 155.040 217.914 C 164.674 220.383, 175.386 226.578, 183.949 234.633 C 195.111 245.134, 202.752 257.966, 207.413 274.041 C 212.302 290.897, 212.305 290.941, 212.918 360.500 L 213.500 426.500 218.802 426.804 L 224.105 427.108 223.740 351.804 C 223.340 269.461, 223.694 274.623, 217.290 257.569 C 208.112 233.130, 187.682 211.633, 164.626 202.154 C 153.228 197.468, 153.168 197.461, 151.845 200.683 M 350.302 200.911 C 324.937 210.912, 304.353 231.892, 294.710 257.569 C 288.306 274.623, 288.660 269.461, 288.260 351.804 L 287.895 427.108 293.198 426.804 L 298.500 426.500 299.082 360.500 C 299.695 290.941, 299.698 290.897, 304.587 274.041 C 309.248 257.966, 316.889 245.134, 328.051 234.633 C 336.584 226.607, 347.323 220.384, 356.859 217.940 L 362 216.622 361.924 211.061 C 361.845 205.315, 360.063 198.827, 358.431 198.347 C 357.919 198.196, 354.261 199.350, 350.302 200.911 M 175.905 259.750 C 178.580 264.064, 181.782 269.948, 183.021 272.827 C 184.259 275.706, 185.462 277.871, 185.695 277.639 C 186.511 276.822, 180.767 264.547, 176.911 258.869 C 171.042 250.226, 170.366 250.819, 175.905 259.750 M 336.512 256.750 C 332.896 261.648, 327.774 271.598, 326.602 276 C 326.237 277.375, 327.659 275.125, 329.762 271 C 331.866 266.875, 335.250 260.913, 337.281 257.750 C 341.758 250.781, 341.330 250.225, 336.512 256.750"
      fill={strokeColor}
      fillRule="evenodd"
    />
  </svg>
);

export const getLatestCreatinine = (patient: Patient): number | null => {
  if (!patient.dailyChecklists || !Array.isArray(patient.dailyChecklists)) {
    return null;
  }
  for (let i = patient.dailyChecklists.length - 1; i >= 0; i--) {
    const checklist = patient.dailyChecklists[i];
    if (checklist && checklist.checklistCreatinina) {
      const val = parseFloat(checklist.checklistCreatinina.replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
  }
  return null;
};

export interface CreatinineInfo {
  value: number;
  date: string;
}

export const getLatestCreatinineInfo = (patient: Patient): CreatinineInfo | null => {
  if (!patient.dailyChecklists || !Array.isArray(patient.dailyChecklists)) {
    return null;
  }
  for (let i = patient.dailyChecklists.length - 1; i >= 0; i--) {
    const checklist = patient.dailyChecklists[i];
    if (checklist && checklist.checklistCreatinina) {
      const val = parseFloat(checklist.checklistCreatinina.replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        return {
          value: val,
          date: checklist.checklistData || ''
        };
      }
    }
  }
  return null;
};

export const calcularCKDEPI2021 = (creatinina: number, idade: number, sexo: 'M' | 'F'): number => {
  const k = (sexo === 'F') ? 0.7 : 0.9;
  const alfa = (sexo === 'F') ? -0.241 : -0.302;
  const fatorFeminino = (sexo === 'F') ? 1.012 : 1.0;

  const termoMin = Math.min(creatinina / k, 1);
  const termoMax = Math.max(creatinina / k, 1);

  const etfg = 142 
      * Math.pow(termoMin, alfa) 
      * Math.pow(termoMax, -1.200) 
      * Math.pow(0.9938, idade) 
      * fatorFeminino;

  return Math.round(etfg);
};

const ICUBed = ({
  patient,
  onClick,
  onClear,
  onEvolucao,
  onSwapBed,
  onImportDocx
}: {
  key?: number,
  patient: Patient,
  onClick: () => void,
  onClear: () => void,
  onEvolucao: (p: Patient) => void,
  onSwapBed?: (p: Patient) => void,
  onImportDocx?: (patientId: number, file: File) => void
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  useEffect(() => {
    if (isConfirmingClear) {
      const timer = setTimeout(() => setIsConfirmingClear(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmingClear]);

  const isOccupied = patient.name && patient.name.trim() !== '';
  
  let bedColor = 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-md';
  let bedGraphicColor = 'text-slate-300';
  let badgeColor = 'bg-slate-100 text-slate-500 border-slate-200';
  
  if (isOccupied) {
    if (patient.gender === 'Masculino') {
      bedColor = 'bg-blue-50/20 border-blue-200/80 hover:bg-blue-50/40 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5';
      bedGraphicColor = 'text-blue-500';
      badgeColor = 'bg-blue-600 text-white border-blue-600 shadow-sm';
    } else if (patient.gender === 'Feminino') {
      bedColor = 'bg-pink-50/20 border-pink-200/80 hover:bg-pink-50/40 hover:border-pink-400 hover:shadow-lg hover:shadow-pink-500/5';
      bedGraphicColor = 'text-pink-500';
      badgeColor = 'bg-pink-600 text-white border-pink-600 shadow-sm';
    } else {
      bedColor = 'bg-slate-50 border-slate-300 hover:bg-slate-100/50 hover:border-slate-400 hover:shadow-lg';
      bedGraphicColor = 'text-slate-500';
      badgeColor = 'bg-slate-600 text-white border-slate-600 shadow-sm';
    }
  }

  const leftPumps = [0, 1, 2];
  const rightPumps = [3, 4, 5];

  const renderPump = (slotIndex: number) => {
    const infusion = patient.infusions[slotIndex];
    if (!infusion) {
      return (
        <div key={slotIndex} className="flex items-center gap-1.5 p-1 bg-slate-50/40 rounded-md border border-slate-200/40 text-[9px] text-slate-400 select-none">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
          <span className="font-bold truncate uppercase tracking-widest text-[8px] opacity-60">BOMBA {slotIndex + 1}</span>
        </div>
      );
    }

    const drug = MEDS.find(m => m.id === infusion.drugId);
    if (!drug) return null;
    const dilution = drug.dilutions.find(d => d.id === infusion.dilutionId);
    if (!dilution) return null;

    const flowRate = parseFloat(infusion.flowRate) || 0;
    const weight = parseFloat(patient.weight) || 0;
    const dose = calculateDose(flowRate, weight, drug, dilution);

    const isInactive = flowRate === 0 || infusion.flowRate.trim() === '';

    const unit = getEffectiveUnit(drug, dilution);
    const minDose = getMinDose(drug, dilution);
    const maxDose = getMaxDose(drug, dilution);

    const isWeightNeeded = ['mcg/kg/h', 'mg/kg/h', 'mcg/kg/min'].includes(unit);
    const isWeightMissing = isWeightNeeded && !weight;

    let hasAlert = false;

    if (!isInactive) {
      if (!isWeightMissing && minDose !== undefined && maxDose !== undefined) {
        if (dose < minDose || dose > maxDose) {
          hasAlert = true;
        }
      }
    }

    let pulseDot = null;
    if (!isInactive) {
      if (hasAlert) {
        pulseDot = (
          <div className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
          </div>
        );
      } else {
        pulseDot = (
          <div className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
        );
      }
    } else {
      pulseDot = <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />;
    }

    const flowRateStr = flowRate > 0 ? `${flowRate} ml/h` : '0 ml/h';
    const formattedDoseVal = dose === 0 ? '0' : formatDoseValue(dose);
    const formattedDoseStr = isWeightMissing ? 'sem peso' : `${formattedDoseVal} ${unit}`;

    if (isInactive) {
      return (
        <div 
          key={slotIndex} 
          className="flex items-center justify-between p-1 rounded-md border text-[9px] shadow-sm transition-colors bg-slate-50/50 border-slate-200 text-slate-400"
        >
          <div className="flex items-center gap-1 truncate">
            {pulseDot}
            <span className="font-extrabold truncate uppercase tracking-tight text-[8px]">{drug.name}</span>
          </div>
          <span className="font-mono font-bold whitespace-nowrap bg-white/70 px-0.5 rounded border border-slate-200/30 text-[8px]">
            {flowRateStr}
          </span>
        </div>
      );
    }

    return (
      <div 
        key={slotIndex} 
        className={`flex flex-col p-1 px-1.5 rounded-md border shadow-sm transition-colors ${
          hasAlert 
            ? 'bg-rose-50 border-rose-300 text-rose-900 font-extrabold'
            : isWeightMissing 
              ? 'bg-amber-50 border-amber-300 text-amber-900 font-extrabold'
              : 'bg-emerald-50 border-emerald-300 text-emerald-950 font-extrabold'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {pulseDot}
            <span className="font-black truncate uppercase tracking-tight text-[8.5px] leading-tight">{drug.name}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5 pt-0.5 border-t border-slate-200/60 text-[8px] leading-none">
          <span className="font-mono font-extrabold whitespace-nowrap bg-white/90 px-1 py-0.2 rounded border border-slate-200/60 text-slate-800 shadow-2xs">
            {flowRateStr}
          </span>
          <span className={`font-mono font-black whitespace-nowrap tracking-tight ${
            hasAlert ? 'text-rose-700' : isWeightMissing ? 'text-amber-700' : 'text-emerald-800'
          }`}>
            {formattedDoseStr}
          </span>
        </div>
      </div>
    );
  };

  const renderRenalInfo = () => {
    if (!isOccupied) return null;

    const ageNum = parseInt(patient.age || '');
    const genderMap = patient.gender === 'Masculino' ? 'M' : patient.gender === 'Feminino' ? 'F' : null;
    const latestCrInfo = getLatestCreatinineInfo(patient);

    const missing = [];
    if (!genderMap) missing.push('Sexo');
    if (isNaN(ageNum) || ageNum <= 0) missing.push('Idade');
    if (!latestCrInfo) missing.push('Cr');

    let valueDisplay = "";
    let valueColor = "text-slate-500";
    let bgClass = "bg-slate-50 border-slate-100";
    let crLabel = "";
    let kidneyFillColor = "#cbd5e1";
    let kidneyPulse = false;

    if (genderMap && !isNaN(ageNum) && latestCrInfo) {
      const etfg = calcularCKDEPI2021(latestCrInfo.value, ageNum, genderMap);
      valueDisplay = `${etfg} mL/min/1.73m²`;
      crLabel = `cr: ${latestCrInfo.value.toString().replace('.', ',')} mg/dL${latestCrInfo.date ? ` em ${latestCrInfo.date}` : ''}`;
      
      if (etfg >= 90) {
        valueColor = "text-emerald-600 font-extrabold";
        bgClass = "bg-emerald-50/50 border-emerald-100";
        kidneyFillColor = "#10b981"; // Verde esmeralda (ótima função renal)
      } else if (etfg >= 60) {
        valueColor = "text-blue-600 font-extrabold";
        bgClass = "bg-blue-50/50 border-blue-100";
        kidneyFillColor = "#3b82f6"; // Azul (boa função renal)
      } else if (etfg >= 30) {
        valueColor = "text-amber-600 font-extrabold";
        bgClass = "bg-amber-50/50 border-amber-100";
        kidneyFillColor = "#f59e0b"; // Amarelo/Âmbar (função renal moderadamente reduzida)
      } else {
        valueColor = "text-rose-600 font-extrabold";
        bgClass = "bg-rose-50/50 border-rose-100";
        kidneyFillColor = "#f43f5e"; // Vermelho/Rose (função renal baixa / crítica)
        kidneyPulse = true;
      }
    } else {
      valueDisplay = missing.length > 0 ? `Pendente: ${missing.join(', ')}` : "Aguardando dados";
      bgClass = "bg-slate-50/60 border-slate-200/50 border-dashed";
      crLabel = "Sem dados de creatinina";
      kidneyFillColor = "#f43f5e"; // Vermelho alertando pendência de Cr
      kidneyPulse = true;
    }

    return (
      <div className={`mt-1 px-1.5 py-1 rounded-lg border text-left leading-normal flex flex-col gap-0.5 ${bgClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 text-[8px] font-black uppercase text-slate-500 tracking-wider">
          <KidneyIcon 
            size={12} 
            fillColor={kidneyFillColor} 
            strokeColor="#1e293b" 
            className={`flex-shrink-0 ${kidneyPulse ? 'animate-pulse' : ''}`} 
          />
          <span>Função Renal (CKD-EPI 2021)</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[9.5px] font-black tracking-tight leading-none ${valueColor}`}>
            {valueDisplay}
          </span>
          <span className="text-[7.5px] font-bold text-slate-400 lowercase">
            {crLabel}
          </span>
        </div>
      </div>
    );
  };

  const dailyLists = ensureDailyChecklists(patient);
  let lastChecklistDate = '';
  for (let i = dailyLists.length - 1; i >= 0; i--) {
    if (dailyLists[i]?.checklistData && dailyLists[i].checklistData?.trim() !== '') {
      lastChecklistDate = dailyLists[i].checklistData!.trim();
      break;
    }
  }
  if (!lastChecklistDate && patient.checklistData) {
    lastChecklistDate = patient.checklistData.trim();
  }

  return (
    <div 
      onClick={onClick}
      onDragOver={(e) => {
        if (!isOccupied) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!isOccupied) {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file && onImportDocx) {
            onImportDocx(patient.id, file);
          }
        }
      }}
      className={`relative flex flex-col justify-between p-4 h-full border-2 rounded-2xl cursor-pointer transition-all duration-300 ${bedColor}`}
    >
      <div className="flex items-center justify-between">
        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wider uppercase border ${badgeColor}`}>
          Leito {patient.id}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSwapBed?.(patient);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300 shadow-sm"
            title="Trocar o paciente deste leito para outro leito"
          >
            <ArrowLeftRight size={11} />
            <span>TROCAR</span>
          </button>
          {isOccupied && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isConfirmingClear) {
                    onClear();
                    setIsConfirmingClear(false);
                  } else {
                    setIsConfirmingClear(true);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all border ${
                  isConfirmingClear 
                    ? 'bg-red-600 text-white border-red-600 animate-pulse scale-105 shadow-sm' 
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-red-600 hover:bg-red-50 hover:border-red-200'
                }`}
                title="Apagar todos os dados deste leito"
              >
                <Trash2 size={11} />
                <span>{isConfirmingClear ? 'CONFIRMAR?' : 'LIMPAR'}</span>
              </button>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">OCUPADO</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 min-h-[40px] flex flex-col justify-center">
        {isOccupied ? (
          <div>
            <p className="text-sm font-black text-slate-800 uppercase tracking-tight truncate max-w-[240px]">{patient.name}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide">
              {patient.age ? `${patient.age} ANOS` : ''} 
              {patient.age && patient.weight ? ' | ' : ''} 
              {patient.weight ? `${patient.weight} KG` : ''}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 py-1.5 px-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 gap-1.5">
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Leito Vazio</span>
              <label 
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9.5px] font-black uppercase shadow-xs transition-all tracking-wider cursor-pointer active:scale-95 hover:-translate-y-0.5"
                title="Carregar arquivo do Word (.docx) com a evolução deste paciente"
              >
                <FileUp size={11} />
                <span>Carregar Evolução (.docx)</span>
                <input
                  type="file"
                  accept=".docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onImportDocx) {
                      onImportDocx(patient.id, file);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
            <span className="text-[8px] text-slate-400 uppercase font-bold tracking-tight">Clique no leito para abrir ou carregue o Word acima</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-2 items-center my-3 flex-1 min-h-[120px]">
        <div className="col-span-4 flex flex-col gap-1 justify-center h-full">
          {leftPumps.map(slot => renderPump(slot))}
        </div>

        <div className="col-span-4 flex flex-col items-center justify-center h-full select-none">
          <svg className={`w-[84px] h-[96px] ${bedGraphicColor}`} viewBox="0 0 64 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Corner bumpers/wheels */}
            <circle cx="10" cy="10" r="2" className="opacity-40" fill="currentColor" />
            <circle cx="54" cy="10" r="2" className="opacity-40" fill="currentColor" />
            <circle cx="10" cy="90" r="2" className="opacity-40" fill="currentColor" />
            <circle cx="54" cy="90" r="2" className="opacity-40" fill="currentColor" />

            {/* Bed Frame */}
            <rect x="8" y="12" width="48" height="76" rx="4" className="opacity-30" strokeWidth="2" />

            {/* Headboard */}
            <path d="M12 12 h40" strokeWidth="3" className="opacity-70" />

            {/* Footboard */}
            <path d="M16 88 h32" strokeWidth="3" className="opacity-70" />

            {/* Side safety rails */}
            {/* Left Rails */}
            <rect x="5" y="24" width="2" height="18" rx="0.5" className="opacity-50" fill="currentColor" />
            <rect x="5" y="48" width="2" height="18" rx="0.5" className="opacity-50" fill="currentColor" />
            
            {/* Right Rails */}
            <rect x="57" y="24" width="2" height="18" rx="0.5" className="opacity-50" fill="currentColor" />
            <rect x="57" y="48" width="2" height="18" rx="0.5" className="opacity-50" fill="currentColor" />

            {/* Mattress */}
            <rect x="11" y="15" width="42" height="70" rx="3" fill="currentColor" fillOpacity="0.05" strokeWidth="1" />

            {/* Pillow */}
            <rect x="18" y="20" width="28" height="12" rx="2.5" fill="currentColor" fillOpacity="0.15" strokeWidth="1" />

            {/* Folded duvet/sheet */}
            <path d="M11 44 h42" strokeWidth="1" strokeDasharray="2 2" className="opacity-50" />
            <path d="M11 44 l10 6 h22 l10 -6" fill="currentColor" fillOpacity="0.08" strokeWidth="1" />
          </svg>
          {isOccupied && (
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-1">
              {patient.gender}
            </span>
          )}
        </div>

        <div className="col-span-4 flex flex-col gap-1 justify-center h-full">
          {rightPumps.map(slot => renderPump(slot))}
        </div>
      </div>

      {isOccupied && renderRenalInfo()}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 uppercase font-bold tracking-wider">
        <span>Bombas: {patient.infusions.length}/6</span>
        {isOccupied && lastChecklistDate && (
          <span className="text-emerald-600 font-extrabold text-right truncate ml-1" title={`Checklist ${lastChecklistDate} Preenchido`}>
            CHECKLIST {lastChecklistDate} PREENCHIDO
          </span>
        )}
      </div>
    </div>
  );
};

const PatientCard = ({ 
  patient, 
  updatePatient, 
  showAllDilutions,
  onClose,
  showExamsModal,
  onPrintGasometria,
  onEvolucao,
  onSwapBed,
  onImportDocx
}: { 
  patient: Patient, 
  updatePatient: (p: Patient) => void,
  showAllDilutions: () => void,
  onClose?: () => void,
  showExamsModal?: (p: Patient) => void,
  onPrintGasometria?: (p: Patient) => void,
  onEvolucao?: (p: Patient) => void,
  onSwapBed?: (p: Patient) => void,
  onImportDocx?: (patientId: number, file: File) => void
}) => {
  const [activeTab, setActiveTab] = useState<'infusions' | 'clinical' | 'checklist'>('infusions');

  const handleDateMask = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 6);
    if (clean.length <= 2) return clean;
    if (clean.length <= 4) return `${clean.slice(0, 2)}/${clean.slice(2)}`;
    return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 6)}`;
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para este site para que o checklist possa ser impresso.');
      return;
    }

    const getVal = (val: any, width = '100%') => {
      if (val === undefined || val === null || val === '') {
        return `<span class="handwritten-placeholder" style="width: ${width};"></span>`;
      }
      return `<strong class="filled-value">${val}</strong>`;
    };

    const getValMultiLine = (val: any, numLines = 3) => {
      if (val === undefined || val === null || val === '') {
        let lines = '';
        for (let i = 0; i < numLines; i++) {
          lines += `<div class="handwritten-line"></div>`;
        }
        return lines;
      }
      return `<div class="filled-value-multiline">${val.replace(/\n/g, '<br/>')}</div>`;
    };

    const getRadioSimNao = (val: string | undefined) => {
      return `${val === 'Sim' ? '<strong>[X] SIM</strong>' : '[ ] SIM'}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${val === 'Não' ? '<strong>[X] NÃO</strong>' : '[ ] NÃO'}`;
    };

    const getRadioSimNaoNda = (val: string | undefined) => {
      return `${val === 'Sim' ? '<strong>[X] SIM</strong>' : '[ ] SIM'}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${val === 'Não' ? '<strong>[X] NÃO</strong>' : '[ ] NÃO'}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${val === 'NDA' ? '<strong>[X] NDA</strong>' : '[ ] NDA'}`;
    };

    const getRadioSimNaoNa = (val: string | undefined) => {
      return `${val === 'Sim' ? '<strong>[X] SIM</strong>' : '[ ] SIM'}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${val === 'Não' ? '<strong>[X] NÃO</strong>' : '[ ] NÃO'}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${val === 'N/A' ? '<strong>[X] N/A</strong>' : '[ ] N/A'}`;
    };

    const renderVentilacao = (val: string[] | undefined) => {
      const allOpts = [
        { ids: ['ar_ambiente', 'AA'], label: 'Ar Ambiente' },
        { ids: ['venturi', 'VNT'], label: 'Venturi' },
        { ids: ['canula_nasal', 'CN'], label: 'Cânula Nasal' },
        { ids: ['ventilacao_mecanica', 'VM'], label: 'Vent. Mecânica' },
        { ids: ['tot', 'TOT'], label: 'TOT' },
        { ids: ['tqt', 'TQT'], label: 'TQT' }
      ];
      if (!val || val.length === 0) {
        return allOpts.map(opt => `[ ] ${opt.label}`).join('&nbsp;&nbsp;&nbsp;&nbsp;');
      }
      return allOpts.map(opt => {
        const checked = opt.ids.some(id => val.includes(id)) ? '<strong>[X]</strong>' : '[ ]';
        return `${checked} ${opt.label}`;
      }).join('&nbsp;&nbsp;&nbsp;&nbsp;');
    };

    // Get daily checklists cycle
    const dailyListsFull = ensureDailyChecklists(patient);
    const { pageLists: dailyLists, startColumn } = getLastFilledPageLists(dailyListsFull);

    const renderCell = (rawVal: any, styleAttr: string = '') => {
      if (rawVal === undefined || rawVal === null || rawVal === '') {
        return `<td class="checklist-cell cell-empty" style="${styleAttr}">—</td>`;
      }
      const valStr = String(rawVal).replace(/\n/g, '<br/>');
      return `<td class="checklist-cell cell-filled" style="${styleAttr}">${valStr}</td>`;
    };

    const renderVentilacaoCell = (val: string[] | undefined, outros?: string) => {
      if (!val || val.length === 0) {
        return outros ? `<td class="checklist-cell cell-filled">${outros}</td>` : `<td class="checklist-cell cell-empty">—</td>`;
      }
      let txt = val.map(formatVentilacaoItem).filter(Boolean).join(', ');
      if (outros) txt += ` (${outros})`;
      return `<td class="checklist-cell cell-filled">${txt}</td>`;
    };

    const tableRows = [
      { label: 'NIHSS Atual', getValue: (d: DailyChecklist) => d.checklistNihssAtual, colorClass: 'row-blue' },
      { label: 'GLASGOW', getValue: (d: DailyChecklist) => d.checklistGlasgow, colorClass: 'row-blue' },
      { label: 'Pupilas (PUP)', getValue: (d: DailyChecklist) => d.checklistPup, colorClass: 'row-blue' },
      { label: 'Respiração (RESP)', getValue: (d: DailyChecklist) => d.checklistResp, colorClass: 'row-blue' },
      { label: 'Função Motora', getValue: (d: DailyChecklist) => d.checklistMotor, colorClass: 'row-blue' },
      { label: 'Sedação', getValue: (d: DailyChecklist) => d.checklistSedacao ? `${d.checklistSedacao}${d.checklistSedacaoText ? `: ${d.checklistSedacaoText}` : ''}` : '', colorClass: 'row-purple' },
      { label: 'Analgesia', getValue: (d: DailyChecklist) => d.checklistAnalgesia ? `${d.checklistAnalgesia}${d.checklistAnalgesiaText ? `: ${d.checklistAnalgesiaText}` : ''}` : '', colorClass: 'row-purple' },
      { label: 'Drogas Vasoativas (DVA)', getValue: (d: DailyChecklist) => d.checklistDva ? `${d.checklistDva}${d.checklistDvaText ? `: ${d.checklistDvaText}` : ''}` : '', colorClass: 'row-purple' },
      { label: 'Bloqueador Neuromuscular', getValue: (d: DailyChecklist) => d.checklistBloqueadorNeuromuscular, colorClass: 'row-purple' },
      { label: 'Suporte Ventilatório', getValue: (d: DailyChecklist) => '', isVent: true },
      { label: 'Dias VM / Desmame', getValue: (d: DailyChecklist) => (d.checklistDiasVm || d.checklistDesmameVm) ? `${d.checklistDiasVm ? `${d.checklistDiasVm}d` : ''} ${d.checklistDesmameVm ? `| Desmame: ${d.checklistDesmameVm}` : ''}` : '' },
      { label: 'Pressão Arterial (PAS X PAD)', getValue: (d: DailyChecklist) => {
          if (d.checklistPas || d.checklistPad) {
            return `PAS: ${d.checklistPas || '—'}<br/>PAD: ${d.checklistPad || '—'}`;
          }
          if (d.checklistPasPad) {
            const parts = d.checklistPasPad.split(/\s*x\s*|\s*\/\s*/i);
            if (parts.length === 2) {
              return `PAS: ${parts[0]}<br/>PAD: ${parts[1]}`;
            }
            return d.checklistPasPad;
          }
          return '';
        }
      },
      { label: 'Febre registrada', getValue: (d: DailyChecklist) => {
          if (d.checklistFebre && d.checklistFebreTemp) {
            return `${d.checklistFebre} (${d.checklistFebreTemp})`;
          }
          return d.checklistFebre || d.checklistFebreTemp;
        }
      },
      { 
        label: 'Controle Glicêmico (HGT)', 
        getValue: (d: DailyChecklist) => {
          if (!d.checklistHgtMaior && !d.checklistHgtMenor) return '';
          return `Max: ${d.checklistHgtMaior || '—'}<br/>Min: ${d.checklistHgtMenor || '—'}`;
        } 
      },
      { 
        label: 'Antibioticoterapia', 
        getValue: (d: DailyChecklist) => {
          if (d.checklistAntibiotico === 'Não') return 'Não';
          if (d.checklistAntibioticoText && d.checklistAntibioticoText.trim()) {
            const lines = d.checklistAntibioticoText
              .split('\n')
              .map(l => l.trim())
              .filter(Boolean);
            if (lines.length > 0) {
              return lines.join('<br/>');
            }
          }
          return d.checklistAntibiotico || '';
        }, 
        colorClass: 'row-orange' 
      },
      { label: 'Antiagregante', getValue: (d: DailyChecklist) => d.checklistAntiagregante },
      { label: 'Anticoagulante', getValue: (d: DailyChecklist) => d.checklistAnticoagulante },
      { label: 'Acesso Venoso', getValue: (d: DailyChecklist) => (d.checklistAcessoLocal || d.checklistAcessoDia) ? `${d.checklistAcessoLocal || '—'} (Dia ${d.checklistAcessoDia || '—'})` : '' },
      { label: 'Dieta', getValue: (d: DailyChecklist) => d.checklistDieta ? `${d.checklistDieta}${d.checklistDietaTipo ? ` (${d.checklistDietaTipo})` : ''}` : '' },
      { 
        label: 'BH (24h) / Diurese', 
        getValue: (d: DailyChecklist) => {
          if (!d.checklistBalançoHidrico && !d.checklistDiurese) return '';
          return `BH: ${d.checklistBalançoHidrico || '—'}<br/>Diur: ${d.checklistDiurese || '—'}`;
        }, 
        colorClass: 'row-yellow' 
      },
      { label: 'Evacuações', getValue: (d: DailyChecklist) => d.checklistEvacuacoes ? `${d.checklistEvacuacoes}${d.checklistEvacuacoesAspecto ? ` (${d.checklistEvacuacoesAspecto})` : ''}` : '' },
      { label: 'Presença de Escaras', getValue: (d: DailyChecklist) => d.checklistEscaras ? `${d.checklistEscaras}${d.checklistEscarasLocal ? ` [${d.checklistEscarasLocal}]` : ''}` : '' },
      { label: 'Fisioterapia Motora', getValue: (d: DailyChecklist) => (d.checklistFisioGrauForca || d.checklistFisioTonus) ? `Força: ${d.checklistFisioGrauForca || '—'} / Tônus: ${d.checklistFisioTonus || '—'}` : '' },
      { label: 'Avaliação Fonoaudiológica', getValue: (d: DailyChecklist) => d.checklistFonoaudiologia },
      { label: 'Disfagia / Linguagem', getValue: (d: DailyChecklist) => d.checklistDisfagiaLinguagem },
      { label: 'Gasometria (pH/PaO2/HCO3)', getValue: (d: DailyChecklist) => (d.checklistPh || d.checklistPao2Paco2) ? `pH: ${d.checklistPh || '—'} | PaO2: ${d.checklistPao2Paco2 || '—'} | HCO3: ${d.checklistHco3Sao2 || '—'}` : '', colorClass: 'row-green' },
      { label: 'Laboratório (Hb/Ht/Plaq)', getValue: (d: DailyChecklist) => (d.checklistHb || d.checklistPlaquetas) ? `Hb: ${d.checklistHb || '—'} | Plaq: ${d.checklistPlaquetas || '—'}` : '', colorClass: 'row-green' },
      { label: 'Leucócitos / Bastões', getValue: (d: DailyChecklist) => (d.checklistLeucograma || d.checklistBastoes) ? `Leu: ${d.checklistLeucograma || '—'} | Bast: ${d.checklistBastoes || '—'}` : '', colorClass: 'row-green' },
      { label: 'INR / Sódio / Potássio', getValue: (d: DailyChecklist) => (d.checklistInr || d.checklistSodio || d.checklistPotassio) ? `INR: ${d.checklistInr || '—'} | Na: ${d.checklistSodio || '—'} | K: ${d.checklistPotassio || '—'}` : '', colorClass: 'row-green' },
      { label: 'Ureia / Creatinina / Outros', getValue: (d: DailyChecklist) => {
          const parts = [];
          if (d.checklistUreia) parts.push(`Ur: ${d.checklistUreia}`);
          if (d.checklistCreatinina) parts.push(`Cr: ${d.checklistCreatinina}`);
          if (d.checklistBioquimicaOutros) parts.push(`Outros: ${d.checklistBioquimicaOutros}`);
          return parts.length > 0 ? parts.join(' | ') : '';
        }, colorClass: 'row-green' },
      { label: 'ECG / Eco Doppler', getValue: (d: DailyChecklist) => (d.checklistEcgExame || d.checklistEcoDoppler) ? `ECG: ${d.checklistEcgExame || '—'} | Eco: ${d.checklistEcoDoppler || '—'}` : '' },
      { 
        label: 'Condutas', 
        getValue: (d: DailyChecklist) => d.checklistCondutas || '',
        alignJustify: true
      },
      { label: 'Médico Plantonista', getValue: (d: DailyChecklist) => d.checklistMedicoPlantonista }
    ];

    const tableHeadersHtml = `
      <tr>
        <th class="checklist-header-param" style="width: 16%; text-align: left; text-transform: uppercase; font-weight: 800; font-size: 8px;">PARÂMETRO / AVAL.</th>
        ${dailyLists.map((list, idx) => {
          const colNum = startColumn + idx;
          const dateLabel = list.checklistData ? `<strong>${list.checklistData}</strong>` : `<span style="color: #64748b; font-weight: normal;">—</span>`;
          return `
            <th class="checklist-header-day" style="width: 14%; text-align: center;">
              <div style="font-size: 7px; font-weight: 500; color: #475569; margin-bottom: 2px;">COLUNA ${colNum}</div>
              <div style="font-size: 8.5px; font-weight: 800;">${dateLabel}</div>
            </th>
          `;
        }).join('')}
      </tr>
    `;

    const tableRowsHtml = tableRows.map(row => {
      const colorClass = (row as any).colorClass || '';
      const alignStyle = (row as any).alignJustify ? 'text-align: justify; text-justify: inter-word; word-break: break-word;' : '';
      return `
        <tr class="checklist-row ${colorClass}">
          <td class="checklist-param-label" style="font-weight: 800; color: #1e293b; font-size: 7.5px; text-transform: uppercase; line-height: 1.1; padding: 2.5px 3px;">${row.label}</td>
          ${dailyLists.map(list => {
            if (row.isVent) {
              return renderVentilacaoCell(list.checklistVentilacao, list.checklistVentilacaoOutros);
            }
            return renderCell(row.getValue(list), alignStyle);
          }).join('')}
        </tr>
      `;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Checklist Diário - Leito ${patient.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 15px;
      background-color: #f8fafc;
      font-size: 11px;
      line-height: 1.25;
      -webkit-text-size-adjust: 100%;
    }
    
    .container {
      max-width: 900px;
      width: 100%;
      box-sizing: border-box;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      padding: 15px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }
    
    @page {
      size: A4 portrait;
      margin: 6mm 5mm;
    }

    @media print {
      body {
        padding: 0;
        margin: 0;
        background-color: #fff;
        color: #000;
        width: 100%;
      }
      .container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
      }
      .no-print {
        display: none !important;
      }
    }

    .no-print-bar {
      background-color: #0f172a;
      color: #fff;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
    }

    .btn-print {
      background-color: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 700;
      cursor: pointer;
      text-transform: uppercase;
      font-size: 10px;
      transition: background-color 0.2s;
    }

    .btn-print:hover {
      background-color: #1d4ed8;
    }

    .sections-i-ii-iii {
      text-transform: uppercase !important;
    }
    .sections-i-ii-iii * {
      text-transform: uppercase !important;
    }

    .header {
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }

    .header h1 {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 3px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .header p {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0 0 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-block;
      background-color: #fef08a;
      padding: 2px 10px;
      border-radius: 4px;
      border: 1px solid #fde047;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .section-title {
      background-color: #f1f5f9;
      border-left: 3px solid #1e40af;
      padding: 3px 6px;
      font-weight: 800;
      font-size: 11.5px;
      text-transform: uppercase;
      color: #1e3a8a;
      margin-top: 8px;
      margin-bottom: 4px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 4px;
      margin-bottom: 4px;
    }

    .col-12 { grid-column: span 12; }
    .col-6  { grid-column: span 6; }
    .col-5  { grid-column: span 5; }
    .col-4  { grid-column: span 4; }
    .col-3  { grid-column: span 3; }
    .col-2  { grid-column: span 2; }
    .col-1  { grid-column: span 1; }
    .col-8  { grid-column: span 8; }
    .col-9  { grid-column: span 9; }
    .col-10 { grid-column: span 10; }

    .field {
      background-color: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 2px 5px;
      display: flex;
      flex-direction: column;
      min-height: 20px;
      justify-content: center;
    }

    .field-label {
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 1px;
      line-height: 1.1;
    }

    .field-value {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.15;
    }

    .handwritten-placeholder {
      display: inline-block;
      border-bottom: 1px solid #64748b;
      height: 12px;
      margin-top: 1px;
      vertical-align: bottom;
    }

    .handwritten-line {
      border-bottom: 1px dashed #cbd5e1;
      height: 20px;
      margin-top: 2px;
    }

    .filled-value-multiline {
      font-size: 11px;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.2;
      padding-top: 2px;
    }

    /* Table styling */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      margin-bottom: 10px;
    }

    th {
      background-color: #f8fafc;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8px;
      padding: 4px 6px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }

    td {
      padding: 3px 5px;
      border: 1px solid #cbd5e1;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.15;
    }

    .footer-signature {
      margin-top: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .signature-block {
      text-align: center;
      width: 45%;
    }

    .signature-line {
      border-bottom: 1px solid #0f172a;
      margin-bottom: 4px;
      height: 25px;
    }

    .signature-label {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }

    /* 6-Column Checklist Table */
    .checklist-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 15px;
      table-layout: fixed;
    }
    
    .checklist-table th, .checklist-table td {
      border: 1px solid #94a3b8;
      padding: 2.5px 3px;
      font-size: 8.5px;
      vertical-align: middle;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .checklist-header-param {
      background-color: #f1f5f9;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      font-size: 8px !important;
    }

    .checklist-header-day {
      background-color: #e2e8f0;
      color: #0f172a;
      text-align: center;
    }

    .checklist-row:nth-child(even) {
      background-color: #f8fafc;
    }

    .row-blue {
      background-color: #eff6ff !important;
    }
    .row-blue .checklist-param-label {
      background-color: #dbeafe !important;
      color: #1e40af !important;
    }

    .row-purple {
      background-color: #f5f3ff !important;
    }
    .row-purple .checklist-param-label {
      background-color: #ede9fe !important;
      color: #6d28d9 !important;
    }

    .row-yellow {
      background-color: #fffbeb !important;
    }
    .row-yellow .checklist-param-label {
      background-color: #fef9c3 !important;
      color: #a16207 !important;
    }

    .row-green {
      background-color: #f0fdf4 !important;
    }
    .row-green .checklist-param-label {
      background-color: #dcfce7 !important;
      color: #15803d !important;
    }

    .row-orange {
      background-color: #fff7ed !important;
    }
    .row-orange .checklist-param-label {
      background-color: #ffedd5 !important;
      color: #c2410c !important;
    }

    .row-blue, .row-purple, .row-yellow, .row-green, .row-orange {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .row-blue .checklist-param-label,
    .row-purple .checklist-param-label,
    .row-yellow .checklist-param-label,
    .row-green .checklist-param-label,
    .row-orange .checklist-param-label {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .checklist-param-label {
      background-color: #f8fafc;
      color: #334155;
      font-weight: 800 !important;
      text-transform: uppercase !important;
      text-align: left;
    }

    .checklist-cell {
      text-align: center;
    }

    .cell-empty {
      color: #94a3b8;
      font-weight: normal;
    }

    .cell-filled {
      color: #0f172a;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="no-print no-print-bar">
    <span>Visualização de Impressão - Checklist Diário</span>
    <button class="btn-print" onclick="window.print()">Imprimir PDF</button>
  </div>

  <div class="container">
    <div class="header">
      <h1>Resumo Clínico & Checklist Diário</h1>
      <p>Unidade de AVC - Leito ${patient.id}</p>
    </div>

    <!-- FICHA CLÍNICA, HISTÓRICO, EXAMES EM CAIXA ALTA -->
    <div class="sections-i-ii-iii">
      <!-- FICHA CLÍNICA -->
      <div class="section-title">I. Ficha Clínica / Identificação Geral</div>
      <div class="grid">
        <div class="field col-6">
          <span class="field-label">Nome do Paciente</span>
          <span class="field-value">${getVal(patient.name, '80%')}</span>
        </div>
        <div class="field col-6">
          <span class="field-label">Nome da Mãe</span>
          <span class="field-value">${getVal(patient.nomeMae, '80%')}</span>
        </div>
      </div>

      <div class="grid">
        <div class="field col-2">
          <span class="field-label">Idade</span>
          <span class="field-value">${getVal(patient.age ? `${patient.age} anos` : '', '50%')}</span>
        </div>
        <div class="field col-2">
          <span class="field-label">Sexo</span>
          <span class="field-value">${getVal(patient.gender, '50%')}</span>
        </div>
        <div class="field col-2">
          <span class="field-label">Registro</span>
          <span class="field-value">${getVal(patient.registro, '60%')}</span>
        </div>
      </div>

      <div class="grid">
        <div class="field col-3">
          <span class="field-label">Leito</span>
          <span class="field-value"><strong>LEITO ${patient.id}</strong></span>
        </div>
        <div class="field col-3">
          <span class="field-label">Peso de Admissão</span>
          <span class="field-value">${getVal(patient.weight ? `${patient.weight} kg` : '', '50%')}</span>
        </div>
        <div class="field col-3">
          <span class="field-label">Data de Admissão</span>
          <span class="field-value">${getVal(patient.dataAdmissao, '60%')}</span>
        </div>
        <div class="field col-3">
          <span class="field-label">Duração dos Sintomas</span>
          <span class="field-value">${getVal(patient.duracaoSintomas, '60%')}</span>
        </div>
      </div>

      <div class="section-title">II. Histórico do Ictus & Trombólise</div>
      <div class="grid">
        <div class="field col-3">
          <span class="field-label">Data do Ictus</span>
          <span class="field-value">${getVal(patient.dataIctus, '60%')}</span>
        </div>
        <div class="field col-3">
          <span class="field-label">Hora do Ictus</span>
          <span class="field-value">${getVal(patient.horaIctus, '60%')}</span>
        </div>
        <div class="field col-3">
          <span class="field-label">Trombólise</span>
          <span class="field-value">${getRadioSimNao(patient.trombolise)}</span>
        </div>
        <div class="field col-3">
          <span class="field-label">Data/Hora Trombólise</span>
          <span class="field-value">${getVal(patient.tromboliseDataHora, '80%')}</span>
        </div>
      </div>

      <div class="grid">
        <div class="field col-3">
          <span class="field-label">NIHSS na Admissão</span>
          <span class="field-value">${getVal(patient.nihssAdmissao, '50%')}</span>
        </div>
        <div class="field col-3">
          <span class="field-label">Rankin Prévio / Adm</span>
          <span class="field-value">${getVal(patient.rankinAdm, '50%')}</span>
        </div>
        <div class="field col-3">
          <span class="field-label">Rankin na Alta</span>
          <span class="field-value">${getVal(patient.rankinAlta, '50%')}</span>
        </div>
        <div class="field col-3">
          <span class="field-label">PA de Admissão</span>
          <span class="field-value">${patient.paSistolica || patient.paDiastolica ? getVal(`${patient.paSistolica || ''} x ${patient.paDiastolica || ''} mmHg`) : getVal('', '60%')}</span>
        </div>
      </div>

      <div class="grid">
        <div class="field col-6">
          <span class="field-label">Sintomas na Admissão</span>
          <span class="field-value">${getVal(patient.sintomasAdmissao, '90%')}</span>
        </div>
        <div class="field col-6">
          <span class="field-label">Comorbidades / Antecedentes</span>
          <span class="field-value">${getVal(patient.comorbidades, '90%')}</span>
        </div>
      </div>

      ${(() => {
        const cranialTcs = getFirstAndLastCranialTcs(patient);
        return `
          <div class="section-title">III. Exames de Imagem de Entrada & Controle (Apenas Crânio)</div>
          <div class="grid">
            <div class="field col-3">
              <span class="field-label">${cranialTcs.firstLabel} (Data)</span>
              <span class="field-value">${getVal(cranialTcs.firstData, '70%')}</span>
            </div>
            <div class="field col-9">
              <span class="field-label">${cranialTcs.firstLabel} (Laudo)</span>
              <span class="field-value">${getVal(cranialTcs.firstLaudo, '95%')}</span>
            </div>
          </div>
          <div class="grid">
            <div class="field col-12">
              <span class="field-label">AngioTC / Doppler Transcraniano (Descrição)</span>
              <span class="field-value">${getVal(patient.angiotomoDescricao, '95%')}</span>
            </div>
          </div>
          <div class="grid" style="margin-top: 4px;">
            <div class="field col-3">
              <span class="field-label">${cranialTcs.lastLabel} (Data)</span>
              <span class="field-value">${getVal(cranialTcs.lastData, '70%')}</span>
            </div>
            <div class="field col-9">
              <span class="field-label">${cranialTcs.lastLabel} (Laudo)</span>
              <span class="field-value">${getVal(cranialTcs.lastLaudo, '95%')}</span>
            </div>
          </div>
        `;
      })()}
      <div class="grid">
        <div class="field col-3">
          <span class="field-label">ECG Entrada (Data)</span>
          <span class="field-value">${getVal(patient.ecgData, '70%')}</span>
        </div>
        <div class="field col-9">
          <span class="field-label">ECG Entrada (Laudo)</span>
          <span class="field-value">${getVal(patient.ecgLaudo, '95%')}</span>
        </div>
      </div>
    </div>

    <!-- CHECK-LIST DIÁRIO (6 COLUNAS) -->
    <div class="section-title">IV. Check-list Diário da Unidade de AVC (Ciclo de 6 Dias)</div>
    <table class="checklist-table">
      <thead>
        ${tableHeadersHtml}
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <!-- ASSINATURA -->
    <div class="footer-signature" style="margin-top: 35px; display: flex; justify-content: center; align-items: flex-end;">
      <div class="signature-block" style="text-align: center; width: 60%;">
        <div class="signature-line" style="border-bottom: 1px solid #0f172a; margin-bottom: 4px; height: 30px;">
          <div style="text-align: center; font-weight: bold; font-size: 11px; padding-top: 10px;">
            ${[...dailyLists].reverse().find(l => l.checklistMedicoPlantonista)?.checklistMedicoPlantonista || patient.checklistMedicoPlantonista || ''}
          </div>
        </div>
        <span class="signature-label" style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #475569;">Dr(a). Médico(a) Plantonista / CRM</span>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const addInfusion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (patient.infusions.length >= 6) {
      alert("O limite máximo de 6 medicações em infusão contínua foi atingido.");
      return;
    }
    const newInfusion: InfusionRow = {
      id: Math.random().toString(36).substring(2, 9),
      drugId: MEDS[0].id,
      dilutionId: MEDS[0].dilutions[0].id,
      flowRate: '',
      isMinimized: false
    };
    // Minimize all other infusions of this patient when adding a new one for clean view
    const updatedInfusions = patient.infusions.map(inf => ({ ...inf, isMinimized: true }));
    updatePatient({ ...patient, infusions: [...updatedInfusions, newInfusion], isExpanded: true });
  };

  const removeInfusion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updatePatient({ ...patient, infusions: patient.infusions.filter(inf => inf.id !== id) });
  };

  const updateInfusion = (id: string, updates: Partial<InfusionRow>) => {
    updatePatient({
      ...patient,
      infusions: patient.infusions.map(inf => {
        if (inf.id === id) {
          const updated = { ...inf, ...updates };
          if (updates.drugId) {
            const drug = MEDS.find(m => m.id === updates.drugId);
            updated.dilutionId = drug?.dilutions[0].id || '';
          }
          return updated;
        }
        return inf;
      })
    });
  };

  const toggleExpand = () => {
    if (onClose) {
      onClose();
    } else {
      updatePatient({ ...patient, isExpanded: !patient.isExpanded });
    }
  };

  const alerts = useMemo(() => {
    return patient.infusions.filter(inf => {
      const drug = MEDS.find(m => m.id === inf.drugId);
      if (!drug) return false;
      const dilution = drug.dilutions.find(d => d.id === inf.dilutionId);
      if (!dilution) return false;
      const weight = parseFloat(patient.weight) || 0;
      const flowRate = parseFloat(inf.flowRate) || 0;
      const dose = calculateDose(flowRate, weight, drug, dilution);
      
      const unit = getEffectiveUnit(drug, dilution);
      const minDose = getMinDose(drug, dilution);
      const maxDose = getMaxDose(drug, dilution);

      const isWeightNeeded = ['mcg/kg/h', 'mg/kg/h', 'mcg/kg/min'].includes(unit);
      const weightMissing = isWeightNeeded && weight === 0;
      
      if (weightMissing) return false;
      return dose > 0 && (dose < minDose || dose > maxDose);
    });
  }, [patient]);

  const alertCount = alerts.length;

  const isFilled = !!(patient.name && patient.name.trim() !== '');
  const gender = patient.gender || '';

  // Theme definition
  let theme: {
    bgLight: string;
    bgLightHover: string;
    textMain: string;
    textAccent: string;
    textSub: string;
    borderLeft: string;
    borderAccent: string;
    hoverBorder: string;
    btnBgHover: string;
    chevronColor: string;
    ringColor: string;
    tagColor: "blue" | "red" | "green" | "yellow" | "purple" | "gray";
  } = {
    bgLight: 'bg-slate-100/70',
    bgLightHover: 'group-hover:bg-slate-200/50',
    textMain: 'text-slate-700',
    textAccent: 'text-slate-600',
    textSub: 'text-slate-400',
    borderLeft: 'border-l-slate-400',
    borderAccent: 'border-slate-300',
    hoverBorder: 'hover:border-slate-400',
    btnBgHover: 'group-hover:bg-slate-600',
    chevronColor: 'group-hover:text-slate-500',
    ringColor: 'focus:ring-slate-500/10 focus:border-slate-500',
    tagColor: 'gray',
  };

  if (isFilled) {
    if (gender === 'Masculino') {
      theme = {
        bgLight: 'bg-blue-50',
        bgLightHover: 'group-hover:bg-blue-100',
        textMain: 'text-blue-900',
        textAccent: 'text-blue-700',
        textSub: 'text-blue-400',
        borderLeft: 'border-l-blue-600',
        borderAccent: 'border-blue-200',
        hoverBorder: 'hover:border-blue-400',
        btnBgHover: 'group-hover:bg-blue-600',
        chevronColor: 'group-hover:text-blue-500',
        ringColor: 'focus:ring-blue-500/10 focus:border-blue-500',
        tagColor: 'blue',
      };
    } else if (gender === 'Feminino') {
      theme = {
        bgLight: 'bg-pink-50',
        bgLightHover: 'group-hover:bg-pink-100',
        textMain: 'text-pink-900',
        textAccent: 'text-pink-700',
        textSub: 'text-pink-400',
        borderLeft: 'border-l-pink-600',
        borderAccent: 'border-pink-200',
        hoverBorder: 'hover:border-pink-400',
        btnBgHover: 'group-hover:bg-pink-600',
        chevronColor: 'group-hover:text-pink-500',
        ringColor: 'focus:ring-pink-500/10 focus:border-pink-500',
        tagColor: 'purple',
      };
    }
  }

  if (!patient.isExpanded) {
    return (
      <motion.div layout id={`patient-col-${patient.id}`}>
        <Card 
          className={`flex flex-col h-full bg-white transition-all cursor-pointer group border-l-4 w-24 sm:w-32 ${theme.borderLeft} ${theme.hoverBorder}`}
          onClick={toggleExpand}
        >
          <div className="p-3 sm:p-4 flex flex-col h-full justify-between items-center text-center">
            <div className="space-y-4 w-full">
              <div className={`w-full py-2 sm:py-3 rounded-lg flex flex-col items-center ${theme.bgLight} transition-colors`}>
                 <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest ${theme.textSub}`}>
                   {isFilled ? (gender === 'Masculino' ? 'MASC' : gender === 'Feminino' ? 'FEM' : 'UTI') : 'LEITO'}
                 </span>
                 <span className={`text-2xl sm:text-3xl font-black leading-tight ${theme.textAccent}`}>{patient.id}</span>
              </div>
              
              {/* Patient Name and Age in Collapsed State */}
              <div className="space-y-1 w-full min-h-[38px] flex flex-col justify-center">
                {isFilled ? (
                  <div className="w-full overflow-hidden">
                    <p className={`text-[10px] font-black leading-tight truncate px-1 ${theme.textMain}`} title={patient.name}>
                      {patient.name}
                    </p>
                    {patient.age && (
                      <p className="text-[9px] font-bold text-slate-500 mt-0.5">
                        {patient.age} anos
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider block">Livre</span>
                )}
              </div>

              <div className="space-y-1 pt-3 border-t border-slate-100">
                 <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase block tracking-wider leading-none">Peso</span>
                 <div className="flex flex-col items-center">
                    <Scale size={12} className="text-slate-300 mb-0.5" />
                    <span className="text-xs sm:text-sm font-black text-slate-800 leading-none">{patient.weight || '--'}</span>
                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase">kg</span>
                 </div>
              </div>

              <div className="pt-3 border-t border-slate-100 w-full">
                <div className="flex flex-col items-center gap-1 overflow-hidden">
                  {patient.infusions.length > 0 ? (
                    patient.infusions.slice(0, 3).map((inf, i) => {
                      const drugName = MEDS.find(m => m.id === inf.drugId)?.name.substring(0, 3).toUpperCase();
                      return <Badge key={i} color={theme.tagColor}>{drugName}</Badge>;
                    })
                  ) : (
                    <span className="text-[8px] sm:text-[9px] font-medium text-slate-300 italic">Sem drogas</span>
                  )}
                  {patient.infusions.length > 3 && <span className="text-[8px] sm:text-[9px] font-bold text-blue-500">+{patient.infusions.length - 3}</span>}
                </div>
              </div>
            </div>

            <div className="w-full space-y-2 mt-4 sm:mt-6">
              {alertCount > 0 && (
                <div className="flex flex-col items-center text-red-500 animate-pulse">
                  <AlertCircle size={16} />
                  <span className="text-[8px] sm:text-[9px] font-black mt-0.5 leading-none">{alertCount} ERR</span>
                </div>
              )}
              <div className="flex gap-1.5 w-full">
                <button 
                  onClick={addInfusion}
                  className={`flex-1 py-2 sm:py-2.5 rounded-xl bg-slate-50 text-slate-300 transition-all flex items-center justify-center shadow-sm text-white ${theme.btnBgHover}`}
                  title="Adicionar Infusão"
                >
                  <Plus size={16} />
                </button>
                <button 
                  onClick={handlePrint}
                  className="px-2.5 py-2 sm:py-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all border border-slate-200 flex items-center justify-center shadow-sm"
                  title="Imprimir Checklist Diário"
                >
                  <Printer size={16} />
                </button>
              </div>
              <div className={`flex items-center justify-center text-slate-200 transition-colors ${theme.chevronColor}`}>
                 <ChevronRight size={16} />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div layout id={`patient-col-expanded-${patient.id}`} className="h-full w-full">
      <Card className={`flex flex-col h-full bg-slate-50 w-full max-w-full border-0 shadow-none rounded-none`}>
        <div className="bg-white p-4 border-b-2 border-slate-100 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={toggleExpand}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black shadow-lg transition-transform group-hover:scale-105 ${
                patient.gender === 'Masculino' ? 'bg-blue-600 shadow-blue-100' : 
                patient.gender === 'Feminino' ? 'bg-pink-600 shadow-pink-100' : 
                'bg-slate-600 shadow-slate-100'
              }`}>
                {patient.id}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                   <h3 className="font-black text-slate-800 text-base tracking-tight leading-none uppercase">Leito {patient.id}</h3>
                   <ChevronLeft size={14} className="text-slate-300 group-hover:-translate-x-1 transition-transform" />
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">DETALHES DO PACIENTE</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="grid grid-cols-2 gap-1.5">
                <button 
                  onClick={() => onSwapBed?.(patient)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all flex items-center justify-center gap-1 font-black text-[10px] uppercase shadow-sm tracking-wider h-8 min-w-[125px]"
                  title="Trocar este paciente de leito com outro leito"
                >
                  <ArrowLeftRight size={13} className="shrink-0" />
                  <span className="truncate">Trocar Leito</span>
                </button>
                <button 
                  onClick={handlePrint}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 transition-all flex items-center justify-center gap-1 font-black text-[10px] uppercase shadow-sm tracking-wider h-8 min-w-[125px]"
                  title="Imprimir Checklist"
                >
                  <Printer size={13} className="shrink-0" />
                  <span className="truncate">Checklist</span>
                </button>
                <button 
                  onClick={() => showExamsModal?.(patient)}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-100 transition-all flex items-center justify-center gap-1 font-black text-[10px] uppercase shadow-sm tracking-wider h-8 min-w-[125px]"
                  title="Imprimir Exames"
                >
                  <ClipboardList size={13} className="shrink-0" />
                  <span className="truncate">Exames</span>
                </button>
                <button 
                  onClick={() => onPrintGasometria?.(patient)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 transition-all flex items-center justify-center gap-1 font-black text-[10px] uppercase shadow-sm tracking-wider h-8 min-w-[125px]"
                  title="Imprimir Gasometria"
                >
                  <Printer size={13} className="shrink-0" />
                  <span className="truncate">Gasometria</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-blue-50/70 border border-blue-200/80 rounded-xl">
              <div className="flex items-center gap-1.5 text-blue-800 text-[11px] font-bold">
                <FileUp size={14} className="text-blue-600 shrink-0" />
                <span>Importar Evolução Médica:</span>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase shadow-xs transition-all tracking-wider active:scale-95">
                <FileUp size={11} />
                <span>Carregar (.docx)</span>
                <input
                  type="file"
                  accept=".docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onImportDocx) {
                      onImportDocx(patient.id, file);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                Nome do Paciente (Nome e Sobrenome)
              </label>
              <input
                type="text"
                placeholder="Ex: João Silva"
                value={patient.name || ''}
                onChange={(e) => updatePatient({ ...patient, name: e.target.value })}
                className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                  Idade
                </label>
                <input
                  type="number"
                  placeholder="Idade"
                  value={patient.age || ''}
                  onChange={(e) => updatePatient({ ...patient, age: e.target.value })}
                  className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                  Sexo
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => updatePatient({ ...patient, gender: patient.gender === 'Masculino' ? '' : 'Masculino' })}
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                      patient.gender === 'Masculino'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    MASC
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePatient({ ...patient, gender: patient.gender === 'Feminino' ? '' : 'Feminino' })}
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                      patient.gender === 'Feminino'
                        ? 'bg-pink-600 text-white border-pink-600 shadow-md shadow-pink-100'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    FEM
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                Peso do Paciente
              </label>
              <div className="relative">
                <Scale size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  placeholder="Peso em kg"
                  value={patient.weight}
                  onChange={(e) => updatePatient({ ...patient, weight: e.target.value })}
                  className={`w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-black text-slate-700 ${theme.ringColor}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 uppercase">KG</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Selector Bar */}
        <div className="flex border-b border-slate-150 bg-white sticky top-[244px] z-10 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('infusions')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === 'infusions'
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            Infusões ({patient.infusions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clinical')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === 'clinical'
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            Ficha Clínica
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === 'checklist'
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            Check-list Diário
          </button>
        </div>

        {activeTab === 'infusions' ? (
          <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-4 min-h-0 custom-scrollbar">
            {patient.infusions.length >= 6 ? (
              <div className="w-full py-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-center text-xs font-bold uppercase tracking-wider select-none">
                Limite de 6 medicações contínuas atingido
              </div>
            ) : (
              <button 
                onClick={addInfusion}
                className="w-full py-3 px-4 border-2 border-dashed border-blue-200 rounded-xl text-blue-600 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 group shadow-sm bg-blue-50/20"
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-90 transition-all duration-300">
                   <Plus size={18} />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[11px] font-black uppercase tracking-widest leading-tight">Adicionar Medicação</span>
                  <span className="text-[9px] font-medium text-slate-400 uppercase leading-none">Máximo de 6 infusões contínuas ({patient.infusions.length}/6)</span>
                </div>
              </button>
            )}

            <AnimatePresence mode="popLayout">
            {patient.infusions.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-slate-400 py-20 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 border border-slate-200/50">
                   <Droplets size={32} className="opacity-20" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Configure as medicações</p>
                <p className="text-[10px] font-medium text-slate-400 mt-1">Nenhuma infusão programada no momento</p>
              </motion.div>
            ) : (
              patient.infusions.map((inf) => {
                const drug = MEDS.find(m => m.id === inf.drugId);
                if (!drug) return null;
                const dilution = drug.dilutions.find(d => d.id === inf.dilutionId);
                if (!dilution) return null;
                const weight = parseFloat(patient.weight) || 0;
                const flowRate = parseFloat(inf.flowRate) || 0;
                const dose = calculateDose(flowRate, weight, drug, dilution);
                
                const unit = getEffectiveUnit(drug, dilution);
                const minDose = getMinDose(drug, dilution);
                const maxDose = getMaxDose(drug, dilution);

                const isWeightNeeded = ['mcg/kg/h', 'mg/kg/h', 'mcg/kg/min'].includes(unit);
                const weightMissing = isWeightNeeded && weight === 0;

                const isLow = dose > 0 && dose < minDose && !weightMissing;
                const isHigh = dose > maxDose && !weightMissing;
                const isWarning = isLow || isHigh;

                const formattedDose = formatDoseValue(dose);

                // Minimized State Rendering
                if (inf.isMinimized !== false) {
                  return (
                    <motion.div
                      key={inf.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => updateInfusion(inf.id, { isMinimized: false })}
                      className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3 shadow-sm select-none relative group ${
                        weightMissing 
                          ? 'bg-amber-50/70 border-amber-200 hover:border-amber-300 text-amber-700'
                          : isWarning 
                            ? 'bg-red-50/95 border-red-300 hover:border-red-400 text-red-600 shadow-md shadow-red-50/50' 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md text-slate-700'
                      }`}
                    >
                      {/* Hover Trash Button to delete instantly */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeInfusion(inf.id, e);
                        }}
                        className="absolute -right-2 -top-2 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-md flex items-center justify-center transition-all z-10 sm:opacity-0 sm:group-hover:opacity-100"
                        title="Remover Infusão"
                      >
                        <Trash2 size={13} />
                      </button>

                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          weightMissing ? 'bg-amber-100 text-amber-700' : 
                          isWarning ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {weightMissing ? <Scale size={14} /> : isWarning ? <AlertCircle size={14} className="animate-pulse" /> : <Activity size={14} />}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`text-[11px] font-black tracking-tight leading-tight uppercase truncate ${
                            isWarning ? 'text-red-700' : 'text-slate-800'
                          }`}>
                            {drug.name}
                          </span>
                          <span className={`text-[12px] font-black tabular-nums tracking-tight mt-0.5 ${
                            isWarning ? 'text-red-600 font-extrabold' : 'text-slate-500'
                          }`}>
                            {weightMissing ? (
                              <span className="text-[10px] font-bold text-amber-600 uppercase">Aguardando peso...</span>
                            ) : (
                              `${formattedDose} ${unit.toUpperCase()}`
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center text-slate-300 group-hover:text-slate-400 shrink-0 pr-1">
                        <Edit2 size={12} />
                      </div>
                    </motion.div>
                  );
                }

                // Full Expanded State Rendering
                return (
                  <motion.div
                    key={inf.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`bg-white p-4 rounded-2xl border transition-all duration-300 relative group ${
                      isWarning ? 'border-red-200 shadow-lg shadow-red-50' : 'border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Activity size={14} className="text-blue-600 shrink-0" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 truncate">
                          {drug.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateInfusion(inf.id, { isMinimized: true })}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black transition-all flex items-center gap-1 text-[10px] uppercase shadow-sm border border-slate-200/60"
                          title="Minimizar / Recolher Infusão"
                        >
                          <ChevronUp size={13} />
                          <span>Recolher</span>
                        </button>
                        <button 
                          onClick={(e) => removeInfusion(inf.id, e)}
                          className="p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 font-bold transition-all border border-red-100"
                          title="Remover Infusão"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-2">
                         <div className="flex-1">
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Medicação</label>
                          <div className="relative">
                            <select
                              value={inf.drugId}
                              onChange={(e) => updateInfusion(inf.id, { drugId: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none font-black text-slate-700 pr-6"
                            >
                              {MEDS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                        <div className="w-24">
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Vazão</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={inf.flowRate}
                              placeholder="0.0"
                              onChange={(e) => updateInfusion(inf.id, { flowRate: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateInfusion(inf.id, { isMinimized: true });
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-black text-center text-blue-600"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] font-bold text-slate-300">ML/H</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Concentração Selecionada</label>
                        <div className="relative">
                          <select
                            value={inf.dilutionId}
                            onChange={(e) => updateInfusion(inf.id, { dilutionId: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none pr-8 truncate font-bold text-slate-600"
                          >
                            {drug.dilutions.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className={`p-4 rounded-xl border-2 transition-all duration-500 ${
                        weightMissing ? 'bg-amber-50 border-amber-200 border-dashed' :
                        isWarning ? 'bg-red-50 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 
                        'bg-emerald-50/50 border-emerald-500/30'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${
                            weightMissing ? 'text-amber-600' : isWarning ? 'text-red-600' : 'text-emerald-700'
                          }`}>Dose Final</span>
                          <div className="text-right">
                             <span className="text-[9px] font-black text-slate-400 uppercase leading-none block mb-1.5">Referência</span>
                             <div className="flex flex-col items-end gap-0.5">
                               <div className="flex items-baseline gap-1">
                                 <span className="text-[7px] font-bold text-slate-400 uppercase">Min.</span>
                                 <span className="text-[10px] font-black text-slate-600">{minDose}</span>
                               </div>
                               <div className="flex items-baseline gap-1">
                                 <span className="text-[7px] font-bold text-slate-400 uppercase">Max.</span>
                                 <span className="text-[10px] font-black text-slate-600">{maxDose}</span>
                               </div>
                               <span className="text-[8px] font-bold text-slate-400 leading-none mt-1">{unit}</span>
                             </div>
                          </div>
                        </div>

                        {weightMissing ? (
                           <div className="flex items-center gap-2 py-2 text-amber-700">
                              <AlertCircle size={18} className="animate-pulse" />
                              <div>
                                <span className="text-[11px] font-black uppercase leading-none block">Peso Obrigatório</span>
                                <span className="text-[9px] font-medium opacity-80">Esta droga depende do peso do paciente.</span>
                              </div>
                           </div>
                        ) : (
                          <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-black tabular-nums tracking-tighter ${
                              isWarning ? 'text-red-700' : 'text-emerald-700'
                            }`}>
                              {formattedDose}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                              isWarning ? 'text-red-400' : 'text-emerald-500'
                            }`}>
                              {unit}
                            </span>
                          </div>
                        )}

                        {isWarning && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="mt-3 pt-3 border-t border-red-100 overflow-hidden"
                          >
                            <div className="flex items-start gap-2 text-red-600">
                              <div className="mt-0.5 bg-red-600 text-white rounded-full p-1 ring-4 ring-red-100">
                                <AlertCircle size={12} />
                              </div>
                              <div>
                                <span className="text-[10px] font-black uppercase leading-none block">Alerta de Segurança</span>
                                <span className="text-[9px] font-bold uppercase block mt-0.5 opacity-80">
                                  {isHigh ? 'Dosagem superior ao limite estabelecido' : 'Dosagem inferior ao limite estabelecido'}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* Minimize Button in expanded state */}
                      <button
                        type="button"
                        onClick={() => updateInfusion(inf.id, { isMinimized: true })}
                        className="w-full py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
                      >
                        <Check size={14} /> Minimizar Infusão
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
        ) : activeTab === 'clinical' ? (
          <div className="flex-1 p-5 flex flex-col items-center justify-center text-center bg-blue-50/10 rounded-2xl border border-dashed border-blue-200/50 m-4 shadow-inner">
            <Maximize2 size={32} className="text-blue-500 mb-3 animate-pulse" />
            <p className="text-xs font-black uppercase tracking-wider text-blue-700">Ficha Técnica Clínica</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">Aberto em Pop-up Tela Cheia para melhor visualização e preenchimento de dados.</p>
            <button 
              type="button"
              onClick={() => setActiveTab('clinical')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-1 mx-auto"
            >
              <Maximize2 size={10} />
              <span>Abrir Tela Cheia</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 p-5 flex flex-col items-center justify-center text-center bg-purple-50/10 rounded-2xl border border-dashed border-purple-200/50 m-4 shadow-inner">
            <Maximize2 size={32} className="text-purple-500 mb-3 animate-pulse" />
            <p className="text-xs font-black uppercase tracking-wider text-purple-700">Check-list Diário</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">Aberto em Pop-up Tela Cheia para melhor visualização e preenchimento de dados.</p>
            <button 
              type="button"
              onClick={() => setActiveTab('checklist')}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md shadow-purple-100 hover:bg-purple-700 transition-all flex items-center gap-1 mx-auto"
            >
              <Maximize2 size={10} />
              <span>Abrir Tela Cheia</span>
            </button>
          </div>
        )}
      </Card>

      {/* Fullscreen Modal Portal */}
      {(activeTab === 'clinical' || activeTab === 'checklist') && createPortal(
        <div className="fixed inset-0 z-[150] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, y: 15, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-slate-50 w-full h-full max-w-7xl rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left border border-slate-200"
          >
            {/* Modal Header */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg ${
                  patient.gender === 'Masculino' ? 'bg-blue-600 shadow-blue-100' : 
                  patient.gender === 'Feminino' ? 'bg-pink-600 shadow-pink-100' : 
                  'bg-slate-600 shadow-slate-100'
                }`}>
                  {patient.id}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-slate-800 text-lg uppercase tracking-tight">Leito {patient.id} — {patient.name || 'Paciente sem nome'}</h2>
                    {patient.age && <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">{patient.age} anos</span>}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Ficha Técnica Clínica & Check-list Diário de Controle</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 transition-all flex items-center gap-2 font-black text-xs uppercase shadow-sm tracking-wider"
                  title="Imprimir Checklist"
                >
                  <Printer size={16} />
                  <span>Imprimir Checklist</span>
                </button>
                <button 
                  onClick={() => showExamsModal?.(patient)}
                  className="px-4 py-2 rounded-xl bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-100 transition-all flex items-center gap-2 font-black text-xs uppercase shadow-sm tracking-wider"
                  title="Imprimir Exames"
                >
                  <ClipboardList size={16} />
                  <span>Imprimir Exames</span>
                </button>
                <button 
                  onClick={() => onPrintGasometria?.(patient)}
                  className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 transition-all flex items-center gap-2 font-black text-xs uppercase shadow-sm tracking-wider"
                  title="Imprimir Gasometria"
                >
                  <Printer size={16} />
                  <span>Imprimir Gasometria</span>
                </button>
                <button 
                  onClick={() => setActiveTab('infusions')}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-900 border border-slate-800 transition-all flex items-center gap-1.5 font-black text-xs uppercase shadow-md tracking-wider"
                  title="Salvar e Fechar"
                >
                  <Check size={16} />
                  <span>Salvar e Fechar</span>
                </button>
              </div>
            </div>

            {/* Modal Tab Switcher */}
            <div className="bg-white border-b border-slate-200 flex shrink-0 px-4">
              <button
                type="button"
                onClick={() => setActiveTab('clinical')}
                className={`px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'clinical'
                    ? 'border-blue-600 text-blue-600 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Ficha Técnica / Clínica
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('checklist')}
                className={`px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'checklist'
                    ? 'border-blue-600 text-blue-600 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Check-list Diário da Unidade de AVC
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
              {activeTab === 'clinical' ? (
                <ClinicalForm 
                  patient={patient} 
                  updatePatient={updatePatient} 
                  handleDateMask={handleDateMask} 
                  theme={theme} 
                />
              ) : (
                <ChecklistForm 
                  patient={patient} 
                  updatePatient={updatePatient} 
                  handleDateMask={handleDateMask} 
                  theme={theme} 
                />
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </motion.div>
  );
};

// --- Consultation Lists Data ---

const ANTIBIOTICOS_LIST = [
  "1. AMICACINA SULFATO 500MG (2ML) + SF 0,9% 100ML, EV, CORRER EM 60 MIN, DE 12/12H",
  "2. AMPICILINA SÓDICA 500MG + SF 0,9% 100ML, EV, CORRER EM 30 MIN, DE 6/6H",
  "3. AMPICILINA + SULBACTAM 1,5G + SF 0,9% 100ML, EV, CORRER EM 30 MIN, DE 6/6H",
  "4. BENZILPENICILINA POTÁSSICA 5.000.000U + SF 0,9% 200ML, EV, CORRER EM 120 MIN, DE 4/4H A 6/6H",
  "5. CEFALOTINA SÓDICA 1G + SF 0,9% 50ML, EV, CORRER EM 30 MIN, DE 6/6H",
  "6. CEFAZOLINA SÓDICA 1G + SF 0,9% 100ML, EV, CORRER EM 30 MIN, DE 8/8H",
  "7. CEFEPIME CLORIDRATO 1G + SF 0,9% 100ML, EV, CORRER EM 3H, DE 8/8H",
  "8. CEFOTAXIMA SÓDICA 1G + SF 0,9% 100ML, EV, CORRER EM 30 MIN, DE 6/6H",
  "9. CEFOXITINA SÓDICA 1G + SF 0,9% 100ML, EV, CORRER EM 30 MIN, DE 6/6H",
  "10. CEFTAZIDIMA 1G + SF 0,9% 100ML, EV, CORRER EM 3H, DE 8/8H",
  "11. CEFTRIAXONA 1G + SF 0,9% 100ML, EV, CORRER EM 30 MIN, DE 24/24H",
  "12. CEFUROXIMA SÓDICA 750MG + SF 0,9% 100ML, EV, CORRER EM 30 MIN, DE 8/8H",
  "13. CIPROFLOXACINO 200MG/100ML, BOLSA PRONTA, EV, CORRER EM 60 MIN, DE 12/12H",
  "14. CLARITROMICINA 500MG + SF 0,9% 250ML, EV, CORRER EM 60 MIN, DE 12/12H",
  "15. CLINDAMICINA FOSFATO 300MG (2ML) + SF 0,9% 50ML, EV, CORRER EM 30 MIN, DE 6/6H",
  "16. GENTAMICINA SULFATO 40MG (1ML) + SF 0,9% 50ML, EV, CORRER EM 60 MIN, DE 24/24H",
  "17. IMIPENEM + CILASTATINA SÓDICA 500MG + SF 0,9% 100ML, EV, CORRER EM 2H, DE 6/6H",
  "18. LEVOFLOXACINO 500MG/100ML, BOLSA PRONTA, EV, CORRER EM 60 MIN, DE 24/24H",
  "19. LINEZOLIDA 600MG/300ML, BOLSA PRONTA, EV, CORRER EM 120 MIN, DE 12/12H",
  "20. MEROPENEM 500MG + SF 0,9% 100ML, EV, CORRER EM 3H, DE 8/8H",
  "21. METRONIDAZOL 500MG/100ML, BOLSA PRONTA, EV, CORRER EM 60 MIN, DE 8/8H",
  "22. OXACILINA 500MG + SF 0,9% 100ML, EV, CORRER EM 3H, DE 4/4H",
  "23. PIPERACILINA + TAZOBACTAM 4,5G + SF 0,9% 150ML, EV, CORRER EM 4H, DE 6/6H",
  "24. POLIMIXINA B 500.000U + SG 5% 500ML, EV, CORRER EM 4 HORAS, DE 12/12H",
  "25. SULFAMETOXAZOL + TRIMETOPRIM 1 AMP (5ML) + SF 0,9% 150ML, EV, CORRER EM 60 MIN, DE 6/6H",
  "26. TEICOPLANINA 400MG + SF 0,9% 100ML, EV, CORRER EM 60 MIN, DE 24/24H",
  "27. TIGECICLINA 50MG + SF 0,9% 100ML, EV, CORRER EM 60 MIN, DE 12/12H",
  "28. VANCOMICINA CLORIDRATO 500MG + SF 0,9% 100ML, EV, CORRER EM 60 MIN, DE 12/12H"
];

const SEDATIVOS_LIST = [
  "1. MIDAZOLAM (50 MG/10ML) 40 ML + 160 ML SF 0,9%, EV EM BIC, VAZÃO ACM",
  "2. PROPOFOL (10MG/ML) 100 ML PURO, EV EM BIC, VAZÃO ACM",
  "3. PRECEDEX (2MCG/ML) 2 AMP + 96 ML SF 0,9% EV EM BIC, VAZÃO ACM"
];

const ANALGESICOS_LIST = [
  "1. FENTANIL (50 MCG/10 ML) 40 ML + 160 ML SF 0,9%, EV EM BIC, VAZÃO ACM",
  "2. CETAMINA (5MG/ML) 10 ML + 90 ML SF 0,9% EV EM BIC, VAZÃO ACM",
  "3. MORFINA (10 MG/ML) 02 AMP + SF 0,9% 98 ML, EV EM BIC, VAZÃO ACM",
  "4. TRAMAL (50 MG/ML) 01 AMP + SF 0,9% 50 ML, EV, EM 30 MIN, DE 6/6H SE SINAIS DE DOR REFRATÁRIA A DIPIRONA ENDOVENOSA"
];

// --- Date Mask Helper ---
const handleDateMask = (val: string) => {
  const clean = val.replace(/\D/g, '').slice(0, 6);
  if (clean.length <= 2) return clean;
  if (clean.length <= 4) return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 6)}`;
};

// --- Main App Component ---

export default function InfusionApp() {
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('uti_avc_patients') : null;
    let loaded: Patient[] = [];
    if (saved) {
      try {
        loaded = JSON.parse(saved);
      } catch (e) {
        console.error("Erro ao carregar dados do localStorage:", e);
      }
    }
    if (!loaded || loaded.length === 0) {
      loaded = Array.from({ length: 6 }, (_, i) => ({
        id: i + 1,
        name: '',
        age: '',
        gender: '',
        weight: '',
        height: '',
        infusions: [],
        isExpanded: false
      }));
    }
    return loaded.map(p => {
      let tcControles = p.tcControles;
      if (!tcControles || !Array.isArray(tcControles)) {
        if (p.tcControleData || p.tcControleLaudo) {
          tcControles = [
            {
              id: 'initial-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
              data: p.tcControleData || '',
              laudo: p.tcControleLaudo || ''
            }
          ];
        } else {
          tcControles = [];
        }
      }
      return {
        ...p,
        tcControles,
        dailyChecklists: ensureDailyChecklists(p)
      };
    });
  });

  useEffect(() => {
    localStorage.setItem('uti_avc_patients', JSON.stringify(patients));
  }, [patients]);
  
  // --- Pacientes Antigos (Arquivados ao apagar leito por até 10 dias) ---
  const [archivedPatients, setArchivedPatients] = useState<ArchivedPatient[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('uti_avc_archived_patients') : null;
    if (saved) {
      try {
        const parsed: ArchivedPatient[] = JSON.parse(saved);
        const now = Date.now();
        return parsed.filter(item => (now - item.deletedAt) <= TEN_DAYS_MS);
      } catch (e) {
        console.error("Erro ao carregar pacientes arquivados:", e);
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('uti_avc_archived_patients', JSON.stringify(archivedPatients));
  }, [archivedPatients]);

  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [restoreTargetPatient, setRestoreTargetPatient] = useState<ArchivedPatient | null>(null);
  const [restoreChosenBedId, setRestoreChosenBedId] = useState<number | null>(null);

  // --- Importação de Evolução (.docx / Word) ---
  const [importPreviewData, setImportPreviewData] = useState<ParsedEvolutionData | null>(null);
  const [importTargetBedId, setImportTargetBedId] = useState<number | null>(null);
  const [isImportLoading, setIsImportLoading] = useState(false);

  const [showDilutionsModal, setShowDilutionsModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [examModalPatient, setExamModalPatient] = useState<Patient | null>(null);
  const [isWhatsAppSettingsOpen, setIsWhatsAppSettingsOpen] = useState(false);
  const [isWhatsAppSendOpen, setIsWhatsAppSendOpen] = useState(false);

  const [editingPatientId, setEditingPatientId] = useState<number | null>(null);
  const [swapSourcePatient, setSwapSourcePatient] = useState<Patient | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<number | null>(null);

  const handleSwapBeds = (sourceId: number, targetId: number) => {
    if (sourceId === targetId) return;

    setPatients(prevPatients => {
      const sourcePatient = prevPatients.find(p => p.id === sourceId);
      const targetPatient = prevPatients.find(p => p.id === targetId);
      if (!sourcePatient || !targetPatient) return prevPatients;

      return prevPatients.map(p => {
        if (p.id === sourceId) {
          return {
            ...targetPatient,
            id: sourceId
          };
        }
        if (p.id === targetId) {
          return {
            ...sourcePatient,
            id: targetId
          };
        }
        return p;
      });
    });

    if (editingPatientId === sourceId) {
      setEditingPatientId(targetId);
    } else if (editingPatientId === targetId) {
      setEditingPatientId(sourceId);
    }

    setSwapSourcePatient(null);
    setSwapTargetId(null);
  };
  const [logoFailed, setLogoFailed] = useState(false);

  const [examFields, setExamFields] = useState({
    name: '',
    registro: '',
    dataNascimento: '',
    age: '',
    solicitadoEm: '',
    solicitadoAs: '06:00',
    nomeMae: '',
    outros: '',
    indicacao: 'Avaliação clínica rotineira de Unidade de AVC.',
    medicoSolicitante: '',
    exams: {
      'HEMOGRAMA COMPLETO': true,
      'COAGULOGRAMA': false,
      'SÓDIO/POTÁSSIO/CLORO/CÁLCIO IÔNICO': true,
      'GLICOSE': false,
      'URÉIA/CREATININA': true,
      'GGT/FOSFATASE ALCALINA': false,
      'BIL. TOTAIS E FRAÇÕES': false,
      'TGO/TGP': false,
      'SUMÁRIO DE URINA': false,
      'PCR': true,
      'TAP/TTPA': false,
      'CK NAC/CK MB': false,
      'TROPONINA': false,
      'AMILASE': false,
      'BETA HCG': false,
      'HBsAg - teste rápido': false,
      'VDRL': false,
    } as Record<string, boolean>
  });

  useEffect(() => {
    if (examModalPatient) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const year = String(tomorrow.getFullYear()).slice(-2);
      const tomorrowStr = `${day}/${month}/${year}`;

      setExamFields({
        name: examModalPatient.name || '',
        registro: examModalPatient.registro || '',
        dataNascimento: examModalPatient.dataNascimento || '',
        age: examModalPatient.age || '',
        solicitadoEm: tomorrowStr,
        solicitadoAs: '06:00',
        nomeMae: examModalPatient.nomeMae || '',
        outros: '',
        indicacao: 'Avaliação clínica rotineira de Unidade de AVC.',
        medicoSolicitante: '',
        exams: {
          'HEMOGRAMA COMPLETO': true,
          'COAGULOGRAMA': false,
          'SÓDIO/POTÁSSIO/CLORO/CÁLCIO IÔNICO': true,
          'GLICOSE': false,
          'URÉIA/CREATININA': true,
          'GGT/FOSFATASE ALCALINA': false,
          'BIL. TOTAIS E FRAÇÕES': false,
          'TGO/TGP': false,
          'SUMÁRIO DE URINA': false,
          'PCR': true,
          'TAP/TTPA': false,
          'CK NAC/CK MB': false,
          'TROPONINA': false,
          'AMILASE': false,
          'BETA HCG': false,
          'HBsAg - teste rápido': false,
          'VDRL': false,
        }
      });
    }
  }, [examModalPatient]);

  const updatePatient = (updated: Patient) => {
    setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const clearPatient = (id: number) => {
    const patientToClear = patients.find(p => p.id === id);
    if (patientToClear && patientToClear.name && patientToClear.name.trim() !== '') {
      const now = new Date();
      const newArchived: ArchivedPatient = {
        archiveId: 'arch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        deletedAt: now.getTime(),
        deletedDateFormatted: formatDateTimeDDMMAA(now),
        originalBedId: id,
        patient: JSON.parse(JSON.stringify(patientToClear))
      };
      setArchivedPatients(prev => [newArchived, ...prev.filter(item => (Date.now() - item.deletedAt) <= TEN_DAYS_MS)]);
    }

    const freshPatient: Patient = {
      id,
      weight: '',
      height: '',
      infusions: [],
      isExpanded: false,
      name: '',
      age: '',
      gender: '',
      registro: '',
      nomeMae: '',
      dataNascimento: '',
      dataIctus: '',
      horaIctus: '',
      trombolise: '',
      tromboliseDataHora: '',
      dataAdmissao: '',
      nihssAdmissao: '',
      rankinAdm: '',
      rankinAlta: '',
      sintomasAdmissao: '',
      paSistolica: '',
      paDiastolica: '',
      duracaoSintomas: '',
      comorbidades: '',
      tcAdmissaoData: '',
      tcAdmissaoLaudo: '',
      angiotomoDescricao: '',
      tcControleData: '',
      tcControleLaudo: '',
      tcControles: [],
      ecgData: '',
      ecgLaudo: '',
      checklistData: '',
      checklistNihssAtual: '',
      checklistGlasgow: '',
      checklistEcgCheck: '',
      checklistPup: '',
    };
    freshPatient.dailyChecklists = ensureDailyChecklists(freshPatient);
    updatePatient(freshPatient);
  };

  const handleRestorePatient = (archived: ArchivedPatient, targetBedId: number) => {
    const targetBed = patients.find(p => p.id === targetBedId);
    if (!targetBed || (targetBed.name && targetBed.name.trim() !== '')) {
      alert('O leito selecionado não está vazio.');
      return;
    }

    const restoredData: Patient = {
      ...archived.patient,
      id: targetBedId,
      isExpanded: true
    };
    restoredData.dailyChecklists = ensureDailyChecklists(restoredData);

    updatePatient(restoredData);
    setArchivedPatients(prev => prev.filter(item => item.archiveId !== archived.archiveId));
    setRestoreTargetPatient(null);
    setRestoreChosenBedId(null);
    setIsArchivedModalOpen(false);
    setEditingPatientId(targetBedId);
  };

  const handleDeleteArchivedPatient = (archiveId: string) => {
    setArchivedPatients(prev => prev.filter(item => item.archiveId !== archiveId));
    if (restoreTargetPatient?.archiveId === archiveId) {
      setRestoreTargetPatient(null);
      setRestoreChosenBedId(null);
    }
  };

  const handleImportDocx = async (bedId: number, file: File) => {
    setIsImportLoading(true);
    try {
      const parsed = await parseEvolutionDocxFile(file);
      setImportPreviewData(parsed);
      setImportTargetBedId(bedId);
    } catch (err: any) {
      alert(err?.message || 'Erro ao ler o arquivo .docx');
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleConfirmImport = (finalData: ParsedEvolutionData) => {
    if (importTargetBedId === null) return;
    const existing = patients.find(p => p.id === importTargetBedId);
    const updatedPatient: Patient = {
      ...(existing || { id: importTargetBedId, weight: '', height: '', infusions: [], isExpanded: true }),
      id: importTargetBedId,
      name: finalData.name || existing?.name || '',
      registro: finalData.registro || existing?.registro || '',
      dataNascimento: finalData.dataNascimento || existing?.dataNascimento || '',
      age: finalData.age || existing?.age || '',
      weight: finalData.weight || existing?.weight || '',
      gender: finalData.gender || existing?.gender || '',
      nomeMae: finalData.nomeMae || existing?.nomeMae || '',
      dataAdmissao: finalData.dataAdmissao || existing?.dataAdmissao || '',
      dataIctus: finalData.dataIctus || existing?.dataIctus || '',
      horaIctus: finalData.horaIctus || existing?.horaIctus || '',
      sintomasAdmissao: finalData.sintomasAdmissao || existing?.sintomasAdmissao || '',
      duracaoSintomas: finalData.duracaoSintomas || existing?.duracaoSintomas || '',
      nihssAdmissao: finalData.nihssAdmissao || existing?.nihssAdmissao || '',
      rankinAdm: finalData.rankinAdm || existing?.rankinAdm || '',
      paSistolica: finalData.paSistolica || existing?.paSistolica || '',
      paDiastolica: finalData.paDiastolica || existing?.paDiastolica || '',
      comorbidades: finalData.comorbidades || existing?.comorbidades || '',
      tcAdmissaoData: finalData.tcAdmissaoData || existing?.tcAdmissaoData || '',
      tcAdmissaoLaudo: finalData.tcAdmissaoLaudo || existing?.tcAdmissaoLaudo || '',
      angiotomoDescricao: finalData.angiotomoDescricao || existing?.angiotomoDescricao || '',
      ecgData: finalData.ecgData || existing?.ecgData || '',
      ecgLaudo: finalData.ecgLaudo || existing?.ecgLaudo || '',
      checklistData: finalData.dataAdmissao || existing?.checklistData || '',
      checklistGlasgow: finalData.checklistGlasgow || existing?.checklistGlasgow || '',
      checklistPup: finalData.checklistPup || existing?.checklistPup || '',
      isExpanded: true
    };
    updatedPatient.dailyChecklists = ensureDailyChecklists(updatedPatient);

    if (updatedPatient.dailyChecklists && updatedPatient.dailyChecklists.length > 0) {
      const first = updatedPatient.dailyChecklists[0];
      if (!first.checklistData && finalData.dataAdmissao) {
        first.checklistData = finalData.dataAdmissao;
      }
      if (!first.checklistGlasgow && finalData.checklistGlasgow) {
        first.checklistGlasgow = finalData.checklistGlasgow;
      }
      if (!first.checklistPup && finalData.checklistPup) {
        first.checklistPup = finalData.checklistPup;
      }
      if (!first.checklistNihssAtual && finalData.nihssAdmissao) {
        first.checklistNihssAtual = finalData.nihssAdmissao;
      }
    }

    updatePatient(updatedPatient);
    setImportPreviewData(null);
    const targetId = importTargetBedId;
    setImportTargetBedId(null);
    setEditingPatientId(targetId);
  };

  const getAllChecklistsHtml = (): string => {
    const occupied = patients.filter(p => p.name && p.name.trim() !== '').sort((a, b) => a.id - b.id);
    if (occupied.length === 0) {
      return '';
    }

    // Obter a última data registrada (última coluna com data) do primeiro leito preenchido
    let targetDateStr = '';
    for (const patient of occupied) {
      const dailyLists = ensureDailyChecklists(patient);
      for (let i = dailyLists.length - 1; i >= 0; i--) {
        if (dailyLists[i].checklistData && dailyLists[i].checklistData.trim() !== '') {
          targetDateStr = dailyLists[i].checklistData.trim();
          break;
        }
      }
      if (targetDateStr) break;
    }

    if (!targetDateStr) {
      targetDateStr = new Date().toLocaleDateString('pt-BR');
    }

    const getVal = (val: any, width = '100%') => {
      if (val === undefined || val === null || val === '') {
        return `<span class="handwritten-placeholder" style="width: ${width};"></span>`;
      }
      return `<strong class="filled-value">${val}</strong>`;
    };

    const getRadioSimNao = (val: string | undefined) => {
      return `${val === 'Sim' ? '<strong>[X] SIM</strong>' : '[ ] SIM'}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${val === 'Não' ? '<strong>[X] NÃO</strong>' : '[ ] NÃO'}`;
    };

    const renderCell = (rawVal: any, styleAttr: string = '') => {
      if (rawVal === undefined || rawVal === null || rawVal === '') {
        return `<td class="checklist-cell cell-empty" style="${styleAttr}">—</td>`;
      }
      const valStr = String(rawVal).replace(/\n/g, '<br/>');
      return `<td class="checklist-cell cell-filled" style="${styleAttr}">${valStr}</td>`;
    };

    const renderVentilacaoCell = (val: string[] | undefined, outros?: string) => {
      if (!val || val.length === 0) {
        return outros ? `<td class="checklist-cell cell-filled">${outros}</td>` : `<td class="checklist-cell cell-empty">—</td>`;
      }
      let txt = val.map(formatVentilacaoItem).filter(Boolean).join(', ');
      if (outros) txt += ` (${outros})`;
      return `<td class="checklist-cell cell-filled">${txt}</td>`;
    };

    const tableRows = [
      { label: 'NIHSS Atual', getValue: (d: DailyChecklist) => d.checklistNihssAtual, colorClass: 'row-blue' },
      { label: 'GLASGOW / RASS', getValue: (d: DailyChecklist) => d.checklistGlasgow, colorClass: 'row-blue' },
      { label: 'Pupilas (PUP)', getValue: (d: DailyChecklist) => d.checklistPup, colorClass: 'row-blue' },
      { label: 'Respiração (RESP)', getValue: (d: DailyChecklist) => d.checklistResp, colorClass: 'row-blue' },
      { label: 'Função Motora', getValue: (d: DailyChecklist) => d.checklistMotor, colorClass: 'row-blue' },
      { label: 'Sedação', getValue: (d: DailyChecklist) => d.checklistSedacao ? `${d.checklistSedacao}${d.checklistSedacaoText ? `: ${d.checklistSedacaoText}` : ''}` : '', colorClass: 'row-purple' },
      { label: 'Analgesia', getValue: (d: DailyChecklist) => d.checklistAnalgesia ? `${d.checklistAnalgesia}${d.checklistAnalgesiaText ? `: ${d.checklistAnalgesiaText}` : ''}` : '', colorClass: 'row-purple' },
      { label: 'Drogas Vasoativas (DVA)', getValue: (d: DailyChecklist) => d.checklistDva ? `${d.checklistDva}${d.checklistDvaText ? `: ${d.checklistDvaText}` : ''}` : '', colorClass: 'row-purple' },
      { label: 'Bloqueador Neuromuscular', getValue: (d: DailyChecklist) => d.checklistBloqueadorNeuromuscular, colorClass: 'row-purple' },
      { label: 'Suporte Ventilatório', getValue: (d: DailyChecklist) => '', isVent: true },
      { label: 'Dias VM / Desmame', getValue: (d: DailyChecklist) => (d.checklistDiasVm || d.checklistDesmameVm) ? `${d.checklistDiasVm ? `${d.checklistDiasVm}d` : ''} ${d.checklistDesmameVm ? `| Desmame: ${d.checklistDesmameVm}` : ''}` : '' },
      { label: 'Pressão Arterial (PAS X PAD)', getValue: (d: DailyChecklist) => {
          if (d.checklistPas || d.checklistPad) {
            return `PAS: ${d.checklistPas || '—'}<br/>PAD: ${d.checklistPad || '—'}`;
          }
          if (d.checklistPasPad) {
            const parts = d.checklistPasPad.split(/\s*x\s*|\s*\/\s*/i);
            if (parts.length === 2) {
              return `PAS: ${parts[0]}<br/>PAD: ${parts[1]}`;
            }
            return d.checklistPasPad;
          }
          return '';
        }
      },
      { label: 'Febre registrada', getValue: (d: DailyChecklist) => {
          if (d.checklistFebre && d.checklistFebreTemp) {
            return `${d.checklistFebre} (${d.checklistFebreTemp})`;
          }
          return d.checklistFebre || d.checklistFebreTemp;
        }
      },
      { 
        label: 'Controle Glicêmico (HGT)', 
        getValue: (d: DailyChecklist) => {
          if (!d.checklistHgtMaior && !d.checklistHgtMenor) return '';
          return `Max: ${d.checklistHgtMaior || '—'}<br/>Min: ${d.checklistHgtMenor || '—'}`;
        } 
      },
      { 
        label: 'Antibioticoterapia', 
        getValue: (d: DailyChecklist) => {
          if (d.checklistAntibiotico === 'Não') return 'Não';
          if (d.checklistAntibioticoText && d.checklistAntibioticoText.trim()) {
            const lines = d.checklistAntibioticoText
              .split('\n')
              .map(l => l.trim())
              .filter(Boolean);
            if (lines.length > 0) {
              return lines.join('<br/>');
            }
          }
          return d.checklistAntibiotico || '';
        }, 
        colorClass: 'row-orange' 
      },
      { label: 'Antiagregante', getValue: (d: DailyChecklist) => d.checklistAntiagregante },
      { label: 'Anticoagulante', getValue: (d: DailyChecklist) => d.checklistAnticoagulante },
      { label: 'Acesso Venoso', getValue: (d: DailyChecklist) => (d.checklistAcessoLocal || d.checklistAcessoDia) ? `${d.checklistAcessoLocal || '—'} (Dia ${d.checklistAcessoDia || '—'})` : '' },
      { label: 'Dieta', getValue: (d: DailyChecklist) => d.checklistDieta ? `${d.checklistDieta}${d.checklistDietaTipo ? ` (${d.checklistDietaTipo})` : ''}` : '' },
      { 
        label: 'BH (24h) / Diurese', 
        getValue: (d: DailyChecklist) => {
          if (!d.checklistBalançoHidrico && !d.checklistDiurese) return '';
          return `BH: ${d.checklistBalançoHidrico || '—'}<br/>Diur: ${d.checklistDiurese || '—'}`;
        }, 
        colorClass: 'row-yellow' 
      },
      { label: 'Evacuações', getValue: (d: DailyChecklist) => d.checklistEvacuacoes ? `${d.checklistEvacuacoes}${d.checklistEvacuacoesAspecto ? ` (${d.checklistEvacuacoesAspecto})` : ''}` : '' },
      { label: 'Presença de Escaras', getValue: (d: DailyChecklist) => d.checklistEscaras ? `${d.checklistEscaras}${d.checklistEscarasLocal ? ` [${d.checklistEscarasLocal}]` : ''}` : '' },
      { label: 'Fisioterapia Motora', getValue: (d: DailyChecklist) => (d.checklistFisioGrauForca || d.checklistFisioTonus) ? `Força: ${d.checklistFisioGrauForca || '—'} / Tônus: ${d.checklistFisioTonus || '—'}` : '' },
      { label: 'Avaliação Fonoaudiológica', getValue: (d: DailyChecklist) => d.checklistFonoaudiologia },
      { label: 'Disfagia / Linguagem', getValue: (d: DailyChecklist) => d.checklistDisfagiaLinguagem },
      { label: 'Gasometria (pH/PaO2/HCO3)', getValue: (d: DailyChecklist) => (d.checklistPh || d.checklistPao2Paco2) ? `pH: ${d.checklistPh || '—'} | PaO2: ${d.checklistPao2Paco2 || '—'} | HCO3: ${d.checklistHco3Sao2 || '—'}` : '', colorClass: 'row-green' },
      { label: 'Laboratório (Hb/Ht/Plaq)', getValue: (d: DailyChecklist) => (d.checklistHb || d.checklistPlaquetas) ? `Hb: ${d.checklistHb || '—'} | Plaq: ${d.checklistPlaquetas || '—'}` : '', colorClass: 'row-green' },
      { label: 'Leucócitos / Bastões', getValue: (d: DailyChecklist) => (d.checklistLeucograma || d.checklistBastoes) ? `Leu: ${d.checklistLeucograma || '—'} | Bast: ${d.checklistBastoes || '—'}` : '', colorClass: 'row-green' },
      { label: 'INR / Sódio / Potássio', getValue: (d: DailyChecklist) => (d.checklistInr || d.checklistSodio || d.checklistPotassio) ? `INR: ${d.checklistInr || '—'} | Na: ${d.checklistSodio || '—'} | K: ${d.checklistPotassio || '—'}` : '', colorClass: 'row-green' },
      { label: 'Ureia / Creatinina / Outros', getValue: (d: DailyChecklist) => {
          const parts = [];
          if (d.checklistUreia) parts.push(`Ur: ${d.checklistUreia}`);
          if (d.checklistCreatinina) parts.push(`Cr: ${d.checklistCreatinina}`);
          if (d.checklistBioquimicaOutros) parts.push(`Outros: ${d.checklistBioquimicaOutros}`);
          return parts.length > 0 ? parts.join(' | ') : '';
        }, colorClass: 'row-green' },
      { label: 'ECG / Eco Doppler', getValue: (d: DailyChecklist) => (d.checklistEcgExame || d.checklistEcoDoppler) ? `ECG: ${d.checklistEcgExame || '—'} | Eco: ${d.checklistEcoDoppler || '—'}` : '' },
      { 
        label: 'Condutas', 
        getValue: (d: DailyChecklist) => d.checklistCondutas || '',
        alignJustify: true
      },
      { label: 'Médico Plantonista', getValue: (d: DailyChecklist) => d.checklistMedicoPlantonista }
    ];

    const pagesHtml = occupied.map(patient => {
      const dailyListsFull = ensureDailyChecklists(patient);
      const { pageLists: dailyLists, startColumn } = getLastFilledPageLists(dailyListsFull);

      const tableHeadersHtml = `
        <tr>
          <th class="checklist-header-param" style="width: 16%; text-align: left; text-transform: uppercase; font-weight: 800; font-size: 8px;">PARÂMETRO / AVAL.</th>
          ${dailyLists.map((list, idx) => {
            const colNum = startColumn + idx;
            const dateLabel = list.checklistData ? `<strong>${list.checklistData}</strong>` : `<span style="color: #64748b; font-weight: normal;">—</span>`;
            return `
              <th class="checklist-header-day" style="width: 14%; text-align: center;">
                <div style="font-size: 7px; font-weight: 500; color: #475569; margin-bottom: 2px;">COLUNA ${colNum}</div>
                <div style="font-size: 8.5px; font-weight: 800;">${dateLabel}</div>
              </th>
            `;
          }).join('')}
        </tr>
      `;

      const tableRowsHtml = tableRows.map(row => {
        const colorClass = (row as any).colorClass || '';
        const alignStyle = (row as any).alignJustify ? 'text-align: justify; text-justify: inter-word; word-break: break-word;' : '';
        return `
          <tr class="checklist-row ${colorClass}">
            <td class="checklist-param-label" style="font-weight: 800; color: #1e293b; font-size: 7.5px; text-transform: uppercase; line-height: 1.1; padding: 2.5px 3px;">${row.label}</td>
            ${dailyLists.map(list => {
              if (row.isVent) {
                return renderVentilacaoCell(list.checklistVentilacao, list.checklistVentilacaoOutros);
              }
              return renderCell(row.getValue(list), alignStyle);
            }).join('')}
          </tr>
        `;
      }).join('');

      return `
      <div class="page-container">
        <div class="header">
          <h1>Resumo Clínico & Checklist Diário</h1>
          <p>Unidade de AVC - Leito ${patient.id}</p>
        </div>

        <!-- FICHA CLÍNICA, HISTÓRICO, EXAMES EM CAIXA ALTA -->
        <div class="sections-i-ii-iii">
          <!-- FICHA CLÍNICA -->
          <div class="section-title">I. Ficha Clínica / Identificação Geral</div>
          <div class="grid">
            <div class="field col-6">
              <span class="field-label">Nome do Paciente</span>
              <span class="field-value">${getVal(patient.name, '80%')}</span>
            </div>
            <div class="field col-6">
              <span class="field-label">Nome da Mãe</span>
              <span class="field-value">${getVal(patient.nomeMae, '80%')}</span>
            </div>
          </div>

          <div class="grid">
            <div class="field col-2">
              <span class="field-label">Idade</span>
              <span class="field-value">${getVal(patient.age ? `${patient.age} anos` : '', '50%')}</span>
            </div>
            <div class="field col-2">
              <span class="field-label">Sexo</span>
              <span class="field-value">${getVal(patient.gender, '50%')}</span>
            </div>
            <div class="field col-2">
              <span class="field-label">Registro</span>
              <span class="field-value">${getVal(patient.registro, '60%')}</span>
            </div>
          </div>

          <div class="grid">
            <div class="field col-3">
              <span class="field-label">Leito</span>
              <span class="field-value"><strong>LEITO ${patient.id}</strong></span>
            </div>
            <div class="field col-3">
              <span class="field-label">Peso de Admissão</span>
              <span class="field-value">${getVal(patient.weight ? `${patient.weight} kg` : '', '50%')}</span>
            </div>
            <div class="field col-3">
              <span class="field-label">Data de Admissão</span>
              <span class="field-value">${getVal(patient.dataAdmissao, '60%')}</span>
            </div>
            <div class="field col-3">
              <span class="field-label">Duração dos Sintomas</span>
              <span class="field-value">${getVal(patient.duracaoSintomas, '60%')}</span>
            </div>
          </div>

          <div class="section-title">II. Histórico do Ictus & Trombólise</div>
          <div class="grid">
            <div class="field col-3">
              <span class="field-label">Data do Ictus</span>
              <span class="field-value">${getVal(patient.dataIctus, '60%')}</span>
            </div>
            <div class="field col-3">
              <span class="field-label">Hora do Ictus</span>
              <span class="field-value">${getVal(patient.horaIctus, '60%')}</span>
            </div>
            <div class="field col-3">
              <span class="field-label">Trombólise</span>
              <span class="field-value">${getRadioSimNao(patient.trombolise)}</span>
            </div>
            <div class="field col-3">
              <span class="field-label">Data/Hora Trombólise</span>
              <span class="field-value">${getVal(patient.tromboliseDataHora, '80%')}</span>
            </div>
          </div>

          <div class="grid">
            <div class="field col-3">
              <span class="field-label">NIHSS na Admissão</span>
              <span class="field-value">${getVal(patient.nihssAdmissao, '50%')}</span>
            </div>
            <div class="field col-3">
              <span class="field-label">Rankin Prévio / Adm</span>
              <span class="field-value">${getVal(patient.rankinAdm, '50%')}</span>
            </div>
            <div class="field col-3">
              <span class="field-label">Rankin na Alta</span>
              <span class="field-value">${getVal(patient.rankinAlta, '50%')}</span>
            </div>
            <div class="field col-3">
              <span class="field-label">PA de Admissão</span>
              <span class="field-value">${patient.paSistolica || patient.paDiastolica ? getVal(`${patient.paSistolica || ''} x ${patient.paDiastolica || ''} mmHg`) : getVal('', '60%')}</span>
            </div>
          </div>

          <div class="grid">
            <div class="field col-6">
              <span class="field-label">Sintomas na Admissão</span>
              <span class="field-value">${getVal(patient.sintomasAdmissao, '90%')}</span>
            </div>
            <div class="field col-6">
              <span class="field-label">Comorbidades / Antecedentes</span>
              <span class="field-value">${getVal(patient.comorbidades, '90%')}</span>
            </div>
          </div>

          ${(() => {
            const cranialTcs = getFirstAndLastCranialTcs(patient);
            return `
              <div class="section-title">III. Exames de Imagem de Entrada & Controle (Apenas Crânio)</div>
              <div class="grid">
                <div class="field col-3">
                  <span class="field-label">${cranialTcs.firstLabel} (Data)</span>
                  <span class="field-value">${getVal(cranialTcs.firstData, '70%')}</span>
                </div>
                <div class="field col-9">
                  <span class="field-label">${cranialTcs.firstLabel} (Laudo)</span>
                  <span class="field-value">${getVal(cranialTcs.firstLaudo, '95%')}</span>
                </div>
              </div>
              <div class="grid">
                <div class="field col-12">
                  <span class="field-label">AngioTC / Doppler Transcraniano (Descrição)</span>
                  <span class="field-value">${getVal(patient.angiotomoDescricao, '95%')}</span>
                </div>
              </div>
              <div class="grid" style="margin-top: 4px;">
                <div class="field col-3">
                  <span class="field-label">${cranialTcs.lastLabel} (Data)</span>
                  <span class="field-value">${getVal(cranialTcs.lastData, '70%')}</span>
                </div>
                <div class="field col-9">
                  <span class="field-label">${cranialTcs.lastLabel} (Laudo)</span>
                  <span class="field-value">${getVal(cranialTcs.lastLaudo, '95%')}</span>
                </div>
              </div>
            `;
          })()}
          <div class="grid">
            <div class="field col-3">
              <span class="field-label">ECG Entrada (Data)</span>
              <span class="field-value">${getVal(patient.ecgData, '70%')}</span>
            </div>
            <div class="field col-9">
              <span class="field-label">ECG Entrada (Laudo)</span>
              <span class="field-value">${getVal(patient.ecgLaudo, '95%')}</span>
            </div>
          </div>
        </div>

        <!-- CHECK-LIST DIÁRIO (6 COLUNAS) -->
        <div class="section-title">IV. Check-list Diário da Unidade de AVC (Ciclo de 6 Dias)</div>
        <table class="checklist-table">
          <thead>
            ${tableHeadersHtml}
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <!-- ASSINATURA -->
        <div class="footer-signature" style="margin-top: 35px; display: flex; justify-content: center; align-items: flex-end;">
          <div class="signature-block" style="text-align: center; width: 60%;">
            <div class="signature-line" style="border-bottom: 1px solid #0f172a; margin-bottom: 4px; height: 30px;">
              <div style="text-align: center; font-weight: bold; font-size: 11px; padding-top: 10px;">
                ${[...dailyLists].reverse().find(l => l.checklistMedicoPlantonista)?.checklistMedicoPlantonista || patient.checklistMedicoPlantonista || ''}
              </div>
            </div>
            <span class="signature-label" style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #475569;">Dr(a). Médico(a) Plantonista / CRM</span>
          </div>
        </div>
      </div>
      `;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Todos os Checklists Diários - UAVC ${targetDateStr}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 15px;
      background-color: #f8fafc;
      font-size: 11px;
      line-height: 1.25;
      -webkit-text-size-adjust: 100%;
    }

    .sections-i-ii-iii {
      text-transform: uppercase !important;
    }
    .sections-i-ii-iii * {
      text-transform: uppercase !important;
    }
    
    .page-container {
      max-width: 900px;
      width: 100%;
      box-sizing: border-box;
      margin: 0 auto 30px auto;
      border: 1px solid #e2e8f0;
      padding: 15px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }
    
    @page {
      size: A4 portrait;
      margin: 6mm 5mm;
    }

    @media print {
      body {
        padding: 0;
        margin: 0;
        background-color: #fff;
        color: #000;
        width: 100%;
      }
      .page-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
        margin-bottom: 0 !important;
        page-break-after: always;
        break-after: page;
      }
      .page-container:last-child {
        page-break-after: avoid;
        break-after: avoid;
      }
      .no-print {
        display: none !important;
      }
    }

    .no-print-bar {
      background-color: #0f172a;
      color: #fff;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
    }

    .btn-print {
      background-color: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 700;
      cursor: pointer;
      text-transform: uppercase;
      font-size: 10px;
      transition: background-color 0.2s;
    }

    .btn-print:hover {
      background-color: #1d4ed8;
    }

    .header {
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }

    .header h1 {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 3px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .header p {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0 0 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-block;
      background-color: #fef08a;
      padding: 2px 10px;
      border-radius: 4px;
      border: 1px solid #fde047;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .section-title {
      background-color: #f1f5f9;
      border-left: 3px solid #1e40af;
      padding: 3px 6px;
      font-weight: 800;
      font-size: 11.5px;
      text-transform: uppercase;
      color: #1e3a8a;
      margin-top: 8px;
      margin-bottom: 4px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 4px;
      margin-bottom: 4px;
    }

    .col-12 { grid-column: span 12; }
    .col-6  { grid-column: span 6; }
    .col-5  { grid-column: span 5; }
    .col-4  { grid-column: span 4; }
    .col-3  { grid-column: span 3; }
    .col-2  { grid-column: span 2; }
    .col-1  { grid-column: span 1; }
    .col-8  { grid-column: span 8; }
    .col-9  { grid-column: span 9; }
    .col-10 { grid-column: span 10; }

    .field {
      background-color: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 2px 5px;
      display: flex;
      flex-direction: column;
      min-height: 20px;
      justify-content: center;
    }

    .field-label {
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 1px;
      line-height: 1.1;
    }

    .field-value {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.15;
    }

    .handwritten-placeholder {
      display: inline-block;
      border-bottom: 1px solid #64748b;
      height: 12px;
      margin-top: 1px;
      vertical-align: bottom;
    }

    .handwritten-line {
      border-bottom: 1px dashed #cbd5e1;
      height: 20px;
      margin-top: 2px;
    }

    .filled-value-multiline {
      font-size: 11px;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.2;
      padding-top: 2px;
    }

    /* Table styling */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      margin-bottom: 10px;
    }

    th {
      background-color: #f8fafc;
      color: #334155;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9.5px;
      padding: 3px 5px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }

    td {
      padding: 3px 5px;
      border: 1px solid #cbd5e1;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.15;
    }

    .footer-signature {
      margin-top: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .signature-block {
      text-align: center;
      width: 45%;
    }

    .signature-line {
      border-bottom: 1px solid #0f172a;
      margin-bottom: 4px;
      height: 25px;
    }

    .signature-label {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }

    /* 6-Column Checklist Table */
    .checklist-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 15px;
      table-layout: fixed;
    }
    
    .checklist-table th, .checklist-table td {
      border: 1px solid #94a3b8;
      padding: 2.5px 3px;
      font-size: 8.5px;
      vertical-align: middle;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .checklist-header-param {
      background-color: #f1f5f9;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      font-size: 8px !important;
    }

    .checklist-header-day {
      background-color: #e2e8f0;
      color: #0f172a;
      text-align: center;
    }

    .checklist-row:nth-child(even) {
      background-color: #f8fafc;
    }

    .row-blue {
      background-color: #eff6ff !important;
    }
    .row-blue .checklist-param-label {
      background-color: #dbeafe !important;
      color: #1e40af !important;
    }

    .row-purple {
      background-color: #f5f3ff !important;
    }
    .row-purple .checklist-param-label {
      background-color: #ede9fe !important;
      color: #6d28d9 !important;
    }

    .row-yellow {
      background-color: #fffbeb !important;
    }
    .row-yellow .checklist-param-label {
      background-color: #fef9c3 !important;
      color: #a16207 !important;
    }

    .row-green {
      background-color: #f0fdf4 !important;
    }
    .row-green .checklist-param-label {
      background-color: #dcfce7 !important;
      color: #15803d !important;
    }

    .row-orange {
      background-color: #fff7ed !important;
    }
    .row-orange .checklist-param-label {
      background-color: #ffedd5 !important;
      color: #c2410c !important;
    }

    .row-blue, .row-purple, .row-yellow, .row-green, .row-orange {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .row-blue .checklist-param-label,
    .row-purple .checklist-param-label,
    .row-yellow .checklist-param-label,
    .row-green .checklist-param-label,
    .row-orange .checklist-param-label {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .checklist-param-label {
      background-color: #f8fafc;
      color: #334155;
      font-weight: 800 !important;
      text-transform: uppercase !important;
      text-align: left;
    }

    .checklist-cell {
      text-align: center;
    }

    .cell-empty {
      color: #94a3b8;
      font-weight: normal;
    }

    .cell-filled {
      color: #0f172a;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="no-print no-print-bar">
    <span>Visualização de Impressão - Todos os Checklists Diários UAVC ${targetDateStr}</span>
    <button class="btn-print" onclick="window.print()">Imprimir PDF</button>
  </div>

  ${pagesHtml}
</body>
</html>
    `;

    return htmlContent;
  };

  const printAllChecklists = () => {
    const htmlContent = getAllChecklistsHtml();
    if (!htmlContent) {
      alert('Nenhum leito ocupado para imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para este site para que os checklists possam ser impressos.');
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const getVitalsSummaryHtml = () => {
    const occupied = patients.filter(p => p.name && p.name.trim() !== '');
    if (occupied.length === 0) return null;

    const now = new Date();
    const todayStrShort = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear()).slice(-2)}`;
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yDay = String(yesterday.getDate()).padStart(2, '0');
    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yYearFull = String(yesterday.getFullYear());
    const yYearShort = yYearFull.slice(-2);

    const yesterdayStrShort = `${yDay}/${yMonth}/${yYearShort}`;
    const yesterdayStrFull = `${yDay}/${yMonth}/${yYearFull}`;

    const tablesHtml = occupied.map(patient => {
      const dailyLists = ensureDailyChecklists(patient);

      // 1) Search target checklist for yesterday
      let targetChecklist = dailyLists.find(c => {
        if (!c || !c.checklistData) return false;
        const dStr = c.checklistData.trim();
        return dStr === yesterdayStrShort || dStr === yesterdayStrFull;
      });

      // 2) If not found by exact date string, search for filled checklists
      if (!targetChecklist) {
        const filledLists = dailyLists.filter(c => c && c.checklistData && c.checklistData.trim() !== '');
        if (filledLists.length > 0) {
          const lastFilled = filledLists[filledLists.length - 1];
          if (lastFilled.checklistData?.trim() === todayStrShort && filledLists.length > 1) {
            targetChecklist = filledLists[filledLists.length - 2];
          } else {
            targetChecklist = lastFilled;
          }
        } else {
          targetChecklist = dailyLists[0] || {};
        }
      }

      const targetDateLabel = targetChecklist.checklistData?.trim() || yesterdayStrShort;

      // Extract GLICEMIA ↑ (HGT Maior)
      let hgtMaiorStr = '—';
      if (targetChecklist.checklistHgtMaior && targetChecklist.checklistHgtMaior.trim()) {
        const raw = targetChecklist.checklistHgtMaior.trim();
        hgtMaiorStr = raw.toUpperCase().includes('MG/DL') ? raw.toUpperCase() : `${raw} MG/DL`;
      }

      // Extract GLICEMIA ↓ (HGT Menor)
      let hgtMenorStr = '—';
      if (targetChecklist.checklistHgtMenor && targetChecklist.checklistHgtMenor.trim()) {
        const raw = targetChecklist.checklistHgtMenor.trim();
        hgtMenorStr = raw.toUpperCase().includes('MG/DL') ? raw.toUpperCase() : `${raw} MG/DL`;
      }

      // Extract EVACUAÇÃO
      let evacuacaoFormatted = '—';
      if (targetChecklist.checklistEvacuacoes) {
        const val = targetChecklist.checklistEvacuacoes.trim();
        const asp = targetChecklist.checklistEvacuacoesAspecto?.trim();
        if (val) {
          evacuacaoFormatted = asp ? `${val.toUpperCase()} (${asp})` : val.toUpperCase();
        }
      }

      // Extract PRESSÃO ARTERIAL (PAS and PAD)
      let pasVal = targetChecklist.checklistPas?.trim() || '';
      let padVal = targetChecklist.checklistPad?.trim() || '';
      if (!pasVal && !padVal && targetChecklist.checklistPasPad) {
        const parts = targetChecklist.checklistPasPad.split(/\s*x\s*|\s*\/\s*/i);
        if (parts[0]) pasVal = parts[0].trim();
        if (parts[1]) padVal = parts[1].trim();
      }
      const pasFormatted = pasVal ? (pasVal.toUpperCase().includes('MMHG') ? pasVal.toUpperCase() : `${pasVal} MMHG`) : '—';
      const padFormatted = padVal ? (padVal.toUpperCase().includes('MMHG') ? padVal.toUpperCase() : `${padVal} MMHG`) : '—';

      // Extract TEMPERATURA
      let tempFormatted = '—';
      if (targetChecklist.checklistFebreTemp && targetChecklist.checklistFebreTemp.trim()) {
        const raw = targetChecklist.checklistFebreTemp.trim();
        if (raw.includes('°C') || raw.includes('°c')) {
          tempFormatted = raw;
        } else {
          tempFormatted = raw.startsWith('>') || raw.startsWith('<') ? `${raw} °C` : `>${raw} °C`;
        }
      }

      // Extract BH (Balanço Hídrico)
      let bhFormatted = '—';
      if (targetChecklist.checklistBalançoHidrico && targetChecklist.checklistBalançoHidrico.trim()) {
        let raw = targetChecklist.checklistBalançoHidrico.trim();
        if (!raw.startsWith('+') && !raw.startsWith('-') && !raw.startsWith('(+)') && !raw.startsWith('(-)')) {
          raw = `(+) ${raw}`;
        } else if (raw.startsWith('+')) {
          raw = `(+) ${raw.slice(1).trim()}`;
        } else if (raw.startsWith('-')) {
          raw = `(-) ${raw.slice(1).trim()}`;
        }
        if (!raw.toUpperCase().includes('ML')) {
          raw = `${raw} ML/24H`;
        }
        bhFormatted = raw;
      }

      // Extract DIURESE
      let diureseFormatted = '—';
      if (targetChecklist.checklistDiurese && targetChecklist.checklistDiurese.trim()) {
        const raw = targetChecklist.checklistDiurese.trim();
        diureseFormatted = raw.toUpperCase().includes('ML') ? raw.toUpperCase() : `${raw} ML/24H`;
      }

      return `
      <div class="patient-summary-container">
        <div class="patient-header">
          <div class="patient-title">LEITO ${patient.id} - ${patient.name ? patient.name.toUpperCase() : 'NOME NÃO INFORMADO'}</div>
          <div class="patient-details">
            ${patient.registro ? `REG: ${patient.registro} &nbsp;|&nbsp; ` : ''}
            ${patient.age ? `IDADE: ${patient.age} ANOS &nbsp;|&nbsp; ` : ''}
            ${patient.gender ? `SEXO: ${patient.gender.toUpperCase()} &nbsp;|&nbsp; ` : ''}
            DATA DA AVALIAÇÃO: <strong>${targetDateLabel}</strong>
          </div>
        </div>

        <table class="summary-table" style="width: 100%; border-collapse: collapse; border: 1px solid #000000; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt;">
          <tbody>
            <tr class="summary-row">
              <td class="col-label" style="width: 42%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 700; text-transform: uppercase; color: #0f172a; background-color: #ffffff; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">GLICEMIA ↑</td>
              <td class="col-value" style="width: 58%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 400; color: #0f172a; background-color: #ffffff; border-bottom: 1px solid #000000; vertical-align: middle; user-select: text; -webkit-user-select: text;">${hgtMaiorStr}</td>
            </tr>
            <tr class="summary-row">
              <td class="col-label" style="width: 42%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 700; text-transform: uppercase; color: #0f172a; background-color: #ffffff; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">GLICEMIA ↓</td>
              <td class="col-value" style="width: 58%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 400; color: #0f172a; background-color: #ffffff; border-bottom: 1px solid #000000; vertical-align: middle; user-select: text; -webkit-user-select: text;">${hgtMenorStr}</td>
            </tr>
            <tr class="summary-row">
              <td class="col-label" style="width: 42%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 700; text-transform: uppercase; color: #0f172a; background-color: #ffffff; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">EVACUAÇÃO</td>
              <td class="col-value" style="width: 58%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 400; color: #0f172a; background-color: #ffffff; border-bottom: 1px solid #000000; vertical-align: middle; user-select: text; -webkit-user-select: text;">${evacuacaoFormatted}</td>
            </tr>
            <tr class="summary-row">
              <td class="col-label" style="width: 42%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 700; text-transform: uppercase; color: #0f172a; background-color: #ffffff; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">PRESSÃO ARTERIAL</td>
              <td class="col-value" style="width: 58%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 400; color: #0f172a; background-color: #ffffff; border-bottom: 1px solid #000000; vertical-align: middle; user-select: text; -webkit-user-select: text;">
                <div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 400;">PAS: ${pasFormatted}</div>
                <div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 400; margin-top: 3px;">PAD: ${padFormatted}</div>
              </td>
            </tr>
            <tr class="summary-row">
              <td class="col-label" style="width: 42%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 700; text-transform: uppercase; color: #0f172a; background-color: #ffffff; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">TEMPERATURA</td>
              <td class="col-value" style="width: 58%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 400; color: #0f172a; background-color: #ffffff; border-bottom: 1px solid #000000; vertical-align: middle; user-select: text; -webkit-user-select: text;">${tempFormatted}</td>
            </tr>
            <tr class="summary-row">
              <td class="col-label" style="width: 42%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 700; text-transform: uppercase; color: #0f172a; background-color: #ffffff; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">BH</td>
              <td class="col-value" style="width: 58%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 400; color: #0f172a; background-color: #ffffff; border-bottom: 1px solid #000000; vertical-align: middle; user-select: text; -webkit-user-select: text;">${bhFormatted}</td>
            </tr>
            <tr class="summary-row">
              <td class="col-label" style="width: 42%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 700; text-transform: uppercase; color: #0f172a; background-color: #ffffff; border-right: 1px solid #000000; border-bottom: none; vertical-align: middle; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">DIURESE</td>
              <td class="col-value" style="width: 58%; padding: 8px 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; font-weight: 400; color: #0f172a; background-color: #ffffff; border-bottom: none; vertical-align: middle; user-select: text; -webkit-user-select: text;">${diureseFormatted}</td>
            </tr>
          </tbody>
        </table>
      </div>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Resumo de Sinais Vitais - Unidade de AVC</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Calibri, "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 10pt;
      line-height: 1.3;
      padding: 20px;
    }

    .patient-summary-container {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .patient-header {
      background-color: #f8fafc;
      border: 1px solid #000000;
      border-bottom: none;
      padding: 8px 12px;
    }

    .patient-title {
      font-size: 11pt;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
    }

    .patient-details {
      font-size: 10pt;
      color: #334155;
      font-weight: 700;
      margin-top: 2px;
      text-transform: uppercase;
    }

    table.summary-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000000;
      font-family: Calibri, "Segoe UI", Arial, sans-serif;
      font-size: 10pt;
    }

    tr.summary-row {
      border-bottom: 1px solid #000000;
    }

    tr.summary-row:last-child {
      border-bottom: none;
    }

    td.col-label {
      width: 42%;
      padding: 8px 12px;
      font-family: Calibri, "Segoe UI", Arial, sans-serif;
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #0f172a;
      background-color: #ffffff;
      letter-spacing: -0.01em;
      border-right: 1px solid #000000;
      border-bottom: 1px solid #000000;
      vertical-align: middle;
      user-select: none !important;
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
    }

    td.col-value {
      width: 58%;
      padding: 8px 12px;
      font-family: Calibri, "Segoe UI", Arial, sans-serif;
      font-size: 10pt;
      color: #0f172a;
      font-weight: 400;
      background-color: #ffffff;
      border-bottom: 1px solid #000000;
      vertical-align: middle;
      user-select: text;
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
    }

    tr.summary-row:last-child td {
      border-bottom: none;
    }

    .col-value * {
      font-family: Calibri, "Segoe UI", Arial, sans-serif !important;
      font-size: 10pt !important;
      font-weight: 400 !important;
    }

    @media print {
      body {
        padding: 0;
      }
      .patient-summary-container {
        page-break-inside: avoid;
        margin-bottom: 20px;
      }
    }
  </style>
</head>
<body>
  ${tablesHtml}
</body>
</html>
    `;
  };

  const printVitalsSummary = () => {
    const htmlContent = getVitalsSummaryHtml();
    if (!htmlContent) {
      alert('Nenhum leito ocupado para gerar o resumo de sinais vitais.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para este site para que o resumo possa ser exibido.');
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleOpenWhatsAppSend = () => {
    const occupied = patients.filter(p => p.name && p.name.trim() !== '');
    if (occupied.length === 0) {
      alert('Nenhum leito ocupado para enviar checklists.');
      return;
    }
    setIsWhatsAppSendOpen(true);
  };

  const printGasometria = (p: Patient) => {

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para este site para que o formulário possa ser impresso.');
      return;
    }

    const escapeHtml = (str: string) => {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const nome = p.name || '';
    const registro = p.registro || '';
    const dataNascimento = p.dataNascimento || '';
    const idade = p.age || '';
    const leitoStr = `LEITO ${p.id}`;

    let dataNascIdade = '';
    if (dataNascimento && idade) {
      dataNascIdade = `${dataNascimento} / ${idade} ANOS`;
    } else if (dataNascimento) {
      dataNascIdade = dataNascimento;
    } else if (idade) {
      dataNascIdade = `${idade} ANOS`;
    }

    const setorLeito = `UNIDADE DE EMERGÊNCIA - UTI AVC - ${leitoStr}`;
    const unidadeExecutante = 'UE';
    const logoUrl = window.location.origin + "/logopng.png";

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Solicitação de Gasometria — Leito ${p.id}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 1.5cm 1.5cm 1.5cm 1.5cm;
    }
    body {
      font-family: Arial, sans-serif;
      color: #000;
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print-bar {
      background-color: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: system-ui, sans-serif;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .no-print-bar span {
      font-weight: bold;
      color: #334155;
      font-size: 14px;
    }
    .btn-print {
      background-color: #005fa4;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 13px;
      transition: background-color 0.15s ease;
    }
    .btn-print:hover {
      background-color: #004d85;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        background-color: #fff !important;
        padding: 0;
      }
      .sheet {
        box-shadow: none !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: auto !important;
      }
    }
    .sheet {
      background: #fff;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      max-width: 21cm;
      min-height: 29.7cm;
      margin: 30px auto;
      padding: 2.5cm 2cm 2cm 2cm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .header-logo-container {
      text-align: center;
      margin-bottom: 12px;
    }
    .gov-title {
      text-align: center;
      font-family: Arial, sans-serif;
      font-size: 11px;
      font-weight: bold;
      color: #005fa4;
      line-height: 1.5;
      text-transform: uppercase;
      margin-bottom: 16px;
      letter-spacing: 0.3px;
    }
    .anexo-subtitle {
      text-align: left;
      font-family: Arial, sans-serif;
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #000;
    }
    .main-title {
      text-align: center;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
      text-transform: uppercase;
      color: #000;
    }
    .gaso-options {
      text-align: center;
      font-family: Arial, sans-serif;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 25px;
      color: #000;
    }
    .section-title {
      font-family: Arial, sans-serif;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      margin-top: 20px;
      margin-bottom: 10px;
      color: #000;
      letter-spacing: 0.2px;
    }
    .patient-info-list {
      list-style-type: none;
      padding: 0;
      margin: 0 0 15px 0;
    }
    .patient-info-list li {
      display: flex;
      align-items: flex-end;
      margin-bottom: 10px;
      font-size: 11px;
    }
    .info-bullet {
      font-weight: bold;
      margin-right: 5px;
      white-space: nowrap;
      color: #000;
    }
    .info-value-line {
      flex-grow: 1;
      border-bottom: 1px solid #000;
      padding-left: 8px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      font-weight: bold;
      color: #0f172a;
      min-height: 18px;
      line-height: 1.5;
    }
    .indicacao-block {
      text-align: justify;
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.8;
      margin-top: 5px;
      margin-bottom: 20px;
      color: #000;
    }
    .checkbox-inline {
      display: inline-flex;
      align-items: center;
      margin-right: 14px;
      white-space: nowrap;
      margin-bottom: 8px;
    }
    .checkbox-box {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 1px solid #000;
      margin-right: 5px;
      flex-shrink: 0;
    }
    .checkbox-last-row {
      display: flex;
      align-items: flex-end;
      width: 100%;
      margin-top: 5px;
    }
    .line-fill {
      flex-grow: 1;
      border-bottom: 1px solid #000;
      min-height: 15px;
    }
    .footer-section {
      margin-top: auto;
      text-align: center;
      font-family: Arial, sans-serif;
      font-size: 9.5px;
      color: #000;
      padding-top: 15px;
    }
    .footer-hr {
      border: 0;
      border-top: 1px solid #000;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="no-print no-print-bar">
    <span>Solicitação de Gasometria — Leito ${p.id}</span>
    <button class="btn-print" onclick="window.print()">Confirmar e Imprimir</button>
  </div>

  <div class="sheet">
    <div class="header-logo-container">
      <img src="https://bienal.ufal.br/2023/wp-content/themes/bienaldealagoas/image/logos/governo-de-alagoas.png" alt="Governo de Alagoas" style="max-height: 70px; width: auto; display: block; margin: 0 auto;" />
    </div>

    <div class="gov-title">
      ESTADO DE ALAGOAS SECRETARIA DE ESTADO DA SAÚDE<br>
      SECRETARIA EXECUTIVA DE AÇÕES DE SAÚDE SUPERINTENDÊNCIA DE<br>
      ASSISTÊNCIA PRÉ-HOSPITALAR E HOSPITALAR
    </div>

    <div class="anexo-subtitle">
      (Anexo 2) – Formulário de solicitação de gasometrias
    </div>

    <div class="main-title">
      SOLICITAÇÃO DE GASOMETRIA
    </div>

    <div class="gaso-options">
      <span>( &nbsp; ) Arterial</span>
      <span style="margin-left: 50px;">( &nbsp; ) Venosa</span>
    </div>

    <div class="section-title">1. IDENTIFICAÇÃO DO PACIENTE</div>
    <ul class="patient-info-list">
      <li>
        <span class="info-bullet">• Nome:</span>
        <span class="info-value-line">${escapeHtml(nome)}</span>
      </li>
      <li>
        <span class="info-bullet">• Data de nascimento / Idade:</span>
        <span class="info-value-line">${escapeHtml(dataNascIdade)}</span>
      </li>
      <li>
        <span class="info-bullet">• Prontuário:</span>
        <span class="info-value-line">${escapeHtml(registro)}</span>
      </li>
      <li>
        <span class="info-bullet">• Unidade Solicitante/ Setor / Leito:</span>
        <span class="info-value-line">${escapeHtml(setorLeito)}</span>
      </li>
      <li>
        <span class="info-bullet">• Unidade Executante:</span>
        <span class="info-value-line">${escapeHtml(unidadeExecutante)}</span>
      </li>
    </ul>

    <div class="section-title">2. INDICAÇÃO <em>(Assinalar uma ou mais)</em></div>
    <div class="indicacao-block">
      <span class="checkbox-inline"><span class="checkbox-box"></span>Dispneia aguda / insuficiência respiratória</span>
      <span class="checkbox-inline"><span class="checkbox-box"></span>Hipoxemia ou suspeita de retenção de CO₂</span>
      <span class="checkbox-inline"><span class="checkbox-box"></span>Avaliação e monitorização de oxigenoterapia ou ventilação</span>
      <span class="checkbox-inline"><span class="checkbox-box"></span>Suspeita de acidose ou alcalose metabólica</span>
      <span class="checkbox-inline"><span class="checkbox-box"></span>Suspeita ou monitorização de sepse / choque</span>
      <span class="checkbox-inline"><span class="checkbox-box"></span>Distúrbios hidroeletrolíticos graves</span>
      <span class="checkbox-inline"><span class="checkbox-box"></span>Monitorização terapêutica (pós-intervenção)</span>
      <div class="checkbox-last-row">
        <span class="checkbox-box" style="margin-bottom: 2px;"></span>
        <span style="white-space: nowrap; margin-right: 5px;">Outro motivo clínico relevante:</span>
        <span class="line-fill"></span>
      </div>
    </div>

    <div style="display: flex; align-items: flex-end; width: 100%; margin-top: 25px; margin-bottom: 20px;">
      <span style="font-weight: bold; font-size: 11px; text-transform: uppercase; white-space: nowrap; margin-right: 5px;">3. HIPÓTESE DIAGNÓSTICA:</span>
      <span class="line-fill"></span>
    </div>

    <div class="section-title">4. PROFISSIONAL SOLICITANTE:</div>
    <ul class="patient-info-list">
      <li style="margin-bottom: 12px; display: flex; align-items: flex-end; width: 60%;">
        <span class="info-bullet">• Nome e registro:</span>
        <span class="info-value-line" style="min-height: 18px;"></span>
      </li>
      <li style="display: flex; align-items: flex-end; width: 60%;">
        <span class="info-bullet">• Data / Hora:</span>
        <span style="font-family: Arial, sans-serif; font-size: 11px; padding-left: 8px; letter-spacing: 1px; font-weight: normal; border-bottom: 1px solid #000; flex-grow: 1; min-height: 18px; padding-bottom: 1px; color: #000;">
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </span>
      </li>
    </ul>

    <div class="footer-section">
      <hr class="footer-hr">
      <div>Avenida da Paz, 978, Jaraguá, Maceió/AL – CEP: 57025-059. Fone: (82) 3315-1102 www.saude.al.gov.br</div>
    </div>
  </div>
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleSaveAndPrintExam = () => {
    if (!examModalPatient) return;
    
    const updatedPat: Patient = {
      ...examModalPatient,
      name: examFields.name,
      registro: examFields.registro,
      dataNascimento: examFields.dataNascimento,
      age: examFields.age,
      nomeMae: examFields.nomeMae,
    };
    updatePatient(updatedPat);
    
    printExamSheet(examModalPatient.id);
  };

  const renderExamSheetDiv = (bedId: number, fields: typeof examFields) => {
    const escapeHtml = (str: string) => {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const getCheckClass = (isChecked: boolean) => isChecked ? 'checked' : '';
    const getCheckContent = (isChecked: boolean) => isChecked ? '✓' : '';

    const examsList = [
      'HEMOGRAMA COMPLETO',
      'COAGULOGRAMA',
      'SÓDIO/POTÁSSIO/CLORO/CÁLCIO IÔNICO',
      'GLICOSE',
      'URÉIA/CREATININA',
      'GGT/FOSFATASE ALCALINA',
      'BIL. TOTAIS E FRAÇÕES',
      'TGO/TGP',
      'SUMÁRIO DE URINA',
      'PCR',
      'TAP/TTPA',
      'CK NAC/CK MB',
      'TROPONINA',
      'AMILASE',
      'BETA HCG',
      'HBsAg - teste rápido',
      'VDRL'
    ];

    const firstCol = examsList.slice(0, 11);
    const secondCol = examsList.slice(11);

    let examsGridHtml = '<table class="exams-grid"><tr><td style="width: 50%; vertical-align: top;">';
    firstCol.forEach(exam => {
      const isChecked = fields.exams[exam];
      examsGridHtml += `
        <div style="margin-bottom: 6px;">
          <span class="exam-circle ${getCheckClass(isChecked)}">${getCheckContent(isChecked)}</span>
          <span class="exam-text">${exam}</span>
        </div>
      `;
    });
    examsGridHtml += '</td><td style="width: 50%; vertical-align: top;">';
    secondCol.forEach(exam => {
      const isChecked = fields.exams[exam];
      examsGridHtml += `
        <div style="margin-bottom: 6px;">
          <span class="exam-circle ${getCheckClass(isChecked)}">${getCheckContent(isChecked)}</span>
          <span class="exam-text">${exam}</span>
        </div>
      `;
    });
    examsGridHtml += '</td></tr></table>';

    return `
  <div class="sheet">
    <!-- HEADER TABLE -->
    <table class="header-table">
      <tr>
        <td class="header-logo-left">
          <div class="logo-he-container">
            <div class="logo-he-cross">HE</div>
            <div class="logo-he-text">
              Hospital de Emergência<br>
              Dr. Daniel Houly
            </div>
          </div>
        </td>
        <td class="header-title-cell">
          <h1 class="title-main">Solicitação de Exames Laboratoriais</h1>
        </td>
        <td class="header-logo-right">
          <div class="logo-alagoas-text">ALAGOAS</div>
          <div class="logo-alagoas-sub">Trabalhar mais para fazer mais</div>
        </td>
      </tr>
    </table>

    <!-- PATIENT IDENTIFICATION SECTION -->
    <table class="id-section">
      <tr>
        <td style="width: 5%;">
          <span class="field-label">Nome</span>
        </td>
        <td style="width: 65%;" class="field-line">
          ${escapeHtml(fields.name)}
        </td>
        <td style="width: 15%; text-align: right; padding-right: 8px;">
          <span class="field-label">Nº de Registro</span>
        </td>
        <td style="width: 15%;">
          <div class="field-box">${escapeHtml(fields.registro)}</div>
        </td>
      </tr>
    </table>

    <table class="id-section" style="margin-top: -10px;">
      <tr>
        <td style="width: 10%;">
          <span class="field-label">Data de Nasc.</span>
        </td>
        <td style="width: 15%;" class="field-line">
          ${escapeHtml(fields.dataNascimento)}
        </td>
        <td style="width: 5%; text-align: right; padding-right: 4px;">
          <span class="field-label">Idade</span>
        </td>
        <td style="width: 8%;" class="field-line">
          ${escapeHtml(fields.age ? `${escapeHtml(fields.age)}` : '')}
        </td>
        <td style="width: 10%; text-align: right; padding-right: 4px;">
          <span class="field-label">Solicitado em</span>
        </td>
        <td style="width: 15%;" class="field-line">
          ${escapeHtml(fields.solicitadoEm)}
        </td>
        <td style="width: 3%; text-align: right; padding-right: 4px;">
          <span class="field-label">às</span>
        </td>
        <td style="width: 10%;" class="field-line">
          ${escapeHtml(fields.solicitadoAs)} h
        </td>
        <td style="width: 5%; text-align: right; padding-right: 4px;">
          <span class="field-label">Leito</span>
        </td>
        <td style="width: 15%;">
          <div class="field-box">LEITO ${bedId}</div>
        </td>
      </tr>
    </table>

    <table class="id-section" style="margin-top: -10px;">
      <tr>
        <td style="width: 11%;">
          <span class="field-label">Nome da Mãe</span>
        </td>
        <td style="width: 64%;" class="field-line">
          ${escapeHtml(fields.nomeMae)}
        </td>
        <td style="width: 5%; text-align: right; padding-right: 4px;">
          <span class="field-label">Enf.</span>
        </td>
        <td style="width: 20%;">
          <div class="field-box">UTI AVC</div>
        </td>
      </tr>
    </table>

    <!-- EXAMS GRID & OUTROS PANEL -->
    <table class="exams-layout">
      <tr>
        <td class="exams-left-panel">
          ${examsGridHtml}
        </td>
        <td class="exams-right-panel">
          <div class="box-container">
            <div class="box-title">Outros:</div>
            <div class="box-content">${escapeHtml(fields.outros)}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- INDICATION & DOCTOR SIGNATURE -->
    <table class="bottom-layout">
      <tr>
        <td class="bottom-left-panel">
          <div class="indication-box">
            <div class="box-title">Indicação:</div>
            <div class="box-content">${escapeHtml(fields.indicacao)}</div>
          </div>
        </td>
        <td class="bottom-right-panel">
          <div class="doctor-box">
            <div class="box-title" style="margin-bottom: 0;">Médico (a) Solicitante:</div>
            <div class="signature-line">
              <div style="text-align: center; font-weight: bold; font-size: 10px; margin-top: -12px;">
                ${escapeHtml(fields.medicoSolicitante ? `Dr(a). ${fields.medicoSolicitante}` : '')}
              </div>
            </div>
            <div class="box-title" style="text-align: center; font-size: 8px; font-weight: normal; margin-top: 4px; text-transform: uppercase;">Carimbo:</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- FOOTER ADDRESS -->
    <div class="footer-address">
      Rod. AL 220, km 05, s/n - Sen. Arnon de Melo - CEP: 57315-745 Arapiraca/AL
    </div>
  </div>
    `;
  };

  const printExamSheet = (bedId: number) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para este site para que o formulário possa ser impresso.');
      return;
    }

    const sheetContent = renderExamSheetDiv(bedId, examFields);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Solicitação de Exames Laboratoriais — Leito ${bedId}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 1cm;
    }
    body {
      font-family: Arial, sans-serif;
      color: #000;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.3;
      background-color: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print-bar {
      background-color: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: system-ui, sans-serif;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .no-print-bar span {
      font-weight: bold;
      color: #334155;
    }
    .btn-print {
      background-color: #7c3aed;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-print:hover {
      background-color: #6d28d9;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        margin: 0;
        padding: 0;
        background-color: #fff !important;
      }
      .sheet {
        box-shadow: none !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
      }
    }
    
    .sheet {
      background: #fff;
      width: 100%;
      max-width: 21cm;
      margin: 20px auto;
      box-sizing: border-box;
      padding: 15px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    /* HEADER */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .header-logo-left {
      width: 25%;
      text-align: left;
      vertical-align: middle;
    }
    .header-logo-right {
      width: 25%;
      text-align: right;
      vertical-align: middle;
    }
    .header-title-cell {
      width: 50%;
      text-align: center;
      vertical-align: middle;
    }
    .title-main {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin: 0;
      text-transform: uppercase;
      border-bottom: 2px solid #000;
      padding-bottom: 4px;
    }
    
    /* LOGOS CSS */
    .logo-he-container {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .logo-he-cross {
      width: 24px;
      height: 24px;
      background-color: #15803d;
      color: white;
      font-weight: 900;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    .logo-he-text {
      font-size: 6.5px;
      font-weight: bold;
      color: #15803d;
      line-height: 1.1;
      text-transform: uppercase;
      text-align: left;
    }
    .logo-alagoas-text {
      font-size: 13px;
      font-weight: 900;
      color: #ea580c;
      margin: 0;
      line-height: 1;
      text-align: right;
      text-transform: uppercase;
    }
    .logo-alagoas-sub {
      font-size: 5px;
      color: #64748b;
      font-weight: bold;
      text-transform: uppercase;
      text-align: right;
      margin: 0;
    }

    /* ID CARD FIELDS */
    .id-section {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .id-section td {
      padding: 4px 2px;
      vertical-align: middle;
    }
    .field-label {
      font-size: 10px;
      font-weight: bold;
      white-space: nowrap;
      text-transform: uppercase;
    }
    .field-line {
      border-bottom: 1px solid #000;
      padding-left: 5px;
      font-size: 11px;
      font-weight: bold;
    }
    .field-box {
      border: 1px solid #000;
      text-align: center;
      font-size: 11px;
      font-weight: bold;
      height: 18px;
      line-height: 18px;
      padding: 0 6px;
    }

    /* EXAMS SECTION */
    .exams-layout {
      width: 100%;
      margin-bottom: 15px;
      border-collapse: collapse;
    }
    .exams-left-panel {
      width: 63%;
      vertical-align: top;
    }
    .exams-right-panel {
      width: 37%;
      vertical-align: top;
      padding-left: 15px;
    }

    .exams-grid {
      width: 100%;
      border-collapse: collapse;
    }
    .exams-grid td {
      padding: 3px 1px;
      vertical-align: middle;
      font-size: 10px;
      font-weight: bold;
    }
    .exam-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 11px;
      height: 11px;
      border: 1.5px solid #000;
      border-radius: 50%;
      vertical-align: middle;
      margin-right: 6px;
      font-size: 8px;
      font-weight: 900;
      line-height: 1;
    }
    .exam-circle.checked {
      background-color: #000 !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .exam-text {
      vertical-align: middle;
      font-size: 9.5px;
    }

    /* OUTROS BOX */
    .box-container {
      border: 1px dashed #000;
      border-radius: 4px;
      min-height: 165px;
      padding: 8px;
      box-sizing: border-box;
    }
    .box-title {
      font-size: 10px;
      font-weight: bold;
      margin-top: 0;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .box-content {
      font-size: 10px;
      white-space: pre-wrap;
      font-weight: bold;
    }

    /* INDICATION & DOCTOR SIGNATURE */
    .bottom-layout {
      width: 100%;
      border-collapse: collapse;
    }
    .bottom-left-panel {
      width: 63%;
      vertical-align: top;
    }
    .bottom-right-panel {
      width: 37%;
      vertical-align: top;
      padding-left: 15px;
    }

    .indication-box {
      border: 1px dotted #000;
      min-height: 100px;
      padding: 8px;
      box-sizing: border-box;
    }
    .doctor-box {
      border: 1px dotted #000;
      min-height: 100px;
      padding: 8px;
      box-sizing: border-box;
      position: relative;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      margin-top: 35px;
      margin-bottom: 4px;
    }

    /* FOOTER */
    .footer-address {
      text-align: center;
      font-size: 8px;
      color: #333;
      margin-top: 15px;
      border-top: 1px solid #000;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="no-print no-print-bar">
    <span>Visualização de Impressão — Solicitação de Exames Laboratoriais</span>
    <button class="btn-print" onclick="window.print()">Confirmar e Imprimir</button>
  </div>

  ${sheetContent}
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const printAllExams = () => {
    const occupied = patients.filter(p => p.name && p.name.trim() !== '').sort((a, b) => a.id - b.id);
    if (occupied.length === 0) {
      alert('Nenhum leito ocupado para imprimir exames.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para este site para que as solicitações de exames possam ser impressas.');
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const year = String(tomorrow.getFullYear()).slice(-2);
    const tomorrowStr = `${day}/${month}/${year}`;

    const defaultExams = {
      'HEMOGRAMA COMPLETO': true,
      'COAGULOGRAMA': false,
      'SÓDIO/POTÁSSIO/CLORO/CÁLCIO IÔNICO': true,
      'GLICOSE': false,
      'URÉIA/CREATININA': true,
      'GGT/FOSFATASE ALCALINA': false,
      'BIL. TOTAIS E FRAÇÕES': false,
      'TGO/TGP': false,
      'SUMÁRIO DE URINA': false,
      'PCR': true,
      'TAP/TTPA': false,
      'CK NAC/CK MB': false,
      'TROPONINA': false,
      'AMILASE': false,
      'BETA HCG': false,
      'HBsAg - teste rápido': false,
      'VDRL': false,
    };

    const sheetsHtml = occupied.map(p => {
      const fields = {
        name: p.name || '',
        registro: p.registro || '',
        dataNascimento: p.dataNascimento || '',
        age: p.age || '',
        solicitadoEm: tomorrowStr,
        solicitadoAs: '06:00',
        nomeMae: p.nomeMae || '',
        outros: '',
        indicacao: 'Avaliação clínica rotineira de Unidade de AVC.',
        medicoSolicitante: '',
        exams: defaultExams,
      };
      return renderExamSheetDiv(p.id, fields);
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Solicitação de Exames Laboratoriais — Todos os Leitos Ocupados</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 1cm;
    }
    body {
      font-family: Arial, sans-serif;
      color: #000;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.3;
      background-color: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print-bar {
      background-color: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: system-ui, sans-serif;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .no-print-bar span {
      font-weight: bold;
      color: #334155;
    }
    .btn-print {
      background-color: #7c3aed;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-print:hover {
      background-color: #6d28d9;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        margin: 0;
        padding: 0;
        background-color: #fff !important;
      }
      .sheet {
        page-break-after: always;
        page-break-inside: avoid;
        box-shadow: none !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
      }
      .sheet:last-child {
        page-break-after: auto;
      }
    }
    
    .sheet {
      background: #fff;
      width: 100%;
      max-width: 21cm;
      margin: 20px auto;
      box-sizing: border-box;
      padding: 15px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    /* HEADER */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .header-logo-left {
      width: 25%;
      text-align: left;
      vertical-align: middle;
    }
    .header-logo-right {
      width: 25%;
      text-align: right;
      vertical-align: middle;
    }
    .header-title-cell {
      width: 50%;
      text-align: center;
      vertical-align: middle;
    }
    .title-main {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin: 0;
      text-transform: uppercase;
      border-bottom: 2px solid #000;
      padding-bottom: 4px;
    }
    
    /* LOGOS CSS */
    .logo-he-container {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .logo-he-cross {
      width: 24px;
      height: 24px;
      background-color: #15803d;
      color: white;
      font-weight: 900;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    .logo-he-text {
      font-size: 6.5px;
      font-weight: bold;
      color: #15803d;
      line-height: 1.1;
      text-transform: uppercase;
      text-align: left;
    }
    .logo-alagoas-text {
      font-size: 13px;
      font-weight: 900;
      color: #ea580c;
      margin: 0;
      line-height: 1;
      text-align: right;
      text-transform: uppercase;
    }
    .logo-alagoas-sub {
      font-size: 5px;
      color: #64748b;
      font-weight: bold;
      text-transform: uppercase;
      text-align: right;
      margin: 0;
    }

    /* ID CARD FIELDS */
    .id-section {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .id-section td {
      padding: 4px 2px;
      vertical-align: middle;
    }
    .field-label {
      font-size: 10px;
      font-weight: bold;
      white-space: nowrap;
      text-transform: uppercase;
    }
    .field-line {
      border-bottom: 1px solid #000;
      padding-left: 5px;
      font-size: 11px;
      font-weight: bold;
    }
    .field-box {
      border: 1px solid #000;
      text-align: center;
      font-size: 11px;
      font-weight: bold;
      height: 18px;
      line-height: 18px;
      padding: 0 6px;
    }

    /* EXAMS SECTION */
    .exams-layout {
      width: 100%;
      margin-bottom: 15px;
      border-collapse: collapse;
    }
    .exams-left-panel {
      width: 63%;
      vertical-align: top;
    }
    .exams-right-panel {
      width: 37%;
      vertical-align: top;
      padding-left: 15px;
    }

    .exams-grid {
      width: 100%;
      border-collapse: collapse;
    }
    .exams-grid td {
      padding: 3px 1px;
      vertical-align: middle;
      font-size: 10px;
      font-weight: bold;
    }
    .exam-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 11px;
      height: 11px;
      border: 1.5px solid #000;
      border-radius: 50%;
      vertical-align: middle;
      margin-right: 6px;
      font-size: 8px;
      font-weight: 900;
      line-height: 1;
    }
    .exam-circle.checked {
      background-color: #000 !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .exam-text {
      vertical-align: middle;
      font-size: 9.5px;
    }

    /* OUTROS BOX */
    .box-container {
      border: 1px dashed #000;
      border-radius: 4px;
      min-height: 165px;
      padding: 8px;
      box-sizing: border-box;
    }
    .box-title {
      font-size: 10px;
      font-weight: bold;
      margin-top: 0;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .box-content {
      font-size: 10px;
      white-space: pre-wrap;
      font-weight: bold;
    }

    /* INDICATION & DOCTOR SIGNATURE */
    .bottom-layout {
      width: 100%;
      border-collapse: collapse;
    }
    .bottom-left-panel {
      width: 63%;
      vertical-align: top;
    }
    .bottom-right-panel {
      width: 37%;
      vertical-align: top;
      padding-left: 15px;
    }

    .indication-box {
      border: 1px dotted #000;
      min-height: 100px;
      padding: 8px;
      box-sizing: border-box;
    }
    .doctor-box {
      border: 1px dotted #000;
      min-height: 100px;
      padding: 8px;
      box-sizing: border-box;
      position: relative;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      margin-top: 35px;
      margin-bottom: 4px;
    }

    /* FOOTER */
    .footer-address {
      text-align: center;
      font-size: 8px;
      color: #333;
      margin-top: 15px;
      border-top: 1px solid #000;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="no-print no-print-bar">
    <span>Visualização de Impressão — Solicitação de Exames Laboratoriais (${occupied.length} leito${occupied.length > 1 ? 's' : ''} ocupado${occupied.length > 1 ? 's' : ''})</span>
    <button class="btn-print" onclick="window.print()">Confirmar e Imprimir Todos</button>
  </div>

  ${sheetsHtml}
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const generateSummary = () => {
    const activePatients = patients.filter(p => p.infusions.length > 0 || (p.name && p.name.trim() !== ''));
    
    if (activePatients.length === 0) {
      return "Nenhum paciente configurado com nome ou infusões.";
    }

    return activePatients.map(p => {
      const weight = parseFloat(p.weight) || 0;
      const patientDetails = [
        p.name ? `Nome: ${p.name}` : '',
        p.age ? `Idade: ${p.age} anos` : '',
        p.gender ? `Sexo: ${p.gender}` : '',
        p.weight ? `Peso: ${p.weight} kg` : ''
      ].filter(Boolean).join(' | ');

      const header = `=== LEITO ${p.id}${patientDetails ? ` (${patientDetails})` : ''} ===\n`;
      
      const infusionList = p.infusions.length > 0 
        ? p.infusions.map(inf => {
            const drug = MEDS.find(m => m.id === inf.drugId)!;
            const dilution = drug.dilutions.find(d => d.id === inf.dilutionId)!;
            const flowRate = parseFloat(inf.flowRate) || 0;
            const dose = calculateDose(flowRate, weight, drug, dilution);
            const unit = getEffectiveUnit(drug, dilution);
            const doseStr = dose === 0 ? '---' : formatDoseValue(dose);
            
            return `- ${drug.name}: ${flowRate} ml/h → ${doseStr} ${unit} (${dilution.name})`;
          }).join('\n')
        : '- Sem medicações em infusão.';

      // Assemble Clinical Records details if any exist
      const hasClinicalInfo = p.registro || p.dataAdmissao || p.nihssAdmissao || p.rankinAdm || p.rankinAlta || 
                              p.paSistolica || p.paDiastolica || p.sintomasAdmissao || p.dataIctus || p.horaIctus || 
                              p.duracaoSintomas || p.trombolise || p.tromboliseDataHora || p.comorbidades || 
                              p.tcAdmissaoData || p.tcAdmissaoLaudo || p.angiotomoDescricao || 
                              p.tcControleData || p.tcControleLaudo || (p.tcControles && p.tcControles.length > 0) || p.ecgData || p.ecgLaudo;

      let clinicalDetails = '';
      if (hasClinicalInfo) {
        clinicalDetails = `\n-- FICHA CLÍNICA --\n` + [
          p.registro ? `Registro: ${p.registro}` : '',
          p.dataAdmissao ? `Data Admissão: ${p.dataAdmissao}` : '',
          p.nihssAdmissao ? `NIHSS Admissão: ${p.nihssAdmissao}` : '',
          p.rankinAdm ? `Rankin Adm: ${p.rankinAdm}` : '',
          p.rankinAlta ? `Rankin Alta: ${p.rankinAlta}` : '',
          (p.paSistolica || p.paDiastolica) ? `PA Admissão: ${p.paSistolica || '___'}/${p.paDiastolica || '___'} mmHg` : '',
          p.sintomasAdmissao ? `Sintomas da Admissão: ${p.sintomasAdmissao}` : '',
          (p.dataIctus || p.horaIctus) ? `Ictus: ${p.dataIctus || '___'} às ${p.horaIctus || '___'}` : '',
          p.duracaoSintomas ? `Duração dos Sintomas: ${p.duracaoSintomas}` : '',
          p.trombolise ? `Trombólise: ${p.trombolise}${p.tromboliseDataHora ? ` (${p.tromboliseDataHora})` : ''}` : '',
          p.comorbidades ? `Comorbidades: ${p.comorbidades}` : '',
          (p.tcAdmissaoData || p.tcAdmissaoLaudo) ? `TC Admissão (${p.tcAdmissaoData || '__/__/__'}): ${p.tcAdmissaoLaudo || 'Sem descrição'}` : '',
          p.angiotomoDescricao ? `Angiotomo: ${p.angiotomoDescricao}` : '',
          (p.tcControles && p.tcControles.length > 0)
            ? p.tcControles.map((tc, idx) => `TC Controle #${idx + 1} (${tc.data || '__/__/__'}): ${tc.laudo || 'Sem descrição'}`).join('\n- ')
            : ((p.tcControleData || p.tcControleLaudo) ? `TC Controle (${p.tcControleData || '__/__/__'}): ${p.tcControleLaudo || 'Sem descrição'}` : ''),
          (p.ecgData || p.ecgLaudo) ? `ECG (${p.ecgData || '__/__/__'}): ${p.ecgLaudo || 'Sem descrição'}` : ''
        ].filter(Boolean).map(line => `- ${line}`).join('\n') + `\n`;
      }
      
      return `${header}${infusionList}\n${clinicalDetails}`;
    }).join('\n');
  };

  const openConsultation = (type: 'antibioticos' | 'sedativos' | 'analgesia') => {
    const title = type === 'antibioticos' ? 'ANTIBIÓTICOS' : type === 'sedativos' ? 'SEDATIVOS' : 'ANALGESIA';
    const list = type === 'antibioticos' ? ANTIBIOTICOS_LIST : type === 'sedativos' ? SEDATIVOS_LIST : ANALGESICOS_LIST;
    
    try {
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title} - UTI-AVC</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  font-family: Calibri, Candara, "Segoe UI", Optima, Arial, sans-serif;
                  background-color: #f8fafc;
                  color: #1e293b;
                  padding: 32px 16px;
                  max-width: 800px;
                  margin: 0 auto;
                }
                .header {
                  text-align: center;
                  border-bottom: 2px solid #e2e8f0;
                  padding-bottom: 20px;
                  margin-bottom: 24px;
                }
                .title {
                  font-size: 24px;
                  font-weight: 900;
                  color: #0f172a;
                  text-transform: uppercase;
                  letter-spacing: -0.025em;
                }
                .subtitle {
                  font-size: 11px;
                  font-weight: 700;
                  color: #64748b;
                  text-transform: uppercase;
                  letter-spacing: 0.1em;
                  margin-top: 6px;
                }
                .search-container {
                  margin-bottom: 20px;
                }
                .search-input {
                  width: 100%;
                  box-sizing: border-box;
                  padding: 12px 16px;
                  font-size: 14px;
                  font-weight: 600;
                  border: 1px solid #cbd5e1;
                  border-radius: 12px;
                  background-color: white;
                  color: #334155;
                  outline: none;
                  transition: all 0.2s;
                }
                .search-input:focus {
                  border-color: #3b82f6;
                  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                }
                .list {
                  display: flex;
                  flex-direction: column;
                  gap: 12px;
                }
                .item {
                  background: white;
                  padding: 16px 20px;
                  border-radius: 12px;
                  border: 1px solid #e2e8f0;
                  font-size: 14px;
                  font-weight: 700;
                  color: #334155;
                  line-height: 1.6;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  gap: 16px;
                  transition: all 0.2s;
                }
                .item:hover {
                  border-color: #cbd5e1;
                }
                .item:nth-child(even) {
                  background: #fdfdfd;
                }
                .item-text {
                  flex-grow: 1;
                }
                .copy-btn {
                  flex-shrink: 0;
                  background-color: #f1f5f9;
                  color: #475569;
                  border: 1px solid #cbd5e1;
                  padding: 8px 16px;
                  font-size: 11px;
                  font-weight: 800;
                  border-radius: 8px;
                  cursor: pointer;
                  transition: all 0.2s;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                }
                .copy-btn:hover {
                  background-color: #e2e8f0;
                  color: #1e293b;
                }
                .copy-btn.copied {
                  background-color: #ecfdf5;
                  color: #059669;
                  border-color: #a7f3d0;
                }
                .footer {
                  margin-top: 48px;
                  text-align: center;
                  font-size: 11px;
                  font-weight: 700;
                  color: #94a3b8;
                  text-transform: uppercase;
                  letter-spacing: 0.1em;
                }
                .no-results {
                  display: none;
                  text-align: center;
                  padding: 32px;
                  color: #64748b;
                  font-weight: 700;
                  font-size: 14px;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="title">${title}</div>
                <div class="subtitle">Guia de Consulta Rápida UTI-AVC</div>
              </div>
              
              <div class="search-container">
                <input type="text" id="search" class="search-input" placeholder="Buscar medicação ou diluição...">
              </div>

              <div id="no-results" class="no-results">Nenhuma medicação encontrada para a pesquisa.</div>

              <div class="list" id="list">
                ${list.map((item, idx) => `
                  <div class="item" data-text="${item.toLowerCase()}">
                    <div class="item-text">${item}</div>
                    <button class="copy-btn" onclick="copyText(this, ${idx})">Copiar</button>
                  </div>
                `).join('')}
              </div>

              <div class="footer">
                CALCULADORA UTI-AVC © 2026
              </div>

              <script>
                const items = ${JSON.stringify(list)};
                
                function copyText(button, index) {
                  let text = items[index];
                  // Robust numeral and dot removal
                  const dotIndex = text.indexOf('.');
                  if (dotIndex !== -1 && !isNaN(text.substring(0, dotIndex).trim())) {
                    text = text.substring(dotIndex + 1).trim();
                  }
                  navigator.clipboard.writeText(text).then(() => {
                    button.innerText = 'Copiado!';
                    button.classList.add('copied');
                    setTimeout(() => {
                      button.innerText = 'Copiar';
                      button.classList.remove('copied');
                    }, 1500);
                  }).catch(err => {
                    console.error('Erro ao copiar:', err);
                  });
                }

                document.getElementById('search').addEventListener('input', function(e) {
                  const query = e.target.value.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
                  const itemsList = document.querySelectorAll('.item');
                  let visibleCount = 0;

                  itemsList.forEach(item => {
                    const text = item.getAttribute('data-text').normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
                    if (text.includes(query)) {
                      item.style.display = 'flex';
                      visibleCount++;
                    } else {
                      item.style.display = 'none';
                    }
                  });

                  const noResults = document.getElementById('no-results');
                  if (visibleCount === 0) {
                    noResults.style.display = 'block';
                  } else {
                    noResults.style.display = 'none';
                  }
                });
              </script>
            </body>
          </html>
        `);
        newWindow.document.close();
      }
    } catch (e) {
      console.warn("Popup blocked or not supported:", e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between max-w-[1920px] mx-auto">
          <div className="flex items-center gap-3">
            {!logoFailed ? (
              <img 
                src="/logopng.png" 
                alt="UAVC APP Logo" 
                className="h-10 w-auto object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
                <Activity size={24} />
              </div>
            )}
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none text-slate-800 uppercase">UAVC APP</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unidade de AVC</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                 <span className="text-xs font-bold text-slate-500">{patients.filter(p => p.name && p.name.trim() !== '').length} LEITOS OCUPADOS</span>
               </div>
            </div>
            


            <button 
               onClick={() => setShowDilutionsModal(true)}
               className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-md hover:-translate-y-0.5"
            >
              <Info size={14} />
              <span>DILUIÇÕES USADAS</span>
            </button>

            <button 
               onClick={() => {
                 setRestoreTargetPatient(null);
                 setRestoreChosenBedId(null);
                 setIsArchivedModalOpen(true);
               }}
               className="relative flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm hover:-translate-y-0.5"
               title="Ver histórico de pacientes apagados e restaurar para leitos vazios (válido por 10 dias)"
            >
              <History size={14} className="text-indigo-600" />
              <span>PACIENTES ANTIGOS</span>
              {archivedPatients.filter(a => (Date.now() - a.deletedAt) <= TEN_DAYS_MS).length > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-black leading-none">
                  {archivedPatients.filter(a => (Date.now() - a.deletedAt) <= TEN_DAYS_MS).length}
                </span>
              )}
            </button>

            {/* Divider */}
            <div className="h-6 w-[1px] bg-slate-200 hidden md:block" />

            {/* Consultation buttons */}
            <button 
               onClick={() => openConsultation('antibioticos')}
               className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 hover:border-blue-300 transition-all hover:-translate-y-0.5"
            >
              <Pill size={14} />
              <span>ANTIBIÓTICOS</span>
            </button>

            <button 
               onClick={() => openConsultation('sedativos')}
               className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-purple-100 hover:border-purple-300 transition-all hover:-translate-y-0.5"
            >
              <Brain size={14} />
              <span>SEDATIVOS</span>
            </button>

            <button 
               onClick={() => openConsultation('analgesia')}
               className="flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-rose-100 hover:border-rose-300 transition-all hover:-translate-y-0.5"
            >
              <Heart size={14} />
              <span>ANALGESIA</span>
            </button>
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1920px] mx-auto">
          {patients.map(patient => (
            <ICUBed 
              key={patient.id}
              patient={patient}
              onClear={() => clearPatient(patient.id)}
              onEvolucao={openEvolucaoTab}
              onSwapBed={setSwapSourcePatient}
              onImportDocx={handleImportDocx}
              onClick={() => {
                setEditingPatientId(patient.id);
                if (!patient.isExpanded) {
                  updatePatient({ ...patient, isExpanded: true });
                }
              }}
            />
          ))}
        </div>
      </main>

      {/* Edit Drawer Modal */}
      <AnimatePresence>
        {editingPatientId !== null && (
          <div key="edit-drawer" className="fixed inset-0 z-40 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPatientId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-[450px] h-full bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              <div className="flex-1 h-full flex flex-col overflow-hidden">
                {(() => {
                  const patient = patients.find(p => p.id === editingPatientId);
                  if (!patient) return null;
                  return (
                    <PatientCard 
                      patient={patient} 
                      updatePatient={updatePatient}
                      showAllDilutions={() => setShowDilutionsModal(true)}
                      onClose={() => setEditingPatientId(null)}
                      showExamsModal={setExamModalPatient}
                      onPrintGasometria={printGasometria}
                      onEvolucao={openEvolucaoTab}
                      onSwapBed={setSwapSourcePatient}
                      onImportDocx={handleImportDocx}
                    />
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Summary Modal */}
      <AnimatePresence>
        {showSummaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSummaryModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3 text-emerald-600">
                   <Save size={24} />
                   <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Resumo de Infusões</h2>
                </div>
                <button 
                  onClick={() => setShowSummaryModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto bg-slate-50">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                   <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed select-text">
                     {generateSummary()}
                   </pre>
                </div>
              </div>

              <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center">
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Resumo gerado em {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                 <div className="flex gap-3">
                   <button 
                      onClick={() => setShowSummaryModal(false)}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors uppercase text-xs"
                   >
                     Fechar
                   </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dilutions Modal */}
      <AnimatePresence>
        {showDilutionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDilutionsModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3 text-blue-600">
                   <Droplets size={24} />
                   <h2 className="text-xl font-black text-slate-800">TABELA DE DILUIÇÕES PADRÃO</h2>
                </div>
                <button 
                  onClick={() => setShowDilutionsModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {['Sedativo', 'Analgésico', 'Vasoativa', 'Bloqueador Neuromuscular'].map(cat => {
                    const catDisplayNames: Record<string, string> = {
                      'Sedativo': 'Sedativos',
                      'Analgésico': 'Analgésicos',
                      'Vasoativa': 'Vasoativas',
                      'Bloqueador Neuromuscular': 'Bloqueadores Neuromusculares'
                    };
                    const titleColors: Record<string, string> = {
                      'Sedativo': 'text-purple-600',
                      'Analgésico': 'text-emerald-600',
                      'Vasoativa': 'text-blue-600',
                      'Bloqueador Neuromuscular': 'text-amber-600'
                    };
                    return (
                      <div key={cat} className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b-2 border-slate-100">
                          <span className={`text-xs font-black uppercase tracking-widest ${titleColors[cat] || 'text-slate-600'}`}>
                            {catDisplayNames[cat] || cat}
                          </span>
                        </div>
                        <div className="space-y-4">
                          {MEDS.filter(m => m.category === cat).map(med => (
                            <div key={med.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <h4 className="font-bold text-slate-800 mb-2">{med.name}</h4>
                              <div className="space-y-2">
                                {med.dilutions.map(dil => (
                                  <div key={dil.id} className="text-xs">
                                    <div className="font-bold text-slate-600 uppercase text-[9px] mb-0.5">{dil.name}</div>
                                    <div className="text-slate-500 leading-relaxed bg-white/60 p-2 rounded-md border border-slate-200/50">
                                      {dil.info}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400">
                 <div className="flex items-center gap-4">
                    <span>© 2026 CALCULADORA UTI-AVC</span>
                    <span className="flex items-center gap-1"><AlertCircle size={12} /> PROTOCOLO INSTITUCIONAL</span>
                 </div>
                 <button 
                    onClick={() => setShowDilutionsModal(false)}
                    className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 uppercase"
                 >
                   Fechar
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXAMS SOLICITATION MODAL */}
      <AnimatePresence>
        {examModalPatient && (
          <div key="exams-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExamModalPatient(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border border-slate-200 z-10 text-left"
            >
              {/* Header */}
              <div className="bg-purple-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <ClipboardList size={22} />
                  <div>
                    <h2 className="font-black text-base uppercase tracking-wider">Solicitação de Exames Laboratoriais</h2>
                    <p className="text-[10px] opacity-85 font-bold uppercase tracking-wider">Leito {examModalPatient.id} — {examFields.name || 'Paciente Sem Nome'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setExamModalPatient(null)}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ChevronDown className="rotate-90" size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6 custom-scrollbar text-left">
                
                {/* PATIENT FIELDS ROW */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">I. Identificação do Paciente</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                      <input
                        type="text"
                        value={examFields.name}
                        onChange={(e) => setExamFields(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all font-bold text-slate-700"
                        placeholder="Nome completo do paciente"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nº de Registro</label>
                      <input
                        type="text"
                        value={examFields.registro}
                        onChange={(e) => setExamFields(prev => ({ ...prev, registro: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all font-bold text-slate-700 text-center"
                        placeholder="Ex: 123456"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome da Mãe</label>
                      <input
                        type="text"
                        value={examFields.nomeMae}
                        onChange={(e) => setExamFields(prev => ({ ...prev, nomeMae: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all font-bold text-slate-700"
                        placeholder="Nome da mãe"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Data de Nasc.</label>
                      <input
                        type="text"
                        maxLength={8}
                        value={examFields.dataNascimento}
                        onChange={(e) => setExamFields(prev => ({ ...prev, dataNascimento: handleDateMask(e.target.value) }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all font-bold text-slate-700 text-center"
                        placeholder="DD/MM/AA"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Idade</label>
                      <input
                        type="number"
                        value={examFields.age}
                        onChange={(e) => setExamFields(prev => ({ ...prev, age: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all font-bold text-slate-700 text-center"
                        placeholder="Idade"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Solicitado em</label>
                      <input
                        type="text"
                        maxLength={8}
                        value={examFields.solicitadoEm}
                        onChange={(e) => setExamFields(prev => ({ ...prev, solicitadoEm: handleDateMask(e.target.value) }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all font-bold text-slate-700 text-center"
                        placeholder="DD/MM/AA"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">às</label>
                      <input
                        type="text"
                        value={examFields.solicitadoAs}
                        onChange={(e) => setExamFields(prev => ({ ...prev, solicitadoAs: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all font-bold text-slate-700 text-center"
                        placeholder="06:00"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Leito / Enf.</label>
                      <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-600 text-center uppercase tracking-wider">
                        Leito {examModalPatient.id} — UTI AVC
                      </div>
                    </div>
                  </div>
                </div>

                {/* EXAMS SELECTOR GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                  
                  {/* Exams Checklist */}
                  <div className="md:col-span-2 bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">II. Seleção de Exames</h3>
                      <button
                        type="button"
                        onClick={() => {
                          const allChecked = Object.values(examFields.exams).every(v => v);
                          const updatedExams = { ...examFields.exams };
                          Object.keys(updatedExams).forEach(k => {
                            updatedExams[k] = !allChecked;
                          });
                          setExamFields(prev => ({ ...prev, exams: updatedExams }));
                        }}
                        className="text-[9px] font-black uppercase text-purple-600 tracking-wider hover:underline"
                      >
                        {Object.values(examFields.exams).every(v => v) ? 'Desmarcar Todos' : 'Marcar Todos'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {Object.keys(examFields.exams).map(exam => (
                        <label
                          key={exam}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100"
                        >
                          <input
                            type="checkbox"
                            checked={examFields.exams[exam]}
                            onChange={() => {
                              setExamFields(prev => ({
                                ...prev,
                                exams: {
                                  ...prev.exams,
                                  [exam]: !prev.exams[exam]
                                }
                              }));
                            }}
                            className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                          />
                          <span className="text-xs font-bold text-slate-600 leading-tight">{exam}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Outros e Indicação */}
                  <div className="flex flex-col gap-4 text-left">
                    <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm flex-1 flex flex-col">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">III. Outros Exames</h3>
                      <textarea
                        value={examFields.outros}
                        onChange={(e) => setExamFields(prev => ({ ...prev, outros: e.target.value }))}
                        className="w-full flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all font-bold text-slate-700 resize-none min-h-[100px]"
                        placeholder="Digite outros exames não listados..."
                      />
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm flex-1 flex flex-col">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">IV. Indicação Clínica</h3>
                      <textarea
                        value={examFields.indicacao}
                        onChange={(e) => setExamFields(prev => ({ ...prev, indicacao: e.target.value }))}
                        className="w-full flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all font-bold text-slate-700 resize-none min-h-[100px]"
                        placeholder="Ex: Monitorização de paciente pós AVC."
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setExamModalPatient(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndPrintExam}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-purple-100 hover:scale-[1.02]"
                >
                  <Printer size={16} />
                  <span>Imprimir Solicitação</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Swap Bed Modal */}
      <AnimatePresence>
        {swapSourcePatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSwapSourcePatient(null);
                setSwapTargetId(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                <div className="flex items-center gap-2.5 text-amber-700">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black shadow-sm">
                    <ArrowLeftRight size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-800 uppercase tracking-tight leading-none">Trocar de Leito</h2>
                    <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block mt-0.5">
                      Origem: LEITO {swapSourcePatient.id} {swapSourcePatient.name ? `(${swapSourcePatient.name})` : '(Livre)'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSwapSourcePatient(null);
                    setSwapTargetId(null);
                  }}
                  className="p-1.5 hover:bg-slate-200/60 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <Plus className="rotate-45" size={22} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                <p className="text-xs font-bold text-slate-600">
                  Selecione o leito de destino para trocar com o <span className="text-amber-700 font-black">LEITO {swapSourcePatient.id}</span>:
                </p>

                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {patients.map(p => {
                    const isCurrent = p.id === swapSourcePatient.id;
                    const isSelected = swapTargetId === p.id;
                    const isOccupied = p.name && p.name.trim() !== '';

                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={isCurrent}
                        onClick={() => setSwapTargetId(p.id)}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isCurrent 
                            ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                            : isSelected 
                              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center ${
                            isSelected ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {p.id}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-800 uppercase">Leito {p.id}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-200 text-slate-600">Leito Atual</span>
                              )}
                              {isOccupied ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-700">Ocupado</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-400">Livre</span>
                              )}
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 truncate max-w-[260px] mt-0.5">
                              {isOccupied ? p.name : 'Nenhum paciente cadastrado'}
                            </p>
                          </div>
                        </div>

                        {!isCurrent && (
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {swapTargetId && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800 uppercase text-[10px] tracking-wider">
                      <ArrowLeftRight size={14} />
                      <span>Resumo da Troca</span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      • <strong>Leito {swapSourcePatient.id}</strong> ({swapSourcePatient.name || 'Livre'}) vai para o <strong>Leito {swapTargetId}</strong>.
                    </p>
                    <p className="text-xs leading-relaxed">
                      • <strong>Leito {swapTargetId}</strong> ({patients.find(p => p.id === swapTargetId)?.name || 'Livre'}) vai para o <strong>Leito {swapSourcePatient.id}</strong>.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSwapSourcePatient(null);
                    setSwapTargetId(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-colors uppercase text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!swapTargetId}
                  onClick={() => {
                    if (swapTargetId) {
                      handleSwapBeds(swapSourcePatient.id, swapTargetId);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black transition-all uppercase text-xs shadow-md flex items-center gap-1.5"
                >
                  <ArrowLeftRight size={14} />
                  <span>Confirmar Troca</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Archived Patients Modal (Recuperar Pacientes Antigos) */}
      <AnimatePresence>
        {isArchivedModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsArchivedModalOpen(false);
                setRestoreTargetPatient(null);
                setRestoreChosenBedId(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/60">
                <div className="flex items-center gap-3 text-indigo-700">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shadow-sm">
                    <History size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-800 uppercase tracking-tight leading-none">
                      Pacientes Antigos
                    </h2>
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mt-1">
                      {restoreTargetPatient 
                        ? `Restaurar para Leito Vazio` 
                        : `Histórico de Exclusão (Disponível por 10 dias)`}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsArchivedModalOpen(false);
                    setRestoreTargetPatient(null);
                    setRestoreChosenBedId(null);
                  }}
                  className="p-1.5 hover:bg-slate-200/60 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <Plus className="rotate-45" size={22} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {(() => {
                  const validArchived = archivedPatients.filter(a => (Date.now() - a.deletedAt) <= TEN_DAYS_MS);
                  const emptyBeds = patients.filter(p => !p.name || p.name.trim() === '');

                  if (restoreTargetPatient) {
                    return (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Paciente a Restaurar</span>
                            <h3 className="text-sm font-black text-slate-800 uppercase">{restoreTargetPatient.patient.name}</h3>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                              Ex-Leito {restoreTargetPatient.originalBedId} • Apagado em {restoreTargetPatient.deletedDateFormatted}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setRestoreTargetPatient(null);
                              setRestoreChosenBedId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 uppercase transition-all"
                          >
                            Voltar
                          </button>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">
                            Selecione o leito de destino (Apenas leitos vazios):
                          </label>

                          {emptyBeds.length === 0 ? (
                            <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                              <h4 className="text-xs font-black text-amber-800 uppercase">Nenhum leito vazio disponível</h4>
                              <p className="text-xs text-amber-700">
                                Todos os 6 leitos da UTI estão ocupados. Limpe ou desocupe um leito para poder restaurar as informações deste paciente.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {emptyBeds.map(eb => {
                                const isSelected = restoreChosenBedId === eb.id;
                                return (
                                  <button
                                    key={eb.id}
                                    type="button"
                                    onClick={() => setRestoreChosenBedId(eb.id)}
                                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                      isSelected
                                        ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-300 shadow-sm'
                                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center ${
                                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        {eb.id}
                                      </div>
                                      <div>
                                        <div className="text-xs font-black text-slate-800 uppercase">Leito {eb.id}</div>
                                        <div className="text-[10px] font-bold text-emerald-600 uppercase">Livre / Disponível</div>
                                      </div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                      isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                                    }`}>
                                      {isSelected && <Check size={12} strokeWidth={3} />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {restoreChosenBedId && (
                          <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-indigo-950 text-xs font-medium flex items-center gap-2">
                            <RotateCcw size={16} className="text-indigo-600 shrink-0" />
                            <span>
                              As informações de <strong>{restoreTargetPatient.patient.name}</strong> serão restauradas no <strong>Leito {restoreChosenBedId}</strong>.
                            </span>
                          </div>
                        )}

                        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setRestoreTargetPatient(null);
                              setRestoreChosenBedId(null);
                            }}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-colors uppercase text-xs"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={!restoreChosenBedId}
                            onClick={() => {
                              if (restoreChosenBedId) {
                                handleRestorePatient(restoreTargetPatient, restoreChosenBedId);
                              }
                            }}
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black transition-all uppercase text-xs shadow-md flex items-center gap-1.5"
                          >
                            <RotateCcw size={14} />
                            <span>Confirmar Restauração</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (validArchived.length === 0) {
                    return (
                      <div className="text-center py-12 space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <Archive className="w-10 h-10 text-slate-300 mx-auto" />
                        <div>
                          <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide">Nenhum paciente no histórico</h3>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                            Ao apagar um paciente de qualquer leito, ele fica automaticamente salvo aqui por 10 dias para restauração.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                        <span>{validArchived.length} paciente(s) disponível(is) para restauração:</span>
                        <span className="text-[10px] font-bold uppercase text-slate-400">Validade: 10 dias</span>
                      </div>

                      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {validArchived.map(arch => {
                          const msSince = Date.now() - arch.deletedAt;
                          const daysRemaining = Math.max(0, Math.ceil((TEN_DAYS_MS - msSince) / (24 * 60 * 60 * 1000)));
                          const p = arch.patient;
                          const activeInfusionsCount = (p.infusions || []).filter(inf => parseFloat(inf.flowRate) > 0).length;
                          const checklistsCount = (p.dailyChecklists || []).filter(c => c && c.checklistData && c.checklistData.trim() !== '').length;

                          return (
                            <div 
                              key={arch.archiveId}
                              className="p-4 bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl shadow-sm transition-all space-y-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                      {p.name || 'Paciente sem nome'}
                                    </h4>
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-black uppercase border border-slate-200">
                                      Ex-Leito {arch.originalBedId}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                                    {p.age && <span>{p.age} anos</span>}
                                    {p.gender && <span>• {p.gender}</span>}
                                    {p.registro && <span>• Reg: {p.registro}</span>}
                                    {p.dataAdmissao && <span>• Adm: {p.dataAdmissao}</span>}
                                  </div>
                                </div>

                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
                                  daysRemaining <= 2 
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                }`}>
                                  <Clock size={11} className="inline mr-1 -mt-0.5" />
                                  {daysRemaining === 1 ? 'Expira em 1 dia' : `Expira em ${daysRemaining} dias`}
                                </span>
                              </div>

                              {/* Chips / summaries */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-bold">
                                {checklistsCount > 0 && (
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                                    {checklistsCount} checklist(s) preenchido(s)
                                  </span>
                                )}
                                {activeInfusionsCount > 0 && (
                                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md border border-purple-100">
                                    {activeInfusionsCount} bomba(s) ativa(s)
                                  </span>
                                )}
                                {p.tcControles && p.tcControles.length > 0 && (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">
                                    {p.tcControles.length} TC(s) de controle
                                  </span>
                                )}
                                <span className="text-slate-400 text-[9px] font-normal ml-auto">
                                  Apagado: {arch.deletedDateFormatted}
                                </span>
                              </div>

                              {/* Action Footer */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteArchivedPatient(arch.archiveId)}
                                  className="text-slate-400 hover:text-red-500 text-[10px] font-bold uppercase transition-colors flex items-center gap-1 p-1"
                                  title="Remover definitivamente do histórico"
                                >
                                  <Trash2 size={12} />
                                  <span>Excluir do Histórico</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRestoreTargetPatient(arch);
                                    setRestoreChosenBedId(null);
                                  }}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase shadow-sm hover:shadow transition-all flex items-center gap-1.5"
                                >
                                  <RotateCcw size={13} strokeWidth={2.5} />
                                  <span>Restaurar Paciente</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              {!restoreTargetPatient && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold">
                  <span>Pacientes excluídos há mais de 10 dias são descartados automaticamente.</span>
                  <button
                    type="button"
                    onClick={() => setIsArchivedModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-colors uppercase text-xs"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EVOLUTION IMPORT REVIEW MODAL */}
      <AnimatePresence>
        {importPreviewData && importTargetBedId !== null && (
          <div key="evolution-import-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setImportPreviewData(null);
                setImportTargetBedId(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border border-slate-200 z-10 text-left"
            >
              {/* Header */}
              <div className="bg-blue-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <FileUp size={22} />
                  </div>
                  <div>
                    <h2 className="font-black text-base uppercase tracking-wider">Evolução Médica (.docx) Detectada</h2>
                    <p className="text-[11px] opacity-85 font-bold uppercase tracking-wider">
                      Leito {importTargetBedId} — Revise os dados extraídos antes de confirmar
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setImportPreviewData(null);
                    setImportTargetBedId(null);
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                >
                  <Plus className="rotate-45" size={22} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-5 custom-scrollbar text-left">
                {/* 1. Identificação */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span>1. Identificação do Paciente</span>
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Leito {importTargetBedId}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nome Completo</label>
                      <input
                        type="text"
                        value={importPreviewData.name}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="Nome do paciente"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Registro / PE</label>
                      <input
                        type="text"
                        value={importPreviewData.registro}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, registro: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="Registro hospitalar"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Data Nascimento</label>
                      <input
                        type="text"
                        maxLength={8}
                        value={importPreviewData.dataNascimento}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, dataNascimento: handleDateMask(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="DD/MM/AA"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Idade</label>
                      <input
                        type="number"
                        value={importPreviewData.age}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, age: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="Anos"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Sexo</label>
                      <select
                        value={importPreviewData.gender}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, gender: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="">Selecione</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Masculino">Masculino</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Peso (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={importPreviewData.weight}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, weight: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-blue-700 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="Peso (kg)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nome da Mãe</label>
                    <input
                      type="text"
                      value={importPreviewData.nomeMae}
                      onChange={(e) => setImportPreviewData({ ...importPreviewData, nomeMae: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-400"
                      placeholder="Nome da mãe"
                    />
                  </div>
                </div>

                {/* 2. Dados Clínicos e Admissão */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-xs font-black text-blue-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                    2. Quadro Clínico & Admissão
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Data Admissão</label>
                      <input
                        type="text"
                        maxLength={8}
                        value={importPreviewData.dataAdmissao}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, dataAdmissao: handleDateMask(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="DD/MM/AA"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">NIHSS Admissão</label>
                      <input
                        type="number"
                        value={importPreviewData.nihssAdmissao}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, nihssAdmissao: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="NIHSS"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Rankin Prévio</label>
                      <input
                        type="number"
                        value={importPreviewData.rankinAdm}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, rankinAdm: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="Rankin"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">PA Admissão</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={importPreviewData.paSistolica}
                          onChange={(e) => setImportPreviewData({ ...importPreviewData, paSistolica: e.target.value })}
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                          placeholder="PAS"
                        />
                        <span className="text-slate-400 font-black">x</span>
                        <input
                          type="number"
                          value={importPreviewData.paDiastolica}
                          onChange={(e) => setImportPreviewData({ ...importPreviewData, paDiastolica: e.target.value })}
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                          placeholder="PAD"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Data do Ictus</label>
                      <input
                        type="text"
                        maxLength={8}
                        value={importPreviewData.dataIctus}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, dataIctus: handleDateMask(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="DD/MM/AA"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Hora do Ictus</label>
                      <input
                        type="text"
                        value={importPreviewData.horaIctus}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, horaIctus: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="HH:mm"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Comorbidades</label>
                      <input
                        type="text"
                        value={importPreviewData.comorbidades}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, comorbidades: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="HAS, DM, FA..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Sintomas de Admissão</label>
                    <textarea
                      rows={2}
                      value={importPreviewData.sintomasAdmissao}
                      onChange={(e) => setImportPreviewData({ ...importPreviewData, sintomasAdmissao: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-400"
                      placeholder="Sintomas relatados na admissão..."
                    />
                  </div>
                </div>

                {/* 3. Exames Complementares */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-xs font-black text-blue-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                    3. Exames & Avaliação Inicial
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Data TC Crânio</label>
                      <input
                        type="text"
                        maxLength={8}
                        value={importPreviewData.tcAdmissaoData}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, tcAdmissaoData: handleDateMask(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="DD/MM/AA"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Laudo TC Crânio / Angio-TC</label>
                      <textarea
                        rows={2}
                        value={importPreviewData.tcAdmissaoLaudo}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, tcAdmissaoLaudo: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="Laudo da tomografia de crânio..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Data ECG</label>
                      <input
                        type="text"
                        maxLength={8}
                        value={importPreviewData.ecgData}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, ecgData: handleDateMask(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="DD/MM/AA"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Laudo ECG</label>
                      <input
                        type="text"
                        value={importPreviewData.ecgLaudo}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, ecgLaudo: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="Sinusal, FA..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Glasgow Admissão</label>
                      <input
                        type="number"
                        value={importPreviewData.checklistGlasgow}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, checklistGlasgow: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="15"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Pupilas</label>
                      <input
                        type="text"
                        value={importPreviewData.checklistPup}
                        onChange={(e) => setImportPreviewData({ ...importPreviewData, checklistPup: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-400"
                        placeholder="Isocóricas..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-500 font-medium">
                  Os dados preencherão o <strong>Leito {importTargetBedId}</strong> e a <strong>Ficha Clínica</strong>.
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setImportPreviewData(null);
                      setImportTargetBedId(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-200 transition-colors uppercase text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmImport(importPreviewData)}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-all uppercase text-xs shadow-md flex items-center gap-1.5 active:scale-95"
                  >
                    <Check size={15} strokeWidth={2.5} />
                    <span>Confirmar e Preencher Leito</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Botões Flutuantes: WhatsApp & Imprimir no Canto Inferior Direito */}
      <div className="fixed bottom-3 right-4 z-30 flex items-center gap-1.5 opacity-35 hover:opacity-100 transition-opacity duration-300">
        <button
          type="button"
          onClick={() => setIsWhatsAppSettingsOpen(true)}
          className="flex items-center justify-center bg-slate-800/90 hover:bg-slate-900 text-slate-200 p-2 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 border border-slate-700"
          title="Configurações do WhatsApp (Evolution API)"
        >
          <Settings size={15} />
        </button>

        <button
          type="button"
          onClick={handleOpenWhatsAppSend}
          className="flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-700 text-white font-black text-[11px] px-3 py-2 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 uppercase tracking-wider border border-emerald-500"
          title="Enviar todos os checklists para o WhatsApp via Evolution API"
        >
          <MessageSquare size={14} />
          <span>Enviar para WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={printVitalsSummary}
          className="flex items-center gap-1.5 bg-purple-600/90 hover:bg-purple-700 text-white font-black text-[11px] px-3 py-2 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 uppercase tracking-wider border border-purple-500"
          title="Gerar resumo de sinais vitais de todos os leitos ocupados"
        >
          <Activity size={14} />
          <span>Resumo Sinais Vitais</span>
        </button>

        <button
          type="button"
          onClick={printAllChecklists}
          className="flex items-center gap-1.5 bg-blue-600/90 hover:bg-blue-700 text-white font-black text-[11px] px-3 py-2 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 uppercase tracking-wider border border-blue-500"
          title="Imprimir todos os checklists de leitos ocupados"
        >
          <Printer size={14} />
          <span>Imprimir Todos</span>
        </button>

        <button
          type="button"
          onClick={printAllExams}
          className="flex items-center gap-1.5 bg-indigo-600/90 hover:bg-indigo-700 text-white font-black text-[11px] px-3 py-2 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 uppercase tracking-wider border border-indigo-500"
          title="Imprimir solicitação de exames laboratoriais de todos os leitos ocupados"
        >
          <FileText size={14} />
          <span>Todos Exames</span>
        </button>
      </div>

      <WhatsAppSettingsModal
        isOpen={isWhatsAppSettingsOpen}
        onClose={() => setIsWhatsAppSettingsOpen(false)}
      />

      <WhatsAppSendModal
        isOpen={isWhatsAppSendOpen}
        onClose={() => setIsWhatsAppSendOpen(false)}
        getHtmlContent={getAllChecklistsHtml}
        onPrintAll={printAllChecklists}
        onOpenSettings={() => {
          setIsWhatsAppSendOpen(false);
          setIsWhatsAppSettingsOpen(true);
        }}
      />


      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
