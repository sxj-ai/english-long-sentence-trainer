import { promises as fs } from "fs";
import path from "path";
import { rawSentenceArraySchema, validateSentenceRelations } from "../src/features/article/articleSchema";

async function main() {
  const articleDirs = [
    path.join(process.cwd(), "英语一json"),
    path.join(process.cwd(), "英语二json"),
    path.join(process.cwd(), "data", "articles")
  ];
  const files = (await Promise.all(articleDirs.map(readJsonFilesIfExists))).flat();
  let hasWarnings = false;

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = rawSentenceArraySchema.parse(JSON.parse(content));
    const warnings = validateSentenceRelations(parsed);

    console.log(`${path.relative(process.cwd(), filePath)}: ${parsed.length} sentences`);
    if (warnings.length > 0) {
      hasWarnings = true;
      for (const warning of warnings) {
        console.warn(`  - ${warning}`);
      }
    }
  }

  if (hasWarnings) {
    process.exitCode = 1;
  }
}

async function readJsonFilesIfExists(dir: string) {
  try {
    const files = await fs.readdir(dir);
    return files.filter((file) => file.endsWith(".json")).map((file) => path.join(dir, file));
  } catch {
    return [];
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
