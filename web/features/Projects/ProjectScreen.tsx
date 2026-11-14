"use client";
// One project (a watch): its goal, requirements, sources, checks, findings and the pause/stop controls. Scaffold:
// a placeholder with a way back until the Projects stream fills it in.
import { Screen, ScreenStack } from "@/web/shared/Screen";
import { SisuButton, SisuCard } from "@/web/shared/SisuStyle";

export interface ProjectScreenProps {
  /** The watch id (`PropertyWatch.id`). */
  id: string;
  onClose: () => void;
}

export function ProjectScreen({ id, onClose }: ProjectScreenProps) {
  return (
    <Screen testId="project.screen">
      <ScreenStack>
        <SisuCard>
          <h1 style={{ font: "var(--sisu-type-h2)", color: "var(--sisu-color-text)", margin: 0 }}>Project</h1>
          <p style={{ font: "var(--sisu-type-body)", color: "var(--sisu-color-text-muted)", margin: 0 }} data-project-id={id}>
            The details of this project are not shown here yet.
          </p>
        </SisuCard>
        <SisuButton label="Back" style="secondary" action={onClose} />
      </ScreenStack>
    </Screen>
  );
}
