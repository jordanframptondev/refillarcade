import PeptidePanic from './PeptidePanic.jsx'
import GainsRun from './GainsRun.jsx'
import ScriptSorter from './ScriptSorter.jsx'
import PerfectDose from './PerfectDose.jsx'
import SymptomSmack from './SymptomSmack.jsx'
import PeptideOrPretend from './PeptideOrPretend.jsx'
import VialPairs from './VialPairs.jsx'
import MergeLab from './MergeLab.jsx'
import { GAME_LIST } from './meta.js'

const COMPONENTS = {
  'peptide-panic': PeptidePanic,
  'gains-run': GainsRun,
  'script-sorter': ScriptSorter,
  'perfect-dose': PerfectDose,
  'symptom-smack': SymptomSmack,
  'peptide-or-pretend': PeptideOrPretend,
  'vial-pairs': VialPairs,
  'merge-lab': MergeLab,
}

export const GAMES = GAME_LIST.map((g) => ({ ...g, Component: COMPONENTS[g.id] }))
