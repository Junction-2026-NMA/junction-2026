"use client";
// One artboard of the contract in the lab: drawn with its contract defaults, with a button per `in` trigger
// (stamped, so each tap fires once) and its `out` triggers reported to the page.
import { useState, type CSSProperties } from "react";
import { RiveValue, type RiveValueMap } from "@/web/core/RiveContract";
import { riveEnums, type RiveComponentContract, type RiveContractProperty } from "@/web/rive/contract";
import { RiveComponent } from "@/web/rive/RiveComponent";

/** The contract defaults of every `in` value property (RiveBindings' sample values). */
export function contractDefaults(contract: RiveComponentContract): RiveValueMap {
  return contract.properties
    .filter((property) => property.direction !== "out" && property.type !== "trigger" && !property.name.startsWith("_"))
    .reduce<RiveValueMap>((values, property) => {
      const value = defaultValue(property);
      return value ? { ...values, [property.name]: value } : values;
    }, {});
}

function defaultValue(property: RiveContractProperty): RiveValue | null {
  const fallback = property.default;
  switch (property.type) {
    case "string":
      return RiveValue.string(typeof fallback === "string" ? fallback : "");
    case "number":
      return RiveValue.number(typeof fallback === "number" ? fallback : 0);
    case "boolean":
      return RiveValue.bool(fallback === true);
    case "enum":
      return typeof fallback === "string" ? RiveValue.enumCase(fallback) : null;
    default:
      return null;
  }
}

/** A frame for the components that follow their parent (fill), so they have something to fill. */
const frames: Partial<Record<string, CSSProperties>> = {
  Celebration: { width: "100%", height: 520 },
};

export function LabArtboard({ contract, onOut }: { contract: RiveComponentContract; onOut: (line: string) => void }) {
  const [fired, setFired] = useState<string[]>([]);
  const [values, setValues] = useState<RiveValueMap>(() => contractDefaults(contract));
  const enums = contract.properties.filter((property) => property.type === "enum" && property.direction !== "out");

  const fire = (name: string) => setFired((list) => [...list.filter((entry) => !entry.startsWith(`${name}#`)), `${name}#${Date.now()}`]);
  const { width, height } = contract.designSize;

  return (
    <section className="sisu-lab-card" data-testid={`lab.${contract.name}`}>
      <header className="sisu-lab-head">
        <h2>{contract.name}</h2>
        <span>
          {width} x {height} · {contract.sizing}
        </span>
      </header>
      <p className="sisu-lab-purpose">{contract.purpose}</p>
      <div className="sisu-lab-stage" style={frames[contract.name]}>
        <RiveComponent
          component={contract.name}
          values={values}
          triggers={fired}
          onTrigger={(name) => onOut(`${contract.name}.${name}`)}
          ariaLabel={contract.name}
        />
      </div>
      {contract.inTriggers.length > 0 || enums.length > 0 ? (
        <div className="sisu-lab-controls">
          {contract.inTriggers.map((name) => (
            <button key={name} type="button" className="sisu-lab-button" onClick={() => fire(name)}>
              fire {name}
            </button>
          ))}
          {enums.map((property) => (
            <EnumPicker key={property.name} property={property} values={values} onChange={setValues} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EnumPicker({ property, values, onChange }: {
  property: RiveContractProperty;
  values: RiveValueMap;
  onChange: (values: RiveValueMap) => void;
}) {
  const cases = property.enum ? (riveEnums[property.enum] ?? []) : [];
  const current = values[property.name];
  return (
    <label className="sisu-lab-enum">
      {property.name}
      <select
        value={current?.kind === "enumCase" ? current.value : ""}
        onChange={(event) => onChange({ ...values, [property.name]: RiveValue.enumCase(event.target.value) })}
      >
        {cases.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
