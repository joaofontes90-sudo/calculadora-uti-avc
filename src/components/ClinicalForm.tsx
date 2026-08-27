import React from 'react';
import { Patient, TcControleItem } from '../App';
import { Plus, Trash2 } from 'lucide-react';

interface ClinicalFormProps {
  patient: Patient;
  updatePatient: (p: Patient) => void;
  handleDateMask: (value: string) => string;
  theme: {
    ringColor: string;
  };
}

export const ClinicalForm: React.FC<ClinicalFormProps> = ({
  patient,
  updatePatient,
  handleDateMask,
  theme,
}) => {
  const addTcControle = () => {
    const newId = 'tc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const newItems = [...(patient.tcControles || []), { id: newId, data: '', laudo: '' }];
    
    const updatedPatient: Patient = {
      ...patient,
      tcControles: newItems,
    };
    if (newItems.length > 0) {
      updatedPatient.tcControleData = newItems[0].data;
      updatedPatient.tcControleLaudo = newItems[0].laudo;
    }
    updatePatient(updatedPatient);
  };

  const removeTcControle = (id: string) => {
    const newItems = (patient.tcControles || []).filter(item => item.id !== id);
    const updatedPatient: Patient = {
      ...patient,
      tcControles: newItems,
    };
    if (newItems.length > 0) {
      updatedPatient.tcControleData = newItems[0].data;
      updatedPatient.tcControleLaudo = newItems[0].laudo;
    } else {
      updatedPatient.tcControleData = '';
      updatedPatient.tcControleLaudo = '';
    }
    updatePatient(updatedPatient);
  };

  const updateTcControle = (id: string, field: 'data' | 'laudo', value: string) => {
    const newItems = (patient.tcControles || []).map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    const updatedPatient: Patient = {
      ...patient,
      tcControles: newItems,
    };
    if (newItems.length > 0) {
      updatedPatient.tcControleData = newItems[0].data;
      updatedPatient.tcControleLaudo = newItems[0].laudo;
    }
    updatePatient(updatedPatient);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
      {/* SEÇÃO 1: ADMISSÃO E REGISTRO */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 space-y-4 shadow-sm text-left">
        <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
          <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Admissão & Registro</span>
        </div>
        
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Registro</label>
          <input
            type="number"
            placeholder="Ex: 123456"
            value={patient.registro || ''}
            onChange={(e) => updatePatient({ ...patient, registro: e.target.value })}
            className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Nome da Mãe</label>
          <input
            type="text"
            placeholder="Ex: Maria Silva"
            value={patient.nomeMae || ''}
            onChange={(e) => updatePatient({ ...patient, nomeMae: e.target.value })}
            className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 ${theme.ringColor}`}
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Data de Nascimento</label>
          <input
            type="text"
            placeholder="DD/MM/AA"
            maxLength={8}
            value={patient.dataNascimento || ''}
            onChange={(e) => updatePatient({ ...patient, dataNascimento: handleDateMask(e.target.value) })}
            className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Data Admissão</label>
            <input
              type="text"
              placeholder="DD/MM/AA"
              maxLength={8}
              value={patient.dataAdmissao || ''}
              onChange={(e) => updatePatient({ ...patient, dataAdmissao: handleDateMask(e.target.value) })}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">NIHSS Admissão</label>
            <input
              type="number"
              placeholder="Valor"
              value={patient.nihssAdmissao || ''}
              onChange={(e) => updatePatient({ ...patient, nihssAdmissao: e.target.value })}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Rankin Prévio</label>
            <input
              type="number"
              placeholder="Rankin"
              value={patient.rankinAdm || ''}
              onChange={(e) => updatePatient({ ...patient, rankinAdm: e.target.value })}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Rankin Alta</label>
            <input
              type="number"
              placeholder="Rankin"
              value={patient.rankinAlta || ''}
              onChange={(e) => updatePatient({ ...patient, rankinAlta: e.target.value })}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">PA Admissão (Sistólica/Diastólica)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Sistólica"
              value={patient.paSistolica || ''}
              onChange={(e) => updatePatient({ ...patient, paSistolica: e.target.value })}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
            />
            <span className="text-slate-400 font-bold text-sm">/</span>
            <input
              type="number"
              placeholder="Diastólica"
              value={patient.paDiastolica || ''}
              onChange={(e) => updatePatient({ ...patient, paDiastolica: e.target.value })}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
            />
            <span className="text-slate-400 text-[10px] font-black uppercase shrink-0">mmHg</span>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Sintomas da Admissão</label>
          <textarea
            placeholder="Descreva os sintomas apresentados..."
            value={patient.sintomasAdmissao || ''}
            onChange={(e) => updatePatient({ ...patient, sintomasAdmissao: e.target.value })}
            rows={3}
            className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 custom-scrollbar ${theme.ringColor}`}
          />
        </div>
      </div>

      {/* SEÇÃO 2: ICTUS E TROMBÓLISE */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 space-y-4 shadow-sm text-left">
        <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
          <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Ictus & Trombólise</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Data do Ictus</label>
            <input
              type="text"
              placeholder="DD/MM/AA"
              maxLength={8}
              value={patient.dataIctus || ''}
              onChange={(e) => updatePatient({ ...patient, dataIctus: handleDateMask(e.target.value) })}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Hora do Ictus</label>
            <input
              type="text"
              placeholder="Ex: 14:30"
              value={patient.horaIctus || ''}
              onChange={(e) => updatePatient({ ...patient, horaIctus: e.target.value })}
              className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Duração dos Sintomas</label>
          <div className="grid grid-cols-3 gap-1.5">
            {['< 10 min', '10-59 min', '> 60 min'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updatePatient({ ...patient, duracaoSintomas: patient.duracaoSintomas === opt ? '' : (opt as any) })}
                className={`py-2 rounded-xl text-[10px] font-black border transition-all ${
                  patient.duracaoSintomas === opt
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Trombólise</label>
            <div className="flex gap-1.5">
              {['Sim', 'Não'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updatePatient({ ...patient, trombolise: patient.trombolise === opt ? '' : (opt as any) })}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition-all ${
                    patient.trombolise === opt
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {opt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Data/Hora</label>
            <input
              type="text"
              placeholder="Ex: 12/11 15:45"
              value={patient.tromboliseDataHora || ''}
              disabled={patient.trombolise !== 'Sim'}
              onChange={(e) => updatePatient({ ...patient, tromboliseDataHora: e.target.value })}
              className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold ${
                patient.trombolise === 'Sim'
                  ? `bg-slate-50 border-slate-200 text-slate-700 ${theme.ringColor}`
                  : 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 leading-none">Comorbidades</label>
          <textarea
            placeholder="Ex: Hipertensão, Diabetes Melitus..."
            value={patient.comorbidades || ''}
            onChange={(e) => updatePatient({ ...patient, comorbidades: e.target.value })}
            rows={3}
            className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 custom-scrollbar ${theme.ringColor}`}
          />
        </div>
      </div>

      {/* SEÇÃO 3: HISTÓRICO E EXAMES */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 space-y-4 shadow-sm text-left lg:col-span-1 md:col-span-2">
        <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
          <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Histórico & Exames de Imagem</span>
        </div>

        {/* TC Admissão */}
        <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">TC de Crânio Admissão</span>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="DD/MM/AA"
              maxLength={8}
              value={patient.tcAdmissaoData || ''}
              onChange={(e) => updatePatient({ ...patient, tcAdmissaoData: handleDateMask(e.target.value) })}
              className={`w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
            />
            <textarea
              placeholder="Descrição do Laudo..."
              value={patient.tcAdmissaoLaudo || ''}
              onChange={(e) => updatePatient({ ...patient, tcAdmissaoLaudo: e.target.value })}
              rows={2}
              className={`w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 custom-scrollbar ${theme.ringColor}`}
            />
          </div>
        </div>

        {/* Angiotomo */}
        <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Angiotomo</span>
          <textarea
            placeholder="Descrição do laudo / join..."
            value={patient.angiotomoDescricao || ''}
            onChange={(e) => updatePatient({ ...patient, angiotomoDescricao: e.target.value })}
            rows={2}
            className={`w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 custom-scrollbar ${theme.ringColor}`}
          />
        </div>

        {/* TC de Controle */}
        <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">TC de Crânio Controle</span>
            <button
              type="button"
              onClick={addTcControle}
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1"
            >
              <Plus className="w-3 h-3 stroke-[3]" /> Adicionar
            </button>
          </div>

          {(patient.tcControles || []).length === 0 ? (
            <div className="text-center py-4 bg-white/50 border border-dashed border-slate-200 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Nenhuma TC de controle</p>
              <button
                type="button"
                onClick={addTcControle}
                className="mt-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase rounded-lg transition-all"
              >
                Adicionar Nova TC
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {(patient.tcControles || []).map((item, index) => (
                <div key={item.id} className="p-2.5 bg-white border border-slate-200/80 rounded-xl space-y-2 relative group shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase">TC Controle #${index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeTcControle(item.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                      title="Excluir TC de Controle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="DD/MM/AA"
                      maxLength={8}
                      value={item.data || ''}
                      onChange={(e) => updateTcControle(item.id, 'data', handleDateMask(e.target.value))}
                      className={`w-full px-2.5 py-1 bg-slate-50/50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
                    />
                    <textarea
                      placeholder="Descrição do laudo..."
                      value={item.laudo || ''}
                      onChange={(e) => updateTcControle(item.id, 'laudo', e.target.value)}
                      rows={2}
                      className={`w-full px-2.5 py-1 bg-slate-50/50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 custom-scrollbar ${theme.ringColor}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ECG */}
        <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-200/40 space-y-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">ECG</span>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="DD/MM/AA"
              maxLength={8}
              value={patient.ecgData || ''}
              onChange={(e) => updatePatient({ ...patient, ecgData: handleDateMask(e.target.value) })}
              className={`w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 text-center ${theme.ringColor}`}
            />
            <textarea
              placeholder="Descrição do laudo..."
              value={patient.ecgLaudo || ''}
              onChange={(e) => updatePatient({ ...patient, ecgLaudo: e.target.value })}
              rows={2}
              className={`w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 transition-all font-bold text-slate-700 custom-scrollbar ${theme.ringColor}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
