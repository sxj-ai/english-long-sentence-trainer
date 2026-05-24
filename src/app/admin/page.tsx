import { Badge } from "@/components/common/Badge";

export default function AdminPage() {
  return (
    <div className="section-block narrow">
      <div className="section-heading">
        <Badge tone="amber">预留模块</Badge>
        <h1>后台管理</h1>
        <p>这里预留给后续文章上传、JSON 校验、结构块编辑、练习题管理和发布流程。</p>
      </div>

      <div className="roadmap-list">
        <div>上传并校验文章 JSON</div>
        <div>可视化编辑句子、chunk、重点词和重点短语</div>
        <div>发布、下架和版本管理</div>
        <div>接入数据库后查看用户学习数据</div>
      </div>
    </div>
  );
}
