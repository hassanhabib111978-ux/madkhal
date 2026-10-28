"""Regression checks for production job-import workflows."""
from pathlib import Path
import ast
import re
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"


class ImporterWorkflowContracts(unittest.TestCase):
    def read_workflow(self, filename):
        return (WORKFLOWS / filename).read_text(encoding="utf-8")

    def test_no_literal_supabase_key_placeholder_remains(self):
        pattern = re.compile(
            r"""SUPABASE_KEY\s*=\s*["']\$\{SUPABASE_KEY\}["']"""
        )
        offenders = [
            path.name
            for path in WORKFLOWS.glob("*.yml")
            if pattern.search(path.read_text(encoding="utf-8"))
        ]
        self.assertEqual(
            offenders,
            [],
            f"Import workflows must read secrets from the environment, not a literal placeholder: {offenders}",
        )

    def test_myself_feed_uses_existing_jobs_schema_and_deduplicates(self):
        source = self.read_workflow("myself-jobs.yml")
        self.assertIn('"source_job_id": reference', source)
        self.assertNotIn('"source_id": reference', source)
        self.assertIn("existing_references", source)
        self.assertIn('"source_job_id": "in.(" + quoted_references + ")"', source)
        self.assertIn("if not SUPABASE_URL or not SUPABASE_KEY or not FEED_URL:", source)

    def test_himalayas_uses_environment_secret_and_surfaces_write_failures(self):
        source = self.read_workflow("un-jobs.yml")
        self.assertIn('SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")', source)
        self.assertIn("if not SUPABASE_KEY:", source)
        self.assertIn("failed += 1", source)
        self.assertIn("if failed:", source)
        self.assertIn("raise SystemExit(1)", source)

    def test_un_careers_uses_environment_secret_and_surfaces_write_failures(self):
        source = self.read_workflow("un-careers.yml")
        self.assertIn('SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")', source)
        self.assertIn("if not SUPABASE_KEY:", source)
        self.assertIn("failed += 1", source)
        self.assertIn("if failed:", source)
        self.assertIn("raise SystemExit(1)", source)

    def test_live_feed_rows_are_refreshed_instead_of_permanently_skipped(self):
        expectations = {
            "myself-jobs.yml": ("source_job_id", "method=\"PATCH\"", "Existing source records refreshed"),
            "un-jobs.yml": ('"source_job_id": "eq." + job_id', 'method="PATCH"', "Refreshed existing live jobs"),
            "un-careers.yml": ('"source_job_id": "eq." + job_id', 'method="PATCH"', "Refreshed existing live jobs"),
        }
        for filename, snippets in expectations.items():
            with self.subTest(filename=filename):
                source = self.read_workflow(filename)
                for snippet in snippets:
                    self.assertIn(snippet, source)
                self.assertIn('"last_checked_at": datetime.now(timezone.utc).isoformat()', source)

    def test_changed_python_importers_have_valid_python_syntax(self):
        for filename in ("myself-jobs.yml", "un-jobs.yml", "un-careers.yml"):
            with self.subTest(filename=filename):
                source = self.read_workflow(filename)
                lines = source.splitlines()
                starts = [
                    index for index, line in enumerate(lines)
                    if line.strip() == "python - <<'PY'"
                ]
                self.assertEqual(
                    len(starts),
                    1,
                    f"Expected exactly one Python heredoc in {filename}, found {len(starts)}",
                )
                start = starts[0]
                ends = [
                    index for index in range(start + 1, len(lines))
                    if lines[index].strip() == "PY"
                ]
                self.assertTrue(ends, f"Missing heredoc terminator in {filename}")
                script = textwrap.dedent("\n".join(lines[start + 1:ends[0]]))
                ast.parse(script, filename=filename)

    def test_import_workflows_use_read_only_github_token_permissions(self):
        for filename in ("myself-jobs.yml", "un-jobs.yml", "un-careers.yml"):
            with self.subTest(filename=filename):
                source = self.read_workflow(filename)
                self.assertRegex(source, r"(?m)^permissions:\n  contents: read$")


if __name__ == "__main__":
    unittest.main()
