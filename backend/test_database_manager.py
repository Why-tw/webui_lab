import io
import sqlite3
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from database_manager import clear_database, confirm_and_clear, delete_by_primary_key, list_tables


class DatabaseManagerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys = ON")
        self.connection.executescript(
            """
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            );
            CREATE TABLE layers (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id)
            );
            INSERT INTO projects (name) VALUES ('pixel art');
            INSERT INTO layers (id, project_id) VALUES (1, 1);
            """
        )

    def tearDown(self) -> None:
        self.connection.close()

    def test_list_tables_excludes_sqlite_internal_tables(self) -> None:
        self.assertEqual(list_tables(self.connection), ["layers", "projects"])

    def test_delete_by_primary_key_deletes_only_matching_row(self) -> None:
        deleted = delete_by_primary_key(self.connection, "layers", ["1"])

        self.assertEqual(deleted, 1)
        self.assertEqual(self.connection.execute("SELECT COUNT(*) FROM layers").fetchone()[0], 0)

    def test_clear_database_removes_rows_and_preserves_schema(self) -> None:
        deleted_counts = clear_database(self.connection)

        self.assertEqual(deleted_counts, {"layers": 1, "projects": 1})
        self.assertEqual(list_tables(self.connection), ["layers", "projects"])
        self.assertEqual(self.connection.execute("SELECT COUNT(*) FROM layers").fetchone()[0], 0)
        self.assertEqual(self.connection.execute("SELECT COUNT(*) FROM projects").fetchone()[0], 0)
        self.assertEqual(self.connection.execute("PRAGMA foreign_keys").fetchone()[0], 1)

    def test_clear_requires_typed_confirmation(self) -> None:
        output = io.StringIO()
        with patch("builtins.input", side_effect=["yes", "CLEAR temp.sqlite3"]), redirect_stdout(output):
            confirm_and_clear(self.connection, Path("/tmp/temp.sqlite3"))

        self.assertIn("警告", output.getvalue())
        self.assertEqual(self.connection.execute("SELECT COUNT(*) FROM projects").fetchone()[0], 0)

    def test_clear_cancel_preserves_rows(self) -> None:
        with patch("builtins.input", return_value="no"):
            confirm_and_clear(self.connection, Path("/tmp/temp.sqlite3"))

        self.assertEqual(self.connection.execute("SELECT COUNT(*) FROM projects").fetchone()[0], 1)

    def test_clear_removes_fts_virtual_table_rows(self) -> None:
        self.connection.execute("CREATE VIRTUAL TABLE project_search USING fts5(name)")
        with self.connection:
            self.connection.execute("INSERT INTO project_search (name) VALUES ('pixel art')")

        clear_database(self.connection)

        self.assertEqual(
            self.connection.execute("SELECT COUNT(*) FROM project_search").fetchone()[0],
            0,
        )


if __name__ == "__main__":
    unittest.main()
