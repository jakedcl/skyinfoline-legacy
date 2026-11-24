"use client";

import type { Viewpoint, ViewpointId } from "@/lib/viewpoints";
import { VIEWPOINTS } from "@/lib/viewpoints";

type ViewpointSwitcherProps = {
  value: ViewpointId;
  onChange: (id: ViewpointId) => void;
};

export function ViewpointSwitcher({ value, onChange }: ViewpointSwitcherProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-end gap-1.5"
      role="tablist"
      aria-label="Skyline viewpoint"
    >
      {VIEWPOINTS.map((vp: Viewpoint) => {
        const active = vp.id === value;
        return (
          <button
            key={vp.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(vp.id)}
            className="pill"
          >
            {vp.label}
            <span
              className={[
                "hidden text-[10px] uppercase opacity-60 sm:inline",
              ].join(" ")}
            >
              {vp.heading}
            </span>
          </button>
        );
      })}
    </div>
  );
}
