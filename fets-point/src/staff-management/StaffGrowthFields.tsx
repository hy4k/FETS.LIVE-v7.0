import React from "react";
export const growthFields = [
  ["certificates", "Certificates"],
  ["trainings_attended", "Trainings attended"],
  ["future_trainings", "Future training / plans"],
] as const;
export function StaffGrowthFields({
  value,
  onChange,
  disabled = false,
}: {
  value: any;
  onChange: (v: any) => void;
  disabled?: boolean;
}) {
  return (
    <div className="su-growth">
      {growthFields.map(([key, label]) => (
        <fieldset key={key} disabled={disabled}>
          <legend>{label}</legend>
          {(Array.isArray(value[key]) ? value[key] : []).map(
            (entry: any, index: number) => (
              <div className="su-entry" key={entry.id || index}>
                <input
                  aria-label={`${label} ${index + 1}`}
                  value={entry.title || ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      [key]: value[key].map((item: any, i: number) =>
                        i === index ? { ...item, title: e.target.value } : item,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={`Remove ${label} ${index + 1}`}
                  onClick={() =>
                    onChange({
                      ...value,
                      [key]: value[key].filter(
                        (_: any, i: number) => i !== index,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ),
          )}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                [key]: [
                  ...(value[key] || []),
                  { id: crypto.randomUUID(), title: "" },
                ],
              })
            }
          >
            Add {label.toLowerCase()}
          </button>
        </fieldset>
      ))}
      <label>
        Remarks
        <textarea
          aria-label="Remarks"
          rows={3}
          value={value.remarks || ""}
          onChange={(e) => onChange({ ...value, remarks: e.target.value })}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
