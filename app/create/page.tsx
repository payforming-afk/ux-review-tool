import { CreateTaskForm } from "@/components/create-task-form";

export default function CreateTaskPage() {
  return (
    <section className="stack-lg">
      <div className="section-head">
        <div>
          <p className="eyebrow">页面 2</p>
          <h2 className="section-title">创建走查任务</h2>
          <p className="section-subtitle">
            支持拖拽上传多张设计稿和实现截图，自动生成多组视觉差异比对。
          </p>
        </div>
      </div>

      <CreateTaskForm />
    </section>
  );
}
