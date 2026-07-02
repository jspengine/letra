import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SnapshotStore } from "./snapshot.js";
import { acStaleDetector } from "./detectors/ac-stale.js";
import { missingDirDetector } from "./detectors/missing-dir.js";
import { stageDriftDetector } from "./detectors/stage-drift.js";
import { harnessStaleDetector } from "./detectors/harness-stale.js";
import { acFalsePosDetector } from "./detectors/ac-false-pos.js";
import { missingSpecLinkDetector } from "./detectors/missing-spec-link.js";
import { writeWorkflow } from "../commands/flow-init.js";
import type { DiagnosticResult } from "./types.js";

export type DiagnosticType = "info" | "warning" | "error";

export interface DiagnosticOutput {
  fixes: {
    id: string;
    title: string;
    description: string;
    snapshotId: string;
  }[];
  suggestions: {
    id: string;
    title: string;
    description: string;
    type: DiagnosticType;
    detector: string;
  }[];
  errors: string[];
}

export class DiagnosticEngine {
  private rootDir: string;
  private snapshots: SnapshotStore;
  private projectType: string;
  private detectors = [
    acStaleDetector,
    acFalsePosDetector,
		missingDirDetector,
		stageDriftDetector,
    harnessStaleDetector,
    missingSpecLinkDetector,
  ];
  private lastOutput: DiagnosticOutput = {
    fixes: [],
    suggestions: [],
    errors: [],
  };
  private lastResults: import("./types.js").DiagnosticResult[] = [];
  private appliedFixes = new Set<string>();

  constructor(rootDir: string, projectType = "software") {
    this.rootDir = rootDir;
    this.projectType = projectType;
    this.snapshots = new SnapshotStore(rootDir);
  }

  getLastResults(): import("./types.js").DiagnosticResult[] {
    return [...this.lastResults];
  }

  async runAll(): Promise<DiagnosticOutput> {
    const output: DiagnosticOutput = { fixes: [], suggestions: [], errors: [] };
    const newApplied = new Set<string>();
    const allResults: import("./types.js").DiagnosticResult[] = [];

    for (const detector of this.detectors) {
      if (detector.devOnly && this.projectType !== "software") {
        continue;
      }
      try {
        const results = await detector.run(this.rootDir);
        allResults.push(...results);
        for (const result of results) {
          if (result.autoFix && result.certainty >= 0.9) {
            if (this.appliedFixes.has(result.id)) {
              continue;
            }
            try {
              const fix = await result.autoFix();
              if (fix.files.length === 0) continue;
              const snapshotId = await this.snapshots.save(
                result.id,
                result.title,
                fix.files,
              );
              for (const file of fix.files) {
                const absPath = join(this.rootDir, file.path);
                if (file.path === ".letra/workflow.json") {
                  const workflow = JSON.parse(file.after);
                  writeWorkflow(this.rootDir, { workflow, source: "stage-drift", skipSitrep: true, quiet: true, skipEngine: true });
                } else {
                  writeFileSync(absPath, file.after, "utf-8");
                }
              }
              newApplied.add(result.id);
              if (snapshotId) {
                output.fixes.push({
                  id: result.id,
                  title: result.title,
                  description: result.description,
                  snapshotId,
                });
              }
            } catch (fixError) {
              output.errors.push(
                `Auto-fix falhou para ${result.id}: ${fixError}`,
              );
            }
          } else {
            output.suggestions.push({
              id: result.id,
              title: result.title,
              description: result.description,
              type: result.type,
              detector: result.detector,
            });
          }
        }
      } catch (detError) {
        output.errors.push(`Detector ${detector.name} falhou: ${detError}`);
      }
    }

    this.appliedFixes = newApplied;
    this.lastOutput = output;
    this.lastResults = allResults;
    return output;
  }

  getLastOutput(): DiagnosticOutput {
    return this.lastOutput;
  }

  async undo(
    snapshotId: string,
  ): Promise<{ ok: boolean; restoredFiles: string[] }> {
    return this.snapshots.restore(snapshotId);
  }

  async redo(
    snapshotId: string,
  ): Promise<{ ok: boolean; redoneFiles: string[] }> {
    return this.snapshots.redo(snapshotId);
  }

  listSnapshots() {
    return this.snapshots.list();
  }

  ensureDirs(): void {
    const requiredDirs = [
      ".letra/templates",
      ".letra/brand",
      ".letra/snapshots",
    ];
    for (const dir of requiredDirs) {
      const fullPath = join(this.rootDir, dir);
      if (!existsSync(fullPath)) {
        try {
          const { mkdirSync } = require("node:fs");
          mkdirSync(fullPath, { recursive: true });
        } catch {
          /* best effort */
        }
      }
    }
  }
}

// import { deadIconsDetector } from "./detectors/dead-icons.js"; — TODO: implement
