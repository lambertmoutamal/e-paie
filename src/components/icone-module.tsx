import { BarChart3, Calculator, CalendarDays, FileText, FolderLock, Receipt, Smartphone, type LucideIcon } from "lucide-react";
import type { IdModule } from "@/lib/modules";

export const ICONES_MODULES: Record<IdModule, LucideIcon> = {
  administration: FileText,
  bulletins: FolderLock,
  absences: CalendarDays,
  "self-service": Smartphone,
  "notes-de-frais": Receipt,
  pilotage: BarChart3,
  paie: Calculator,
};
