import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  AlignmentType,
  VerticalAlign,
  HeadingLevel
} from 'docx';
import { Patient, DailyChecklist } from '../App';

// Helper to format date as dd/mm/aa
const getTodayFormatted = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

// Helper to find the latest checklist with some data (or the "dia anterior" checklist before the first empty one)
const getLatestFilledChecklist = (p: Patient): DailyChecklist => {
  if (p.dailyChecklists && Array.isArray(p.dailyChecklists)) {
    // Find the first empty checklist index
    const firstEmptyIndex = p.dailyChecklists.findIndex(c => !c.checklistData);
    
    if (firstEmptyIndex > 0) {
      // The one before the first empty checklist is the "dia anterior"
      return p.dailyChecklists[firstEmptyIndex - 1];
    } else if (firstEmptyIndex === 0) {
      // If Day 1 is empty, check if there is any other filled checklist in the array
      const filled = p.dailyChecklists.find(c => c.checklistData);
      if (filled) return filled;
    } else {
      // All 6 checklists have checklistData filled (none is empty), so the last one is the most recent
      return p.dailyChecklists[p.dailyChecklists.length - 1];
    }
  }
  return p;
};

export const generateEvolucaoDocx = async (patient: Patient) => {
  const latestChecklist = getLatestFilledChecklist(patient);

  // Parse TFG/Renal Info using latest Cr info
  const ageNum = parseInt(patient.age || '');
  const genderMap = patient.gender === 'Masculino' ? 'M' : patient.gender === 'Feminino' ? 'F' : null;
  
  // Extract latest creatinine and date
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

  // Calculate TFG (CKD-EPI 2021) rounded to closest integer
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

  // 1. DATA
  const todayStr = getTodayFormatted();

  // 2. ESCALA DE NIHSS ATUAL
  const nihssAtualStr = latestChecklist.checklistNihssAtual || '___';

  // 3. GLICEMIA ↑ e ↓
  const glicemiaMax = latestChecklist.checklistHgtMaior ? `${latestChecklist.checklistHgtMaior} MG/DL` : '___';
  const glicemiaMin = latestChecklist.checklistHgtMenor ? `${latestChecklist.checklistHgtMenor} MG/DL` : '___';

  // 4. TC DE CRANIO/ CERVICAL ADMISSÃO E CONTROLE (keep dates on single line, allow appending)
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

  // 5. ATB
  const atbStr = latestChecklist.checklistAntibiotico === 'Sim' && latestChecklist.checklistAntibioticoText
    ? latestChecklist.checklistAntibioticoText
    : 'FEZ USO: NADA / EM USO: NADA';

  // 6. PRESSÃO ARTERIAL (PAS x PAD MMHG format)
  const pasVal = latestChecklist.checklistPas || '___';
  const padVal = latestChecklist.checklistPad || '___';
  const paStr = pasVal === '___' && padVal === '___' ? '___' : `${pasVal} x ${padVal} MMHG`;

  // 7. TEMPERATURA
  let tempVal = latestChecklist.checklistFebreTemp || '___';
  if (tempVal !== '___' && !tempVal.toUpperCase().includes('°C')) {
    tempVal = `${tempVal}°C`;
  }
  const tempStr = latestChecklist.checklistFebre === 'Sim' && tempVal !== '___' ? `> ${tempVal}` : tempVal;

  // 8. BH (Fluid balance with sign and ML/24H)
  let bhVal = latestChecklist.checklistBalançoHidrico || '___';
  if (bhVal !== '___') {
    // If it's a number and doesn't already start with + or -
    const trimmed = bhVal.trim();
    if (/^\d/.test(trimmed)) {
      bhVal = `+ ${trimmed}`;
    }
    if (!bhVal.toUpperCase().includes('ML/24H')) {
      bhVal = `${bhVal} ML/24H`;
    }
  }

  // 9. DIURESE
  let diureseVal = latestChecklist.checklistDiurese || '___';
  if (diureseVal !== '___') {
    if (!diureseVal.toUpperCase().includes('ML/24H')) {
      diureseVal = `${diureseVal} ML/24H`;
    }
  }

  // Common borders for tables
  const borderThin = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
  const cellBorders = {
    top: borderThin,
    bottom: borderThin,
    left: borderThin,
    right: borderThin,
  };

  // Build Comorbidades
  const comorbidadesList = patient.comorbidades
    ? patient.comorbidades.split(/[,;\n]/).map(c => c.trim()).filter(Boolean)
    : [];

  // Build Dispositivos
  const dispositivosList: string[] = [];
  if (latestChecklist.checklistAcessoLocal) {
    dispositivosList.push(latestChecklist.checklistAcessoLocal);
  } else {
    dispositivosList.push('AVP'); // Default
  }
  if (latestChecklist.checklistDietaTipo && latestChecklist.checklistDietaTipo.toLowerCase().includes('sng')) {
    dispositivosList.push('SNG');
  }
  if (latestChecklist.checklistDietaTipo && latestChecklist.checklistDietaTipo.toLowerCase().includes('sne')) {
    dispositivosList.push('SNE');
  }

  // Text paragraph builders
  const makeText = (text: string, bold = false, size = 18, color = '000000') => {
    return new TextRun({
      text,
      bold,
      size,
      font: 'Arial',
      color,
    });
  };

  const makeCellParagraph = (runs: TextRun[], alignment: any = AlignmentType.LEFT) => {
    return new Paragraph({
      children: runs,
      alignment,
      spacing: { before: 40, after: 40, line: 240 },
    });
  };

  const makeLabelValueRow = (label: string, value: string) => {
    return new TableRow({
      children: [
        new TableCell({
          children: [makeCellParagraph([makeText(label, true, 16, '555555')])],
          width: { size: 40, type: WidthType.PERCENTAGE },
          borders: cellBorders,
        }),
        new TableCell({
          children: [makeCellParagraph([makeText(value, false, 16, '000000')])],
          width: { size: 60, type: WidthType.PERCENTAGE },
          borders: cellBorders,
        })
      ]
    });
  };

  // Generate dynamic Admission paragraph
  const textAdmissao = `ADMISSÃO: PACIENTE REGULADO VIA JOIN, PROVENIENTE DE ${patient.sintomasAdmissao?.includes('PROVENIENTE') ? '' : 'MUNICÍPIO DE ORIGEM'}, COM HISTÓRIA DE DÉFICIT NEUROLÓGICO SÚBITO INICIADO AS ${patient.horaIctus || '___'}, CARACTERIZADO POR: ${patient.sintomasAdmissao || 'DÉFICIT NEUROLÓGICO'}. CHEGA EM JANELA DE TEMPO PARA REALIZAÇÃO DE TROMBÓLISE. REALIZA TOMOGRAFIAS DE CRÂNIO NA ADMISSÃO, SENDO AVALIADO PELA NEUROLOGIA QUE RECOMENDA TRATAMENTO REPERFUSIONAL. ${patient.trombolise === 'Sim' ? `TROMBÓLISE REALIZADA: BÓLUS ÀS ${patient.tromboliseDataHora || '___'}. PROCEDIMENTO REALIZADO SEM INTERCORRÊNCIAS.` : 'TROMBÓLISE NÃO REALIZADA.'} FAZ USO DOMICILIAR DE: ${patient.comorbidades || 'MEDICAÇÕES DE USO DIÁRIO'}.`;

  // Generate dynamic Evolution paragraph
  const textEvolucao = `EVOLUÇÃO: PACIENTE EM LEITO ${patient.id}, ESTÁVEL CLINICAMENTE. DO PONTO DE VISTA HEMODINÂMICO, APRESENTA-SE ${latestChecklist.checklistDva === 'Sim' ? `INSTÁVEL, EM USO DE DVA (${latestChecklist.checklistDvaText || 'Drogas Vasoativas'})` : 'ESTÁVEL, SEM USO DE DRUGAS VASOATIVAS (DVA)'} COM BOM CONTROLE PRESSÓRICO. APRESENTA-SE EUPNEICO EM ${latestChecklist.checklistVentilacao && latestChecklist.checklistVentilacao.length > 0 ? `VENTILAÇÃO MECÂNICA (${latestChecklist.checklistVentilacao.join(', ')})` : 'AR AMBIENTE'}. DIETA: ${latestChecklist.checklistDieta === 'Sim' ? `DIETA ENTERAL EM CURSO (${latestChecklist.checklistDietaTipo || 'SNG'})` : 'DIETA ZERO'}. DIURESE REGISTRADA DE ${diureseVal} EM 24 HORAS. BALANÇO HÍDRICO DE ${bhVal}. APRESENTOU ${latestChecklist.checklistFebre === 'Sim' ? `EPISÓDIO FEBRIL ISOLADO (${tempStr})` : 'TEMPERATURA ESTÁVEL, AFEBRIL'}. EM USO DE ANTIBIOTICOTERAPIA: ${atbStr}. EXAME NEUROLÓGICO: GLASGOW ${latestChecklist.checklistGlasgow || '15'}, EXECUTANDO COMANDOS SIMPLES, NIHSS ATUAL ${nihssAtualStr}. EXAME DE IMAGEM ADMISSÃO E CONTROLE REALIZADOS NAS DATAS: ${tcDatesStr}. FUNÇÃO RENAL (CKD-EPI 2021) CALCULADA EM ${tfgDisplay}${latestCrVal ? ` (ÚLTIMO REGISTRO DE CREATININA: ${latestCrVal} mg/dL em ${latestCrDate})` : ''}.`;

  // Doc structure
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1000,
            bottom: 1000,
            left: 1000,
            right: 1000,
          }
        }
      },
      children: [
        // Header block
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            makeText('ESTADO DE ALAGOAS', true, 18, '000000'),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            makeText('SECRETARIA DE ESTADO DA SAÚDE – SESAU', true, 16, '333333'),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            makeText('HOSPITAL DE EMERGÊNCIA DR. DANIEL HOULY', true, 16, '333333'),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            makeText('Rodovia AL 220 km 05 S/N, Senador Arnon de Melo, CEP: 57.315-745, Arapiraca-AL', false, 14, '666666'),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            makeText('UTI AVC', true, 24, '6B21A8'), // Purple color
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            makeText('EVOLUÇÃO MÉDICA', true, 20, '000000'),
          ],
        }),

        // Patient general info block table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [makeCellParagraph([makeText('NOME: ', true, 16), makeText((patient.name || '________________________').toUpperCase(), true, 16)])],
                  width: { size: 70, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                }),
                new TableCell({
                  children: [makeCellParagraph([makeText('REGISTRO: ', true, 16), makeText(patient.registro || '__________', true, 16)])],
                  width: { size: 30, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [makeCellParagraph([makeText('MÃE: ', true, 14), makeText((patient.nomeMae || '________________________').toUpperCase(), false, 14)])],
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [makeCellParagraph([
                    makeText('DN: ', true, 14), makeText(patient.dataNascimento || '___/___/___', false, 14),
                    makeText('   IDADE: ', true, 14), makeText(patient.age ? `${patient.age} ANOS` : '___', false, 14),
                    makeText('   PESO: ', true, 14), makeText(patient.weight ? `${patient.weight} KG` : '___', false, 14),
                  ])],
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [makeCellParagraph([makeText('DATA: ', true, 14), makeText(todayStr, true, 14, '1D4ED8')])], // Blue highlighted
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                })
              ]
            })
          ]
        }),

        new Paragraph({ spacing: { before: 100, after: 100 } }),

        // First Table (Grid with merges)
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            // Row 1: Headers
            new TableRow({
              children: [
                new TableCell({
                  children: [makeCellParagraph([makeText('UTI AVC', true, 16, '000000')], AlignmentType.CENTER)],
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  shading: { fill: 'F3F4F6' },
                }),
                new TableCell({
                  children: [makeCellParagraph([makeText(`LEITO ${String(patient.id).padStart(2, '0')}`, true, 16, '1E3A8A')], AlignmentType.CENTER)],
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  shading: { fill: 'EFF6FF' },
                }),
                new TableCell({
                  children: [makeCellParagraph([makeText('HIPÓTESE DIAGNÓSTICA', true, 16, '000000')], AlignmentType.CENTER)],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                  shading: { fill: 'F3F4F6' },
                }),
              ]
            }),
            // Row 2: Admission dates / Diagnosis details
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    makeCellParagraph([makeText(`ADM. HOSP -----------> ${patient.dataAdmissao || '___/___/___'}`, false, 14)]),
                    makeCellParagraph([makeText(`ADM. UTI AVC --------> ${patient.dataAdmissao || '___/___/___'}`, false, 14)])
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                }),
                new TableCell({
                  children: [
                    makeCellParagraph([makeText(`# HD = AVCI, ICTUS ${patient.dataIctus || '___/___/___'}, ${patient.horaIctus || '___'}`, true, 14)])
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                })
              ]
            }),
            // Row 3: NIHSS
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    makeCellParagraph([
                      makeText('ESCALA DE NIHSS:  ADM ------------- ', false, 14), makeText(`${patient.nihssAdmissao || '___'} PTS`, true, 14),
                      makeText('\n                                  ATUAL ------------ ', false, 14), makeText(`${nihssAtualStr} PTS`, true, 14, 'B91C1C')
                    ])
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                }),
                new TableCell({
                  children: [
                    makeCellParagraph([makeText(`# TROMBÓLISE ${patient.trombolise === 'Sim' ? `${patient.tromboliseDataHora || '___'}` : 'NÃO REALIZADA'}`, true, 14)])
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                })
              ]
            }),
            // Row 4: Rankin
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    makeCellParagraph([makeText(`ESCALA DE RANKIN:  PRÉVIA = ${patient.rankinAdm || '___'} PTS`, false, 14)])
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                }),
                new TableCell({
                  children: [makeCellParagraph([makeText('')])],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                })
              ]
            }),
            // Row 5: Trombolise Check
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    makeCellParagraph([
                      makeText(`TROMBÓLISE:   ( ${patient.trombolise === 'Sim' ? 'X' : ' '} ) SIM     ( ${patient.trombolise === 'Não' ? 'X' : ' '} ) NÃO`, true, 14),
                      makeText(`\nBÓLUS ${patient.tromboliseDataHora || '___'}`, false, 14)
                    ])
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                }),
                new TableCell({
                  children: [makeCellParagraph([makeText('')])],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                })
              ]
            }),
            // Row 6: Glicemias
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    makeCellParagraph([
                      makeText('GLICEMIA ↑: ', true, 14), makeText(glicemiaMax, false, 14),
                      makeText('\nGLICEMIA ↓: ', true, 14), makeText(glicemiaMin, false, 14),
                    ])
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                }),
                new TableCell({
                  children: [makeCellParagraph([makeText('')])],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                })
              ]
            }),
            // Row 7: TC De Cranio
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    makeCellParagraph([
                      makeText('TC DE CRANIO/ CERVICAL ADMISSÃO E CONTROLE:', true, 14),
                      makeText(`\nDATA: ${tcDatesStr}`, true, 14, '1D4ED8'),
                      makeText('\nTH (   ) SIM   (   ) NÃO', false, 14)
                    ])
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                }),
                new TableCell({
                  children: [
                    makeCellParagraph([
                      makeText(`- TC DE CRÂNIO ADMISSÃO: ${patient.tcAdmissaoLaudo || 'SEM ALTERAÇÕES.'}`, false, 12),
                      makeText(
                        (patient.tcControles && patient.tcControles.length > 0)
                          ? patient.tcControles.map((tc, idx) => `\n- TC DE CRÂNIO CONTROLE #${idx + 1} (${tc.data || '__/__/__'}): ${tc.laudo || 'Sem laudo.'}`).join('')
                          : `\n- TC DE CRÂNIO CONTROLE: ${patient.tcControleLaudo || 'AGUARDANDO CONTROLE.'}`,
                        false,
                        12
                      )
                    ])
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  columnSpan: 2,
                  borders: cellBorders,
                })
              ]
            })
          ]
        }),

        new Paragraph({ spacing: { before: 100, after: 100 } }),

        // Second Table (ATB / Comorbidades / Dispositivos)
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                // Col 1: Metrics & Clinical info
                new TableCell({
                  children: [
                    makeCellParagraph([makeText('ATB: ', true, 14, '555555'), makeText(atbStr, false, 14, '000000')]),
                    makeCellParagraph([makeText('PRESSÃO ARTERIAL: ', true, 14, '555555'), makeText(paStr, false, 14, '000000')]),
                    makeCellParagraph([makeText('TEMPERATURA: ', true, 14, '555555'), makeText(tempStr, false, 14, '000000')]),
                    makeCellParagraph([makeText('BH: ', true, 14, '555555'), makeText(bhVal, false, 14, '000000')]),
                    makeCellParagraph([makeText('DIURESE: ', true, 14, '555555'), makeText(diureseVal, false, 14, '000000')]),
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                }),
                // Col 2: Comorbidades
                new TableCell({
                  children: [
                    makeCellParagraph([makeText('COMORBIDADES', true, 16)], AlignmentType.CENTER),
                    ...comorbidadesList.map(c => makeCellParagraph([makeText(`- ${c.toUpperCase()}`, false, 14)])),
                    ...(comorbidadesList.length === 0 ? [
                      makeCellParagraph([makeText('- HAS', false, 14)]),
                      makeCellParagraph([makeText('- DM', false, 14)]),
                      makeCellParagraph([makeText('- OBESIDADE', false, 14)])
                    ] : [])
                  ],
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                }),
                // Col 3: Dispositivos
                new TableCell({
                  children: [
                    makeCellParagraph([makeText('DISPOSITIVOS', true, 16)], AlignmentType.CENTER),
                    ...dispositivosList.map(d => makeCellParagraph([makeText(`- ${d.toUpperCase()}`, false, 14)])),
                    ...(dispositivosList.length === 0 ? [
                      makeCellParagraph([makeText('- AVP', false, 14)])
                    ] : [])
                  ],
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                })
              ]
            })
          ]
        }),

        new Paragraph({ spacing: { before: 200, after: 200 } }),

        // ADMISSÃO Text block
        new Paragraph({
          spacing: { before: 100, after: 100, line: 240 },
          alignment: "both",
          children: [
            makeText(textAdmissao, false, 18)
          ]
        }),

        new Paragraph({ spacing: { before: 100, after: 100 } }),

        // EVOLUÇÃO Text block
        new Paragraph({
          spacing: { before: 100, after: 100, line: 240 },
          alignment: "both",
          children: [
            makeText(textEvolucao, false, 18)
          ]
        }),

        new Paragraph({ spacing: { before: 200, after: 100 } }),

        // Page 2 or remaining details styled nicely
        new Paragraph({
          children: [makeText('# NEUROCHECK: ', true, 16), makeText(`ECG ${latestChecklist.checklistGlasgow || '15'} // PUPILAS = ${latestChecklist.checklistPup || 'ISOCÓRICAS E FOTORREATIVAS'} // RESPIRAÇÃO: ${latestChecklist.checklistResp || 'SEM ALTERAÇÕES'} // DÉFICIT FOCAL: ${patient.sintomasAdmissao || 'MANTÉM AFASIA/HEMIPLEGIA'}`, false, 14)],
          spacing: { before: 60, after: 60 }
        }),
        new Paragraph({
          children: [makeText('# SEDAÇÃO = ', true, 16), makeText(latestChecklist.checklistSedacao === 'Sim' ? (latestChecklist.checklistSedacaoText || 'ATIVA').toUpperCase() : 'AUSENTE', false, 14)],
          spacing: { before: 60, after: 60 }
        }),
        new Paragraph({
          children: [makeText('# ANALGESIA = ', true, 16), makeText(latestChecklist.checklistAnalgesia === 'Sim' ? (latestChecklist.checklistAnalgesiaText || 'DIPIRONA').toUpperCase() : 'AUSENTE', false, 14)],
          spacing: { before: 60, after: 60 }
        }),
        new Paragraph({
          children: [makeText('# DVA = ', true, 16), makeText(latestChecklist.checklistDva === 'Sim' ? (latestChecklist.checklistDvaText || 'ATIVA').toUpperCase() : 'AUSENTE', false, 14)],
          spacing: { before: 60, after: 60 }
        }),
        new Paragraph({
          children: [makeText('# VENTILAÇÃO = ', true, 16), makeText(latestChecklist.checklistVentilacao && latestChecklist.checklistVentilacao.length > 0 ? latestChecklist.checklistVentilacao.join(', ').toUpperCase() : 'ESPONTÂNEA EM AR AMBIENTE', false, 14)],
          spacing: { before: 60, after: 60 }
        }),

        new Paragraph({ spacing: { before: 120, after: 60 } }),

        new Paragraph({
          children: [makeText('# EXAMES:', true, 18)],
          spacing: { before: 100, after: 60 }
        }),
        new Paragraph({
          children: [makeText(`- ECG ${patient.ecgData || todayStr}: ${patient.ecgLaudo || 'SINUSAL'}`, false, 14)],
          indent: { left: 240 }
        }),

        new Paragraph({
          children: [makeText('# AVALIAÇÕES:', true, 18)],
          spacing: { before: 100, after: 60 }
        }),

        new Paragraph({
          children: [makeText('# CONDUTAS:', true, 18)],
          spacing: { before: 100, after: 60 }
        }),
        new Paragraph({
          children: [makeText('- VIGILÂNCIA NEUROLÓGICA / APLICAR NIHSS', false, 14)],
          indent: { left: 240 }
        }),
        new Paragraph({
          children: [makeText('- VIGILÂNCIA INFECCIOSA', false, 14)],
          indent: { left: 240 }
        }),
        new Paragraph({
          children: [makeText('- RECONCILIAÇÃO MEDICAMENTOSA', false, 14)],
          indent: { left: 240 }
        }),
        new Paragraph({
          children: [makeText('- MANTER DIETA CONFORME PRESCRIÇÃO', false, 14)],
          indent: { left: 240 }
        }),
        new Paragraph({
          children: [makeText(`- ${latestChecklist.checklistCondutas || 'DEMAIS CUIDADOS DE UTI'}`, false, 14)],
          indent: { left: 240 }
        }),

        new Paragraph({ spacing: { before: 400 } }),

        // Signature
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            makeText('__________________________________________\n', true, 16, '666666'),
            makeText(latestChecklist.checklistMedicoPlantonista ? `${latestChecklist.checklistMedicoPlantonista}` : 'MÉDICO PLANTONISTA - UTI AVC', true, 14, '444444')
          ]
        })
      ]
    }]
  });

  // Pack document to blob and download
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Evolucao_Medica_Leito_${patient.id}_${todayStr.replace(/\//g, '_')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
