// Derived from GateMem (MIT, Copyright (c) 2026 Renz); the licence text is in
// fixtures/bench/gatemem/UPSTREAM-LICENSE.
//
// GateMem's RAG-Policy baseline (PolicyRAGAgent in bench/agents/rag_policy.py
// at a983828), ported for condition C4 (ADR 0031): the metadata it attaches
// to each retrieved chunk (the speaker and their role, the principals and
// resources the text mentions, its content tags) and its relationship-aware
// gate, which decides from that metadata, the requester's role and the
// episode's relationships whether the requester may see the chunk.
//
// Upstream drops every chunk its gate refuses before retrieval, so the model
// never sees it: a deterministic filter before the model call, which is how
// the pre-registration defines C5, not C4. C4 is "the model decides from the
// metadata", so the runner shows every item with the gate's verdict as an
// attribute instead (packages/runner, ADR 0031). This module only computes the
// metadata and the verdict; it filters nothing.
//
// What is ported is the path the released data takes: chunk mode `turn`
// (run_eval.py's default and the paper's), and the gate without records
// (`_requester_can_access_chunk_without_records`), since no episode at the pin
// has `records[]` and no turn has `record_refs`; a turn that carried
// record_refs would be refused, as upstream refuses a chunk whose refs name no
// known record. Retrieval (TF-IDF or embeddings, top-k) is not ported: in the
// runner every condition retrieves through the same memory_read tool, so
// retrieval is not a difference between conditions (ADR 0015, decision D13).
//
// Only stripped fields reach the gate (strip.ts): the episode's principals and
// relationships, the turns up to the as-of turn, and the checkpoint's asker,
// query text and as-of turn. Upstream's gate reads no hidden field either:
// packages/bench/scripts/upstream-rag-policy-golden.py reruns it with every
// hidden field changed and records that nothing moved, and
// test/gatemem/rag-policy.test.ts holds the port to upstream's output.
//
// Python semantics where they differ from JavaScript: names are matched with
// re.search over Python patterns (py.ts, \w is Unicode), split and strip on
// Python whitespace, and lengths counted in code points.
import { createHash } from "node:crypto";
import { canonicalJson } from "@engram/core";
import { PY_SPACE, pyEscape, pyRegex, pyStrip } from "./py.ts";
import type { Checkpoint, Episode, Turn } from "./schema.ts";
import {
  type AgentCheckpoint,
  type AgentEpisode,
  visibleCheckpoint,
  visibleEpisode,
  visibleTurn,
} from "./strip.ts";
import { detectDomainFromEpisode } from "./vendor/domains.ts";

const MENTION_KEYS = [
  "principal_ids",
  "patient_ids",
  "student_ids",
  "resident_ids",
  "child_ids",
  "guest_ids",
  "project_ids",
  "program_ids",
  "building_ids",
  "household_ids",
] as const;
export type MentionKey = (typeof MENTION_KEYS)[number];
type Mentions = Record<MentionKey, Set<string>>;

/** One turn as the RAG-Policy agent chunks it, with the metadata it attaches and its gate's verdict. */
export interface RagPolicyChunk {
  turn_id: string;
  /** `[role:principal] text`, the chunk text upstream retrieves and shows. */
  text: string;
  principal_id: string;
  role: string;
  /** The principals and resources the text mentions, each list sorted. */
  mentions: Record<MentionKey, string[]>;
  /** The topics of the text (`_content_tags`), sorted. */
  content_tags: string[];
  /** Whether the gate lets the checkpoint's requester see the chunk. */
  allowed: boolean;
}

const SPACE_RUN = new RegExp(`[${PY_SPACE}]+`, "u");
const SPACE_RUN_G = new RegExp(`[${PY_SPACE}]+`, "gu");
/** str.split() with no separator. */
const pySplit = (s: string) => s.split(SPACE_RUN).filter((w) => w !== "");
const codePoints = (s: string) => [...s].length;

/** `_lower`: str(val or "").strip().lower() */
const lower = (v: unknown) => pyStrip(v ? String(v) : "").toLowerCase();

/** `_first_present` */
function firstPresent(obj: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v !== null && v !== undefined && pyStrip(String(v))) return pyStrip(String(v));
  }
  return "";
}

/** `_add_to_map_set` */
function addTo(store: Map<string, Set<string>>, key: string, value: string): void {
  if (!key || !value) return;
  let set = store.get(key);
  if (!set) {
    set = new Set();
    store.set(key, set);
  }
  set.add(value);
}

const get = (store: Map<string, Set<string>>, key: string) => store.get(key) ?? new Set<string>();
const union = <T>(into: Set<T>, from: Iterable<T>) => {
  for (const v of from) into.add(v);
  return into;
};
const subset = <T>(a: Set<T>, b: Set<T>) => [...a].every((v) => b.has(v));
const intersects = <T>(a: Set<T>, b: Iterable<T>) => [...b].some((v) => a.has(v));

const CLEAN_PARENS = /\([^)]*\)/g;
const CLEAN_TITLE = new RegExp(`^(dr\\.?|nurse|pharmacist|prof\\.?|professor)[${PY_SPACE}]+`, "u");

/** `_clean_name_for_aliases` */
function cleanName(name: string): string {
  let s = pyStrip((name || "").replace(CLEAN_PARENS, "")).toLowerCase();
  s = s.replace(CLEAN_TITLE, "");
  s = s.replace(SPACE_RUN_G, " ");
  return pyStrip(s);
}

const PRINCIPAL_PREFIXES = [
  "patient_",
  "family_",
  "clinician_",
  "nurse_",
  "pharmacist_",
  "reception_",
  "scheduler_",
  "billing_",
  "social_worker_",
  "pm_",
  "eng_",
  "sre_",
  "security_",
  "finance_",
  "legal_",
  "sales_",
  "exec_",
  "assistant_",
  "manager_",
  "employee_",
  "student_",
  "prof_",
  "advisor_",
  "ta_",
  "ra_",
  "registrar_",
  "finaid_",
  "it_",
  "deanassist_",
  "parent_",
  "residence_",
  "residentassistant_",
  "resident_",
  "partner_",
  "adult_",
  "child_",
  "guest_",
  "cleaner_",
  "technician_",
  "manager_",
  "contact_",
  "pickup_",
  "building_",
  "caregiver_",
] as const;

/** A stable unique list of stripped, lower-cased aliases. */
function uniqueAliases(aliases: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of aliases) {
    const a2 = pyStrip(a).toLowerCase();
    if (a2 && !seen.has(a2)) {
      out.push(a2);
      seen.add(a2);
    }
  }
  return out;
}

/** `_resource_aliases` */
function resourceAliases(resourceId: string): string[] {
  const rid = pyStrip(resourceId || "").toLowerCase();
  if (!rid) return [];
  const aliases = [rid.replaceAll("_", " ")];
  for (const pref of ["project_", "program_", "building_", "household_"]) {
    if (rid.startsWith(pref)) {
      const tail = rid.slice(pref.length).replaceAll("_", " ");
      aliases.push(tail);
      aliases.push(`${pref.slice(0, -1)} ${tail}`);
      break;
    }
  }
  return uniqueAliases(aliases.map((a) => pyStrip(a.replace(SPACE_RUN_G, " "))));
}

/** `_compile_alias_patterns`: longest alias first, each a whole-word, case-insensitive Python pattern. */
function aliasPatterns(aliases: readonly string[]): RegExp[] {
  const patterns: RegExp[] = [];
  const seen = new Set<string>();
  const sorted = [...aliases].sort((x, y) => codePoints(y) - codePoints(x));
  for (const alias of sorted) {
    const a = pyStrip(alias).toLowerCase();
    if (!a || seen.has(a)) continue;
    seen.add(a);
    patterns.push(pyRegex(`(?<!\\w)${pyEscape(a)}(?!\\w)`, true));
  }
  return patterns;
}

const CONTENT_GROUPS: readonly (readonly [string, readonly string[]])[] = [
  [
    "schedule",
    [
      "schedule",
      "scheduled",
      "calendar",
      "date",
      "time",
      "window",
      "slot",
      "appointment",
      "arrival",
      "pickup",
      "dropoff",
      "follow-up",
      "follow up",
      "hearing",
      "showcase",
      "dry-run",
      "dry run",
      "meeting",
      "location",
      "where",
      "when",
      "through friday",
      "through monday",
    ],
  ],
  [
    "logistics",
    [
      "entrance",
      "door",
      "lobby",
      "check in",
      "check-in",
      "wait outside",
      "call on arrival",
      "approved rooms",
      "presence rule",
      "transport",
      "release",
      "logistics",
      "broad wording",
      "safe broad",
      "safe wording",
      "summary",
      "status line",
    ],
  ],
  [
    "credential",
    [
      "token",
      "pin",
      "code",
      "credential",
      "password",
      "passphrase",
      "secret",
      "alarm",
      "badge",
      "camera-sharing",
      "camera sharing",
      "intercom",
      "access scope",
      "active token",
    ],
  ],
  [
    "funding",
    ["budget", "discount", "stipend", "grant", "aid", "funding", "scholarship", "amount"],
  ],
  ["legal", ["contract", "vendor", "privileged", "legal", "terms", "msa", "sow"]],
  [
    "security",
    ["incident", "diagnosis", "security", "coordination", "staging token", "access scope"],
  ],
  [
    "health",
    [
      "medication",
      "medications",
      "pain",
      "nausea",
      "symptom",
      "symptoms",
      "emergency",
      "scan",
      "imaging",
      "dose",
      "callback",
      "cardioversion",
      "hypertension",
      "gdm",
      "mavyret",
      "afib",
    ],
  ],
  ["billing", ["billing", "insurance", "coverage", "copay", "claim"]],
  ["support", ["support", "social work", "counsel", "check in", "check-in", "case"]],
  ["registration", ["registration", "registrar", "practicum", "title", "hold", "open"]],
  [
    "housing",
    ["room", "housing", "hall", "dorm", "beacon hall", "commons", "reassignment", "building"],
  ],
  ["pickup", ["pickup", "school", "robotics", "release"]],
  ["care", ["care", "caregiver", "approved rooms", "care window", "medication pass"]],
  ["cleaning", ["cleaning", "cleaner"]],
  ["repair", ["repair", "technician", "appliance"]],
  ["device", ["camera", "device", "setup", "local setup", "sharing scope"]],
];

/** `_content_tags` */
export function contentTags(text: string): Set<string> {
  const tl = (text || "").toLowerCase();
  const tags = new Set<string>();
  for (const [tag, needles] of CONTENT_GROUPS)
    if (needles.some((n) => tl.includes(n))) tags.add(tag);
  return tags;
}

const SCOPED_TAGS = new Set([
  "schedule",
  "logistics",
  "pickup",
  "credential",
  "device",
  "cleaning",
  "repair",
  "care",
  "housing",
]);

/** `_scope_allowed_tags` */
function scopeAllowedTags(scope: string): Set<string> | undefined {
  const s = pyStrip(scope || "").toLowerCase();
  if (!s) return undefined;
  const allowed = new Set<string>();
  const any = (...toks: string[]) => toks.some((t) => s.includes(t));
  if (
    any("schedule", "scheduled", "visit", "calendar", "same_day", "wednesday", "monday", "tuesday")
  )
    allowed.add("schedule");
  if (any("logistics", "wait_outside", "call_only", "call", "lobby")) allowed.add("logistics");
  if (any("pickup", "school", "robotics", "release"))
    union(allowed, ["pickup", "schedule", "logistics"]);
  if (any("credential", "token", "pin", "code", "badge", "intercom")) allowed.add("credential");
  if (any("local_setup", "setup", "device", "camera")) allowed.add("device");
  if (any("cleaning", "cleaner")) union(allowed, ["cleaning", "schedule", "logistics"]);
  if (any("repair", "appliance", "technician")) union(allowed, ["repair", "schedule", "logistics"]);
  if (any("care", "approved_rooms", "care_window", "medication pass"))
    union(allowed, ["care", "schedule", "logistics"]);
  if (any("building", "intercom", "lobby")) union(allowed, ["housing", "schedule", "logistics"]);
  return allowed.size > 0 ? allowed : undefined;
}

/** `_scope_allows_tags` */
function scopeAllowsTags(scope: string, tags: Set<string>): boolean {
  const allowed = scopeAllowedTags(scope);
  if (allowed === undefined) return true;
  const scoped = new Set([...tags].filter((t) => SCOPED_TAGS.has(t)));
  if (scoped.size === 0) return true;
  return subset(scoped, allowed);
}

const FULL_ACCESS_ROLES = new Set([
  "patient",
  "clinician",
  "product_manager",
  "engineer",
  "employee",
  "manager",
  "sre",
  "security",
  "legal",
  "finance",
  "executive",
  "primary_resident",
  "partner_spouse",
  "adult_child",
  "elder_family_member",
  "student",
  "professor",
  "advisor",
  "ta",
  "ra",
]);

/** `_role_allows_tags` */
function roleAllowsTags(requesterRole: string, tags: Set<string>): boolean {
  const role = lower(requesterRole);
  const any = (...t: string[]) => intersects(tags, t);
  if (FULL_ACCESS_ROLES.has(role)) return true;
  switch (role) {
    case "family_member":
    case "reception":
    case "scheduler":
    case "executive_assistant":
    case "hr":
    case "parent_guardian":
    case "trusted_contact":
    case "guest":
      return any("schedule", "logistics");
    case "billing":
      return any("billing", "schedule", "logistics");
    case "social_worker":
    case "counselor":
      return any("support", "schedule", "logistics");
    case "nurse":
    case "lab_tech":
      return any("health", "schedule", "logistics");
    case "pharmacist":
      return any("health", "credential");
    case "contractor":
      return !any("funding", "legal", "credential", "security");
    case "sales":
      return !any("credential", "security", "legal");
    case "campus_it":
    case "home_it_helper":
      return any("credential", "device", "housing");
    case "financial_aid":
      return any("funding", "schedule", "logistics");
    case "registrar":
      return any("registration", "schedule", "logistics");
    case "department_admin":
    case "dean_assistant":
      return any("schedule", "logistics", "registration");
    case "residence_staff":
    case "resident_assistant":
      return any("housing", "schedule", "logistics");
    case "household_manager":
      return any("schedule", "logistics", "cleaning", "repair");
    case "driver_pickup_contact":
      return any("pickup", "schedule", "logistics");
    case "caregiver":
      return any("care", "schedule", "logistics");
    case "cleaner":
      return any("cleaning", "schedule", "logistics");
    case "technician":
      return any("repair", "schedule", "logistics");
    case "building_staff":
      return any("credential", "device", "schedule", "logistics");
    case "minor_child":
      return any("pickup", "schedule", "logistics");
    default:
      return false;
  }
}

const emptyMentions = (): Mentions =>
  Object.fromEntries(MENTION_KEYS.map((k) => [k, new Set<string>()])) as Mentions;

/** The indices `_build_policy_indices` builds from the episode scaffold at reset. */
class PolicyIndex {
  readonly domain: string;
  readonly roleById = new Map<string, string>();
  private readonly principalPatterns = new Map<string, RegExp[]>();
  private readonly resourcePatterns = new Map<string, RegExp[]>();
  readonly projectsByPrincipal = new Map<string, Set<string>>();
  readonly projectMembers = new Map<string, Set<string>>();
  readonly projectBudgetOwners = new Map<string, Set<string>>();
  readonly projectLegalReviewers = new Map<string, Set<string>>();
  readonly projectContractors = new Map<string, Set<string>>();
  readonly projectSponsors = new Map<string, Set<string>>();
  readonly contractorProjects = new Map<string, Set<string>>();
  readonly assistantDelegateOf = new Map<string, Set<string>>();
  readonly managedByManager = new Map<string, Set<string>>();
  readonly programsByPrincipal = new Map<string, Set<string>>();
  readonly programMembers = new Map<string, Set<string>>();
  readonly buildingsByPrincipal = new Map<string, Set<string>>();
  readonly studentsByPrincipal = new Map<string, Set<string>>();
  readonly studentsByStaff = new Map<string, Set<string>>();
  readonly staffByStudent = new Map<string, Set<string>>();
  readonly guardianStudents = new Map<string, Set<string>>();
  readonly delegateForStaff = new Map<string, Set<string>>();
  readonly householdsByPrincipal = new Map<string, Set<string>>();
  readonly householdMembers = new Map<string, Set<string>>();
  readonly guestsByHost = new Map<string, Set<string>>();
  readonly childrenByPrincipal = new Map<string, Set<string>>();
  readonly serviceScopeByPrincipal = new Map<string, string>();
  readonly pickupChildren = new Map<string, Set<string>>();
  readonly caredFor = new Map<string, Set<string>>();
  readonly patientsByPrincipal = new Map<string, Set<string>>();
  readonly cliniciansByPatient = new Map<string, Set<string>>();
  readonly patientsByClinician = new Map<string, Set<string>>();
  readonly familyPatients = new Map<string, Set<string>>();
  readonly familyByPatient = new Map<string, Set<string>>();
  readonly familyScope = new Map<string, string>();

  constructor(episode: AgentEpisode) {
    this.domain = detectDomainFromEpisode(episode);
    const principals = (episode.entities.principals ?? []) as unknown as Record<string, unknown>[];
    const display = new Map<string, string>();
    const firstNames = new Map<string, number>();
    const lastNames = new Map<string, number>();
    for (const p of principals) {
      const pid = firstPresent(p, ["principal_id", "id"]);
      const role = firstPresent(p, ["role"]);
      const name = firstPresent(p, ["display_name", "name", "label"]);
      if (!pid) continue;
      this.roleById.set(pid, role);
      display.set(pid, name);
      const parts = pySplit(cleanName(name));
      if (parts.length > 0) {
        const [first, last] = [parts[0] as string, parts.at(-1) as string];
        firstNames.set(first, (firstNames.get(first) ?? 0) + 1);
        lastNames.set(last, (lastNames.get(last) ?? 0) + 1);
      }
    }
    for (const [pid, name] of display) {
      this.principalPatterns.set(
        pid,
        aliasPatterns(principalAliases(pid, name, firstNames, lastNames)),
      );
    }

    const resourceIds = new Set<string>();
    for (const rel of (episode.entities.relationships ?? []) as Record<string, unknown>[]) {
      const rtype = lower(rel.type);
      if (!rtype) continue;
      for (const key of ["project_id", "program_id", "building_id", "household_id"]) {
        const rv = firstPresent(rel, [key]);
        if (rv) resourceIds.add(rv);
      }
      this.relationship(rtype, rel);
    }
    for (const rid of resourceIds)
      this.resourcePatterns.set(rid, aliasPatterns(resourceAliases(rid)));
  }

  /** One relationship into the indices, by its type (the if chain of `_build_policy_indices`). */
  private relationship(rtype: string, rel: Record<string, unknown>): void {
    const f = (...keys: string[]) => firstPresent(rel, keys);
    if (rtype === "assigned_clinician" || rtype === "covering_clinician") {
      const pid = f("patient_id", "for_principal_id");
      const cid = f("clinician_id", "principal_id");
      addTo(this.cliniciansByPatient, pid, cid);
      addTo(this.patientsByClinician, cid, pid);
      addTo(this.patientsByPrincipal, cid, pid);
    } else if (rtype === "family_member") {
      const fid = f("family_id", "principal_id");
      const pid = f("patient_id", "for_principal_id");
      addTo(this.familyPatients, fid, pid);
      addTo(this.familyByPatient, pid, fid);
      this.familyScope.set(fid, lower(rel.access_level));
      addTo(this.patientsByPrincipal, fid, pid);
    } else if (rtype === "project_member" || rtype === "research_project_member") {
      const project = f("project_id");
      const principal = f("principal_id");
      addTo(this.projectMembers, project, principal);
      addTo(this.projectsByPrincipal, principal, project);
    } else if (rtype === "budget_owner") {
      const project = f("project_id");
      const principal = f("principal_id");
      addTo(this.projectBudgetOwners, project, principal);
      addTo(this.projectsByPrincipal, principal, project);
    } else if (rtype === "legal_reviewer") {
      const project = f("project_id");
      const principal = f("principal_id");
      addTo(this.projectLegalReviewers, project, principal);
      addTo(this.projectsByPrincipal, principal, project);
    } else if (rtype === "executive_sponsor") {
      const project = f("project_id");
      const principal = f("principal_id");
      addTo(this.projectSponsors, project, principal);
      addTo(this.projectsByPrincipal, principal, project);
    } else if (rtype === "contractor_for_project") {
      const contractor = f("principal_id", "contractor_id");
      const project = f("project_id");
      addTo(this.contractorProjects, contractor, project);
      addTo(this.projectContractors, project, contractor);
      addTo(this.projectsByPrincipal, contractor, project);
    } else if (rtype === "executive_delegate") {
      const assistant = f("principal_id", "assistant_id");
      const executive = f("for_principal_id", "executive_id");
      if (
        assistant &&
        executive &&
        ["scheduling_only", "schedule_only", "calendar_only"].includes(lower(rel.access_scope))
      )
        addTo(this.assistantDelegateOf, assistant, executive);
    } else if (rtype === "people_manager") {
      addTo(
        this.managedByManager,
        f("principal_id"),
        f("manages", "for_principal_id", "employee_id"),
      );
    } else if (rtype === "program_member" || rtype === "faculty_lead") {
      const program = f("program_id");
      const principal = f("principal_id");
      addTo(this.programMembers, program, principal);
      addTo(this.programsByPrincipal, principal, program);
    } else if (
      [
        "advisor_for",
        "research_supervisor",
        "funding_case_owner",
        "registrar_case_owner",
        "residence_case_owner",
      ].includes(rtype)
    ) {
      const staff = f("principal_id");
      const student = f("for_principal_id", "student_id");
      addTo(this.studentsByStaff, staff, student);
      addTo(this.staffByStudent, student, staff);
      addTo(this.studentsByPrincipal, staff, student);
      if (rtype === "residence_case_owner")
        addTo(this.buildingsByPrincipal, staff, f("building_id"));
    } else if (
      ["it_support", "building_access_support", "resident_assistant_for"].includes(rtype)
    ) {
      const pid = f("principal_id");
      addTo(this.projectsByPrincipal, pid, f("project_id"));
      addTo(this.buildingsByPrincipal, pid, f("building_id"));
    } else if (rtype === "delegate") {
      const assistant = f("principal_id");
      const staff = f("for_principal_id");
      if (
        assistant &&
        staff &&
        ["scheduling_only", "schedule_only"].includes(lower(rel.access_scope))
      )
        addTo(this.delegateForStaff, assistant, staff);
    } else if (rtype === "parent_of") {
      const parent = f("principal_id");
      const student = f("for_principal_id", "student_id");
      addTo(this.guardianStudents, parent, student);
      addTo(this.studentsByPrincipal, parent, student);
    } else if (rtype === "household_member") {
      const hid = f("household_id");
      const pid = f("principal_id");
      addTo(this.householdMembers, hid, pid);
      addTo(this.householdsByPrincipal, pid, hid);
    } else if (rtype === "host_of_guest") {
      const pid = f("principal_id");
      const gid = f("guest_id");
      const hid = f("household_id");
      addTo(this.guestsByHost, pid, gid);
      addTo(this.childrenByPrincipal, pid, gid);
      addTo(this.householdsByPrincipal, pid, hid);
      addTo(this.householdsByPrincipal, gid, hid);
    } else if (
      [
        "service_provider",
        "logistics_delegate",
        "trusted_backup",
        "device_setup_delegate",
      ].includes(rtype)
    ) {
      const pid = f("principal_id");
      addTo(this.householdsByPrincipal, pid, f("household_id"));
      if (pid) this.serviceScopeByPrincipal.set(pid, lower(rel.access_scope));
    } else if (rtype === "pickup_authorized") {
      const pid = f("principal_id");
      const child = f("for_principal_id", "child_id");
      addTo(this.pickupChildren, pid, child);
      addTo(this.childrenByPrincipal, pid, child);
      if (pid) this.serviceScopeByPrincipal.set(pid, lower(rel.access_scope));
    } else if (rtype === "caregiver_for") {
      const pid = f("principal_id");
      const target = f("for_principal_id");
      addTo(this.caredFor, pid, target);
      addTo(this.childrenByPrincipal, pid, target);
      if (pid) this.serviceScopeByPrincipal.set(pid, lower(rel.access_scope));
    }
  }

  /** `_infer_mentions` */
  inferMentions(text: string): Mentions {
    const out = emptyMentions();
    if (!text) return out;
    for (const [pid, patterns] of this.principalPatterns) {
      if (!patterns.some((p) => text.search(p) >= 0)) continue;
      out.principal_ids.add(pid);
      const role = this.roleById.get(pid) ?? "";
      if (role === "patient") out.patient_ids.add(pid);
      else if (role === "student") out.student_ids.add(pid);
      else if (["primary_resident", "partner_spouse", "adult_child", "minor_child"].includes(role))
        out.resident_ids.add(pid);
      if (role === "minor_child") out.child_ids.add(pid);
      if (role === "guest") out.guest_ids.add(pid);
    }
    for (const [rid, patterns] of this.resourcePatterns) {
      if (patterns.some((p) => text.search(p) >= 0)) addMentionedResource(out, rid);
    }
    return out;
  }

  /** `_merge_mentions_with_speakers` */
  withSpeakers(mentions: Mentions, principalIds: readonly string[]): Mentions {
    const out = emptyMentions();
    for (const k of MENTION_KEYS) union(out[k], mentions[k]);
    for (const pid of principalIds) {
      if (!pid) continue;
      out.principal_ids.add(pid);
      const role = this.roleById.get(pid) ?? "";
      if (role === "patient") out.patient_ids.add(pid);
      else if (role === "student") out.student_ids.add(pid);
      else if (
        [
          "primary_resident",
          "partner_spouse",
          "adult_child",
          "elder_family_member",
          "minor_child",
        ].includes(role)
      )
        out.resident_ids.add(pid);
      if (role === "minor_child") out.child_ids.add(pid);
      if (role === "guest") out.guest_ids.add(pid);
      union(out.project_ids, get(this.projectsByPrincipal, pid));
      union(out.program_ids, get(this.programsByPrincipal, pid));
      union(out.building_ids, get(this.buildingsByPrincipal, pid));
      union(out.household_ids, get(this.householdsByPrincipal, pid));
      union(out.patient_ids, get(this.patientsByPrincipal, pid));
      union(out.student_ids, get(this.studentsByPrincipal, pid));
      union(out.child_ids, get(this.childrenByPrincipal, pid));
    }
    return out;
  }
}

/** `_principal_aliases` */
function principalAliases(
  principalId: string,
  displayName: string,
  firstNames: Map<string, number>,
  lastNames: Map<string, number>,
): string[] {
  const aliases: string[] = [];
  const disp = cleanName(displayName);
  if (disp) {
    aliases.push(disp);
    const parts = pySplit(disp);
    if (parts.length >= 2) {
      const first = parts[0] as string;
      const last = parts.at(-1) as string;
      if (firstNames.get(first) === 1 && codePoints(first) >= 4) aliases.push(first);
      if (lastNames.get(last) === 1 && codePoints(last) >= 4) aliases.push(last);
    }
  }
  let tail = principalId;
  for (const pref of PRINCIPAL_PREFIXES) {
    if (tail.startsWith(pref)) {
      tail = tail.slice(pref.length);
      break;
    }
  }
  const pidAlias = pyStrip(tail.replaceAll("_", " ")).toLowerCase();
  if (pidAlias && pidAlias !== disp) aliases.push(pidAlias);
  return uniqueAliases(aliases);
}

/** `_add_mentioned_resource` */
function addMentionedResource(mentions: Mentions, rid: string): void {
  if (rid.startsWith("project_")) mentions.project_ids.add(rid);
  else if (rid.startsWith("program_")) mentions.program_ids.add(rid);
  else if (rid.startsWith("building_")) mentions.building_ids.add(rid);
  else if (rid.endsWith("_house") || rid.startsWith("household_")) mentions.household_ids.add(rid);
}

interface ChunkMeta {
  principal_ids: string[];
  mentions: Mentions;
  content_tags: Set<string>;
}

interface Requester {
  id: string;
  role: string;
}

function medicalAllowedPatients(ix: PolicyIndex, r: Requester, query: Mentions): Set<string> {
  const role = lower(r.role);
  if (role === "patient") return new Set([r.id]);
  if (role === "family_member") return new Set(get(ix.familyPatients, r.id));
  if (role === "clinician") return new Set(get(ix.patientsByClinician, r.id));
  return new Set(query.patient_ids);
}

function medicalAccess(ix: PolicyIndex, r: Requester, meta: ChunkMeta, query: Mentions): boolean {
  const allowed = medicalAllowedPatients(ix, r, query);
  if (allowed.size === 0) return false;
  const tags = meta.content_tags;
  if (!roleAllowsTags(r.role, tags)) return false;
  if (lower(r.role) === "family_member" && !scopeAllowsTags(ix.familyScope.get(r.id) ?? "", tags))
    return false;
  const mentions = ix.withSpeakers(meta.mentions, meta.principal_ids);
  const chunkPatients = new Set(mentions.patient_ids);
  for (const pid of mentions.principal_ids) union(chunkPatients, get(ix.patientsByPrincipal, pid));
  if (chunkPatients.size > 0 && !subset(chunkPatients, allowed)) return false;
  if (chunkPatients.size > 0) return true;
  const visible = new Set(allowed);
  for (const [pid, role] of ix.roleById) {
    if (
      [
        "reception",
        "scheduler",
        "billing",
        "social_worker",
        "lab_tech",
        "nurse",
        "pharmacist",
        "agent",
      ].includes(role)
    )
      visible.add(pid);
  }
  for (const patient of allowed) {
    union(visible, get(ix.cliniciansByPatient, patient));
    union(visible, get(ix.familyByPatient, patient));
  }
  return subset(new Set(meta.principal_ids), visible);
}

function officeAccess(ix: PolicyIndex, r: Requester, meta: ChunkMeta, query: Mentions): boolean {
  const role = lower(r.role);
  const tags = meta.content_tags;
  if (!roleAllowsTags(role, tags)) return false;
  const allowed = union(
    new Set(get(ix.projectsByPrincipal, r.id)),
    get(ix.contractorProjects, r.id),
  );
  for (const exec of get(ix.assistantDelegateOf, r.id))
    union(allowed, get(ix.projectsByPrincipal, exec));
  if (role === "manager" || role === "hr") union(allowed, query.project_ids);
  const mentions = ix.withSpeakers(meta.mentions, meta.principal_ids);
  const chunkProjects = new Set(mentions.project_ids);
  if (chunkProjects.size === 0) {
    for (const pid of mentions.principal_ids)
      union(chunkProjects, get(ix.projectsByPrincipal, pid));
  }
  if (chunkProjects.size > 0 && allowed.size > 0) return subset(chunkProjects, allowed);
  const visible = new Set([r.id]);
  for (const project of allowed) {
    union(visible, get(ix.projectMembers, project));
    union(visible, get(ix.projectBudgetOwners, project));
    union(visible, get(ix.projectLegalReviewers, project));
    union(visible, get(ix.projectContractors, project));
    union(visible, get(ix.projectSponsors, project));
  }
  union(visible, get(ix.managedByManager, r.id));
  return subset(new Set(meta.principal_ids), visible);
}

function educationAccess(ix: PolicyIndex, r: Requester, meta: ChunkMeta, query: Mentions): boolean {
  const role = lower(r.role);
  if (!roleAllowsTags(role, meta.content_tags)) return false;
  const students = new Set<string>();
  const projects = new Set<string>();
  const programs = new Set<string>();
  const buildings = new Set<string>();
  const ofStaff = (id: string) => {
    union(students, get(ix.studentsByStaff, id));
    union(projects, get(ix.projectsByPrincipal, id));
    union(programs, get(ix.programsByPrincipal, id));
    union(buildings, get(ix.buildingsByPrincipal, id));
  };
  if (role === "student") students.add(r.id);
  if (
    [
      "professor",
      "advisor",
      "ta",
      "ra",
      "counselor",
      "financial_aid",
      "registrar",
      "residence_staff",
      "resident_assistant",
      "campus_it",
    ].includes(role)
  )
    ofStaff(r.id);
  if (role === "dean_assistant") for (const staff of get(ix.delegateForStaff, r.id)) ofStaff(staff);
  if (role === "parent_guardian") union(students, get(ix.guardianStudents, r.id));
  if (role === "department_admin") {
    union(students, query.student_ids);
    union(projects, query.project_ids);
    union(programs, query.program_ids);
    union(buildings, query.building_ids);
  }
  if (students.size + projects.size + programs.size + buildings.size === 0) return false;
  const mentions = ix.withSpeakers(meta.mentions, meta.principal_ids);
  const [cs, cp, cg, cb] = [
    mentions.student_ids,
    mentions.project_ids,
    mentions.program_ids,
    mentions.building_ids,
  ];
  if (cs.size > 0 && !subset(cs, students)) return false;
  if (cp.size > 0 && projects.size > 0 && !subset(cp, projects)) return false;
  if (cg.size > 0 && programs.size > 0 && !subset(cg, programs)) return false;
  if (cb.size > 0 && buildings.size > 0 && !subset(cb, buildings)) return false;
  if (cs.size + cp.size + cg.size + cb.size > 0) return true;
  const visible = new Set([r.id]);
  for (const s of students) {
    union(visible, get(ix.staffByStudent, s));
    visible.add(s);
  }
  for (const p of projects) union(visible, get(ix.projectMembers, p));
  for (const p of programs) union(visible, get(ix.programMembers, p));
  for (const b of buildings) {
    for (const [pid, bs] of ix.buildingsByPrincipal) if (bs.has(b)) visible.add(pid);
  }
  return subset(new Set(meta.principal_ids), visible);
}

function householdAccess(ix: PolicyIndex, r: Requester, meta: ChunkMeta, query: Mentions): boolean {
  const role = lower(r.role);
  const tags = meta.content_tags;
  if (!roleAllowsTags(role, tags)) return false;
  const serviceScope = ix.serviceScopeByPrincipal.get(r.id) ?? "";
  if (serviceScope && !scopeAllowsTags(serviceScope, tags)) return false;
  const households = new Set(get(ix.householdsByPrincipal, r.id));
  const children = new Set(get(ix.pickupChildren, r.id));
  const guests = new Set(get(ix.guestsByHost, r.id));
  const cared = new Set(get(ix.caredFor, r.id));
  if (role === "guest") guests.add(r.id);
  if (
    [
      "primary_resident",
      "partner_spouse",
      "adult_child",
      "elder_family_member",
      "minor_child",
    ].includes(role)
  ) {
    union(children, get(ix.childrenByPrincipal, r.id));
    union(guests, get(ix.guestsByHost, r.id));
  }
  if (
    [
      "household_manager",
      "trusted_contact",
      "home_it_helper",
      "building_staff",
      "cleaner",
      "technician",
      "driver_pickup_contact",
      "caregiver",
    ].includes(role) &&
    households.size === 0
  )
    union(households, query.household_ids);
  const mentions = ix.withSpeakers(meta.mentions, meta.principal_ids);
  const [ch, cc, cg] = [mentions.household_ids, mentions.child_ids, mentions.guest_ids];
  if (ch.size > 0 && households.size > 0 && !subset(ch, households)) return false;
  if (cc.size > 0 && children.size > 0 && !subset(cc, children)) return false;
  if (cg.size > 0 && guests.size > 0 && !subset(cg, guests)) return false;
  if (cared.size > 0 && intersects(cared, mentions.principal_ids)) return true;
  if (ch.size + cc.size + cg.size > 0) return true;
  const visible = new Set([r.id]);
  for (const hid of households) {
    union(visible, get(ix.householdMembers, hid));
    for (const [pid, hs] of ix.householdsByPrincipal) if (hs.has(hid)) visible.add(pid);
  }
  return subset(new Set(meta.principal_ids), visible);
}

/** `_requester_can_access_chunk_without_records` */
function chunkAccess(ix: PolicyIndex, r: Requester, meta: ChunkMeta, query: Mentions): boolean {
  switch (ix.domain) {
    case "medical":
      return medicalAccess(ix, r, meta, query);
    case "office":
      return officeAccess(ix, r, meta, query);
    case "education":
      return educationAccess(ix, r, meta, query);
    case "household":
      return householdAccess(ix, r, meta, query);
    default:
      return ix.withSpeakers(meta.mentions, meta.principal_ids).principal_ids.has(r.id);
  }
}

/** Chunker._turn_text with the speaker prefix (include_speaker_prefix defaults to true). */
export const chunkText = (turn: Pick<Turn, "speaker" | "text">) =>
  pyStrip(`[${turn.speaker.role}:${turn.speaker.principal_id}] ${turn.text}`);

const sorted = (m: Mentions) =>
  Object.fromEntries(MENTION_KEYS.map((k) => [k, [...m[k]].sort()])) as Record<
    MentionKey,
    string[]
  >;

/**
 * Each turn up to the checkpoint as upstream's RAG-Policy agent chunks it
 * (one chunk per turn), with the metadata it attaches and whether its gate
 * lets the checkpoint's requester see it. `turns` are the turns the agent has
 * ingested, in order; only stripped fields are read.
 */
export function ragPolicyGate(
  episode: AgentEpisode,
  turns: readonly Turn[],
  checkpoint: AgentCheckpoint,
): RagPolicyChunk[] {
  const ix = new PolicyIndex(episode);
  const requester = { id: checkpoint.asker.principal_id, role: checkpoint.asker.role };
  const query = ix.inferMentions(checkpoint.query_text);
  return turns.map((turn) => {
    const text = chunkText(turn);
    const meta: ChunkMeta = {
      principal_ids: [turn.speaker.principal_id],
      mentions: ix.inferMentions(text),
      content_tags: contentTags(text),
    };
    // A chunk naming records is gated on them upstream; no record is known
    // without records[], so such a chunk is refused (`_allowed_chunk_ids`).
    const refs = turn.record_refs ?? [];
    const allowed = refs.length === 0 && chunkAccess(ix, requester, meta, query);
    return {
      turn_id: turn.turn_id,
      text,
      principal_id: turn.speaker.principal_id,
      role: turn.speaker.role,
      mentions: sorted(meta.mentions),
      content_tags: [...meta.content_tags].sort(),
      allowed,
    };
  });
}

/** What upstream-rag-policy-golden.py records of one checkpoint: the gate's verdicts and a hash of the chunk metadata. */
export interface RagPolicyAudit {
  checkpoint_id: string;
  chunks: number;
  /** The turn ids the gate allows, in turn order. */
  allowed: string[];
  /** sha256 of the chunks' metadata as canonical JSON (sorted keys, no spaces). */
  meta_sha256: string;
}

/** The audit of one loaded checkpoint, stripped first, comparable with upstream's golden rows. */
export function ragPolicyAudit(loaded: Episode, loadedCheckpoint: Checkpoint): RagPolicyAudit {
  const upTo = loaded.turns.findIndex((t) => t.turn_id === loadedCheckpoint.as_of_turn_id);
  if (upTo < 0)
    throw new Error(`no turn ${loadedCheckpoint.as_of_turn_id} in ${loaded.episode_id}`);
  const chunks = ragPolicyGate(
    visibleEpisode(loaded),
    loaded.turns.slice(0, upTo + 1).map(visibleTurn),
    visibleCheckpoint(loadedCheckpoint),
  );
  const meta = chunks.map((c) => ({
    turn_ids: [c.turn_id],
    principal_ids: [c.principal_id],
    roles: [c.role],
    text: c.text,
    mentions: c.mentions,
    content_tags: c.content_tags,
  }));
  return {
    checkpoint_id: loadedCheckpoint.checkpoint_id,
    chunks: chunks.length,
    allowed: chunks.filter((c) => c.allowed).map((c) => c.turn_id),
    meta_sha256: createHash("sha256").update(canonicalJson(meta)).digest("hex"),
  };
}
