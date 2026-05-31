import "dotenv/config";
import { getArticle, listArticles } from "../src/features/article/jsonArticleRepository";
import { prisma } from "../src/lib/db";

function buildSourceKey(input: {
  articleId: string;
  sentenceId: string;
  chunkId: string;
  word: string;
  meaning: string;
}) {
  return [
    input.articleId,
    input.sentenceId,
    input.chunkId,
    input.word.trim().toLowerCase(),
    input.meaning.trim()
  ].join("::");
}

async function main() {
  const summaries = await listArticles();
  let totalWords = 0;
  let created = 0;
  let updated = 0;

  for (const summary of summaries) {
    const article = await getArticle(summary.id);

    if (!article) {
      continue;
    }

    for (const sentence of article.sentences) {
      for (const keyWord of sentence.keyWords) {
        const sourceKey = buildSourceKey({
          articleId: article.id,
          sentenceId: sentence.sentenceId,
          chunkId: keyWord.chunkId,
          word: keyWord.word,
          meaning: keyWord.meaning
        });
        const existing = await prisma.vocabularyItem.findUnique({
          where: { sourceKey },
          select: { id: true }
        });

        await prisma.vocabularyItem.upsert({
          where: { sourceKey },
          update: {
            word: keyWord.word,
            meaning: keyWord.meaning,
            pos: keyWord.pos ?? null,
            sourceText: sentence.original,
            examYear: sentence.year,
            examType: sentence.examType,
            textId: sentence.textId,
            sourceFile: article.sourceFile,
            sourceArticleId: article.id,
            sourceSentenceId: sentence.sentenceId,
            sourceChunkId: keyWord.chunkId
          },
          create: {
            sourceKey,
            word: keyWord.word,
            meaning: keyWord.meaning,
            pos: keyWord.pos ?? null,
            sourceType: "ARTICLE",
            sourceArticleId: article.id,
            sourceSentenceId: sentence.sentenceId,
            sourceChunkId: keyWord.chunkId,
            sourceFile: article.sourceFile,
            sourceText: sentence.original,
            examYear: sentence.year,
            examType: sentence.examType,
            textId: sentence.textId,
            importanceLevel: "MEDIUM"
          }
        });

        totalWords += 1;

        if (existing) {
          updated += 1;
        } else {
          created += 1;
        }
      }
    }
  }

  const vocabularyCount = await prisma.vocabularyItem.count();

  console.log(
    JSON.stringify(
      {
        articles: summaries.length,
        totalWords,
        created,
        updated,
        vocabularyCount
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
