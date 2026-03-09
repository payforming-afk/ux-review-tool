"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useMemo,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";

interface CreateTaskResponse {
  task: {
    task_id: number;
  };
}

type UploadSide = "design" | "implementation";

export function CreateTaskForm() {
  const router = useRouter();
  const designInputRef = useRef<HTMLInputElement>(null);
  const implementationInputRef = useRef<HTMLInputElement>(null);

  const [designFiles, setDesignFiles] = useState<File[]>([]);
  const [implementationFiles, setImplementationFiles] = useState<File[]>([]);
  const [draggingSide, setDraggingSide] = useState<UploadSide | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pairingHint = useMemo(() => {
    if (designFiles.length === 0 || implementationFiles.length === 0) {
      return "上传后自动按顺序配对。";
    }

    if (designFiles.length === implementationFiles.length) {
      return `将按顺序生成 ${designFiles.length} 组比对。`;
    }

    if (designFiles.length === 1) {
      return `将使用 1 张设计稿对比 ${implementationFiles.length} 张实现图。`;
    }

    if (implementationFiles.length === 1) {
      return `将使用 1 张实现图对比 ${designFiles.length} 张设计稿。`;
    }

    return "当前数量不匹配：需两侧数量相等，或任一侧仅上传 1 张。";
  }, [designFiles, implementationFiles]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (designFiles.length === 0 || implementationFiles.length === 0) {
      setError("请至少上传 1 张设计稿和 1 张实现截图。");
      return;
    }

    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    designFiles.forEach((file) => {
      formData.append("design_images", file, file.name);
    });

    implementationFiles.forEach((file) => {
      formData.append("implementation_images", file, file.name);
    });

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "创建任务失败。");
      }

      const payload = (await response.json()) as CreateTaskResponse;
      form.reset();
      setDesignFiles([]);
      setImplementationFiles([]);
      router.push(`/tasks/${payload.task.task_id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "创建任务失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function onFilesSelected(side: UploadSide, event: ChangeEvent<HTMLInputElement>): void {
    const selected = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));

    if (side === "design") {
      setDesignFiles(selected);
      return;
    }

    setImplementationFiles(selected);
  }

  function onDrop(side: UploadSide, event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    setDraggingSide(null);

    const dropped = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));

    if (dropped.length === 0) {
      return;
    }

    if (side === "design") {
      setDesignFiles(uniqueBySignature(dropped));
      return;
    }

    setImplementationFiles(uniqueBySignature(dropped));
  }

  return (
    <form onSubmit={handleSubmit} className="form-card stack-md" encType="multipart/form-data">
      <div className="field-row">
        <label className="field">
          <span>任务名称</span>
          <input name="task_name" type="text" placeholder="首页视觉走查" required maxLength={120} />
        </label>

        <label className="field">
          <span>版本</span>
          <input name="version" type="text" placeholder="v1.0.3" required maxLength={60} />
        </label>
      </div>

      <label className="field">
        <span>负责人</span>
        <input name="owner" type="text" placeholder="zhangsan" required maxLength={80} />
      </label>

      <div className="upload-grid">
        <UploadDropZone
          title="设计稿（支持多图）"
          side="design"
          files={designFiles}
          isDragging={draggingSide === "design"}
          onPick={() => designInputRef.current?.click()}
          onDrop={onDrop}
          onDragState={setDraggingSide}
          onClear={() => setDesignFiles([])}
        />

        <UploadDropZone
          title="实现截图（支持多图）"
          side="implementation"
          files={implementationFiles}
          isDragging={draggingSide === "implementation"}
          onPick={() => implementationInputRef.current?.click()}
          onDrop={onDrop}
          onDragState={setDraggingSide}
          onClear={() => setImplementationFiles([])}
        />
      </div>

      <input
        ref={designInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden-file-input"
        onChange={(event) => onFilesSelected("design", event)}
      />
      <input
        ref={implementationInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden-file-input"
        onChange={(event) => onFilesSelected("implementation", event)}
      />

      <p className="hint-text">配对规则：{pairingHint}</p>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="actions">
        <button type="submit" className="button-link button-link-primary" disabled={isSubmitting}>
          {isSubmitting ? "创建中..." : "开始走查"}
        </button>
      </div>
    </form>
  );
}

function UploadDropZone({
  title,
  side,
  files,
  isDragging,
  onPick,
  onDrop,
  onDragState,
  onClear
}: {
  title: string;
  side: UploadSide;
  files: File[];
  isDragging: boolean;
  onPick: () => void;
  onDrop: (side: UploadSide, event: DragEvent<HTMLElement>) => void;
  onDragState: (side: UploadSide | null) => void;
  onClear: () => void;
}) {
  return (
    <section
      className={`drop-zone ${isDragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        onDragState(side);
      }}
      onDragLeave={() => onDragState(null)}
      onDrop={(event) => onDrop(side, event)}
    >
      <p className="drop-zone-title">{title}</p>
      <p className="drop-zone-subtitle">拖拽图片到此处，或点击按钮选择文件</p>

      <div className="actions">
        <button type="button" className="button-link" onClick={onPick}>
          选择图片
        </button>
        {files.length > 0 ? (
          <button type="button" className="button-link" onClick={onClear}>
            清空
          </button>
        ) : null}
      </div>

      <p className="drop-zone-count">已选 {files.length} 张</p>

      {files.length > 0 ? (
        <ul className="file-list">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">暂无图片</p>
      )}
    </section>
  );
}

function uniqueBySignature(files: File[]): File[] {
  const map = new Map<string, File>();

  files.forEach((file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    map.set(key, file);
  });

  return Array.from(map.values());
}
