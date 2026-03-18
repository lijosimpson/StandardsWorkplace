export type ThresholdType = "equal" | "gtePercent" | "gteCount";
export type DenominatorMode = "fixed" | "editable";
export type AccreditationFramework = "CoC" | "NAPBC" | "NCPRC" | "NQF" | "ASCO" | "ASTRO" | "ACR" | "Other";

export interface StandardDefinition {
  code: string;
  name: string;
  category: string;
  framework: AccreditationFramework;
  description: string;
  referenceNote: string;
  hospitalProcess: string[];
  numeratorComponents: string[];
  denominator: {
    mode: DenominatorMode;
    defaultValue: number;
    label: string;
  };
  threshold: {
    type: ThresholdType;
    value: number;
    label: string;
  };
  retired?: boolean;
}

const normalizeHospitalProcess = (numeratorComponents: string[], hospitalProcess: string[]): string[] => {
  if (hospitalProcess.length === numeratorComponents.length) {
    return hospitalProcess;
  }

  return numeratorComponents.map((component, index) => {
    const cleaned = component.replace(/\s+/g, " ").trim();
    return `Track, document, and store evidence for metric ${index + 1}: ${cleaned}`;
  });
};

const committeeRoleLabels = [
  "Chairperson",
  "Cancer Liaison Physician (CLP)",
  "Diagnostic Radiologist",
  "Pathologist",
  "Surgeon",
  "Medical Oncologist",
  "Radiation Oncologist",
  "Cancer Program Administrator",
  "Oncology Nurse",
  "Oncology Social Worker",
  "Oncology Data Specialist (ODS)",
  "Conference Coordinator",
  "Quality Improvement Coordinator",
  "Registry Quality Coordinator",
  "Clinical Research Coordinator",
  "Psychosocial Services Coordinator",
  "Survivorship Coordinator"
];

export const standardRoleLists: Record<string, string[]> = {
  "2.1": committeeRoleLabels
};

const manualHospitalProcessByCode: Record<string, string[]> = {
  "2.1": committeeRoleLabels.map((roleLabel) =>
    `Verify ${roleLabel} coverage and store the current appointment and credential record.`
  ),
  "2.2": [
    "Document the first CLP NCDB presentation with the meeting date, agenda, and minutes.",
    "Document the second CLP NCDB presentation at a different committee meeting date."
  ],
  "2.3": [
    "Document one qualifying Q1 committee meeting with attendance and quality discussion in the minutes.",
    "Document one qualifying Q2 committee meeting with attendance and quality discussion in the minutes.",
    "Document one qualifying Q3 committee meeting with attendance and quality discussion in the minutes.",
    "Document one qualifying Q4 committee meeting with attendance and quality discussion in the minutes."
  ],
  "2.4": [
    "Track attendance for every required committee role or designated alternate across all cancer committee meetings and store the annual attendance summary."
  ],
  "2.5": [
    "Maintain a multidisciplinary case conference protocol that captures all required conference elements.",
    "Have the Cancer Conference Coordinator monitor and evaluate the conference process and document the required annual report in the cancer committee minutes."
  ],
  "3.1": [
    "Verify the current facility operating license is on file and store the active license document.",
    "Verify all required clinical service accreditation certificates are current and store the active certificates."
  ],
  "4.1": [
    "Verify every physician involved in cancer care holds current medical staff credentials and store the credentialing summary or attestation."
  ],
  "4.2": [
    "Document the annual review of oncology nursing continuing education and clinical competency in the cancer committee meeting minutes.",
    "Maintain a protocol that ensures the facility reviews and assesses oncology nursing continuing education and clinical competency.",
    "Review the oncology nursing education and competency protocol once each accreditation cycle and record that review in the meeting minutes."
  ],
  "4.3": [
    "Verify each Oncology Data Specialist holds a current approved credential and store credential evidence or attestation."
  ],
  "4.4": [
    "Provide cancer risk assessment, genetic counseling, and genetic testing services on-site or by referral through a qualified genetics professional.",
    "Maintain a protocol for genetic counseling and risk-assessment services that contains all required elements.",
    "Maintain a process based on evidence-based national guidance for genetic assessment for a selected cancer site that includes all required elements.",
    "Document the annual genetic counseling and risk assessment report with all required elements in the cancer committee meeting minutes."
  ],
  "4.5": [
    "Provide palliative care services to patients with cancer on-site or by referral.",
    "Maintain a protocol for palliative care services that includes all required elements.",
    "Monitor and evaluate the process for providing or referring palliative care services and document the required annual review in the cancer committee meeting minutes."
  ],
  "4.6": [
    "Develop cancer committee protocols that guide referral to appropriate rehabilitation care services on-site or by referral.",
    "Monitor and evaluate the process for referring or providing rehabilitation care services and document the annual review in the cancer committee meeting minutes."
  ],
  "4.7": [
    "Provide oncology nutrition services on-site or by referral through a Registered Dietitian Nutritionist.",
    "Monitor and evaluate the process for referring or providing oncology nutrition services and document the annual review in the cancer committee meeting minutes."
  ],
  "4.8": [
    "Identify the survivorship program team, including the designated coordinator and team members.",
    "Monitor and evaluate the survivorship program and document the coordinator's required annual review in the cancer committee meeting minutes."
  ],
  "5.1": [
    "Complete the CAP synoptic pathology audit, document whether all required core elements are present, and store the audit worksheet and summary."
  ],
  "5.2": [
    "Maintain protocols that provide patient access to psychosocial services on-site or by referral.",
    "Implement a protocol that includes all required elements for providing and monitoring psychosocial distress screening and referral for psychosocial care.",
    "Screen cancer patients for psychosocial distress at least once during the first course of treatment.",
    "Evaluate the psychosocial distress screening process and document the Psychosocial Services Coordinator's required annual review in the cancer committee meeting minutes."
  ],
  "5.3": [
    "Complete the sentinel node biopsy operative report audit, document inclusion of all required elements, and store the audit worksheet and summary."
  ],
  "5.4": [
    "Complete the axillary lymph node dissection operative report audit, document inclusion of all required elements, and store the audit worksheet and summary."
  ],
  "5.5": [
    "Complete the wide local excision melanoma operative report audit, document inclusion of all required elements, and store the audit worksheet and summary."
  ],
  "5.6": [
    "Complete the colon resection operative report audit, document inclusion of all required elements, and store the audit worksheet and summary."
  ],
  "5.7": [
    "Complete the total mesorectal excision operative report audit, document inclusion of all required elements, and store the audit worksheet and summary."
  ],
  "5.8": [
    "Complete the pulmonary resection operative report audit, document inclusion of all required elements, and store the audit worksheet and summary."
  ],
  "5.9": [
    "Track and store the tobacco use screening rate for eligible patients with cancer at initial oncology consultation.",
    "Track and store the cessation counseling or referral rate for patients identified as current tobacco users."
  ],
  "6.2": [
    "Confirm this retired standard remains Not Applicable and retain the system note or admin verification."
  ],
  "6.3": [
    "Confirm this retired standard remains Not Applicable and retain the system note or admin verification."
  ],
  "6.4": [
    "Submit RCRS cases within the required timeframe and store submission confirmations.",
    "Present the first RCRS compliance report to the cancer committee and store agenda or minutes evidence.",
    "Present the second RCRS compliance report at a different committee meeting and store agenda or minutes evidence."
  ],
  "6.5": [
    "Update follow-up status for the analytic caseload, document contact attempts and outcomes, and store the follow-up rate report."
  ],
  "7.1": [
    "Collect, benchmark, and document performance data for required quality measure 1.",
    "Collect, benchmark, and document performance data for required quality measure 2.",
    "Collect, benchmark, and document performance data for required quality measure 3.",
    "Collect, benchmark, and document performance data for required quality measure 4.",
    "Collect, benchmark, and document performance data for required quality measure 5.",
    "Collect, benchmark, and document performance data for required quality measure 6."
  ],
  "7.3": [
    "Establish baseline data for the quality improvement initiative and store the first committee update.",
    "Measure mid-cycle progress for the quality improvement initiative and store the second committee update.",
    "Complete the final quality improvement report with outcomes and sustainability plan and store the evidence."
  ],
  "7.4": [
    "Define the annual cancer program goal with a measurable target and store the first committee update.",
    "Measure mid-cycle progress toward the cancer program goal and store the committee update.",
    "Complete the final cancer program goal report with outcome or gap analysis and store the evidence."
  ],
  "9.1": [
    "Maintain a screening protocol that identifies participant eligibility for clinical research studies, explains how trial information is shared with subjects, and documents how barriers to enrollment are assessed and addressed.",
    "Track annual accrual to cancer-related clinical research studies and confirm performance meets or exceeds the required percentage.",
    "Have the Clinical Research Coordinator present the annual clinical research activity report to the cancer committee and document the required report elements in the meeting minutes."
  ],
  "9.2": [
    "Document participation in each required special study and store supporting evidence.",
    "Document complete data and supporting submissions for each special study by the established deadline."
  ],
  "9.3": [
    "Identify and document all category-specific requirement variations that apply to the program.",
    "Confirm and document that category-specific standard modifications were applied across relevant standards.",
    "Review the CoC glossary with staff and store evidence that terminology aligns with the definitions used by the program."
  ]
};

const make = (
  code: string,
  name: string,
  category: string,
  numeratorComponents: string[],
  denominator: StandardDefinition["denominator"],
  threshold: StandardDefinition["threshold"],
  description: string,
  hospitalProcess: string[],
  retired = false
): StandardDefinition => ({
  code,
  name,
  category,
  framework: "CoC",
  numeratorComponents,
  denominator,
  threshold,
  description,
  hospitalProcess: manualHospitalProcessByCode[code] || normalizeHospitalProcess(numeratorComponents, hospitalProcess),
  retired,
  referenceNote: `Refer to Section ${code} in your licensed copy of Optimal Resources for Cancer Care (2020 Standards, Updated Oct 2025) for the complete definition, documentation requirements, and measure of compliance.`
});

//  1. Institutional Administrative Commitment 

export const standards: StandardDefinition[] = [
  make(
    "1.1",
    "Administrative Commitment",
    "Governance",
    [
      "Cancer program described: services, patient volume, program specialties, and care settings",
      "Cancer committee quality and patient safety initiatives from the prior year summarized",
      "Facility leadership (e.g., CEO, board, or executive sponsor) involvement in the cancer program documented",
      "Health equity, inclusion, or patient safety initiative(s) supported by leadership identified",
      "Financial investment or resource allocation supporting the cancer program demonstrated"
    ],
    { mode: "fixed", defaultValue: 5, label: "Required letter elements" },
    { type: "equal", value: 5, label: "All 5 elements required" },
    "An annual leadership letter signed by a facility executive must include all five required elements demonstrating institutional commitment to the cancer program.",
    [
      "Draft annual letter template with five required sections",
      "Gather prior-year committee initiative summaries",
      "Obtain executive signature and evidence of leadership involvement",
      "Document equity/safety initiative and financial support examples",
      "Upload signed letter and submit for admin lock"
    ]
  ),

  //  2. Program Scope and Governance 

  make(
    "2.1",
    "Cancer Committee",
    "Committee",
    committeeRoleLabels.map((roleLabel) => `${roleLabel} appointed and documented`),
    { mode: "fixed", defaultValue: 17, label: "Required committee roles" },
    { type: "equal", value: 17, label: "All 17 roles must be filled and documented" },
    "Maintain all 17 required committee roles with named appointees and current supporting documentation.",
    [
      "Maintain current roster with appointment dates and credentials",
      "Identify and fill any vacant roles",
      "Upload updated roster and appointment letters",
      "Cross-check against 2.4 attendance tracking",
      "Submit for admin lock"
    ]
  ),

  make(
    "2.2",
    "Cancer Liaison Physician",
    "Committee",
    [
      "First CLP or designated alternate NCDB presentation documented with agenda, minutes, and meeting date",
      "Second CLP or designated alternate NCDB presentation documented at a different committee meeting date"
    ],
    { mode: "fixed", defaultValue: 2, label: "Required distinct NCDB presentations" },
    { type: "gteCount", value: 2, label: "At least 2 presentations at distinct meetings per calendar year" },
    "Document two separate cancer committee meetings each year where the CLP or designated alternate presents NCDB data.",
    [
      "Confirm the CLP or designated alternate is credentialed and active",
      "Schedule two separate NCDB presentation slots across the year",
      "Upload minutes and agenda confirming each presentation date",
      "Verify the two meetings are on distinct dates",
      "Submit for admin lock"
    ]
  ),

  make(
    "2.3",
    "Cancer Committee Meetings",
    "Committee",
    [
      "Q1 meeting completed and minutes capture attendance and quality discussion",
      "Q2 meeting completed and minutes capture attendance and quality discussion",
      "Q3 meeting completed and minutes capture attendance and quality discussion",
      "Q4 meeting completed and minutes capture attendance and quality discussion"
    ],
    { mode: "fixed", defaultValue: 4, label: "Calendar quarters with a qualifying meeting" },
    { type: "equal", value: 4, label: "One qualifying meeting required in each of the 4 quarters" },
    "Hold one qualifying cancer committee meeting in each quarter and make sure the minutes capture attendance and quality discussion.",
    [
      "Schedule committee meetings for all four quarters",
      "Capture attendance and quality discussion in minutes",
      "Upload signed minutes for each quarterly meeting",
      "Verify minutes contain compliant quality content",
      "Submit for admin lock"
    ]
  ),

  make(
    "2.4",
    "Cancer Committee Attendance",
    "Committee",
    [
      "Attendance of required roles and designated alternates tracked for all meetings held in the year"
    ],
    { mode: "editable", defaultValue: 4, label: "Total cancer committee meetings held in the reporting year" },
    { type: "gtePercent", value: 75, label: "Required roles/alternates must attend 75% of meetings" },
    "Required committee roles (or their designated alternates) must attend at least 75% of cancer committee meetings held in the reporting year.",
    [
      "Compile attendance logs from all quarterly meetings",
      "Record alternates and validate against the designated alternate list",
      "Calculate attendance percentage per required role",
      "Flag any role below 75% and document mitigation",
      "Submit for admin lock"
    ]
  ),

  make(
    "2.5",
    "Multidisciplinary Cancer Case Conference",
    "Committee",
    [
      "A multidisciplinary case conference protocol is in place and covers all required conference elements.",
      "The Cancer Conference Coordinator monitors and evaluates the case conference process and documents the required annual report in the cancer committee minutes."
    ],
    { mode: "fixed", defaultValue: 2, label: "Required case conference compliance criteria" },
    { type: "equal", value: 2, label: "Both case conference criteria must be met" },
    "The cancer program must maintain a compliant multidisciplinary cancer case conference protocol and document the Cancer Conference Coordinator's required annual report to the cancer committee.",
    [
      "Maintain the multidisciplinary cancer case conference protocol with all required elements",
      "Review the conference workflow to confirm required information is captured consistently",
      "Monitor and evaluate case conference activity through the Cancer Conference Coordinator",
      "Prepare the Cancer Conference Coordinator's annual report with all required elements",
      "Document the report in the cancer committee minutes and submit for admin lock"
    ]
  ),

  //  3. Facilities and Equipment Resources 

  make(
    "3.1",
    "Facility Accreditation",
    "Facility",
    [
      "Current facility operating license (state or applicable regulatory authority) on file",
      "Current accreditation certificates for applicable clinical services (e.g., radiation therapy, surgery, laboratory) on file"
    ],
    { mode: "editable", defaultValue: 2, label: "Total required licenses and accreditations" },
    { type: "gtePercent", value: 100, label: "All required licenses/accreditations must be current" },
    "All facility operating licenses and applicable service accreditations must be current and on file.",
    [
      "Compile list of required licenses and accreditations for your facility category",
      "Verify current expiry dates for each",
      "Initiate renewals for any expiring within 90 days",
      "Upload current certificates",
      "Submit for admin lock"
    ]
  ),

  make(
    "3.2",
    "Evaluation and Treatment Services",
    "Facility",
    [
      "Diagnostic imaging services available (CT, MRI, PET, nuclear medicine) on-site or through a documented referral arrangement",
      "Radiation oncology treatment services available on-site or through a documented referral arrangement",
      "Systemic therapy (chemotherapy/immunotherapy/targeted therapy) administration available on-site or through a documented referral arrangement",
      "Quality assurance practices documented for applicable treatment modalities",
      "Anatomic pathology accreditation current (e.g., CAP laboratory accreditation)"
    ],
    { mode: "fixed", defaultValue: 5, label: "Required service and QA elements" },
    { type: "equal", value: 5, label: "All 5 required" },
    "All required evaluation and treatment services must be available (on-site or via documented referral agreement), with QA practices and pathology accreditation documented.",
    [
      "Confirm availability of all required diagnostic imaging modalities",
      "Confirm radiation oncology and systemic therapy access with agreements if off-site",
      "Document QA practices for applicable treatment modalities",
      "Upload current pathology/laboratory accreditation certificate",
      "Submit for admin lock"
    ]
  ),

  //  4. Personnel and Services Resources 

  make(
    "4.1",
    "Physician Credentials",
    "Staffing",
    [
      "All physicians involved in cancer diagnosis, staging, treatment, or follow-up are credentialed per medical staff bylaws, board certified, or supported by documentation of 12 annual cancer-related CME hours when board certification is not current"
    ],
    { mode: "editable", defaultValue: 20, label: "Total physicians involved in cancer diagnosis, staging, treatment, or follow-up" },
    { type: "gtePercent", value: 100, label: "100% must be credentialed" },
    "Every physician involved in cancer diagnosis, staging, treatment, or follow-up must hold current credentials in accordance with the facility's medical staff bylaws. Physicians who are not board certified and who evaluate or manage patients with cancer must also have documentation of 12 annual cancer-related CME hours.",
    [
      "Pull complete list of physicians in cancer care from medical staff office",
      "Verify current credentialing and board certification status for each physician",
      "Collect physician certification credential templates or credentialing documentation for all physicians",
      "Collect documentation of 12 annual cancer-related CME hours for all physicians who are not board certified and manage patients with cancer",
      "Upload all credential and CME evidence, then submit for admin lock"
    ]
  ),

  make(
    "4.2",
    "Oncology Nursing Credentials",
    "Staffing",
    [
      "The annual review of oncology nursing continuing education and clinical competency is documented in the cancer committee meeting minutes.",
      "A protocol is in place to ensure the facility reviews and assesses oncology nursing continuing education and clinical competency.",
      "The oncology nursing education and competency protocol is reviewed once each accreditation cycle and recorded in the meeting minutes."
    ],
    { mode: "fixed", defaultValue: 3, label: "Required oncology nursing compliance criteria" },
    { type: "equal", value: 3, label: "All 3 oncology nursing criteria must be met" },
    "The program must complete the annual oncology nursing evaluation and maintain the accreditation-cycle protocol review requirements for nursing education and competency.",
    [
      "Document the annual evaluation of oncology nursing education and competency in the cancer committee minutes",
      "Maintain the protocol that governs oncology nursing education and competency review",
      "Review the protocol once each accreditation cycle and document the review in the meeting minutes",
      "Store supporting nursing education and competency materials",
      "Submit for admin lock"
    ]
  ),

  make(
    "4.3",
    "Cancer Registry Staff Credentials",
    "Staffing",
    [
      "Each Oncology Data Specialist (ODS) holds a current approved credential (CTR, RHIT, RHIA, or other ACS/NCRA-recognized credential)"
    ],
    { mode: "editable", defaultValue: 4, label: "Total registry staff (ODS) in scope" },
    { type: "gtePercent", value: 100, label: "All ODS must hold current approved credentials" },
    "All cancer registry staff (ODS) must hold current credentials recognized by the ACS/NCRA.",
    [
      "Compile current roster of all ODS staff",
      "Verify credential type and expiry for each ODS",
      "Initiate renewal processes for expiring credentials",
      "Upload credential copies or attestation",
      "Submit for admin lock"
    ]
  ),

  make(
    "4.4",
    "Genetic Counseling and Risk Assessment",
    "Services",
    [
      "Cancer risk assessment, genetic counseling, and genetic testing services are provided on-site or by referral through a qualified genetics professional.",
      "A protocol for genetic counseling and risk-assessment services is in place and contains all required elements.",
      "A process based on evidence-based national guidance is in place for genetic assessment for a selected cancer site and includes all required elements.",
      "The annual genetic counseling and risk assessment report contains all required elements and is documented in the cancer committee meeting minutes."
    ],
    { mode: "fixed", defaultValue: 4, label: "Required genetic counseling and risk assessment criteria" },
    { type: "equal", value: 4, label: "All 4 genetic counseling criteria must be met" },
    "The cancer program must provide access to qualified genetics services, maintain the required protocol and evidence-based assessment process, and document the annual report to the cancer committee.",
    [
      "Confirm qualified genetics professionals are available on-site or by referral",
      "Maintain the genetic counseling and risk-assessment protocol with all required elements",
      "Maintain the evidence-based genetic assessment process for the selected cancer site",
      "Prepare the annual genetic counseling and risk assessment report",
      "Document the report in the cancer committee minutes and submit for admin lock"
    ]
  ),

  make(
    "4.5",
    "Palliative Care Services",
    "Services",
    [
      "Palliative care services are available to patients with cancer on-site or by referral.",
      "A protocol for palliative care services is in place and includes all required elements.",
      "The process for providing or referring palliative care services is monitored and evaluated, and the required annual review is documented in the cancer committee meeting minutes."
    ],
    { mode: "fixed", defaultValue: 3, label: "Required palliative care service criteria" },
    { type: "equal", value: 3, label: "All 3 palliative care criteria must be met" },
    "The cancer program must provide access to palliative care services, maintain the required protocol, and document the monitored annual review to the cancer committee.",
    [
      "Confirm palliative care services are available on-site or by referral",
      "Maintain the palliative care services protocol with all required elements",
      "Monitor and evaluate the process for providing or referring palliative care services",
      "Prepare the annual palliative care services report",
      "Document the report in the cancer committee minutes and submit for admin lock"
    ]
  ),

  make(
    "4.6",
    "Rehabilitation Care Services",
    "Services",
    [
      "The cancer committee develops protocols to guide referral to appropriate rehabilitation care services on-site or by referral.",
      "The process for referring or providing rehabilitation care services is monitored and evaluated and documented in the cancer committee meeting minutes."
    ],
    { mode: "fixed", defaultValue: 2, label: "Required rehabilitation service criteria" },
    { type: "equal", value: 2, label: "Both rehabilitation care criteria must be met" },
    "The cancer program must maintain rehabilitation referral protocols and document the annual evaluation of the rehabilitation care process in the cancer committee minutes.",
    [
      "Develop and maintain referral protocols for rehabilitation care services",
      "Confirm appropriate rehabilitation services are available on-site or by referral",
      "Monitor and evaluate the rehabilitation referral and service process",
      "Document the evaluation in the cancer committee minutes",
      "Submit for admin lock"
    ]
  ),

  make(
    "4.7",
    "Oncology Nutrition Services",
    "Services",
    [
      "Oncology nutrition services are provided on-site or by referral through a Registered Dietitian Nutritionist.",
      "The process for referring or providing oncology nutrition services is monitored and evaluated and documented in the cancer committee meeting minutes."
    ],
    { mode: "fixed", defaultValue: 2, label: "Required oncology nutrition service criteria" },
    { type: "equal", value: 2, label: "Both oncology nutrition criteria must be met" },
    "The cancer program must provide access to oncology nutrition services through a Registered Dietitian Nutritionist and document the annual evaluation of the service process in the cancer committee minutes.",
    [
      "Confirm oncology nutrition services are available on-site or by referral through a Registered Dietitian Nutritionist",
      "Maintain the process for referring or providing oncology nutrition services",
      "Monitor and evaluate the oncology nutrition service process",
      "Document the evaluation in the cancer committee minutes",
      "Submit for admin lock"
    ]
  ),

  make(
    "4.8",
    "Survivorship Program",
    "Services",
    [
      "The cancer committee identifies the survivorship program team, including the designated coordinator and team members.",
      "The survivorship program is monitored and evaluated, and the Survivorship Program Coordinator's annual review is documented in the cancer committee meeting minutes."
    ],
    { mode: "fixed", defaultValue: 2, label: "Required survivorship program criteria" },
    { type: "equal", value: 2, label: "Both survivorship program criteria must be met" },
    "The cancer program must identify its survivorship program team and document the monitored annual review of the survivorship program to the cancer committee.",
    [
      "Identify the survivorship program team and designated coordinator",
      "Maintain the list of survivorship services and program responsibilities",
      "Monitor and evaluate the survivorship program",
      "Prepare the Survivorship Program Coordinator's annual report",
      "Document the report in the cancer committee minutes and submit for admin lock"
    ]
  ),

  //  5. Patient Care: Expectations and Protocols 

  make(
    "5.1",
    "CAP Synoptic Reporting",
    "Quality",
    [
      "Each audited pathology report contains all required College of American Pathologists (CAP) core data elements for the applicable cancer site and histology"
    ],
    { mode: "editable", defaultValue: 20, label: "Audited pathology reports (minimum 20)" },
    { type: "gtePercent", value: 90, label: "90% must include all required CAP core elements" },
    "A minimum 20-case pathology audit must demonstrate that at least 90% of reports contain all required CAP protocol core data elements.",
    [
      "Select audit case sample (minimum 20 eligible reports from prior year)",
      "Use current CAP cancer protocol checklists to evaluate each report",
      "Calculate percentage of compliant reports",
      "If below 90%, implement improvement plan and repeat audit",
      "Present results to cancer committee and submit for admin lock"
    ]
  ),

  make(
    "5.2",
    "Psychosocial Distress Screening",
    "Quality",
    [
      "Protocols are in place to provide patient access to psychosocial services on-site or by referral.",
      "The cancer committee implements a protocol that includes all required elements for providing and monitoring psychosocial distress screening and referral for psychosocial care.",
      "Cancer patients are screened for psychosocial distress at least once during the first course of treatment.",
      "The psychosocial distress screening process is evaluated, and the Psychosocial Services Coordinator's annual review is documented in the cancer committee meeting minutes."
    ],
    { mode: "fixed", defaultValue: 4, label: "Required psychosocial distress screening criteria" },
    { type: "equal", value: 4, label: "All 4 psychosocial distress screening criteria must be met" },
    "The cancer program must maintain the required psychosocial access and screening protocols, screen patients during first-course treatment, and document the annual evaluation report to the cancer committee.",
    [
      "Maintain protocols that provide patient access to psychosocial services on-site or by referral",
      "Implement and maintain the psychosocial distress screening and referral protocol",
      "Confirm cancer patients are screened for psychosocial distress during the first course of treatment",
      "Evaluate the psychosocial distress screening process",
      "Document the Psychosocial Services Coordinator's annual report in the cancer committee minutes and submit for admin lock"
    ]
  ),

  make(
    "5.3",
    "Sentinel Node Biopsy for Breast Cancer",
    "Quality",
    [
      "Each audited operative report documents: clinical indication for procedure, operating surgeon, laterality, sentinel node identification technique, number of sentinel nodes identified, histologic results, and subsequent management recommendation"
    ],
    { mode: "editable", defaultValue: 20, label: "Audited sentinel node biopsy operative reports" },
    { type: "gtePercent", value: 80, label: "80% must document all required operative elements" },
    "Operative reports for sentinel node biopsy for breast cancer must document all required operative elements in at least 80% of audited cases.",
    [
      "Select audit case sample from prior reporting year",
      "Apply required operative element checklist to each report",
      "Calculate percentage of compliant reports",
      "Develop improvement plan if below 80%",
      "Present audit to cancer committee and submit for admin lock"
    ]
  ),

  make(
    "5.4",
    "Axillary Lymph Node Dissection for Breast Cancer",
    "Quality",
    [
      "Each audited operative report documents: clinical indication, operating surgeon identity, laterality, surgical technique used, level of axillary dissection performed, total number of lymph nodes removed, and correlation with pathology results"
    ],
    { mode: "editable", defaultValue: 20, label: "Audited axillary lymph node dissection operative reports" },
    { type: "gtePercent", value: 80, label: "80% must document all required operative elements" },
    "Operative reports for axillary lymph node dissection for breast cancer must document all required operative elements in at least 80% of audited cases.",
    [
      "Select audit case sample from prior reporting year",
      "Apply required operative element checklist to each report",
      "Calculate percentage of compliant reports",
      "Develop improvement plan if below 80%",
      "Present audit to cancer committee and submit for admin lock"
    ]
  ),

  make(
    "5.5",
    "Wide Local Excision for Primary Cutaneous Melanoma",
    "Quality",
    [
      "Each audited operative report documents: clinical indication, operating surgeon identity, anatomic location of lesion, pre-operative biopsy diagnosis, planned excision margin (in cm), achieved margin measurement, and specimen orientation method"
    ],
    { mode: "editable", defaultValue: 20, label: "Audited wide local excision operative reports" },
    { type: "gtePercent", value: 80, label: "80% must document all required operative elements" },
    "Operative reports for wide local excision for primary cutaneous melanoma must document all required operative elements in at least 80% of audited cases.",
    [
      "Select audit case sample from prior reporting year",
      "Apply required operative element checklist to each report",
      "Calculate percentage of compliant reports",
      "Develop improvement plan if below 80%",
      "Present audit to cancer committee and submit for admin lock"
    ]
  ),

  make(
    "5.6",
    "Colon Resection",
    "Quality",
    [
      "Each audited operative report documents: clinical indication, operating surgeon identity, procedure name (e.g., right hemicolectomy, sigmoid resection), anastomosis type, approach (open/laparoscopic/robotic), target lymph node harvest count, and specimen handling documentation"
    ],
    { mode: "editable", defaultValue: 20, label: "Audited colon resection operative reports" },
    { type: "gtePercent", value: 80, label: "80% must document all required operative elements" },
    "Operative reports for colon resection must document all required operative elements in at least 80% of audited cases.",
    [
      "Select audit case sample from prior reporting year",
      "Apply required operative element checklist to each report",
      "Calculate percentage of compliant reports",
      "Develop improvement plan if below 80%",
      "Present audit to cancer committee and submit for admin lock"
    ]
  ),

  make(
    "5.7",
    "Total Mesorectal Excision",
    "Quality",
    [
      "Each audited operative report documents: clinical indication, operating surgeon identity, distance of tumor from anal verge, surgical approach (open/laparoscopic/robotic), assessment of TME completeness, circumferential resection margin (CRM) status, and anastomosis type or stoma creation details"
    ],
    { mode: "editable", defaultValue: 20, label: "Audited total mesorectal excision operative reports" },
    { type: "gtePercent", value: 80, label: "80% must document all required operative elements" },
    "Operative reports for total mesorectal excision must document all required operative elements in at least 80% of audited cases.",
    [
      "Select audit case sample from prior reporting year",
      "Apply required operative element checklist to each report",
      "Calculate percentage of compliant reports",
      "Develop improvement plan if below 80%",
      "Present audit to cancer committee and submit for admin lock"
    ]
  ),

  make(
    "5.8",
    "Pulmonary Resection",
    "Quality",
    [
      "Each audited operative report documents: clinical indication, operating surgeon identity, type of resection performed (lobectomy, segmentectomy, wedge, pneumonectomy), surgical approach, bronchial margin assessment, vascular margin assessment, and intraoperative lymph node sampling documentation"
    ],
    { mode: "editable", defaultValue: 20, label: "Audited pulmonary resection operative reports" },
    { type: "gtePercent", value: 80, label: "80% must document all required operative elements" },
    "Operative reports for pulmonary resection must document all required operative elements in at least 80% of audited cases.",
    [
      "Select audit case sample from prior reporting year",
      "Apply required operative element checklist to each report",
      "Calculate percentage of compliant reports",
      "Develop improvement plan if below 80%",
      "Present audit to cancer committee and submit for admin lock"
    ]
  ),

  make(
    "5.9",
    "Smoking Cessation for Patients with Cancer",
    "Quality",
    [
      "Eligible patients screened for current tobacco use at or near the initial oncology consultation",
      "Current tobacco users who received cessation counseling or a referral to cessation support"
    ],
    { mode: "editable", defaultValue: 50, label: "Total eligible cancer patients in audit period" },
    { type: "gtePercent", value: 80, label: "Both screening rate and referral rate must meet 80%" },
    "The cancer program must track and report two smoking cessation metrics: tobacco use screening rate and cessation counseling/referral rate among identified smokers.",
    [
      "Define eligible patient population and audit period",
      "Pull tobacco use screening data from chart review or EHR",
      "Calculate screening rate: screened patients / eligible patients",
      "Among smokers, calculate counseling/referral rate",
      "Present dual-metric results to cancer committee and submit for admin lock"
    ]
  ),

  //  6. Data Surveillance and Systems 

  make(
    "6.1",
    "Cancer Registry Quality Control",
    "Registry",
    [
      "Annual reabstraction audit completed per QC protocol (minimum case count met, cases randomly selected, abstractor discrepancies documented)",
      "NCDB quality control reports reviewed; all identified data quality issues addressed and documented",
      "Follow-up contact procedures executed; follow-up update rates documented for current and prior analytic years",
      "Timeliness of case abstraction and completion monitored and results reported to cancer committee",
      "All registry staff credentials are current (see also Standard 4.3)"
    ],
    { mode: "fixed", defaultValue: 5, label: "Required QC protocol elements" },
    { type: "equal", value: 5, label: "All 5 required" },
    "The cancer registry must execute a complete quality control protocol annually, encompassing reabstraction audit, NCDB QC review, follow-up, timeliness monitoring, and staff credential verification.",
    [
      "Schedule and execute the annual reabstraction audit",
      "Review NCDB QC reports and document corrective actions",
      "Run and document follow-up contact procedures",
      "Compile timeliness metrics and report to cancer committee",
      "Confirm all ODS credentials are current and upload verification"
    ]
  ),

  make(
    "6.2",
    "Data Submission (Retired 2021)",
    "Registry",
    [
      "Retired standard marked Not Applicable"
    ],
    { mode: "fixed", defaultValue: 1, label: "N/A" },
    { type: "equal", value: 1, label: "Pre-marked N/A; no action required" },
    "This standard was retired effective 2021. No compliance actions are required.",
    [
      "No program action required because the system pre-marks this standard as N/A",
      "Admin locks as Not Applicable"
    ],
    true
  ),

  make(
    "6.3",
    "Data Accuracy (Retired 2021)",
    "Registry",
    [
      "Retired standard marked Not Applicable"
    ],
    { mode: "fixed", defaultValue: 1, label: "N/A" },
    { type: "equal", value: 1, label: "Pre-marked N/A; no action required" },
    "This standard was retired effective 2021. No compliance actions are required.",
    [
      "No program action required because the system pre-marks this standard as N/A",
      "Admin locks as Not Applicable"
    ],
    true
  ),

  make(
    "6.4",
    "Rapid Cancer Reporting System: Data Submission",
    "Registry",
    [
      "Cases submitted to the Rapid Cancer Reporting System (RCRS) within the required timeframe and submission confirmations documented",
      "First RCRS data compliance report presented to cancer committee (meeting date and agenda documented)",
      "Second RCRS data compliance report presented to cancer committee at a distinct meeting (different date from first)"
    ],
    { mode: "fixed", defaultValue: 3, label: "Required elements: timely submission and 2 distinct committee reports" },
    { type: "equal", value: 3, label: "All 3 required" },
    "RCRS cases must be submitted on time and two separate RCRS compliance reports must be presented to the cancer committee at distinct meetings during the year.",
    [
      "Monitor RCRS submission deadlines and export submission confirmations",
      "Schedule two distinct committee meetings for RCRS compliance reporting",
      "Upload submission confirmations and meeting minutes for both presentations",
      "Verify meeting dates are distinct",
      "Submit for admin lock"
    ]
  ),

  make(
    "6.5",
    "Follow-Up of Patients",
    "Registry",
    [
      "Patients in the analytic caseload who have documented follow-up status (alive with contact date, deceased with date, or lost to follow-up with documented contact attempts) in the current reporting year"
    ],
    { mode: "editable", defaultValue: 400, label: "Total analytic cases requiring follow-up" },
    { type: "gtePercent", value: 90, label: "Both short-term (5 years) and long-term (>5 years) cohorts must meet NCDB follow-up thresholds" },
    "The cancer program must achieve required NCDB follow-up rates for both short-term and long-term analytic patient cohorts.",
    [
      "Export current follow-up status report from cancer registry software",
      "Initiate contact attempts for patients with no recent follow-up",
      "Document all contact attempts and outcomes",
      "Calculate short-term and long-term follow-up rates",
      "Review with ODS and report to cancer committee; submit for admin lock"
    ]
  ),

  //  7. Quality Improvement 

  make(
    "7.1",
    "Quality Measures",
    "Program Improvement",
    [
      "Required NCDB or CoC-designated quality measure #1: performance data collected, benchmarked, and presented to cancer committee",
      "Required NCDB or CoC-designated quality measure #2: performance data collected, benchmarked, and presented",
      "Required NCDB or CoC-designated quality measure #3: performance data collected, benchmarked, and presented",
      "Required NCDB or CoC-designated quality measure #4: performance data collected, benchmarked, and presented",
      "Required NCDB or CoC-designated quality measure #5: performance data collected, benchmarked, and presented",
      "Required NCDB or CoC-designated quality measure #6: performance data collected, benchmarked, and presented"
    ],
    { mode: "editable", defaultValue: 6, label: "Total required quality measures" },
    { type: "gtePercent", value: 100, label: "All required quality measures must be reviewed" },
    "All required NCDB/CoC quality measures must be reviewed by the cancer committee with performance data and benchmark comparison.",
    [
      "Identify all required quality measures for the reporting year from NCDB/CoC requirements",
      "Pull analytic data for each measure",
      "Compare performance to national benchmarks",
      "Present all measures to cancer committee with interpretation",
      "Document presentations in meeting minutes and submit for admin lock"
    ]
  ),

  make(
    "7.2",
    "Monitoring Concordance with Evidence-Based Guidelines",
    "Program Improvement",
    [
      "Required evidence-based guideline (EBG) #1: concordance data collected, exceptions reviewed, and improvement actions documented",
      "Required evidence-based guideline (EBG) #2: concordance data collected, exceptions reviewed, and improvement actions documented",
      "Required evidence-based guideline (EBG) #3: concordance data collected, exceptions reviewed, and improvement actions documented",
      "Required evidence-based guideline (EBG) #4: concordance data collected, exceptions reviewed, and improvement actions documented",
      "Required evidence-based guideline (EBG) #5: concordance data collected, exceptions reviewed, and improvement actions documented"
    ],
    { mode: "editable", defaultValue: 5, label: "Total required evidence-based guidelines monitored" },
    { type: "gtePercent", value: 100, label: "All required EBGs must be monitored and reported" },
    "The cancer program must monitor concordance with all required evidence-based guidelines, review cases of non-concordance, and report findings with improvement actions.",
    [
      "Identify all required evidence-based guidelines for the reporting year",
      "Pull concordance data for each guideline from chart review or NCDB",
      "Document exceptions with clinical rationale",
      "Identify and implement improvement actions for non-concordant patterns",
      "Present all EBG concordance reports to cancer committee; submit for admin lock"
    ]
  ),

  make(
    "7.3",
    "Quality Improvement Initiative",
    "Program Improvement",
    [
      "Baseline data established and first status update presented to cancer committee (include baseline metric, target, timeline, and responsible party)",
      "Mid-cycle progress measurement and second status update presented to cancer committee (include current metric vs. baseline and target)",
      "Final report with outcome data, conclusions, and sustainability plan presented to cancer committee"
    ],
    { mode: "fixed", defaultValue: 3, label: "Required milestones: 2 status updates + final report" },
    { type: "equal", value: 3, label: "All 3 milestones required" },
    "A cancer program quality improvement initiative must formally progress through baseline establishment, two status updates, and a final report to the cancer committee.",
    [
      "Select QI initiative topic from identified opportunities",
      "Establish baseline metric and present first status update to committee",
      "Measure mid-cycle progress and present second status update",
      "Complete final report with outcomes and sustainability plan",
      "Upload all milestone documentation and submit for admin lock"
    ]
  ),

  make(
    "7.4",
    "Cancer Program Goal",
    "Program Improvement",
    [
      "Cancer program goal defined with measurable target; first status update (including goal statement, metric, and timeline) presented to cancer committee",
      "Mid-cycle progress update with current metric measurement presented to cancer committee",
      "Final report documenting goal achievement or gap analysis with next steps presented to cancer committee"
    ],
    { mode: "fixed", defaultValue: 3, label: "Required milestones: 2 status updates + final report" },
    { type: "equal", value: 3, label: "All 3 milestones required" },
    "An annual cancer program goal must be tracked through two formal status updates and a final report to the cancer committee.",
    [
      "Define the program goal with a measurable target and owner",
      "Present initial goal statement and first status update to committee",
      "Present mid-cycle progress update to committee",
      "Present final outcome report to committee",
      "Upload all milestone documentation and submit for admin lock"
    ]
  ),

  //  8. Education: Professional and Community Outreach 

  make(
    "8.1",
    "Addressing Barriers to Care",
    "Community",
    [
      "Target population for barriers analysis identified (geographic, demographic, or disease-specific focus documented)",
      "Method used to identify barriers documented (e.g., survey, focus group, claims data review, community health needs assessment)",
      "Specific barriers identified and categorized (financial, geographic, linguistic/cultural, or other)",
      "Strategies planned or implemented to address identified barriers documented",
      "Evaluation of strategy effectiveness documented with outcome data or a progress indicator",
      "Community partners or collaborating organizations involved are identified",
      "Data sources used in the barriers analysis documented",
      "Annual barriers evaluation presented to cancer committee"
    ],
    { mode: "fixed", defaultValue: 8, label: "Required annual evaluation elements" },
    { type: "equal", value: 8, label: "All 8 elements required" },
    "An annual evaluation of barriers to cancer care must be completed and presented to the cancer committee, encompassing all eight required elements.",
    [
      "Identify target population and document rationale",
      "Select and execute a barriers-identification method",
      "Categorize identified barriers by type",
      "Document strategies and any existing improvements",
      "Collect outcome data for evaluating strategy effectiveness",
      "Identify community partners involved",
      "Document data sources used",
      "Present complete annual evaluation to cancer committee; submit for admin lock"
    ]
  ),

  make(
    "8.2",
    "Cancer Prevention Event",
    "Community",
    [
      "Target audience identified with health equity or underserved population consideration documented",
      "Event planning and implementation timeline documented",
      "Prevention topic is linked to evidence-based guidance (e.g., ACS guidelines, USPSTF, or CDC recommendations)",
      "Number of participants reached documented",
      "Post-event outcomes or reach results documented and reported to cancer committee",
      "Annual summary or event report submitted to cancer committee"
    ],
    { mode: "fixed", defaultValue: 6, label: "Required event documentation elements" },
    { type: "equal", value: 6, label: "All 6 required" },
    "The cancer program must plan, execute, and document a cancer prevention event meeting all six required elements and reporting outcomes to the cancer committee.",
    [
      "Select prevention topic aligned with evidence-based guidance",
      "Identify target audience with equity focus",
      "Document event planning and execution timeline",
      "Record participant count at event",
      "Document post-event outcomes and lessons learned",
      "Present annual event report to cancer committee; submit for admin lock"
    ]
  ),

  make(
    "8.3",
    "Cancer Screening Event",
    "Community",
    [
      "Target audience identified with health equity or underserved population consideration documented",
      "Event planning and implementation timeline documented",
      "Screening type aligns with current evidence-based screening guidelines (e.g., USPSTF, ACS, ACR)",
      "Number of individuals screened documented",
      "Follow-up process for abnormal or positive screening results documented",
      "Annual summary or event report submitted to cancer committee"
    ],
    { mode: "fixed", defaultValue: 6, label: "Required event documentation elements" },
    { type: "equal", value: 6, label: "All 6 required" },
    "The cancer program must plan, execute, and document a cancer screening event meeting all six required elements, including a follow-up process for abnormal results.",
    [
      "Select screening type aligned with current guidelines",
      "Identify target audience with equity focus",
      "Document event planning and execution timeline",
      "Record number of individuals screened",
      "Document abnormal-result follow-up pathway",
      "Present annual event report to cancer committee; submit for admin lock"
    ]
  ),

  //  9. Research 

  make(
    "9.1",
    "Clinical Research Accrual",
    "Research",
    [
      "A screening protocol identifies participant eligibility for clinical research studies, explains how clinical trial information is provided to subjects, and shows how barriers to enrollment and participation are assessed and addressed.",
      "The number of accruals to cancer-related clinical research studies meets or exceeds the required percentage.",
      "The Clinical Research Coordinator presents the annual clinical research activity report to the cancer committee, and the report's required elements are documented in the meeting minutes."
    ],
    { mode: "fixed", defaultValue: 3, label: "Required clinical research accrual criteria" },
    { type: "equal", value: 3, label: "All 3 clinical research accrual criteria must be met" },
    "The program must maintain a clinical research screening process, meet the required cancer-related accrual percentage, and complete an annual Clinical Research Coordinator report to the cancer committee with the required elements documented in the minutes.",
    [
      "Maintain the clinical research screening protocol used to identify participant eligibility and explain how study information is shared with subjects",
      "Review barriers to enrollment and participation, then document actions taken to address those barriers",
      "Track annual accrual to cancer-related clinical research studies against the required percentage",
      "Prepare the annual clinical research activity report with all required elements",
      "Have the Clinical Research Coordinator present the report to the cancer committee and document the presentation in the meeting minutes",
      "Submit for admin lock"
    ]
  ),

  make(
    "9.2",
    "Commission on Cancer Special Studies",
    "Research",
    [
      "The program participates in each required special study for its assigned cycle.",
      "Complete data and supporting documentation are submitted by the established deadline for each special study."
    ],
    { mode: "fixed", defaultValue: 2, label: "Required special study compliance criteria" },
    { type: "equal", value: 2, label: "Both special study criteria must be met" },
    "The cancer program must participate in each assigned special study and submit complete data and documentation by the required deadline.",
    [
      "Identify current CoC special study assignments and requirements for your category",
      "Confirm participation in each assigned special study for the current cycle",
      "Collect and verify all required data and supporting documentation",
      "Upload evidence of participation and data submission confirmations",
      "Confirm each submission was completed by the established deadline",
      "Submit for admin lock"
    ]
  ),


];












