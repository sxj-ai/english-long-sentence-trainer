# Sub2API AI 融合说明

这个项目现在已经接入了和 `sentence-learning-system` 同源的 Sub2API 能力。

## 已完成

```text
1. 全局色系改为浅蓝色
2. .env.example 增加 Sub2API 和 DeepSeek 备用配置项
3. 新增 src/lib/sub2api.ts
4. AI 自动批改服务 src/features/ai-grading/aiGradingService.ts 改为真实调用 Sub2API
5. 新增流式长难句问答 API：POST /api/ai/sentence-chat
6. 学生登录状态下的 AI 问答会保存到数据库
7. 新增 AI 学习分析 API：POST /api/ai/student-analysis
8. 学生端可以自己调用 AI 分析自己的学习状态
9. 老师端可以为名下学生调用 AI 生成具体学习画像
10. Sub2API 主模型不可用时，可在第一段输出前自动切换 DeepSeek 备用模型
```

## 环境变量

```text
SUB2API_BASE_URL=http://127.0.0.1:8080
SUB2API_API_KEY=你的 Sub2API API key
SUB2API_MODEL=gpt-5.5

DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=你的 DeepSeek API key
DEEPSEEK_MODEL=deepseek-v4-flash
AI_TIMEOUT_MS=30000
```

当前策略：

```text
1. 优先调用 Sub2API / GPT-5.5
2. 如果请求失败、超时、HTTP 错误，且尚未输出第一段内容，自动切换 DeepSeek
3. 如果主模型已经开始输出后中断，不拼接备用模型回答，而是提示重新发送
```

## 流式问答 API

请求地址：

```text
POST /api/ai/sentence-chat
```

请求体示例：

```json
{
  "sentence": "The sentence you want to analyze.",
  "question": "请帮我拆主干并解释从句。",
  "mode": "考研解析",
  "context": {
    "articleId": "kaoyan-2015-english1-text-1",
    "sentenceId": "S1",
    "translationLiteral": "结构直译",
    "chunks": []
  }
}
```

返回格式是 SSE：

```text
data: {"delta":"..."}
data: [DONE]
```

## 下一步接入位置

最适合先接入的位置是文章详情页右侧的句子面板：

```text
src/components/article/SentenceDetailPanel.tsx
```

建议增加一个“问 AI 老师”区域：

```text
当前选中句子
当前 chunks / 关键词 / 结构直译作为 context
学生输入问题
调用 /api/ai/sentence-chat
流式显示回答
```

这样旧项目原本的结构化真题解析，就能和现在项目的 AI 辅助问答真正结合起来。

## 已接入页面

学生问答入口：

```text
src/components/article/SentenceAiTutor.tsx
```

学生端学习分析：

```text
src/app/student/page.tsx
```

老师端学生画像和问答记录：

```text
src/app/teacher/page.tsx
```

## 数据表

新增两张表：

```text
AiConversation
StudentAiAnalysis
```

作用：

```text
AiConversation：保存学生在文章详情页向 AI 老师提出的问题、AI 回答和句子上下文。
StudentAiAnalysis：保存学生或老师主动触发的 AI 学习分析报告。
```

注意：学习分析不是固定输出“主干识别弱、从句判断弱”等抽象标签，而是要求 AI 引用学生真实问答、考试和批改状态，给出具体依据、能力判断、建议和下一步任务。
