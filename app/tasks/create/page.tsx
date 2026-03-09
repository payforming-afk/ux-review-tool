import { CreateTaskForm } from "@/components/create-task-form";

export default function TaskCreatePage() {
  return (
    <section className="stack-lg">
      <div className="section-head">
        <div>
          <p className="eyebrow">页面 2</p>
          <h2 className="section-title">新建走查任务</h2>
          <p className="section-subtitle">
            填写基础信息并上传设计稿与实现截图，创建可用于演示和走查的任务。
          </p>
        </div>
      </div>

      <CreateTaskForm />
    </section>
  );
}
