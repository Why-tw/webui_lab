import argparse
import json
import sqlite3
import sys
from pathlib import Path


DEFAULT_DATABASE = Path(__file__).resolve().parent / "db" / "shared-projects.sqlite3"
PAGE_SIZE = 20


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def list_tables(connection: sqlite3.Connection) -> list[str]:
    return [
        name
        for schema, name, table_type, *_ in connection.execute("PRAGMA table_list")
        if schema == "main" and table_type in ("table", "virtual") and not name.startswith("sqlite_")
    ]


def table_columns(connection: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    if table not in list_tables(connection):
        raise ValueError(f"Unknown table: {table}")
    return connection.execute(f"PRAGMA table_info({quote_identifier(table)})").fetchall()


def fetch_rows(connection: sqlite3.Connection, table: str, limit: int = PAGE_SIZE) -> list[sqlite3.Row]:
    if table not in list_tables(connection):
        raise ValueError(f"Unknown table: {table}")
    return connection.execute(
        f"SELECT * FROM {quote_identifier(table)} LIMIT ?", (limit,)
    ).fetchall()


def delete_by_primary_key(
    connection: sqlite3.Connection, table: str, primary_key_values: list[str]
) -> int:
    columns = table_columns(connection, table)
    primary_key = [column for column in columns if column["pk"]]
    primary_key.sort(key=lambda column: column["pk"])
    if not primary_key:
        raise ValueError(f"Table {table} has no primary key; refusing to delete an ambiguous row.")
    if len(primary_key_values) != len(primary_key):
        raise ValueError(f"Expected {len(primary_key)} primary key value(s).")

    where_clause = " AND ".join(f"{quote_identifier(column['name'])} = ?" for column in primary_key)
    with connection:
        cursor = connection.execute(
            f"DELETE FROM {quote_identifier(table)} WHERE {where_clause}",
            primary_key_values,
        )
    return cursor.rowcount


def clear_database(connection: sqlite3.Connection) -> dict[str, int]:
    if connection.in_transaction:
        raise sqlite3.ProgrammingError("Cannot clear the database while a transaction is active.")
    tables = list_tables(connection)
    foreign_keys_enabled = connection.execute("PRAGMA foreign_keys").fetchone()[0]
    connection.execute("PRAGMA foreign_keys = OFF")
    try:
        connection.execute("BEGIN IMMEDIATE")
        deleted_counts: dict[str, int] = {}
        for table in tables:
            cursor = connection.execute(f"DELETE FROM {quote_identifier(table)}")
            deleted_counts[table] = cursor.rowcount

        has_sequence = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'"
        ).fetchone()
        if has_sequence:
            connection.execute("DELETE FROM sqlite_sequence")
        connection.commit()
        return deleted_counts
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.execute(f"PRAGMA foreign_keys = {int(foreign_keys_enabled)}")


def show_tables(connection: sqlite3.Connection) -> None:
    tables = list_tables(connection)
    if not tables:
        print("資料庫中沒有資料表。")
        return

    print("資料表：")
    for table in tables:
        count = connection.execute(
            f"SELECT COUNT(*) FROM {quote_identifier(table)}"
        ).fetchone()[0]
        print(f"  {table}（{count} 筆）")


def choose_table(connection: sqlite3.Connection) -> str | None:
    tables = list_tables(connection)
    if not tables:
        print("資料庫中沒有可管理的資料表。")
        return None

    print("可用資料表：" + "、".join(tables))
    table = input("資料表名稱：").strip()
    if table not in tables:
        print("找不到這個資料表。")
        return None
    return table


def show_rows(connection: sqlite3.Connection) -> None:
    table = choose_table(connection)
    if table is None:
        return
    rows = fetch_rows(connection, table)
    if not rows:
        print("這個資料表目前沒有資料。")
        return
    print(json.dumps([dict(row) for row in rows], ensure_ascii=False, indent=2, default=repr))
    if len(rows) == PAGE_SIZE:
        print(f"以上最多顯示 {PAGE_SIZE} 筆資料。")


def delete_row(connection: sqlite3.Connection) -> None:
    table = choose_table(connection)
    if table is None:
        return

    columns = table_columns(connection, table)
    primary_key = sorted((column for column in columns if column["pk"]), key=lambda column: column["pk"])
    if not primary_key:
        print("這個資料表沒有主鍵，為避免誤刪，無法使用此功能。")
        return

    values = [
        input(f"主鍵 {column['name']} 的值：")
        for column in primary_key
    ]
    if input("刪除前請輸入 DELETE 確認：").strip() != "DELETE":
        print("已取消刪除。")
        return

    deleted = delete_by_primary_key(connection, table, values)
    print("資料已刪除。" if deleted else "找不到符合主鍵的資料。")


def confirm_and_clear(connection: sqlite3.Connection, database_path: Path) -> None:
    print("\n警告：這會清除資料庫中所有資料表的資料，且無法復原；資料表結構會保留。")
    if input("確定要繼續嗎？輸入 yes：").strip().lower() != "yes":
        print("已取消清空。")
        return
    expected = f"CLEAR {database_path.name}"
    if input(f"最後確認，請輸入「{expected}」：").strip() != expected:
        print("確認文字不符，已取消清空。")
        return

    deleted_counts = clear_database(connection)
    deleted_total = sum(deleted_counts.values())
    print(f"已清除 {len(deleted_counts)} 個資料表中的資料，共 {deleted_total} 筆。")


def run(database_path: Path) -> int:
    if not database_path.is_file():
        print(f"找不到資料庫檔案：{database_path}", file=sys.stderr)
        return 1

    print(f"SQLite 資料庫管理工具：{database_path}")
    try:
        with sqlite3.connect(database_path) as connection:
            connection.row_factory = sqlite3.Row
            while True:
                print("\n1. 列出資料表和筆數")
                print("2. 檢視資料列")
                print("3. 依主鍵刪除資料列")
                print("4. 清空所有資料")
                print("0. 離開")
                choice = input("請選擇功能：").strip()
                if choice == "1":
                    show_tables(connection)
                elif choice == "2":
                    show_rows(connection)
                elif choice == "3":
                    delete_row(connection)
                elif choice == "4":
                    confirm_and_clear(connection, database_path)
                elif choice == "0":
                    return 0
                else:
                    print("無效的選項，請重新輸入。")
    except (OSError, sqlite3.Error, ValueError) as error:
        print(f"資料庫操作失敗：{error}", file=sys.stderr)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="互動式 SQLite 資料庫管理工具")
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DATABASE,
        help=f"SQLite 資料庫路徑（預設：{DEFAULT_DATABASE}）",
    )
    args = parser.parse_args()
    return run(args.db.expanduser().resolve())


if __name__ == "__main__":
    raise SystemExit(main())
