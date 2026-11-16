from tools.pixel_array_to_raster import pixel_array_to_raster


def pixel_array_to_jpg(pixels: list[list[str | None]]) -> bytes:
    return pixel_array_to_raster(pixels, "JPG")
