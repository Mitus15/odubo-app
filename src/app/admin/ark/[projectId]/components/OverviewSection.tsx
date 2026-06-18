"use client";

import { useState } from "react";
import type { ArkProject } from "@/types/ark";

interface Props {
  project: ArkProject;
  onUpdate: (updates: Partial<ArkProject>) => void;
}

export default function OverviewSection({ project, onUpdate }: Props) {
  const [editingCharter, setEditingCharter] = useState(false);
  const [charter, setCharter] = useState(project.charter || "");

  const objectives = project.objectives ? JSON.parse(project.objectives) : [];
  const successCriteria = project.success_criteria ? JSON.parse(project.success_criteria) : [];
  const tags = project.tags ? JSON.parse(project.tags) : [];

  const saveCharter = () => {
    onUpdate({ charter });
    setEditingCharter(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Charter */}
      <div className="bg-[#1a1816] border border-[#302927] rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider">Charter</h3>
          <button
            onClick={() => editingCharter ? saveCharter() : setEditingCharter(true)}
            className="text-xs text-[#843c2d] hover:text-[#ede8df] transition-colors"
          >
            {editingCharter ? "Save" : "Edit"}
          </button>
        </div>
        {editingCharter ? (
          <textarea
            value={charter}
            onChange={(e) => setCharter(e.target.value)}
            rows={5}
            className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d] resize-y"
            autoFocus
          />
        ) : (
          <p className="text-sm text-[#ede8df] whitespace-pre-wrap">
            {project.charter || <span className="text-[#726d6c] italic">No charter defined yet. Click Edit to add one.</span>}
          </p>
        )}
      </div>

      {/* Objectives */}
      {objectives.length > 0 && (
        <div className="bg-[#1a1816] border border-[#302927] rounded-lg p-5">
          <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider mb-3">Objectives</h3>
          <ul className="space-y-2">
            {objectives.map((obj: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#ede8df]">
                <span className="text-[#843c2d] mt-0.5">&#9679;</span>
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success Criteria */}
      {successCriteria.length > 0 && (
        <div className="bg-[#1a1816] border border-[#302927] rounded-lg p-5">
          <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider mb-3">Success Criteria</h3>
          <ul className="space-y-2">
            {successCriteria.map((sc: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#ede8df]">
                <span className="text-[#22c55e] mt-0.5">&#10003;</span>
                {sc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider mb-2">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag: string, i: number) => (
              <span key={i} className="px-2 py-0.5 bg-[#302927] rounded text-xs text-[#ede8df]">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {project.metadata && (
        <div className="bg-[#1a1816] border border-[#302927] rounded-lg p-5">
          <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider mb-3">Additional Info</h3>
          <pre className="text-xs text-[#ede8df] whitespace-pre-wrap overflow-auto">
            {JSON.stringify(JSON.parse(project.metadata), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
