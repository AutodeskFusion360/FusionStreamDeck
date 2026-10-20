# Copyright (c) 2026 Autodesk, Inc.
# Licensed under the MIT License. See LICENSE in the project root.
"""Picks the best on-disk icon file out of a Fusion command's resourceFolder.

Fusion ships several themed/DPI variants per size, e.g.:
  32x32.png, 32x32@2x.png, 32x32-dark.png, 32x32-dark@2x.png,
  32x32-dark_gray.svg, 32x32-light_gray.svg, 32x32-dark_blue.svg
The "-dark_*" variants are drawn to sit on a dark background (fine details in
white), which is what a Stream Deck key looks like, so they're preferred.
SVG is preferred over PNG since it scales cleanly to whatever key resolution
the Stream Deck hardware needs.
"""
import os

_MIME = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
}


def _candidates(size):
    s = '{0}x{0}'.format(size)
    return [
        '{}-dark_gray.svg'.format(s),
        '{}-dark_blue.svg'.format(s),
        '{}-dark.svg'.format(s),
        '{}-dark@2x.png'.format(s),
        '{}-dark.png'.format(s),
        '{}-light_gray.svg'.format(s),
        '{}.svg'.format(s),
        '{}@2x.png'.format(s),
        '{}.png'.format(s),
    ]


def find_icon(resource_folder, size=32):
    """Returns (absolute_path, mime_type) for the best match, or (None, None)."""
    if not resource_folder or not os.path.isdir(resource_folder):
        return None, None

    for name in _candidates(size):
        path = os.path.join(resource_folder, name)
        if os.path.isfile(path):
            return path, _MIME.get(os.path.splitext(path)[1].lower(), 'application/octet-stream')

    # Nothing at the requested size matched exactly; take anything else with
    # roughly the right prefix so we still show *something* on the key.
    try:
        entries = sorted(os.listdir(resource_folder))
    except OSError:
        return None, None
    prefix = '{0}x{0}'.format(size)
    for name in entries:
        if name.startswith(prefix):
            path = os.path.join(resource_folder, name)
            return path, _MIME.get(os.path.splitext(path)[1].lower(), 'application/octet-stream')

    # Absolute last resort: any image file in the folder.
    for name in entries:
        ext = os.path.splitext(name)[1].lower()
        if ext in _MIME:
            return os.path.join(resource_folder, name), _MIME[ext]

    return None, None
