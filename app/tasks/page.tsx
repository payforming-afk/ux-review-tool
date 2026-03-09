import Link from "next/link";
import { listTasks } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default function TaskListPage() {
  const tasks = listTasks();

  return (
    <section className="stack-lg">
      <div className="section-head">
        <div>
          <p className="eyebrow">页面 1</p>
          <h2 className="section-title">走查任务列表</h2>
          <p className="section-subtitle">查看任务进度，快速进入具体比对结果并标注问题。</p>
        </div>

        <Link href="/create" className="button-link button-link-primary">
          新建任务
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <h3>暂无任务</h3>
          <p>创建第一个视觉走查任务，开始上传图片并生成差异结果。</p>
          <Link href="/create" className="button-link button-link-primary">
            去创建
          </Link>
        </div>
      ) : (
        <div className="task-table-wrap">
          <table className="task-table" aria-label="任务列表表格">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>版本</th>
                <th>负责人</th>
                <th>创建时间</th>
                <th>对比组</th>
                <th>问题数</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.task_id}>
                  <td>{task.task_name}</td>
                  <td>{task.version}</td>
                  <td>{task.owner}</td>
                  <td>{formatDate(task.created_at)}</td>
                  <td>
                    <span className="badge">{task.comparison_count}</span>
                  </td>
                  <td>
                    <span className="badge">{task.issue_count}</span>
                  </td>
                  <td>
                    <Link href={`/tasks/${task.task_id}`} className="inline-link">
                      打开走查
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatDate(raw: string): string {
  const date = new Date(raw.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("zh-CN");
}
