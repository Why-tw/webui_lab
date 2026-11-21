import json
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import server


class SharedProjectFilteringTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_cwd = os.getcwd()
        os.chdir(self.temp_dir.name)
        self.database_path = Path(self.temp_dir.name) / "shared.sqlite3"
        self.database_patch = patch.object(server, "SHARED_PROJECTS_DB", self.database_path)
        self.database_patch.start()

        projects = [
            ("legacy", "Old pixel", "custom", None),
            ("icon", "Icon project", "custom", "icons"),
            ("device", "Device project", "ssd1306", "devices"),
            ("pixel", "Pixel project", "ssd1327", "pixelArt"),
        ]
        connection = sqlite3.connect(self.database_path)
        try:
            connection.execute(
                """
                CREATE TABLE shared_projects (
                    project_id TEXT PRIMARY KEY,
                    project_json TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            for index, (project_id, file_name, profile, project_type) in enumerate(projects):
                project = {
                    "projectId": project_id,
                    "fileName": file_name,
                    "canvasSize": {"width": 16, "height": 16},
                    "displayProfile": profile,
                    "authorName": "tester",
                    "layers": [],
                }
                if project_type:
                    project["projectType"] = project_type
                connection.execute(
                    """
                    INSERT INTO shared_projects (project_id, project_json, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (project_id, json.dumps(project), f"2026-01-0{index + 1} 00:00:00"),
                )
            connection.commit()
        finally:
            connection.close()

    def tearDown(self) -> None:
        self.database_patch.stop()
        os.chdir(self.original_cwd)
        self.temp_dir.cleanup()

    def test_project_type_and_display_profile_filters_combine(self) -> None:
        result = server.get_shared_projects(
            None,
            limit=50,
            offset=0,
            q=None,
            sort="newest",
            project_type=["pixelArt", "icons"],
            display_profile="custom",
            voter_id=None,
        )

        self.assertEqual(
            {project["projectId"] for project in result["projects"]},
            {"legacy", "icon"},
        )
        self.assertEqual(
            {project["projectType"] for project in result["projects"]},
            {"pixelArt", "icons"},
        )
        with closing(sqlite3.connect(self.database_path)) as connection:
            legacy_json = connection.execute(
                "SELECT project_json FROM shared_projects WHERE project_id = 'legacy'"
            ).fetchone()[0]
        self.assertEqual(json.loads(legacy_json)["projectType"], "pixelArt")

    def test_api_accepts_multiple_project_types(self) -> None:
        response = TestClient(server.app).get(
            "/api/projects/shared",
            params=[
                ("projectType", "icons"),
                ("projectType", "devices"),
                ("displayProfile", "ssd1306"),
            ],
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [project["projectId"] for project in response.json()["projects"]],
            ["device"],
        )

    def test_share_persists_selected_project_type_in_json(self) -> None:
        request = server.ShareProjectRequest.model_validate(
            {
                "fileName": "Shared icon",
                "canvasSize": {"width": 1, "height": 1},
                "displayProfile": "custom",
                "projectType": "icons",
                "authorName": "tester",
                "layers": [
                    {
                        "id": "layer-1",
                        "name": "Layer 1",
                        "visible": True,
                        "pixels": [[None]],
                    }
                ],
            }
        )

        result = server.share_project(request, None)

        with closing(sqlite3.connect(self.database_path)) as connection:
            project_json = connection.execute(
                "SELECT project_json FROM shared_projects WHERE project_id = ?",
                (result["projectId"],),
            ).fetchone()[0]
        self.assertEqual(json.loads(project_json)["projectType"], "icons")


if __name__ == "__main__":
    unittest.main()
