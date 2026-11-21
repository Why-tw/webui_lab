import json
import random
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from io import BytesIO

import server
from generate_demo_projects import create_demo_record, populate_database


class SharedProjectPreviewTests(unittest.TestCase):
    def test_share_endpoint_stores_original_json_and_png_preview(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database_path = root / "shared.sqlite3"
            request = server.ShareProjectRequest(
                fileName="測試作品",
                canvasSize={"width": 2, "height": 2},
                displayProfile="custom",
                authorName="測試者",
                layers=[{
                    "id": "layer-1",
                    "name": "主體",
                    "visible": True,
                    "pixels": [["#ff0000", None], [None, "#00ff00"]],
                }],
            )

            with (
                patch.object(server, "SHARED_PROJECTS_DB", database_path),
                patch("logging_system.logging_filename", str(root / "test.log")),
            ):
                result = server.share_project(request, None)

            with sqlite3.connect(database_path) as connection:
                project_json, preview_png = connection.execute(
                    "SELECT project_json, preview_png FROM shared_projects WHERE project_id = ?",
                    (result["projectId"],),
                ).fetchone()
            self.assertIn('"pixels"', project_json)
            self.assertTrue(preview_png.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_list_response_omits_pixels_and_preview_route_returns_png(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database_path = root / "shared.sqlite3"
            record = create_demo_record(random.Random(4), 0)
            populate_database(database_path, [record])
            project_id = record[0]["projectId"]

            with (
                patch.object(server, "SHARED_PROJECTS_DB", database_path),
                patch("logging_system.logging_filename", str(root / "test.log")),
            ):
                page = server.get_shared_projects(
                    None,
                    limit=20,
                    offset=0,
                    q=None,
                    sort="newest",
                    project_type=None,
                    display_profile=None,
                    voter_id="test-voter",
                )
                listed_project = page["projects"][0]
                self.assertNotIn("layers", listed_project)
                self.assertEqual(
                    listed_project["previewUrl"],
                    f"/api/projects/shared/{project_id}/preview",
                )

                response = server.get_shared_project_preview(project_id)
                self.assertEqual(response.media_type, "image/png")
                with Image.open(BytesIO(response.body)) as image:
                    self.assertLessEqual(max(image.size), 512)
                    image.verify()

            with sqlite3.connect(database_path) as connection:
                stored_project = connection.execute(
                    "SELECT project_json, preview_png FROM shared_projects WHERE project_id = ?",
                    (project_id,),
                ).fetchone()
            self.assertIn("layers", stored_project[0])
            self.assertTrue(stored_project[1].startswith(b"\x89PNG\r\n\x1a\n"))

    def test_existing_project_without_preview_is_migrated_on_first_image_request(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database_path = root / "legacy.sqlite3"
            project, _, _ = create_demo_record(random.Random(9), 1)
            connection = sqlite3.connect(database_path)
            connection.execute(
                """
                CREATE TABLE shared_projects (
                    project_id TEXT PRIMARY KEY,
                    project_json TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                "INSERT INTO shared_projects (project_id, project_json) VALUES (?, ?)",
                (project["projectId"], json.dumps(project)),
            )
            connection.commit()
            connection.close()

            with patch.object(server, "SHARED_PROJECTS_DB", database_path):
                response = server.get_shared_project_preview(project["projectId"])

            self.assertEqual(response.media_type, "image/png")
            with sqlite3.connect(database_path) as connection:
                preview_png = connection.execute(
                    "SELECT preview_png FROM shared_projects WHERE project_id = ?",
                    (project["projectId"],),
                ).fetchone()[0]
            self.assertTrue(preview_png.startswith(b"\x89PNG\r\n\x1a\n"))


if __name__ == "__main__":
    unittest.main()
