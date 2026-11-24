/**
 * Vitest setup: keeps every test file away from the real home directory.
 *
 * - HOME/USERPROFILE point to a fresh temp dir, so os.homedir() (and every
 *   ~/.letra path derived from it) is private to this test file.
 * - LETRA_CEILING_DIRECTORIES stops the upward workspace search at the OS
 *   temp dir. On Windows the temp dir lives under the real profile, and a
 *   stray marker there (e.g. ~/.letra-link) used to capture every test.
 * - LETRA_WORKSPACE from the developer's shell must not select a workspace.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const osTempDir = tmpdir();
const testHome = mkdtempSync(join(osTempDir, "letra-test-home-"));

process.env.HOME = testHome;
process.env.USERPROFILE = testHome;
process.env.LETRA_CEILING_DIRECTORIES = osTempDir;
delete process.env.LETRA_WORKSPACE;

afterAll(() => {
	rmSync(testHome, { recursive: true, force: true });
});
