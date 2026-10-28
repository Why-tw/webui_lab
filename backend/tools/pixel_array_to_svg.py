import re


_COLOR_PATTERN = re.compile(r"#[0-9A-Fa-f]{6}")


def pixel_array_to_svg(pixels: list[list[str | None]]) -> str:
    height = len(pixels)
    width = len(pixels[0]) if height else 0

    if width == 0 or height == 0:
        raise ValueError("Pixel array must not be empty")
    if any(len(row) != width for row in pixels):
        raise ValueError("Pixel array rows must have the same width")

    rectangles = []
    for y, row in enumerate(pixels):
        for x, color in enumerate(row):
            if color is None:
                continue
            if not _COLOR_PATTERN.fullmatch(color):
                raise ValueError(f"Invalid pixel color: {color}")
            rectangles.append(
                f'<rect x="{x}" y="{y}" width="1" height="1" fill="{color}" />'
            )

    shapes = "\n  ".join(rectangles)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" '
        f'height="{height}" viewBox="0 0 {width} {height}" '
        f'shape-rendering="crispEdges">\n  {shapes}\n</svg>'
    )