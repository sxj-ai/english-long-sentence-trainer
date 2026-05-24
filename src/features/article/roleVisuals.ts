export type RoleTone =
  | "subject"
  | "predicate"
  | "object"
  | "predicative"
  | "attributive"
  | "adverbial"
  | "complement"
  | "clause"
  | "parallel"
  | "inserted"
  | "special";

export function getRoleTone(role: string): RoleTone {
  if (role.includes("主语")) return "subject";
  if (role.includes("谓语")) return "predicate";
  if (role.includes("宾语")) return "object";
  if (role.includes("表语")) return "predicative";
  if (role.includes("定语")) return "attributive";
  if (role.includes("状语")) return "adverbial";
  if (role.includes("补语")) return "complement";
  if (role.includes("从句")) return "clause";
  if (role.includes("并列")) return "parallel";
  if (role.includes("插入")) return "inserted";
  return "special";
}

export function getRoleClass(role: string) {
  return `grammar-${getRoleTone(role)}`;
}

export const ROLE_LEGEND = [
  { role: "主语", tone: "subject" },
  { role: "谓语", tone: "predicate" },
  { role: "宾语", tone: "object" },
  { role: "表语", tone: "predicative" },
  { role: "定语", tone: "attributive" },
  { role: "状语", tone: "adverbial" },
  { role: "补语", tone: "complement" },
  { role: "从句", tone: "clause" },
  { role: "并列", tone: "parallel" },
  { role: "插入语", tone: "inserted" }
] as const;
