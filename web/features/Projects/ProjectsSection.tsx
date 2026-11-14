"use client";
// The saved projects (watches) in the Sisu tab's history drawer. Scaffold: renders nothing until the Projects
// stream fills it in (read the watches with `CoachClient.watchList`, web/core/WatchModels.ts).

export interface ProjectsSectionProps {
  /** A project (a watch id) was tapped: open it (`AppModel.setOpenProjectId`). */
  onOpen: (id: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the agreed props, used once the section is built
export function ProjectsSection({ onOpen }: ProjectsSectionProps) {
  return null;
}
