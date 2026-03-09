import { CreateTaskForm } from "@/components/create-task-form";

export default function CreatePage() {
  return (
    <div className="app-shell">
      <section className="stack-lg">
        <div className="section-head">
          <div>
            <p className="eyebrow">页面 2</p>
            <h2 className="section-title">新建走查任务</h2>
            <p className="section-subtitle">
              填写任务信息并上传设计稿与实现截图，点击“开始走查”即可创建任务。
            </p>
          </div>
        </div>

        <CreateTaskForm />
      </section>
    </div>
  );
}
