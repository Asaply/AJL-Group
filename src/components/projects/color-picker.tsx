"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS, parseHexColor } from "@/lib/colors";

export function ColorPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [color, setColor] = useState(parseHexColor(defaultValue) ?? PROJECT_COLORS[0]);
  const isCustom = !(PROJECT_COLORS as readonly string[]).includes(color);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={color} />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color del proyecto">
        {PROJECT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
            className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center ring-offset-background transition",
              color === c && "ring-2 ring-ring ring-offset-2"
            )}
            style={{ backgroundColor: c }}
          >
            {color === c && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}
        <label
          className={cn(
            "h-7 px-2 rounded-full border text-xs flex items-center gap-1 cursor-pointer",
            isCustom && "ring-2 ring-ring ring-offset-2"
          )}
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          Otro…
          <input
            type="color"
            className="sr-only"
            value={color.toLowerCase()}
            onChange={(e) => setColor(parseHexColor(e.target.value) ?? color)}
            aria-label="Color personalizado"
          />
        </label>
      </div>
    </div>
  );
}
