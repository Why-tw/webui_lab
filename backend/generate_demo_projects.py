import argparse
import json
import random
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4


DEFAULT_DATABASE = Path(__file__).resolve().parent / "db" / "shared-projects.sqlite3"
CUSTOM_SIZES = [(16, 16), (24, 24), (32, 24), (32, 32), (40, 32)]
THEMES = ("sunset", "flower", "robot", "planet", "cat", "house")
TITLE_WORDS = {
    "sunset": ("海邊日落", "暮色山丘", "橘色黃昏", "遠方的夕陽"),
    "flower": ("像素花園", "窗台小花", "春日花束", "夜色植物"),
    "robot": ("小小機器人", "維修中的機器人", "太空助手", "機械夥伴"),
    "planet": ("環環星球", "宇宙漫遊", "深空訊號", "月球基地"),
    "cat": ("打盹的貓", "夜行貓咪", "窗邊訪客", "像素貓日記"),
    "house": ("森林小屋", "雨天咖啡屋", "山頂燈火", "雲上住宅"),
}
AUTHORS = ("小像素", "Mori", "阿青", "pixel_fox", "星塵", "Rin", "豆子", "Kai")
PALETTES = (
    {
        "sky": "#27364a",
        "far": "#52627a",
        "ground": "#344a4b",
        "primary": "#e47759",
        "secondary": "#75a982",
        "accent": "#e6b85c",
        "light": "#f5e8bd",
        "dark": "#17232f",
    },
    {
        "sky": "#35445f",
        "far": "#65728b",
        "ground": "#423950",
        "primary": "#cf7290",
        "secondary": "#7f9ec4",
        "accent": "#efbd75",
        "light": "#f3dfc5",
        "dark": "#252a42",
    },
    {
        "sky": "#294b4e",
        "far": "#5c8271",
        "ground": "#38544a",
        "primary": "#db9c52",
        "secondary": "#8fae72",
        "accent": "#da735d",
        "light": "#f1e2ad",
        "dark": "#1d3539",
    },
    {
        "sky": "#403552",
        "far": "#725d7d",
        "ground": "#39404e",
        "primary": "#e58c68",
        "secondary": "#70a9a0",
        "accent": "#e9c16e",
        "light": "#f6e7c7",
        "dark": "#282638",
    },
)


def new_layer(width: int, height: int) -> list[list[str | None]]:
    return [[None for _ in range(width)] for _ in range(height)]


def draw_rect(
    pixels: list[list[str | None]],
    x: int,
    y: int,
    width: int,
    height: int,
    color: str,
) -> None:
    canvas_height = len(pixels)
    canvas_width = len(pixels[0])
    for row in range(max(0, y), min(canvas_height, y + height)):
        for column in range(max(0, x), min(canvas_width, x + width)):
            pixels[row][column] = color


def draw_ellipse(
    pixels: list[list[str | None]],
    center_x: int,
    center_y: int,
    radius_x: int,
    radius_y: int,
    color: str,
) -> None:
    if radius_x < 1 or radius_y < 1:
        draw_rect(pixels, center_x, center_y, 1, 1, color)
        return
    for y in range(max(0, center_y - radius_y), min(len(pixels), center_y + radius_y + 1)):
        for x in range(max(0, center_x - radius_x), min(len(pixels[0]), center_x + radius_x + 1)):
            distance = ((x - center_x) / radius_x) ** 2 + ((y - center_y) / radius_y) ** 2
            if distance <= 1:
                pixels[y][x] = color


def draw_triangle(
    pixels: list[list[str | None]],
    first: tuple[int, int],
    second: tuple[int, int],
    third: tuple[int, int],
    color: str,
) -> None:
    x1, y1 = first
    x2, y2 = second
    x3, y3 = third
    area = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
    if area == 0:
        return

    min_x = max(0, min(x1, x2, x3))
    max_x = min(len(pixels[0]) - 1, max(x1, x2, x3))
    min_y = max(0, min(y1, y2, y3))
    max_y = min(len(pixels) - 1, max(y1, y2, y3))
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            first_weight = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / area
            second_weight = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / area
            third_weight = 1 - first_weight - second_weight
            if first_weight >= 0 and second_weight >= 0 and third_weight >= 0:
                pixels[y][x] = color


def draw_line(
    pixels: list[list[str | None]],
    start: tuple[int, int],
    end: tuple[int, int],
    color: str,
) -> None:
    x, y = start
    end_x, end_y = end
    delta_x = abs(end_x - x)
    step_x = 1 if x < end_x else -1
    delta_y = -abs(end_y - y)
    step_y = 1 if y < end_y else -1
    error = delta_x + delta_y

    while True:
        draw_rect(pixels, x, y, 1, 1, color)
        if x == end_x and y == end_y:
            break
        doubled_error = 2 * error
        if doubled_error >= delta_y:
            error += delta_y
            x += step_x
        if doubled_error <= delta_x:
            error += delta_x
            y += step_y


def make_palette(profile: str, rng: random.Random) -> dict[str, str]:
    if profile == "ssd1306":
        return {
            "sky": "#000000",
            "far": "#000000",
            "ground": "#000000",
            "primary": "#ffffff",
            "secondary": "#ffffff",
            "accent": "#ffffff",
            "light": "#ffffff",
            "dark": "#000000",
        }
    if profile == "ssd1327":
        values = [f"#{step:02x}{step:02x}{step:02x}" for step in (24, 56, 88, 120, 152, 184, 216, 248)]
        return dict(zip(
            ("sky", "far", "ground", "primary", "secondary", "accent", "light", "dark"),
            rng.sample(values, len(values)),
        ))
    return dict(rng.choice(PALETTES))


def draw_scene(
    theme: str,
    width: int,
    height: int,
    palette: dict[str, str],
    rng: random.Random,
) -> tuple[list[list[str | None]], list[list[str | None]], list[list[str | None]]]:
    background = new_layer(width, height)
    subject = new_layer(width, height)
    details = new_layer(width, height)
    unit = max(1, min(width, height) // 16)
    center_x = width // 2
    center_y = height // 2
    ground_y = max(1, height * 3 // 4)

    draw_rect(background, 0, 0, width, height, palette["sky"])
    draw_rect(background, 0, height // 2, width, max(1, height // 8), palette["far"])
    draw_rect(background, 0, ground_y, width, height - ground_y, palette["ground"])

    for _ in range(max(2, width // 8)):
        star_x = rng.randrange(width)
        star_y = rng.randrange(max(1, height // 2))
        draw_rect(details, star_x, star_y, unit, unit, palette["light"])

    if theme == "sunset":
        draw_ellipse(subject, center_x, max(2, height // 3), max(2, width // 8), max(2, height // 4), palette["accent"])
        draw_triangle(subject, (0, ground_y), (width // 3, height // 3), (width * 2 // 3, ground_y), palette["dark"])
        draw_triangle(subject, (width // 3, ground_y), (width * 3 // 4, height // 2), (width, ground_y), palette["secondary"])
        for row in range(ground_y + unit, height, unit * 2):
            draw_rect(details, center_x - width // 6, row, max(1, width // 3), unit, palette["accent"])
    elif theme == "flower":
        flower_y = max(3, height // 3)
        stem_top = flower_y + unit * 2
        draw_rect(subject, center_x, stem_top, unit, max(unit, height - stem_top - unit * 3), palette["secondary"])
        draw_ellipse(subject, center_x - unit * 2, height * 2 // 3, unit * 2, unit, palette["secondary"])
        draw_ellipse(subject, center_x + unit * 2, height * 3 // 4, unit * 2, unit, palette["secondary"])
        petal_radius = max(1, unit * 2)
        for offset_x, offset_y in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            draw_ellipse(
                subject,
                center_x + offset_x * petal_radius,
                flower_y + offset_y * petal_radius,
                petal_radius,
                petal_radius,
                palette["primary"],
            )
        draw_ellipse(details, center_x, flower_y, unit, unit, palette["light"])
        draw_rect(subject, center_x - unit * 4, height - unit * 3, unit * 8, unit * 3, palette["primary"])
    elif theme == "robot":
        head_width = max(unit * 6, width // 3)
        head_height = max(unit * 5, height // 3)
        head_y = max(1, height // 5)
        draw_rect(subject, center_x - head_width // 2, head_y, head_width, head_height, palette["primary"])
        draw_rect(subject, center_x - head_width // 3, head_y + head_height, max(unit, head_width * 2 // 3), max(unit, height // 3), palette["secondary"])
        draw_rect(subject, center_x - unit, max(0, head_y - unit * 2), unit * 2, unit * 2, palette["accent"])
        eye_y = head_y + head_height // 2
        draw_rect(details, center_x - head_width // 4, eye_y, unit * 2, unit * 2, palette["light"])
        draw_rect(details, center_x + head_width // 8, eye_y, unit * 2, unit * 2, palette["light"])
        draw_rect(details, center_x - unit * 2, eye_y + unit * 3, unit * 4, unit, palette["dark"])
    elif theme == "planet":
        radius = max(3, min(width, height) // 4)
        draw_ellipse(subject, center_x, center_y, radius, radius, palette["primary"])
        draw_line(subject, (center_x - radius * 2, center_y), (center_x + radius * 2, center_y), palette["accent"])
        draw_line(details, (center_x - radius, center_y - unit), (center_x + radius, center_y - unit), palette["light"])
        for _ in range(max(2, width // 10)):
            x = rng.randrange(width)
            y = rng.randrange(height)
            if abs(x - center_x) > radius or abs(y - center_y) > radius:
                draw_rect(details, x, y, unit, unit, palette["light"])
    elif theme == "cat":
        head_width = max(unit * 8, width // 2)
        head_height = max(unit * 7, height // 2)
        head_y = max(1, height // 4)
        draw_triangle(subject, (center_x - head_width // 2, head_y + unit * 3), (center_x - head_width // 3, head_y), (center_x - unit, head_y + unit * 4), palette["primary"])
        draw_triangle(subject, (center_x + unit, head_y + unit * 4), (center_x + head_width // 3, head_y), (center_x + head_width // 2, head_y + unit * 3), palette["primary"])
        draw_ellipse(subject, center_x, head_y + head_height // 2, head_width // 2, head_height // 2, palette["primary"])
        eye_y = head_y + head_height // 2
        draw_rect(details, center_x - unit * 3, eye_y, unit, unit * 2, palette["dark"])
        draw_rect(details, center_x + unit * 2, eye_y, unit, unit * 2, palette["dark"])
        draw_triangle(details, (center_x - unit, eye_y + unit * 3), (center_x + unit, eye_y + unit * 3), (center_x, eye_y + unit * 4), palette["accent"])
        draw_line(details, (center_x - unit * 2, eye_y + unit * 4), (center_x - unit * 5, eye_y + unit * 3), palette["light"])
        draw_line(details, (center_x + unit * 2, eye_y + unit * 4), (center_x + unit * 5, eye_y + unit * 3), palette["light"])
    else:
        house_width = max(unit * 8, width // 2)
        house_height = max(unit * 5, height // 3)
        house_y = max(1, height // 2 - house_height // 3)
        left = center_x - house_width // 2
        right = left + house_width
        draw_rect(subject, left, house_y + unit * 3, house_width, house_height, palette["primary"])
        draw_triangle(subject, (left - unit, house_y + unit * 3), (center_x, house_y - unit), (right + unit, house_y + unit * 3), palette["dark"])
        draw_rect(subject, center_x - unit, house_y + house_height, unit * 2, max(unit, height - house_y - house_height), palette["secondary"])
        draw_rect(details, left + unit * 2, house_y + unit * 4, unit * 2, unit * 2, palette["light"])
        draw_rect(details, right - unit * 4, house_y + unit * 4, unit * 2, unit * 2, palette["light"])
        draw_rect(details, center_x - unit // 2, house_y + house_height, unit, unit, palette["accent"])

    return background, subject, details


def expand_pixels(
    pixels: list[list[str | None]], width: int, height: int, scale: int
) -> list[list[str | None]]:
    return [
        [pixels[y // scale][x // scale] for x in range(width)]
        for y in range(height)
    ]


def create_demo_record(rng: random.Random, index: int) -> tuple[dict[str, object], str, list[str]]:
    display_cycle = (
        ("custom", *rng.choice(CUSTOM_SIZES)),
        ("custom", *rng.choice(CUSTOM_SIZES)),
        ("ssd1306", 128, 64),
        ("custom", *rng.choice(CUSTOM_SIZES)),
        ("ssd1327", 128, 128),
        ("custom", *rng.choice(CUSTOM_SIZES)),
    )
    display_profile, width, height = display_cycle[index % len(display_cycle)]
    scale = max(1, min(width // 32, height // 32))
    logical_width = width // scale
    logical_height = height // scale
    theme = THEMES[index % len(THEMES)]
    palette = make_palette(display_profile, rng)
    background, subject, details = draw_scene(theme, logical_width, logical_height, palette, rng)

    project_id = str(uuid4())
    layers = []
    for layer_name, layer_pixels in (
        ("背景", background),
        ("主體", subject),
        ("細節", details),
    ):
        layers.append({
            "id": str(uuid4()),
            "name": layer_name,
            "visible": True,
            "pixels": expand_pixels(layer_pixels, width, height, scale),
        })

    title = rng.choice(TITLE_WORDS[theme])
    project_type = ("pixelArt", "icons", "devices")[index % 3]
    project = {
        "fileName": f"{title} {index + 1:02d}",
        "canvasSize": {"width": width, "height": height},
        "displayProfile": display_profile,
        "projectType": project_type,
        "authorName": rng.choice(AUTHORS),
        "layers": layers,
        "projectId": project_id,
    }
    created_at = (
        datetime.now(timezone.utc) - timedelta(minutes=rng.randint(0, 60 * 24 * 45))
    ).strftime("%Y-%m-%d %H:%M:%S")
    star_count = 0 if index % 5 == 0 else rng.randint(1, 60)
    voters = [str(uuid4()) for _ in range(star_count)]
    return project, created_at, voters


def populate_database(
    database_path: Path, records: list[tuple[dict[str, object], str, list[str]]]
) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS shared_projects (
                project_id TEXT PRIMARY KEY,
                project_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                star_voters_json TEXT NOT NULL DEFAULT '[]',
                star_count INTEGER NOT NULL DEFAULT 0,
                preview_png BLOB
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_shared_projects_created_at
            ON shared_projects (created_at DESC, project_id DESC)
            """
        )
        connection.commit()

        from server import (
            CanvasSize,
            SharedLayer,
            create_project_preview,
            ensure_shared_project_search_index,
            ensure_shared_project_preview_column,
            ensure_shared_project_star_fields,
            ensure_shared_project_type_fields,
        )

        ensure_shared_project_search_index(connection)
        ensure_shared_project_star_fields(connection)
        ensure_shared_project_type_fields(connection)
        ensure_shared_project_preview_column(connection)
        with connection:
            for project, created_at, voters in records:
                project_id = str(project["projectId"])
                project_json = json.dumps(project, ensure_ascii=False, separators=(",", ":"))
                canvas_size = CanvasSize.model_validate(project["canvasSize"])
                layers = [
                    SharedLayer.model_validate(layer)
                    for layer in project["layers"]
                ]
                preview_png = create_project_preview(canvas_size, layers)
                connection.execute(
                    """
                    INSERT INTO shared_projects (
                        project_id, project_json, created_at, star_voters_json, star_count,
                        preview_png
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        project_id,
                        project_json,
                        created_at,
                        json.dumps(voters, separators=(",", ":")),
                        len(voters),
                        preview_png,
                    ),
                )
                connection.execute(
                    """
                    INSERT INTO shared_projects_fts (project_id, file_name, author_name)
                    VALUES (?, ?, ?)
                    """,
                    (project_id, project["fileName"], project["authorName"]),
                )
    finally:
        connection.close()


def positive_integer(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a positive integer") from error
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="在社群 SQLite 資料庫新增隨機像素作品展示資料。"
    )
    parser.add_argument("--count", type=positive_integer, default=20, help="新增筆數（預設：20）")
    parser.add_argument("--seed", type=int, help="隨機種子，方便重現作品圖樣")
    parser.add_argument("--db", type=Path, default=DEFAULT_DATABASE, help="SQLite 資料庫路徑")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    records = [create_demo_record(rng, index) for index in range(args.count)]
    database_path = args.db.expanduser().resolve()
    try:
        populate_database(database_path, records)
    except (ImportError, OSError, sqlite3.Error, ValueError) as error:
        print(f"產生展示資料失敗：{error}", file=sys.stderr)
        return 1

    print(f"已新增 {len(records)} 筆展示專案至 {database_path}")
    print("資料以新增方式寫入，不會清除既有專案。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
