"use client";

// WHY: Every creation screen asks the same two language questions. One control
// keeps the visible catalog, the stored code and the "Other language" escape
// hatch from drifting between Write, Generate, Chat and the pack editor.
// PACK: learner-interface
// 2026-10-24 opencode: created for the learner interface pack [pack: learner-interface]

import { useState } from "react";
import { COMMON_LANGUAGES, normalizeLanguage } from "@/lib/shared/language";

/** What one labelled language question needs from its form. */
interface LanguageFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  allowUnset?: boolean;
  unsetLabel?: string;
}

export default function LanguageField({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  allowUnset = false,
  unsetLabel = "Not set",
}: LanguageFieldProps) {
  const code = normalizeLanguage(value);
  const exact = COMMON_LANGUAGES.find((language) => language.code === code) ?? null;
  // A region tag such as en-US keeps its full value while showing a readable
  // name. The option only exists while that value is open, so the catalog stays
  // one clean sorted list.
  const base = code.split("-")[0];
  const baseOption = COMMON_LANGUAGES.find((language) => language.code === base) ?? null;
  const regionOption = !exact && baseOption ? { code, name: `${baseOption.name} (${code})` } : null;
  // WHY: A parent pack can replace the value while this field stays mounted.
  // Derive the unknown case from the current value, so a switch from one pack
  // to another never hides an unlisted language behind the first option.
  const unknown = code.length > 0 && !exact && !baseOption;
  const [otherRequested, setOtherRequested] = useState(unknown);
  const showOther = unknown || (otherRequested && code.length === 0);

  const choose = (next: string) => {
    if (next === "__other") {
      setOtherRequested(true);
      onChange("");
      return;
    }
    setOtherRequested(false);
    onChange(next);
  };

  return (
    <label className="field-label">
      {label}
      <span className="select-wrap">
        <select
          className="field"
          value={showOther ? "__other" : code}
          onChange={(event) => choose(event.target.value)}
          required={required}
          disabled={disabled}
        >
          {allowUnset ? (
            <option value="">{unsetLabel}</option>
          ) : (
            <option value="" disabled>
              Choose a language
            </option>
          )}
          {COMMON_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.name}
            </option>
          ))}
          {regionOption ? <option value={regionOption.code}>{regionOption.name}</option> : null}
          <option value="__other">Other language</option>
        </select>
      </span>
      {showOther ? (
        <input
          className="field"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type a language name or code"
          aria-label={`${label}, other language`}
          required={required}
          disabled={disabled}
        />
      ) : null}
    </label>
  );
}
