"use client";

import type { ArkProject, ArkStatus } from "@/types/ark";

interface Props {
  project: ArkProject;
  statuses: ArkStatus[];
  onUpdate: (updates: Partial<ArkProject>) => void;
}

export default function ProjectHeader({ project, statuses, onUpdate }: Props) {
  const projectStatuses = statuses.filter((s) => s.applies_to === "all" || s.applies_to === "project");
  const taskPercent = project.task_count && project.task_count > 0
    ? Math.round(((project.task_done_count || 0) / project.task_count) * 100)
    : project.progress_percent;

  return (
    <div className="ark-header border-b border-[#302927]" style={{ paddingLeft: 'var(--ark-pad, 20px)', paddingRight: 'var(--ark-pad, 20px)' }}>
      <div className="flex items-start justify-between" style={{ gap: 'var(--ark-gap-lg, 16px)' }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center" style={{ gap: 'var(--ark-gap, 12px)' }}>
            {project.icon && <span className="ark-emoji">{project.icon}</span>}
            <div>
              <h1 className="font-bold text-[#ede8df]">{project.title}</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {project.category_name && (
                  <span
                    className="ark-badge font-medium"
                    style={{ backgroundColor: `${project.category_color || "#843c2d"}20`, color: project.category_color || "#843c2d" }}
                  >
                    {project.category_icon ? `${project.category_icon} ` : ""}{project.category_name}
                  </span>
                )}
                {project.priority && project.priority !== "medium" && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    project.priority === "critical" ? "bg-red-500/20 text-red-400" :
                    project.priority === "high" ? "bg-amber-500/20 text-amber-400" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>
                    {project.priority}
                  </span>
                )}
                {project.start_date && (
                  <span className="text-xs text-[#726d6c]">
                    {new Date(project.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    {project.target_date && ` — ${new Date(project.target_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status + Progress */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Progress ring */}
          {(taskPercent || 0) > 0 && (
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#302927" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none" stroke="#843c2d" strokeWidth="3"
                  strokeDasharray={`${(taskPercent || 0) * 0.942} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#ede8df]">{taskPercent}%</span>
            </div>
          )}

          {/* Status dropdown */}
          <select
            value={project.status_id || ""}
            onChange={(e) => onUpdate({ status_id: e.target.value })}
            className="bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-1.5 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
          >
            {projectStatuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
