import type {
  TeamMember,
  PlanRecord,
  DutyEvent,
  CoverageChange,
} from "./shift-plan";
import type { Person } from "./shift-blueprint-repository";
import type {
  Responsibility,
  DayTask,
  ActionableDuty,
} from "./shift-blueprint";
export type DayData = {
  team: TeamMember[];
  people: Person[];
  record: PlanRecord | null;
  weekLead: string | null;
  events: DutyEvent[];
  changes: CoverageChange[];
  closed: boolean;
  jobs: Responsibility[];
  tasks: DayTask[];
  actionables: ActionableDuty[];
  actionablesFailed: boolean;
  lead: boolean;
  manager: boolean;
};
