import { useId } from "react";
import type {
  JlptVerbalScene,
  JlptVerbalScenePerson,
  JlptVerbalSceneProp,
  JlptVerbalSceneSetting,
} from "../types";
import styles from "../jlpt.module.css";

const X_BY_POSITION = { left: 94, center: 200, right: 306 } as const;

function SceneSetting({ setting }: { setting: JlptVerbalSceneSetting }) {
  switch (setting) {
    case "shop":
      return (
        <>
          <path d="M24 56h352M54 56v38m292-38v38" />
          <path d="M52 94h78m140 0h78M70 94v88m42-88v88m176-88v88m42-88v88" />
          <path d="M70 116h42m176 0h42M70 139h42m176 0h42" />
        </>
      );
    case "train":
      return (
        <>
          <rect x="24" y="42" width="352" height="146" rx="8" />
          <path d="M42 60h86v58H42zm230 0h86v58h-86M42 162h316M58 162v38m284-38v38" />
          <circle cx="200" cy="56" r="8" />
        </>
      );
    case "landmark":
      return (
        <>
          <path d="M24 179c42-44 77-35 113-11 44-57 91-63 139-3 37-26 67-26 100 14" />
          <circle cx="330" cy="54" r="18" />
          <path d="M182 90h36m-29 0 3-40h16l3 40m-36 0h50m-43 0-8 69m44-69 8 69" />
        </>
      );
    case "service-counter":
      return (
        <>
          <path d="M24 64h352M250 64v118M24 156h352v44H24z" />
          <path d="M270 88h80m-80 20h56" />
        </>
      );
    case "classroom":
      return (
        <>
          <rect x="64" y="42" width="272" height="75" rx="3" />
          <path d="M80 133h80v40H80zm160 0h80v40h-80M120 173v27m160-27v27" />
        </>
      );
    case "library":
      return (
        <>
          <path d="M24 52h352M48 52v130m82-130v130m140-130v130m82-130v130" />
          <path d="M48 76h82m-82 27h82m-82 27h82m-82 27h82M270 76h82m-82 27h82m-82 27h82m-82 27h82" />
          <path d="M154 151h92m-76 0-10 49m70-49 10 49" />
        </>
      );
    case "home":
      return (
        <>
          <rect x="42" y="46" width="88" height="70" rx="3" />
          <path d="M86 46v70M42 81h88M286 55v127m0-84h65v84M266 182h105" />
        </>
      );
    case "office":
      return (
        <>
          <rect x="34" y="48" width="104" height="66" rx="3" />
          <path d="M52 67h68M52 84h48M253 142h102v42H253zm16 42v16m70-16v16" />
        </>
      );
    case "street":
      return (
        <>
          <path d="M24 178h352M45 178V74h72v104m166 0V52h72v126M57 91h18m18 0h12M57 117h18m18 0h12m190-40h18m18 0h12m-48 25h18m18 0h12" />
          <path d="M174 178V72m0 0h50l-12 18 12 18h-50" />
        </>
      );
    case "cafe":
      return (
        <>
          <path d="M24 56h352M69 56v52m262-52v52M145 145h110m-93 0-12 55m88-55 12 55" />
          <path d="M58 92h60m164 0h60" />
        </>
      );
  }
}

function Person({ person }: { person: JlptVerbalScenePerson }) {
  const x = X_BY_POSITION[person.side];
  const towardCenter = person.side === "left" ? 1 : -1;
  const heldObjectX = x + 36 * towardCenter - 8;

  if (person.pose === "sitting") {
    return (
      <g transform={`translate(${x} 0)`}>
        <circle cx="0" cy="107" r="15" />
        <path d="M0 122v35h32m-32 0-18 26m50-26v28M-2 135l24 10" />
      </g>
    );
  }

  if (person.pose === "bowing") {
    return (
      <g transform={`rotate(${person.side === "left" ? 18 : -18} ${x} 145)`}>
        <circle cx={x} cy="106" r="15" />
        <path
          d={`M${x} 121v58m0 0-22 28m22-28 22 28M${x} 139l${18 * towardCenter} 25m${-18 * towardCenter} 0L${x} 139`}
        />
      </g>
    );
  }

  const arms =
    person.pose === "pointing" ? (
      <path
        d={`M${x} 139L${x + 28 * towardCenter} 149L${x + 55 * towardCenter} 146M${x} 139L${x - 24 * towardCenter} 164`}
      />
    ) : person.pose === "offering" ? (
      <path
        d={`M${x} 139L${x + 25 * towardCenter} 157L${x + 49 * towardCenter} 156M${x} 139L${x - 24 * towardCenter} 166`}
      />
    ) : person.pose === "requesting" ? (
      <path
        d={`M${x} 139L${x + 16 * towardCenter} 157L${x + 4 * towardCenter} 162M${x} 139L${x - 15 * towardCenter} 158L${x + 4 * towardCenter} 162`}
      />
    ) : person.pose === "confused" ? (
      <path
        d={`M${x} 139L${x + 13 * towardCenter} 155M${x} 139L${x - 16 * towardCenter} 157`}
      />
    ) : person.pose === "holding" ? (
      <path
        d={`M${x} 139L${x + 24 * towardCenter} 157L${x + 42 * towardCenter} 155M${x} 139L${x + 18 * towardCenter} 159`}
      />
    ) : (
      <path
        d={`M${x} 139L${x + 24 * towardCenter} 167M${x} 139L${x - 18 * towardCenter} 167`}
      />
    );

  return (
    <g>
      <circle cx={x} cy="106" r="15" />
      <path d={`M${x} 121v58m0 0-22 28m22-28 22 28`} />
      {arms}
      {person.pose === "holding" ? (
        <rect x={heldObjectX} y="148" width="16" height="13" rx="2" />
      ) : null}
      {person.pose === "speaking" ? (
        <path
          d={`M${x + 20 * towardCenter} 103l12 ${-5 * towardCenter}m-10 13 15 1m-16 10 12 6`}
        />
      ) : null}
      {person.pose === "confused" ? (
        <text
          x={x + 24 * towardCenter}
          y="92"
          fontSize="28"
          textAnchor="middle"
        >
          ?
        </text>
      ) : null}
    </g>
  );
}

function SceneProp({
  kind,
  position,
}: {
  kind: JlptVerbalSceneProp;
  position: "left" | "center" | "right";
}) {
  const x = X_BY_POSITION[position];
  switch (kind) {
    case "bag":
      return (
        <g>
          <rect x={x - 26} y="137" width="52" height="42" rx="5" />
          <path d={`M${x - 14} 137q0-18 14-18t14 18`} />
        </g>
      );
    case "shirt":
      return (
        <path
          d={`M${x - 12} 78l-18 10 9 18 9-5v43h40v-43l9 5 9-18-18-10-10 9z`}
        />
      );
    case "seat":
      return <path d={`M${x - 28} 155h56v26h-56zm3 26v22m50-22v22`} />;
    case "camera":
      return (
        <g>
          <rect x={x - 20} y="143" width="40" height="27" rx="4" />
          <circle cx={x} cy="156.5" r="8" />
          <path d={`M${x - 11} 143l5-7h14l5 7`} />
        </g>
      );
    case "calendar":
      return (
        <g>
          <rect x={x - 36} y="91" width="72" height="83" rx="4" />
          <path
            d={`M${x - 36} 111h72M${x - 20} 82v18m40-18v18M${x - 20} 128h14m12 0h14M${x - 20} 146h14m12 0h14`}
          />
          <path d={`M${x - 18} 162h25m0 0-8-7m8 7-8 7`} />
        </g>
      );
    case "machine":
      return (
        <g>
          <rect x={x - 26} y="87" width="52" height="94" rx="5" />
          <rect x={x - 15} y="100" width="30" height="23" rx="2" />
          <circle cx={x - 10} cy="140" r="3" />
          <circle cx={x} cy="140" r="3" />
          <path d={`M${x - 12} 158h24`} />
        </g>
      );
    case "pencil":
      return <path d={`M${x - 26} 158l45-22 7 7-45 22-12 2z`} />;
    case "glass":
      return <path d={`M${x - 14} 139h28l-4 35h-20z`} />;
    case "sign":
      return <path d={`M${x} 76v102m-30-102h60v42h-60zM${x - 18} 97h36`} />;
    case "window":
      return (
        <g>
          <rect x={x - 32} y="72" width="64" height="72" rx="2" />
          <path d={`M${x} 72v72m-32-36h64`} />
          <circle cx={x - 16} cy="88" r="7" />
          <path d={`M${x - 24} 126q5-9 10 0t10 0M${x + 3} 126q5-9 10 0t10 0`} />
        </g>
      );
    case "menu":
      return (
        <g>
          <rect x={x - 24} y="116" width="48" height="62" rx="3" />
          <path d={`M${x - 13} 132h26m-26 12h26m-26 12h18`} />
        </g>
      );
    case "umbrella":
      return (
        <path d={`M${x - 32} 130q32-36 64 0m-32 0v53q0 14 12 14 10 0 10-11`} />
      );
    case "document":
      return (
        <g>
          <rect x={x - 22} y="121" width="44" height="58" rx="2" />
          <path d={`M${x - 12} 137h24m-24 11h24m-24 11h17`} />
        </g>
      );
    case "box":
      return (
        <g>
          <path d={`M${x - 31} 142h62v43h-62zm0 0 13-14h36l13 14m-31-14v57`} />
        </g>
      );
    case "plate":
      return (
        <g>
          <ellipse cx={x} cy="162" rx="35" ry="12" />
          <path d={`M${x - 22} 153q22-28 44 0`} />
        </g>
      );
    case "charger":
      return (
        <path
          d={`M${x - 24} 151h30v25h-30zm30 12h18q8 0 8-8v-13m0 0-6 6m6-6 6 6`}
        />
      );
  }
}

export function JlptVerbalSceneIllustration({
  scene,
}: {
  scene: JlptVerbalScene;
}) {
  const id = useId().replaceAll(":", "");
  const markerId = `jlpt-speaker-arrow-${id}`;
  const speakerX = X_BY_POSITION[scene.speaker.side];

  return (
    <figure className={styles.verbalScene}>
      <svg
        viewBox="0 0 400 230"
        role="img"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      >
        <title id={`${id}-title`}>{scene.description}</title>
        <desc id={`${id}-description`}>
          The arrow marks the person who will speak next.
        </desc>
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
          >
            <path d="M0 0l8 4-8 4z" className={styles.verbalSceneArrowHead} />
          </marker>
        </defs>
        <g className={styles.verbalSceneBackdrop} aria-hidden="true">
          <SceneSetting setting={scene.setting} />
        </g>
        <g className={styles.verbalScenePeople} aria-hidden="true">
          <Person person={scene.speaker} />
          <Person person={scene.partner} />
        </g>
        {scene.prop ? (
          <g className={styles.verbalSceneObject} aria-hidden="true">
            <SceneProp {...scene.prop} />
          </g>
        ) : null}
        <path
          d={`M${speakerX} 24v48`}
          className={styles.verbalSceneArrow}
          markerEnd={`url(#${markerId})`}
          aria-hidden="true"
        />
      </svg>
      <figcaption>Arrow marks the person who will speak.</figcaption>
    </figure>
  );
}
