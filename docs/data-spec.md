# 数据规范

当前 MVP 使用 `data/articles/*.json`。每个文件暂时保持句子数组结构，项目内部通过 adapter 包装为 Article。

完整的 v1.3 标注规范见 [v1.3-data-spec.md](./v1.3-data-spec.md)。后续生成新年份、新 Text 的 JSON 时，应以该文档为准。

必填字段：

- `sentence_id`
- `year`
- `exam_type`
- `text_id`
- `original`
- `difficulty`
- `translation_literal`
- `chunks`
- `key_words`
- `key_phrases`

`chunks` 中的 `parent_id` 和 `target_id` 如果不为 `null`，必须指向同一句内存在的 `chunk_id`。
