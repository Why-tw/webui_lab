import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from generate_demo_projects import create_demo_record, populate_database


class GenerateDemoProjectsTests(unittest.TestCase):
    def test_records_match_supported_display_sizes_and_layer_shape(self) -> None:
        import random

        records = [create_demo_record(random.Random(7), index) for index in (0, 2, 4)]
        profiles = [record[0]["displayProfile"] for record in records]
        self.assertEqual(profiles, ["custom", "ssd1306", "ssd1327"])

        for project, _, _ in records:
            self.assertIn(project["projectType"], {"pixelArt", "icons", "devices"})
            width = project["canvasSize"]["width"]
            height = project["canvasSize"]["height"]
            self.assertEqual(len(project["layers"]), 3)
            for layer in project["layers"]:
                self.assertEqual(len(layer["pixels"]), height)
                self.assertTrue(all(len(row) == width for row in layer["pixels"]))

    def test_populate_database_appends_records_and_migrates_legacy_stars(self) -> None:
        import random

        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "shared.sqlite3"
            connection = sqlite3.connect(database_path)
            connection.executescript(
                """
                CREATE TABLE shared_projects (
                    project_id TEXT PRIMARY KEY,
                    project_json TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE shared_project_stars (
                    project_id TEXT NOT NULL,
                    voter_id TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (project_id, voter_id)
                );
                INSERT INTO shared_projects (project_id, project_json)
                VALUES ('existing', '{"fileName":"既有專案","authorName":"原作者"}');
                INSERT INTO shared_project_stars (project_id, voter_id)
                VALUES ('existing', 'legacy-voter');
                """
            )
            connection.close()

            records = [create_demo_record(random.Random(42), index) for index in range(2)]
            populate_database(database_path, records)

            connection = sqlite3.connect(database_path)
            self.assertEqual(
                connection.execute("SELECT COUNT(*) FROM shared_projects").fetchone()[0],
                3,
            )
            self.assertEqual(
                connection.execute(
                    "SELECT star_count FROM shared_projects WHERE project_id = 'existing'"
                ).fetchone()[0],
                1,
            )
            self.assertIsNone(
                connection.execute(
                    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_project_stars'"
                ).fetchone()
            )
            indexed_projects = connection.execute(
                "SELECT COUNT(*) FROM shared_projects_fts"
            ).fetchone()[0]
            self.assertEqual(indexed_projects, 3)
            generated_row = connection.execute(
                """
                SELECT project_json, preview_png
                FROM shared_projects
                WHERE project_id != 'existing'
                LIMIT 1
                """
            ).fetchone()
            generated_json, preview_png = generated_row
            self.assertTrue(json.loads(generated_json)["layers"])
            self.assertTrue(preview_png.startswith(b"\x89PNG\r\n\x1a\n"))
            self.assertIn(
                json.loads(generated_json)["projectType"],
                {"pixelArt", "icons", "devices"},
            )
            legacy_json = connection.execute(
                "SELECT project_json FROM shared_projects WHERE project_id = 'existing'"
            ).fetchone()[0]
            self.assertEqual(json.loads(legacy_json)["projectType"], "pixelArt")
            connection.close()


if __name__ == "__main__":
    unittest.main()
