/**
 * cancerMaps.ts
 *
 * Drug → cancer type and HCPCS → cancer type lookup tables.
 * Used to infer which cancer types a provider likely treats
 * based on their prescription history and procedure codes.
 *
 * Drug names match oncology_drug_prescribers.drug_name (uppercase).
 * HCPCS codes match oncology_provider_profiles.hcpcs_codes (string[]).
 */

// ─── Drug → Cancer Types ──────────────────────────────────────────────────────
// One entry per drug; merged at build time to handle multi-indication drugs.
const DRUG_ENTRIES: Array<[string, string[]]> = [
  // Breast
  ["TRASTUZUMAB",               ["Breast (HER2+)", "Gastric (HER2+)"]],
  ["PERTUZUMAB",                ["Breast (HER2+)"]],
  ["TRASTUZUMAB EMTANSINE",     ["Breast (HER2+)"]],
  ["TRASTUZUMAB DERUXTECAN",    ["Breast (HER2+)", "Lung"]],
  ["LAPATINIB",                 ["Breast (HER2+)"]],
  ["NERATINIB",                 ["Breast (HER2+)"]],
  ["TUCATINIB",                 ["Breast (HER2+)"]],
  ["PALBOCICLIB",               ["Breast (HR+)"]],
  ["RIBOCICLIB",                ["Breast (HR+)"]],
  ["ABEMACICLIB",               ["Breast (HR+)"]],
  ["EVEROLIMUS",                ["Breast (HR+)", "RCC", "PNET"]],
  ["EXEMESTANE",                ["Breast (HR+)"]],
  ["LETROZOLE",                 ["Breast (HR+)"]],
  ["ANASTROZOLE",               ["Breast (HR+)"]],
  ["TAMOXIFEN",                 ["Breast (HR+)"]],
  ["FULVESTRANT",               ["Breast (HR+)"]],
  ["ELACESTRANT",               ["Breast (HR+)"]],
  ["ALPELISIB",                 ["Breast (PIK3CA+)"]],
  ["CAPIVASERTIB",              ["Breast"]],
  ["ERIBULIN",                  ["Breast", "Sarcoma (Liposarcoma)"]],
  ["IXABEPILONE",               ["Breast"]],
  ["SACITUZUMAB GOVITECAN",     ["Breast (TNBC)", "Bladder"]],
  ["OLAPARIB",                  ["Breast (BRCA+)", "Ovarian", "Prostate (BRCA+)"]],
  ["TALAZOPARIB",               ["Breast (BRCA+)"]],

  // Lung
  ["ERLOTINIB",                 ["Lung (EGFR+)"]],
  ["GEFITINIB",                 ["Lung (EGFR+)"]],
  ["AFATINIB",                  ["Lung (EGFR+)"]],
  ["DACOMITINIB",               ["Lung (EGFR+)"]],
  ["OSIMERTINIB",               ["Lung (EGFR+)"]],
  ["CRIZOTINIB",                ["Lung (ALK+/ROS1+)"]],
  ["CERITINIB",                 ["Lung (ALK+)"]],
  ["ALECTINIB",                 ["Lung (ALK+)"]],
  ["BRIGATINIB",                ["Lung (ALK+)"]],
  ["LORLATINIB",                ["Lung (ALK+/ROS1+)"]],
  ["CAPMATINIB",                ["Lung (MET)"]],
  ["TEPOTINIB",                 ["Lung (MET)"]],
  ["MOBOCERTINIB",              ["Lung (EGFR exon 20)"]],
  ["AMIVANTAMAB",               ["Lung (EGFR exon 20)"]],
  ["ADAGRASIB",                 ["Lung (KRAS G12C)", "Colorectal (KRAS G12C)"]],
  ["SOTORASIB",                 ["Lung (KRAS G12C)"]],
  ["DURVALUMAB",                ["Lung", "Bladder", "HCC"]],
  ["ATEZOLIZUMAB",              ["Lung", "Breast (TNBC)", "Bladder", "HCC"]],
  ["RAMUCIRUMAB",               ["Lung", "Gastric", "HCC", "Colorectal"]],
  ["SELPERCATINIB",             ["Lung (RET+)", "Thyroid (RET+)"]],
  ["PRALSETINIB",               ["Lung (RET+)", "Thyroid (RET+)"]],

  // Colorectal
  ["OXALIPLATIN",               ["Colorectal", "Gastric"]],
  ["IRINOTECAN",                ["Colorectal", "Gastric"]],
  ["CETUXIMAB",                 ["Colorectal (RAS-WT)", "Head & Neck"]],
  ["PANITUMUMAB",               ["Colorectal (RAS-WT)"]],
  ["REGORAFENIB",               ["Colorectal", "GIST", "HCC"]],
  ["TRIFLURIDINE/TIPIRACIL",   ["Colorectal", "Gastric"]],
  ["ENCORAFENIB",               ["Colorectal (BRAF V600E)", "Melanoma (BRAF V600E)"]],
  ["FRUQUINTINIB",              ["Colorectal"]],

  // Multiple Myeloma
  ["BORTEZOMIB",                ["Multiple Myeloma", "Mantle Cell Lymphoma"]],
  ["CARFILZOMIB",               ["Multiple Myeloma"]],
  ["IXAZOMIB",                  ["Multiple Myeloma"]],
  ["LENALIDOMIDE",              ["Multiple Myeloma", "MDS", "Follicular Lymphoma"]],
  ["POMALIDOMIDE",              ["Multiple Myeloma"]],
  ["THALIDOMIDE",               ["Multiple Myeloma"]],
  ["DARATUMUMAB",               ["Multiple Myeloma"]],
  ["ISATUXIMAB",                ["Multiple Myeloma"]],
  ["ELOTUZUMAB",                ["Multiple Myeloma"]],
  ["PANOBINOSTAT",              ["Multiple Myeloma"]],
  ["SELINEXOR",                 ["Multiple Myeloma", "DLBCL"]],
  ["TECLISTAMAB",               ["Multiple Myeloma"]],
  ["CILTACABTAGENE AUTOLEUCEL", ["Multiple Myeloma"]],
  ["IDECABTAGENE VICLEUCEL",    ["Multiple Myeloma"]],

  // CLL / SLL
  ["IBRUTINIB",                 ["CLL/SLL", "Mantle Cell Lymphoma", "Waldenström Macroglobulinemia"]],
  ["ACALABRUTINIB",             ["CLL/SLL", "Mantle Cell Lymphoma"]],
  ["ZANUBRUTINIB",              ["CLL/SLL", "Mantle Cell Lymphoma", "Waldenström Macroglobulinemia"]],
  ["VENETOCLAX",                ["CLL/SLL", "AML"]],
  ["IDELALISIB",                ["CLL/SLL", "Follicular Lymphoma"]],
  ["DUVELISIB",                 ["CLL/SLL", "Follicular Lymphoma"]],
  ["OBINUTUZUMAB",              ["CLL/SLL", "Follicular Lymphoma"]],
  ["OFATUMUMAB",                ["CLL/SLL"]],

  // AML / MDS
  ["AZACITIDINE",               ["AML", "MDS"]],
  ["DECITABINE",                ["AML", "MDS"]],
  ["MIDOSTAURIN",               ["AML (FLT3+)"]],
  ["GILTERITINIB",              ["AML (FLT3+)"]],
  ["QUIZARTINIB",               ["AML (FLT3+)"]],
  ["ENASIDENIB",                ["AML (IDH2+)"]],
  ["IVOSIDENIB",                ["AML (IDH1+)", "Cholangiocarcinoma (IDH1+)"]],
  ["OLUTASIDENIB",              ["AML (IDH1+)"]],
  ["GLASDEGIB",                 ["AML"]],
  ["GEMTUZUMAB OZOGAMICIN",     ["AML (CD33+)"]],
  ["INOTUZUMAB OZOGAMICIN",     ["ALL"]],
  ["BLINATUMOMAB",              ["ALL", "ALL (Ph+)"]],
  ["TISAGENLECLEUCEL",          ["ALL", "DLBCL"]],
  ["LUSPATERCEPT",              ["MDS", "Beta-Thalassemia"]],

  // CML
  ["IMATINIB",                  ["CML", "GIST", "ALL (Ph+)"]],
  ["DASATINIB",                 ["CML", "ALL (Ph+)"]],
  ["NILOTINIB",                 ["CML"]],
  ["BOSUTINIB",                 ["CML"]],
  ["PONATINIB",                 ["CML", "ALL (Ph+)"]],
  ["ASCIMINIB",                 ["CML"]],

  // NHL / Lymphoma
  ["RITUXIMAB",                 ["NHL", "CLL/SLL"]],
  ["BRENTUXIMAB VEDOTIN",       ["Hodgkin Lymphoma", "ALCL"]],
  ["AXICABTAGENE CILOLEUCEL",   ["DLBCL", "Follicular Lymphoma"]],
  ["LISOCABTAGENE MARALEUCEL",  ["DLBCL"]],
  ["LONCASTUXIMAB TESIRINE",    ["DLBCL"]],
  ["EPCORITAMAB",               ["DLBCL"]],
  ["GLOFITAMAB",                ["DLBCL"]],
  ["MOSUNETUZUMAB",             ["Follicular Lymphoma"]],
  ["TAZEMETOSTAT",              ["Follicular Lymphoma (EZH2+)", "Epithelioid Sarcoma"]],
  ["COPANLISIB",                ["Follicular Lymphoma"]],
  ["UMBRALISIB",                ["CLL/SLL", "Marginal Zone Lymphoma"]],

  // Myeloproliferative
  ["RUXOLITINIB",               ["Myelofibrosis", "Polycythemia Vera"]],
  ["FEDRATINIB",                ["Myelofibrosis"]],
  ["PACRITINIB",                ["Myelofibrosis"]],
  ["MOMELOTINIB",               ["Myelofibrosis"]],

  // Checkpoint inhibitors (broad)
  ["PEMBROLIZUMAB",             ["NSCLC", "Melanoma", "Bladder", "Breast (TNBC)", "Cervical", "Endometrial (MSI-H)", "Colorectal (MSI-H)", "Head & Neck", "Gastric", "Hodgkin Lymphoma", "Any (TMB-H/MSI-H)"]],
  ["NIVOLUMAB",                 ["NSCLC", "Melanoma", "RCC", "HCC", "Gastric", "Colorectal (MSI-H)", "Hodgkin Lymphoma", "Bladder", "Any (TMB-H)"]],
  ["IPILIMUMAB",                ["Melanoma", "NSCLC", "RCC", "HCC", "Colorectal (MSI-H)"]],
  ["DOSTARLIMAB",               ["Endometrial (MSI-H)", "Colorectal (MSI-H)", "Any (MSI-H)"]],
  ["CEMIPLIMAB",                ["Cutaneous SCC", "Basal Cell Carcinoma", "NSCLC", "Cervical"]],
  ["AVELUMAB",                  ["Bladder", "Merkel Cell Carcinoma"]],
  ["BEVACIZUMAB",               ["Colorectal", "Lung", "Ovarian", "Cervical", "Brain (GBM)", "HCC"]],

  // Prostate
  ["ENZALUTAMIDE",              ["Prostate"]],
  ["ABIRATERONE",               ["Prostate"]],
  ["APALUTAMIDE",               ["Prostate"]],
  ["DAROLUTAMIDE",              ["Prostate"]],
  ["DOCETAXEL",                 ["Prostate", "Lung", "Breast", "Gastric"]],
  ["CABAZITAXEL",               ["Prostate"]],
  ["SIPULEUCEL-T",              ["Prostate"]],
  ["RADIUM-223 DICHLORIDE",     ["Prostate (bone mets)"]],
  ["LUTETIUM LU 177 VIPIVOTIDE",["Prostate (PSMA+)"]],
  ["RUCAPARIB",                 ["Prostate (BRCA+)", "Ovarian"]],
  ["NIRAPARIB",                 ["Ovarian", "Prostate (BRCA+)"]],

  // Ovarian / GYN
  ["MIRVETUXIMAB SORAVTANSINE", ["Ovarian (FRα+)"]],
  ["LENVATINIB",                ["Endometrial", "HCC", "RCC", "Thyroid (DTC)"]],

  // Melanoma / Skin
  ["VEMURAFENIB",               ["Melanoma (BRAF V600E)"]],
  ["DABRAFENIB",                ["Melanoma (BRAF V600E)", "Lung (BRAF)", "Thyroid (BRAF V600E)", "Any (BRAF V600E)"]],
  ["TRAMETINIB",                ["Melanoma (BRAF V600)", "Lung (BRAF)", "Thyroid (BRAF)", "Any (BRAF V600)"]],
  ["COBIMETINIB",               ["Melanoma (BRAF V600E)"]],
  ["BINIMETINIB",               ["Melanoma (BRAF V600E)", "NSCLC (BRAF)"]],
  ["VISMODEGIB",                ["Basal Cell Carcinoma"]],
  ["SONIDEGIB",                 ["Basal Cell Carcinoma"]],

  // RCC / Bladder
  ["SUNITINIB",                 ["RCC", "GIST", "PNET"]],
  ["PAZOPANIB",                 ["RCC", "Sarcoma"]],
  ["CABOZANTINIB",              ["RCC", "HCC", "Thyroid (MTC)"]],
  ["AXITINIB",                  ["RCC"]],
  ["SORAFENIB",                 ["RCC", "HCC", "Thyroid (DTC)"]],
  ["TIVOZANIB",                 ["RCC"]],
  ["BELZUTIFAN",                ["RCC (VHL)", "HCC"]],
  ["ENFORTUMAB VEDOTIN",        ["Bladder"]],
  ["ERDAFITINIB",               ["Bladder (FGFR+)"]],

  // HCC / GI
  ["REGORAFENIB",               ["HCC", "Colorectal", "GIST"]],
  ["PEMIGATINIB",               ["Cholangiocarcinoma (FGFR2+)"]],
  ["INFIGRATINIB",              ["Cholangiocarcinoma (FGFR2+)"]],
  ["FUTIBATINIB",               ["Cholangiocarcinoma (FGFR2+)"]],
  ["GEMCITABINE",               ["Pancreatic", "Bladder", "Lung", "Breast"]],
  ["NAB-PACLITAXEL",            ["Pancreatic", "Breast", "Lung"]],
  ["PACLITAXEL",                ["Ovarian", "Breast", "Lung", "Gastric"]],
  ["CARBOPLATIN",               ["Ovarian", "Lung", "Breast", "Head & Neck"]],
  ["CISPLATIN",                 ["Bladder", "Lung", "Head & Neck", "Ovarian", "Gastric", "Esophageal"]],
  ["CAPECITABINE",              ["Breast", "Colorectal", "Gastric"]],

  // Thyroid
  ["VANDETANIB",                ["Thyroid (MTC)"]],

  // Brain
  ["TEMOZOLOMIDE",              ["Brain (GBM)", "Brain (Glioma)"]],
  ["VORASIDENIB",               ["Brain (Glioma IDH+)"]],
  ["LOMUSTINE",                 ["Brain (GBM)", "Hodgkin Lymphoma"]],

  // Head & Neck
  ["NIVOLUMAB",                 ["Head & Neck", "NSCLC", "Melanoma", "RCC", "HCC", "Gastric", "Colorectal (MSI-H)", "Hodgkin Lymphoma", "Bladder"]],

  // Sarcoma / GIST
  ["TRABECTEDIN",               ["Sarcoma"]],

  // Tumor-agnostic
  ["LAROTRECTINIB",             ["Any (TRK Fusion+)"]],
  ["ENTRECTINIB",               ["Any (TRK/ROS1 Fusion+)"]],
  ["PEMBROLIZUMAB",             ["Any (TMB-H/MSI-H)"]],

  // General cytotoxics
  ["CYCLOPHOSPHAMIDE",          ["Breast", "NHL", "CLL/SLL", "Multiple Myeloma", "Ovarian"]],
  ["DOXORUBICIN",               ["Breast", "NHL", "Sarcoma", "AML"]],
  ["VINCRISTINE",               ["ALL", "NHL", "Multiple Myeloma"]],
  ["METHOTREXATE",              ["ALL", "NHL", "Breast", "Head & Neck"]],
  ["CYTARABINE",                ["AML", "ALL", "NHL"]],
  ["FLUDARABINE",               ["CLL/SLL", "NHL"]],
  ["BENDAMUSTINE",              ["CLL/SLL", "NHL"]],
  ["CHLORAMBUCIL",              ["CLL/SLL", "NHL"]],
];

// Build map, merging duplicate drug entries
export const DRUG_CANCER_MAP: Record<string, string[]> = {};
for (const [drug, cancers] of DRUG_ENTRIES) {
  const key = drug.toUpperCase();
  if (DRUG_CANCER_MAP[key]) {
    DRUG_CANCER_MAP[key] = [...new Set([...DRUG_CANCER_MAP[key], ...cancers])];
  } else {
    DRUG_CANCER_MAP[key] = cancers;
  }
}

// ─── HCPCS → Cancer Types ─────────────────────────────────────────────────────
// Maps specific procedure codes to likely cancer types
export const HCPCS_CANCER_MAP: Record<string, string[]> = {
  // Flow cytometry — hematologic malignancies
  "88184": ["Leukemia", "Lymphoma", "Multiple Myeloma"],
  "88185": ["Leukemia", "Lymphoma", "Multiple Myeloma"],
  "88187": ["Leukemia", "Lymphoma"],
  "88188": ["Leukemia", "Lymphoma"],
  "88189": ["Leukemia", "Lymphoma"],

  // Bone marrow procedures — hematologic
  "85102": ["Leukemia", "Lymphoma", "Multiple Myeloma", "MDS"],
  "85097": ["Leukemia", "Lymphoma", "Multiple Myeloma", "MDS"],
  "38220": ["Leukemia", "Lymphoma", "Multiple Myeloma", "MDS"],
  "38221": ["Leukemia", "Lymphoma", "Multiple Myeloma", "MDS"],
  "38222": ["Leukemia", "Lymphoma", "Multiple Myeloma", "MDS"],
  "38230": ["Leukemia", "Multiple Myeloma"],
  "38232": ["Leukemia", "Multiple Myeloma"],
  "38240": ["Leukemia", "Lymphoma", "Multiple Myeloma"],
  "38241": ["Leukemia", "Lymphoma", "Multiple Myeloma"],
  "38242": ["Leukemia", "Lymphoma", "Multiple Myeloma"],

  // IHC / tumor markers
  "88342": ["Breast", "Lung", "Colorectal", "Lymphoma"],
  "88360": ["Breast (HER2/ER/PR)", "Lung"],
  "88361": ["Breast (HER2/ER/PR)", "Lung"],
  "88365": ["Breast (HER2)", "Lung (ALK/ROS1)"],
  "88366": ["Breast", "Lung"],

  // Breast procedures
  "19081": ["Breast"], "19082": ["Breast"], "19083": ["Breast"],
  "19084": ["Breast"], "19085": ["Breast"], "19086": ["Breast"],
  "19100": ["Breast"], "19101": ["Breast"], "19120": ["Breast"],
  "19125": ["Breast"], "19126": ["Breast"],
  "19301": ["Breast"], "19302": ["Breast"], "19303": ["Breast"],
  "19304": ["Breast"], "19305": ["Breast"], "19306": ["Breast"],
  "19307": ["Breast"], "19340": ["Breast"], "19342": ["Breast"],

  // Colorectal procedures
  "44140": ["Colorectal"], "44141": ["Colorectal"], "44143": ["Colorectal"],
  "44144": ["Colorectal"], "44145": ["Colorectal"], "44146": ["Colorectal"],
  "44147": ["Colorectal"], "44150": ["Colorectal"], "44151": ["Colorectal"],
  "44155": ["Colorectal"], "44156": ["Colorectal"], "44157": ["Colorectal"],
  "44158": ["Colorectal"], "44160": ["Colorectal"],
  "44204": ["Colorectal"], "44205": ["Colorectal"], "44206": ["Colorectal"],
  "44207": ["Colorectal"], "44208": ["Colorectal"],
  "44210": ["Colorectal"], "44211": ["Colorectal"], "44212": ["Colorectal"],

  // Prostate procedures
  "55810": ["Prostate"], "55812": ["Prostate"], "55815": ["Prostate"],
  "55840": ["Prostate"], "55842": ["Prostate"], "55845": ["Prostate"],
  "55866": ["Prostate"], "55875": ["Prostate (brachytherapy)"],

  // Renal procedures
  "50200": ["RCC"], "50220": ["RCC"], "50225": ["RCC"],
  "50230": ["RCC"], "50240": ["RCC"],
  "50543": ["RCC"], "50545": ["RCC"], "50546": ["RCC"],

  // GYN procedures
  "58150": ["Endometrial", "Ovarian", "Cervical"],
  "58180": ["Endometrial"], "58200": ["Endometrial", "Ovarian"],
  "58210": ["Ovarian", "Endometrial"], "58240": ["Ovarian"],
  "58550": ["Endometrial"], "58552": ["Endometrial"],
  "58553": ["Endometrial"], "58554": ["Endometrial"],
  "58900": ["Ovarian"], "58920": ["Ovarian"], "58925": ["Ovarian"],
  "58940": ["Ovarian"], "58943": ["Ovarian"],
  "58950": ["Ovarian"], "58951": ["Ovarian"], "58952": ["Ovarian"],
  "58953": ["Ovarian"], "58954": ["Ovarian"], "58956": ["Ovarian"],
  "58957": ["Ovarian"], "58958": ["Ovarian"],
  "57531": ["Cervical"], "57540": ["Cervical"],

  // Lung / thoracic procedures
  "32480": ["Lung"], "32482": ["Lung"], "32484": ["Lung"],
  "32486": ["Lung"], "32488": ["Lung"], "32491": ["Lung"],
  "32503": ["Lung"], "32504": ["Lung"], "32505": ["Lung"],
  "32663": ["Lung"], "32666": ["Lung"], "32667": ["Lung"],
  "32668": ["Lung"], "32669": ["Lung"], "32670": ["Lung"],
  "32671": ["Lung"], "32672": ["Lung"], "32673": ["Lung"],

  // Hepatic procedures
  "47120": ["HCC", "Liver Metastases"], "47122": ["HCC", "Liver Metastases"],
  "47125": ["HCC", "Liver Metastases"], "47130": ["HCC", "Liver Metastases"],
  "47370": ["HCC"], "47371": ["HCC"], "47380": ["HCC"],
  "47381": ["HCC"], "47382": ["HCC"],

  // Pancreatic procedures
  "48150": ["Pancreatic"], "48152": ["Pancreatic"], "48153": ["Pancreatic"],
  "48154": ["Pancreatic"], "48155": ["Pancreatic"],
  "48500": ["Pancreatic"], "48510": ["Pancreatic"], "48520": ["Pancreatic"],
  "48540": ["Pancreatic"], "48545": ["Pancreatic"],

  // Esophageal / gastric
  "43117": ["Esophageal"], "43118": ["Esophageal"],
  "43121": ["Esophageal"], "43122": ["Esophageal"],
  "43123": ["Esophageal"], "43124": ["Esophageal"],
  "43210": ["Gastric"],

  // Lymph node procedures — lymphoma / metastatic
  "38500": ["Lymphoma", "Metastatic Disease"], "38505": ["Lymphoma", "Metastatic Disease"],
  "38510": ["Lymphoma", "Metastatic Disease"], "38520": ["Lymphoma", "Metastatic Disease"],
  "38525": ["Lymphoma", "Metastatic Disease"], "38530": ["Lymphoma", "Metastatic Disease"],
  "38740": ["Breast", "Melanoma"], "38745": ["Breast"],
  "38760": ["Breast"], "38765": ["Breast"],
  "38770": ["Prostate", "Bladder"], "38780": ["Colorectal", "Prostate"],

  // Thyroid
  "60240": ["Thyroid"], "60252": ["Thyroid"], "60254": ["Thyroid"],
  "60260": ["Thyroid"], "60270": ["Thyroid"], "60271": ["Thyroid"],

  // SBRT / SRS
  "77371": ["Brain (SRS)", "Lung (SBRT)", "Spine"],
  "77372": ["Brain (SRS)"],
  "77373": ["Lung (SBRT)", "Spine (SBRT)"],

  // PET imaging — general oncology
  "78814": ["Lung", "Colorectal", "Lymphoma"],
  "78815": ["Lung", "Colorectal", "Lymphoma"],
  "78816": ["Lung", "Colorectal", "Lymphoma"],

  // Nuclear medicine
  "79005": ["Thyroid"], "79101": ["Thyroid"],
  "79200": ["Thyroid", "Bone Metastases"],
  "79300": ["Lymphoma"],

  // Chemo administration — label as "Chemotherapy" (generic, deduped if specific found)
  "96401": ["Chemotherapy"], "96402": ["Chemotherapy"],
  "96409": ["Chemotherapy"], "96411": ["Chemotherapy"],
  "96413": ["Chemotherapy"], "96415": ["Chemotherapy"],
  "96416": ["Chemotherapy"], "96417": ["Chemotherapy"],
  "96420": ["Chemotherapy"], "96422": ["Chemotherapy"],
  "96423": ["Chemotherapy"], "96425": ["Chemotherapy"],
  "96440": ["Chemotherapy"], "96446": ["Chemotherapy"],
  "96450": ["Chemotherapy (CNS)"],
  "96521": ["Chemotherapy"], "96522": ["Chemotherapy"],
  "96523": ["Chemotherapy"], "96542": ["Chemotherapy"],
  "96549": ["Chemotherapy"],
};

// ─── Main inference functions ─────────────────────────────────────────────────

/**
 * Infer cancer types for a provider from their drug list and HCPCS codes.
 * Returns a deduplicated, sorted array of cancer type strings.
 * Generic labels ("Chemotherapy") are removed when specific types are present.
 */
export function inferCancerTypes(drugs: string[], hcpcsCodes: string[]): string[] {
  const types = new Set<string>();

  for (const drug of (drugs || [])) {
    const cancers = DRUG_CANCER_MAP[(drug || "").toUpperCase()];
    if (cancers) cancers.forEach(c => types.add(c));
  }

  for (const code of (hcpcsCodes || [])) {
    const cancers = HCPCS_CANCER_MAP[code];
    if (cancers) cancers.forEach(c => types.add(c));
  }

  // Remove generic fallback labels when specific cancer types are present
  if (types.size > 1) {
    types.delete("Chemotherapy");
    types.delete("Chemotherapy (CNS)");
  }

  return [...types].sort();
}

/**
 * Infer cancer types with tentative treatment years.
 * Accepts year-annotated drug and HCPCS records to produce
 * { type: string; years: number[] }[] — e.g. "CLL/SLL (2022, 2023)".
 */
export function inferCancerTypesWithYears(
  drugRecords: Array<{ drug: string; year: number }>,
  hcpcsRecords: Array<{ code: string; year: number }>
): Array<{ type: string; years: number[]; drugCount: number }> {
  const typeYears = new Map<string, Set<number>>();
  // Track unique drug names per cancer type (not rows — same drug in 2 years = 1)
  const typeDrugs = new Map<string, Set<string>>();
  // Track unique HCPCS codes per cancer type
  const typeHcpcs = new Map<string, Set<string>>();

  for (const { drug, year } of (drugRecords || [])) {
    const upper = (drug || "").toUpperCase();
    const cancers = DRUG_CANCER_MAP[upper];
    if (cancers) {
      for (const c of cancers) {
        if (!typeYears.has(c)) typeYears.set(c, new Set());
        typeYears.get(c)!.add(year);
        if (!typeDrugs.has(c)) typeDrugs.set(c, new Set());
        typeDrugs.get(c)!.add(upper);
      }
    }
  }

  for (const { code, year } of (hcpcsRecords || [])) {
    const cancers = HCPCS_CANCER_MAP[code];
    if (cancers) {
      for (const c of cancers) {
        if (!typeYears.has(c)) typeYears.set(c, new Set());
        typeYears.get(c)!.add(year);
        if (!typeHcpcs.has(c)) typeHcpcs.set(c, new Set());
        typeHcpcs.get(c)!.add(code);
      }
    }
  }

  // Remove generic fallbacks when specific types are present
  if (typeYears.size > 1) {
    typeYears.delete("Chemotherapy");
    typeYears.delete("Chemotherapy (CNS)");
    typeDrugs.delete("Chemotherapy");
    typeDrugs.delete("Chemotherapy (CNS)");
  }

  return [...typeYears.entries()]
    .map(([type, years]) => ({
      type,
      years: [...years].sort((a, b) => a - b),
      // drugCount = unique drugs + 0.5 per unique supporting HCPCS code, floored
      drugCount: (typeDrugs.get(type)?.size || 0) + Math.floor((typeHcpcs.get(type)?.size || 0) * 0.5)
    }))
    // Sort primary: drug count descending. Tie-break: alphabetical.
    .sort((a, b) => b.drugCount - a.drugCount || a.type.localeCompare(b.type));
}
