from io import BytesIO

from PIL import Image


def pixel_array_to_raster(pixels: list[list[str | None]], image_format: str) -> bytes:
    height = len(pixels)
    width = len(pixels[0]) if height else 0

    if width == 0 or height == 0:
        raise ValueError("Pixel array must not be empty")
    if any(len(row) != width for row in pixels):
        raise ValueError("Pixel array rows must have the same width")

    is_bmp = image_format == "BMP"
    image = Image.new("RGB" if is_bmp else "RGBA", (width, height), (255, 255, 255) if is_bmp else (0, 0, 0, 0))
    for y, row in enumerate(pixels):
        for x, color in enumerate(row):
            if color is None:
                continue
            if len(color) != 7 or color[0] != "#":
                raise ValueError(f"Invalid pixel color: {color}")
            try:
                rgb = tuple(int(color[index:index + 2], 16) for index in (1, 3, 5))
            except ValueError as error:
                raise ValueError(f"Invalid pixel color: {color}") from error
            image.putpixel((x, y), rgb if is_bmp else (*rgb, 255))

    output = BytesIO()
    image.save(output, format=image_format)
    return output.getvalue()