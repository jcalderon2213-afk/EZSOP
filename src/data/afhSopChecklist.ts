/**
 * afhSopChecklist.ts
 * ==================
 * EZSOP — Standard SOP Checklist for Oregon Adult Foster Homes (AFH)
 *
 * PURPOSE:
 * This file contains a curated checklist of 94 standard operating procedures
 * that every Oregon Adult Foster Home should have documented. These are based on
 * Oregon Administrative Rules (OAR), DHS licensing requirements, DHS survey protocols,
 * and real-world AFH operational needs.
 *
 * HOW IT'S USED:
 * - The app displays these as a checklist for the AFH owner (Norma)
 * - Each item is a question prompt that becomes an SOP when answered
 * - The frontend cross-references this list against existing SOPs to show progress
 * - Categories help organize the checklist into logical operational areas
 * - Questions are written in plain English "How do you..." format to prompt detailed procedural answers
 *
 * CONTEXT FOR AI/LLM:
 * - Primary user: Norma, owner of Blue Mountain Home (Clackamas County, Oregon)
 * - Industry: Oregon Adult Foster Home (AFH) — licensed residential care for elderly/disabled adults
 * - Regulatory body: Oregon DHS (Department of Human Services), APD (Aging and People with Disabilities)
 * - Key regulations: OAR 411-050 (AFH licensing rules)
 * - The "question" field is the interview prompt used to capture the SOP from the owner
 * - Each item can be linked to a created SOP via sop_id once the owner completes it
 * - Every SOP here should be actionable and teachable — something you can train a manager to do step-by-step
 *
 * GENERATION METHOD:
 * - Original 51 items: manually curated from Oregon AFH regulations and operational expertise
 * - Additional 43 items: AI-generated using DHS surveyor mindset against the full EZSOP knowledge base
 *   (127+ regulatory documents across OAR 411-050/051/052, DHS forms, BOLI, OHA Medicaid, etc.)
 * - All items filtered to be actionable procedures, not static compliance checks or policies
 *
 * MAINTENANCE:
 * - Add new items by incrementing the id within the category prefix
 * - Categories can be expanded but should stay aligned with AFH operational areas
 * - If this list grows beyond 120+ items, consider migrating to a database table
 *
 * LAST UPDATED: March 2, 2026
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AfhSopChecklistItem {
  /** Unique identifier in format: "category-prefix-NNN" */
  id: string;
  /** Display category name for grouping in the UI */
  category: string;
  /** Short category key for filtering and programmatic use */
  categoryKey: string;
  /** The interview question / SOP prompt — plain English, "How do you..." format */
  question: string;
  /** Sort order within the category (1-based) */
  sortOrder: number;
  /** Brief description of why this SOP matters for compliance or operations */
  why: string;
}

export interface AfhSopCategory {
  /** Short key for programmatic use */
  key: string;
  /** Display name */
  label: string;
  /** Emoji icon for babified UI */
  icon: string;
  /** How many items in this category */
  count: number;
}

// ---------------------------------------------------------------------------
// Categories (11 total)
// ---------------------------------------------------------------------------

export const afhSopCategories: AfhSopCategory[] = [
  {
    key: "daily-ops",
    label: "Daily Operations & Shift Management",
    icon: "☀️",
    count: 5,
  },
  {
    key: "medication",
    label: "Medication Management",
    icon: "💊",
    count: 11,
  },
  {
    key: "resident-care",
    label: "Resident Care & Service Plans",
    icon: "🩺",
    count: 13,
  },
  {
    key: "change-condition",
    label: "Change in Condition & Clinical Documentation",
    icon: "📋",
    count: 7,
  },
  {
    key: "incident",
    label: "Incident Reporting & Abuse Prevention",
    icon: "🚨",
    count: 8,
  },
  {
    key: "communication",
    label: "Communication & Documentation",
    icon: "📞",
    count: 6,
  },
  {
    key: "safety",
    label: "Safety, Emergency & Facility",
    icon: "🔥",
    count: 9,
  },
  {
    key: "staffing",
    label: "Staffing & Training",
    icon: "👥",
    count: 10,
  },
  {
    key: "admin",
    label: "Administrative & Compliance",
    icon: "📁",
    count: 15,
  },
  {
    key: "admissions",
    label: "Admissions, Discharges & Billing",
    icon: "🏠",
    count: 8,
  },
  {
    key: "resident-rights",
    label: "Resident Rights & Privacy",
    icon: "🛡️",
    count: 2,
  },
];

// ---------------------------------------------------------------------------
// Checklist Items (94 total)
// ---------------------------------------------------------------------------

export const afhSopChecklist: AfhSopChecklistItem[] = [
  // =========================================================================
  // ☀️ DAILY OPERATIONS & SHIFT MANAGEMENT (5)
  // =========================================================================
  {
    id: "daily-ops-001",
    category: "Daily Operations & Shift Management",
    categoryKey: "daily-ops",
    question: "How do you review and verify overnight caregiver documentation?",
    sortOrder: 1,
    why: "Ensures continuity of care and catches issues from overnight shifts before the day begins.",
  },
  {
    id: "daily-ops-002",
    category: "Daily Operations & Shift Management",
    categoryKey: "daily-ops",
    question: "How do you complete and document shift handoff communication?",
    sortOrder: 2,
    why: "Prevents care gaps and miscommunication between shifts — a top DHS survey finding.",
  },
  {
    id: "daily-ops-003",
    category: "Daily Operations & Shift Management",
    categoryKey: "daily-ops",
    question: "How do you perform a daily compliance review as the AFH owner?",
    sortOrder: 3,
    why: "Owner oversight is required by OAR 411-050 and demonstrates active management to DHS.",
  },
  {
    id: "daily-ops-004",
    category: "Daily Operations & Shift Management",
    categoryKey: "daily-ops",
    question: "How do you verify staffing coverage meets resident needs?",
    sortOrder: 4,
    why: "Staffing ratios must meet resident acuity levels per OAR 411-050-0490.",
  },
  {
    id: "daily-ops-005",
    category: "Daily Operations & Shift Management",
    categoryKey: "daily-ops",
    question: "How do you document a stable day with no change in condition?",
    sortOrder: 5,
    why: "Even stable days require documentation to show ongoing monitoring and care continuity.",
  },

  // =========================================================================
  // 💊 MEDICATION MANAGEMENT (11)
  // =========================================================================
  {
    id: "medication-001",
    category: "Medication Management",
    categoryKey: "medication",
    question: "How do you audit MARs daily for completeness and accuracy?",
    sortOrder: 1,
    why: "MAR audits catch medication errors early — incomplete MARs are a top DHS deficiency.",
  },
  {
    id: "medication-002",
    category: "Medication Management",
    categoryKey: "medication",
    question: "How do you document and monitor PRN effectiveness?",
    sortOrder: 2,
    why: "PRN follow-up documentation is required to show the medication worked or needs adjustment.",
  },
  {
    id: "medication-003",
    category: "Medication Management",
    categoryKey: "medication",
    question: "How do you handle and document medication refusals?",
    sortOrder: 3,
    why: "Refusals must be documented with reason, physician notification, and follow-up action.",
  },
  {
    id: "medication-004",
    category: "Medication Management",
    categoryKey: "medication",
    question: "How do you verify medication storage compliance daily?",
    sortOrder: 4,
    why: "Medications must be stored per OAR requirements — locked, proper temp, separated by resident.",
  },
  {
    id: "medication-005",
    category: "Medication Management",
    categoryKey: "medication",
    question: "How do you conduct and document controlled substance counts?",
    sortOrder: 5,
    why: "Controlled substance counts must be documented at every shift change per Oregon pharmacy rules.",
  },
  {
    id: "medication-006",
    category: "Medication Management",
    categoryKey: "medication",
    question: "How do you check and log new medication orders from the doctor?",
    sortOrder: 6,
    why: "Administering medications without a verified current physician's order is a top DHS citation.",
  },
  {
    id: "medication-007",
    category: "Medication Management",
    categoryKey: "medication",
    question: "How do you get rid of old or expired medications safely?",
    sortOrder: 7,
    why: "Improper medication disposal creates diversion risk and pharmacy board violations.",
  },
  {
    id: "medication-008",
    category: "Medication Management",
    categoryKey: "medication",
    question: "How do you handle over-the-counter meds like Tylenol or antacids?",
    sortOrder: 8,
    why: "OTC medications given without physician orders and MAR documentation are a frequent citation.",
  },
  {
    id: "medication-009",
    category: "Medication Management",
    categoryKey: "medication",
    question: "What do you do when there's a medication mix-up or bad reaction?",
    sortOrder: 9,
    why: "Failure to identify, report, and correct medication errors exposes the home to incident reporting violations.",
  },
  {
    id: "medication-010",
    category: "Medication Management",
    categoryKey: "medication",
    question: "How do you handle medications when a resident is out of the house?",
    sortOrder: 10,
    why: "Missed doses during outings are a documentation gap surveyors flag on the MAR.",
  },
  {
    id: "medication-011",
    category: "Medication Management",
    categoryKey: "medication",
    question: "How do you make sure prescriptions get refilled on time?",
    sortOrder: 11,
    why: "Running out of a resident's medication is a preventable care failure that results in missed doses and citations.",
  },

  // =========================================================================
  // 🩺 RESIDENT CARE & SERVICE PLANS (13)
  // =========================================================================
  {
    id: "resident-care-001",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you ensure service plans are being followed daily?",
    sortOrder: 1,
    why: "Service plan compliance is the core of AFH care — DHS checks this at every survey.",
  },
  {
    id: "resident-care-002",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you update a resident's service plan after a change?",
    sortOrder: 2,
    why: "Service plans must be updated within required timeframes when resident needs change.",
  },
  {
    id: "resident-care-003",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you monitor and document nursing delegation tasks?",
    sortOrder: 3,
    why: "Nursing delegated tasks require specific documentation showing proper training and completion.",
  },
  {
    id: "resident-care-004",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you coordinate and document hospice involvement?",
    sortOrder: 4,
    why: "Hospice coordination requires documented communication between AFH, hospice team, and family.",
  },
  {
    id: "resident-care-005",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you coordinate and document home health services?",
    sortOrder: 5,
    why: "Home health visits must be logged and care instructions incorporated into the service plan.",
  },
  {
    id: "resident-care-006",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you document and monitor behavioral interventions?",
    sortOrder: 6,
    why: "Behavioral interventions must be documented per the resident's behavior support plan.",
  },
  {
    id: "resident-care-007",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you monitor and document fall prevention strategies?",
    sortOrder: 7,
    why: "Falls are the #1 incident in AFHs — prevention strategies and documentation are critical.",
  },
  {
    id: "resident-care-008",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you make sure each resident gets the right food for their needs?",
    sortOrder: 8,
    why: "Serving food that contradicts a resident's dietary requirements is a care plan compliance violation.",
  },
  {
    id: "resident-care-009",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you keep track of daily personal care like bathing and grooming?",
    sortOrder: 9,
    why: "Surveyors compare documented care delivery against the service plan — gaps trigger deficiencies.",
  },
  {
    id: "resident-care-010",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you check for skin problems like bedsores or rashes?",
    sortOrder: 10,
    why: "Unidentified or undocumented skin breakdown is a high-severity finding that can escalate to abuse/neglect investigations.",
  },
  {
    id: "resident-care-011",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you follow a resident's behavior support plan and calm things down?",
    sortOrder: 11,
    why: "Using unapproved behavior interventions or failing to follow a documented plan is a resident rights violation.",
  },
  {
    id: "resident-care-012",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you plan and track activities so residents stay engaged?",
    sortOrder: 12,
    why: "Service plans require individualized activities — surveyors look for evidence of engagement beyond basic care.",
  },
  {
    id: "resident-care-013",
    category: "Resident Care & Service Plans",
    categoryKey: "resident-care",
    question: "How do you track each resident's weight and eating habits?",
    sortOrder: 13,
    why: "Unintended weight loss is a sentinel event — failure to monitor and report it is a care planning deficiency.",
  },

  // =========================================================================
  // 📋 CHANGE IN CONDITION & CLINICAL DOCUMENTATION (7)
  // =========================================================================
  {
    id: "change-condition-001",
    category: "Change in Condition & Clinical Documentation",
    categoryKey: "change-condition",
    question: "How do you identify and document a change in condition?",
    sortOrder: 1,
    why: "Timely identification and documentation of changes is a core AFH responsibility.",
  },
  {
    id: "change-condition-002",
    category: "Change in Condition & Clinical Documentation",
    categoryKey: "change-condition",
    question: "How do you notify physicians after a change in condition?",
    sortOrder: 2,
    why: "Physician notification timelines are regulated — delays can result in DHS findings.",
  },
  {
    id: "change-condition-003",
    category: "Change in Condition & Clinical Documentation",
    categoryKey: "change-condition",
    question: "How do you notify family representatives about care changes?",
    sortOrder: 3,
    why: "Family notification is required for significant changes and builds trust with representatives.",
  },
  {
    id: "change-condition-004",
    category: "Change in Condition & Clinical Documentation",
    categoryKey: "change-condition",
    question: "How do you write an event-based progress note?",
    sortOrder: 4,
    why: "Progress notes are the primary clinical record DHS reviews during surveys.",
  },
  {
    id: "change-condition-005",
    category: "Change in Condition & Clinical Documentation",
    categoryKey: "change-condition",
    question: "What do you do right after a resident falls?",
    sortOrder: 5,
    why: "Falls without documented immediate assessment, notification chain, and root-cause review are among the most common DHS citations.",
  },
  {
    id: "change-condition-006",
    category: "Change in Condition & Clinical Documentation",
    categoryKey: "change-condition",
    question: "What do you do when a resident passes away in the home?",
    sortOrder: 6,
    why: "Failure to follow proper notification chain (911, hospice, physician, DHS, family) and preserve documentation is a reportable incident violation.",
  },
  {
    id: "change-condition-007",
    category: "Change in Condition & Clinical Documentation",
    categoryKey: "change-condition",
    question: "What do you document when a resident goes to the hospital and comes back?",
    sortOrder: 7,
    why: "Incomplete transfer documentation creates continuity-of-care failures that surveyors check.",
  },

  // =========================================================================
  // 🚨 INCIDENT REPORTING & ABUSE PREVENTION (8)
  // =========================================================================
  {
    id: "incident-001",
    category: "Incident Reporting & Abuse Prevention",
    categoryKey: "incident",
    question: "How do you determine whether an incident is DHS-reportable?",
    sortOrder: 1,
    why: "Failure to report a reportable incident is a serious DHS violation with potential license action.",
  },
  {
    id: "incident-002",
    category: "Incident Reporting & Abuse Prevention",
    categoryKey: "incident",
    question: "How do you complete and submit a DHS incident report?",
    sortOrder: 2,
    why: "Incident reports must be submitted within required timeframes using proper DHS forms.",
  },
  {
    id: "incident-003",
    category: "Incident Reporting & Abuse Prevention",
    categoryKey: "incident",
    question: "How do you respond to and document abuse or neglect allegations?",
    sortOrder: 3,
    why: "Mandatory reporting obligations and immediate response steps are required by Oregon law.",
  },
  {
    id: "incident-004",
    category: "Incident Reporting & Abuse Prevention",
    categoryKey: "incident",
    question: "How do you log and track incident trends over time?",
    sortOrder: 4,
    why: "Trend tracking helps identify systemic issues and demonstrates proactive quality improvement.",
  },
  {
    id: "incident-005",
    category: "Incident Reporting & Abuse Prevention",
    categoryKey: "incident",
    question: "How do you ensure resident rights are posted and honored?",
    sortOrder: 5,
    why: "Resident rights must be posted visibly and honored in daily practice per OAR 411-050.",
  },
  {
    id: "incident-006",
    category: "Incident Reporting & Abuse Prevention",
    categoryKey: "incident",
    question: "What do you do if a resident goes missing or wanders off?",
    sortOrder: 6,
    why: "Elopement is a DHS-reportable incident requiring immediate 911 contact, search protocol, and incident report.",
  },
  {
    id: "incident-007",
    category: "Incident Reporting & Abuse Prevention",
    categoryKey: "incident",
    question: "What are your steps for reporting suspected abuse or neglect?",
    sortOrder: 7,
    why: "Oregon law requires immediate reporting — failure to report is a criminal violation and grounds for license revocation.",
  },
  {
    id: "incident-008",
    category: "Incident Reporting & Abuse Prevention",
    categoryKey: "incident",
    question: "How do you protect residents from being financially taken advantage of?",
    sortOrder: 8,
    why: "Financial exploitation is a mandatory-report category — surveyors review the Resident Account Record for irregularities.",
  },

  // =========================================================================
  // 📞 COMMUNICATION & DOCUMENTATION (6)
  // =========================================================================
  {
    id: "communication-001",
    category: "Communication & Documentation",
    categoryKey: "communication",
    question: "How do you document communication with physicians?",
    sortOrder: 1,
    why: "All physician communication must be documented with date, time, content, and follow-up actions.",
  },
  {
    id: "communication-002",
    category: "Communication & Documentation",
    categoryKey: "communication",
    question: "How do you document communication with family members?",
    sortOrder: 2,
    why: "Family communication logs protect the AFH and demonstrate transparency in care.",
  },
  {
    id: "communication-003",
    category: "Communication & Documentation",
    categoryKey: "communication",
    question: "How do you conduct and document a care conference?",
    sortOrder: 3,
    why: "Care conferences are required at key intervals and must include all care team members.",
  },
  {
    id: "communication-004",
    category: "Communication & Documentation",
    categoryKey: "communication",
    question: "How do you keep each resident's file complete and ready for a survey?",
    sortOrder: 4,
    why: "Incomplete resident files are the single most common DHS deficiency.",
  },
  {
    id: "communication-005",
    category: "Communication & Documentation",
    categoryKey: "communication",
    question: "How do you handle advance directives and POLST forms?",
    sortOrder: 5,
    why: "Not having current advance directives accessible or failing to follow them during emergencies is a resident rights violation.",
  },
  {
    id: "communication-006",
    category: "Communication & Documentation",
    categoryKey: "communication",
    question: "How do you work with each resident's DHS case manager?",
    sortOrder: 6,
    why: "Failure to communicate service changes to the case manager creates billing mismatches and unauthorized service findings.",
  },

  // =========================================================================
  // 🔥 SAFETY, EMERGENCY & FACILITY (9)
  // =========================================================================
  {
    id: "safety-001",
    category: "Safety, Emergency & Facility",
    categoryKey: "safety",
    question: "How do you perform and log a daily safety walk-through?",
    sortOrder: 1,
    why: "Daily safety checks catch hazards before they become incidents or DHS findings.",
  },
  {
    id: "safety-002",
    category: "Safety, Emergency & Facility",
    categoryKey: "safety",
    question: "How do you verify emergency exits and fire safety equipment?",
    sortOrder: 2,
    why: "Fire safety is heavily regulated — blocked exits or expired extinguishers are immediate findings.",
  },
  {
    id: "safety-003",
    category: "Safety, Emergency & Facility",
    categoryKey: "safety",
    question: "How do you complete and document infection control checks?",
    sortOrder: 3,
    why: "Infection control procedures must be documented, especially hand hygiene and PPE protocols.",
  },
  {
    id: "safety-004",
    category: "Safety, Emergency & Facility",
    categoryKey: "safety",
    question: "How do you log refrigerator temperature and food safety compliance?",
    sortOrder: 4,
    why: "Food temp logs are required daily and checked during DHS kitchen inspections.",
  },
  {
    id: "safety-005",
    category: "Safety, Emergency & Facility",
    categoryKey: "safety",
    question: "How do you conduct and document fire drills?",
    sortOrder: 5,
    why: "Fire drills are required quarterly with documented participation and evacuation times.",
  },
  {
    id: "safety-006",
    category: "Safety, Emergency & Facility",
    categoryKey: "safety",
    question: "How do you conduct and document disaster drills?",
    sortOrder: 6,
    why: "Disaster preparedness drills must be documented per emergency plans.",
  },
  {
    id: "safety-007",
    category: "Safety, Emergency & Facility",
    categoryKey: "safety",
    question: "How do you keep your emergency plan up to date?",
    sortOrder: 7,
    why: "Surveyors verify the plan exists, is current, includes 72-hour supply provisions, and that staff can access it.",
  },
  {
    id: "safety-008",
    category: "Safety, Emergency & Facility",
    categoryKey: "safety",
    question: "How do you deal with pest problems like ants or mice?",
    sortOrder: 8,
    why: "Pest evidence in a care facility triggers immediate environmental safety deficiencies.",
  },
  {
    id: "safety-009",
    category: "Safety, Emergency & Facility",
    categoryKey: "safety",
    question: "How do you handle cameras or monitors in the home and get consent?",
    sortOrder: 9,
    why: "Using monitoring devices without proper consent violates resident privacy rights.",
  },

  // =========================================================================
  // 👥 STAFFING & TRAINING (10)
  // =========================================================================
  {
    id: "staffing-001",
    category: "Staffing & Training",
    categoryKey: "staffing",
    question: "How do you confirm caregivers meet required training standards?",
    sortOrder: 1,
    why: "All caregivers must complete required training hours before providing care per OAR 411-050.",
  },
  {
    id: "staffing-002",
    category: "Staffing & Training",
    categoryKey: "staffing",
    question: "How do you track and renew caregiver certifications?",
    sortOrder: 2,
    why: "Expired certifications mean unqualified staff — a serious DHS finding.",
  },
  {
    id: "staffing-003",
    category: "Staffing & Training",
    categoryKey: "staffing",
    question: "How do you track and renew background checks?",
    sortOrder: 3,
    why: "Background checks must be current for all staff — renewals are required every 2 years.",
  },
  {
    id: "staffing-004",
    category: "Staffing & Training",
    categoryKey: "staffing",
    question: "How do you manage and document staff in-service training hours?",
    sortOrder: 4,
    why: "Annual in-service training hours are tracked by DHS and required for license renewal.",
  },
  {
    id: "staffing-005",
    category: "Staffing & Training",
    categoryKey: "staffing",
    question: "How do you log and resolve maintenance issues?",
    sortOrder: 5,
    why: "Maintenance logs show the home is safe and well-maintained — checked during DHS surveys.",
  },
  {
    id: "staffing-006",
    category: "Staffing & Training",
    categoryKey: "staffing",
    question: "How do you walk new caregivers through the orientation checklist?",
    sortOrder: 6,
    why: "Incomplete caregiver orientation (APD 0349) is a frequently cited deficiency — every checklist item must be completed.",
  },
  {
    id: "staffing-007",
    category: "Staffing & Training",
    categoryKey: "staffing",
    question: "How do you keep a backup provider agreement ready to go?",
    sortOrder: 7,
    why: "Not having a current, signed back-up provider agreement is a licensing violation.",
  },
  {
    id: "staffing-008",
    category: "Staffing & Training",
    categoryKey: "staffing",
    question: "How do you fill out the weekly staffing schedule?",
    sortOrder: 8,
    why: "Surveyors review the weekly plan of operation to verify adequate staffing at all times.",
  },
  {
    id: "staffing-009",
    category: "Staffing & Training",
    categoryKey: "staffing",
    question: "How do you stay on top of wage, break, and overtime rules?",
    sortOrder: 9,
    why: "BOLI violations result in fines and complaints that can trigger DHS investigation.",
  },
  {
    id: "staffing-010",
    category: "Staffing & Training",
    categoryKey: "staffing",
    question: "How do you make sure every caregiver gets their 12 training hours?",
    sortOrder: 10,
    why: "Insufficient training hours are verified during every survey — surveyors pull training records.",
  },

  // =========================================================================
  // 📁 ADMINISTRATIVE & COMPLIANCE (15)
  // =========================================================================
  {
    id: "admin-001",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you manage and document resident financial records?",
    sortOrder: 1,
    why: "Resident financial management must be transparent and documented per DHS requirements.",
  },
  {
    id: "admin-002",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you handle and document resident grievances?",
    sortOrder: 2,
    why: "A formal grievance process is required and must show timely resolution and follow-up.",
  },
  {
    id: "admin-003",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you prepare for a DHS survey inspection?",
    sortOrder: 3,
    why: "Survey prep ensures all required documentation, postings, and records are current and accessible.",
  },
  {
    id: "admin-004",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you track corrective action plans after a deficiency?",
    sortOrder: 4,
    why: "DHS requires documented corrective action plans with timelines and proof of resolution.",
  },
  {
    id: "admin-005",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you track license and insurance renewals?",
    sortOrder: 5,
    why: "Operating with expired licenses or insurance can result in immediate DHS action.",
  },
  {
    id: "admin-006",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you manage supply inventory and reorder processes?",
    sortOrder: 6,
    why: "Running out of essential supplies impacts care quality and safety.",
  },
  {
    id: "admin-007",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you track and document private pay billing and payments?",
    sortOrder: 7,
    why: "Financial records for private pay residents must be transparent and properly documented.",
  },
  {
    id: "admin-008",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you submit and double-check Medicaid billing?",
    sortOrder: 8,
    why: "eXPRS billing errors and mismatches between billed and documented services trigger Medicaid audits.",
  },
  {
    id: "admin-009",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you collect and track room and board payments?",
    sortOrder: 9,
    why: "Commingling room and board with service payments is a Medicaid compliance violation.",
  },
  {
    id: "admin-010",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you collect each resident's client liability payment?",
    sortOrder: 10,
    why: "Collecting incorrect client liability amounts creates Medicaid billing discrepancies flagged during audits.",
  },
  {
    id: "admin-011",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you keep up with your DHS provider agreement requirements?",
    sortOrder: 11,
    why: "Provider agreement violations can result in agreement termination and loss of Medicaid payments.",
  },
  {
    id: "admin-012",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you request a change to your license capacity?",
    sortOrder: 12,
    why: "Operating outside your licensed capacity — even temporarily — is an immediate licensing violation.",
  },
  {
    id: "admin-013",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you keep your business registration and tax filings current?",
    sortOrder: 13,
    why: "Lapsed business registration or missing tax filings trigger compliance issues with the state and IRS.",
  },
  {
    id: "admin-014",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you make sure all your insurance policies stay active?",
    sortOrder: 14,
    why: "Lapsed insurance is a licensing violation — surveyors verify current certificates of insurance.",
  },
  {
    id: "admin-015",
    category: "Administrative & Compliance",
    categoryKey: "admin",
    question: "How do you handle SSI payments and rate coordination for residents?",
    sortOrder: 15,
    why: "Incorrect rate applications and missed payment exception requests result in audit findings.",
  },

  // =========================================================================
  // 🏠 ADMISSIONS, DISCHARGES & BILLING (8)
  // =========================================================================
  {
    id: "admissions-001",
    category: "Admissions, Discharges & Billing",
    categoryKey: "admissions",
    question: "How do you manage resident admissions?",
    sortOrder: 1,
    why: "Admissions require proper screening, documentation, service plan creation, and family orientation.",
  },
  {
    id: "admissions-002",
    category: "Admissions, Discharges & Billing",
    categoryKey: "admissions",
    question: "How do you manage resident discharges?",
    sortOrder: 2,
    why: "Discharges must follow DHS rules including notice requirements and proper record transfer.",
  },
  {
    id: "admissions-003",
    category: "Admissions, Discharges & Billing",
    categoryKey: "admissions",
    question: "How do you review and log Medicaid eligibility updates?",
    sortOrder: 3,
    why: "Medicaid eligibility changes affect reimbursement — missed updates mean lost revenue.",
  },
  {
    id: "admissions-004",
    category: "Admissions, Discharges & Billing",
    categoryKey: "admissions",
    question: "How do you generate and manage weekly meal plans?",
    sortOrder: 4,
    why: "Meal plans must meet dietary needs per service plans and be documented for DHS review.",
  },
  {
    id: "admissions-005",
    category: "Admissions, Discharges & Billing",
    categoryKey: "admissions",
    question: "How do you screen high-needs residents before admitting them?",
    sortOrder: 5,
    why: "Admitting a special-needs resident without prior DHS approval is a licensing violation.",
  },
  {
    id: "admissions-006",
    category: "Admissions, Discharges & Billing",
    categoryKey: "admissions",
    question: "How do you show a new resident around and document their orientation?",
    sortOrder: 6,
    why: "Resident orientation must be documented — missing documentation is a deficiency and unoriented residents face safety risks.",
  },
  {
    id: "admissions-007",
    category: "Admissions, Discharges & Billing",
    categoryKey: "admissions",
    question: "How do you get prior approval for Medicaid-covered services?",
    sortOrder: 7,
    why: "Delivering services without required prior authorization results in claim denials and unrecoverable costs.",
  },
  {
    id: "admissions-008",
    category: "Admissions, Discharges & Billing",
    categoryKey: "admissions",
    question: "How do you handle it when a resident needs to be moved out involuntarily?",
    sortOrder: 8,
    why: "Involuntary discharges without proper written notice and appeal rights information violate resident rights.",
  },

  // =========================================================================
  // 🛡️ RESIDENT RIGHTS & PRIVACY (2)
  // =========================================================================
  {
    id: "resident-rights-001",
    category: "Resident Rights & Privacy",
    categoryKey: "resident-rights",
    question: "How do you keep track of each resident's personal belongings?",
    sortOrder: 1,
    why: "Missing resident property without documentation triggers financial exploitation investigations.",
  },
  {
    id: "resident-rights-002",
    category: "Resident Rights & Privacy",
    categoryKey: "resident-rights",
    question: "How do you investigate and resolve complaints?",
    sortOrder: 2,
    why: "DHS reviews complaint resolution documentation during surveys — unresolved complaints suggest systemic care issues.",
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Get all items for a specific category */
export function getChecklistByCategory(categoryKey: string): AfhSopChecklistItem[] {
  return afhSopChecklist.filter((item) => item.categoryKey === categoryKey);
}

/** Get total count of checklist items */
export function getChecklistTotal(): number {
  return afhSopChecklist.length;
}

/** Get a single item by id */
export function getChecklistItem(id: string): AfhSopChecklistItem | undefined {
  return afhSopChecklist.find((item) => item.id === id);
}

/** Get all category keys */
export function getCategoryKeys(): string[] {
  return afhSopCategories.map((cat) => cat.key);
}

/** Get category info by key */
export function getCategory(key: string): AfhSopCategory | undefined {
  return afhSopCategories.find((cat) => cat.key === key);
}
