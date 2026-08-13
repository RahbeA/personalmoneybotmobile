"""Render a PNG still from a character GLB via headless Chromium + model-viewer."""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

REPO_ROOT = Path(settings.BASE_DIR).resolve().parent
PREVIEW_DIR = REPO_ROOT / 'tools' / 'glb-preview'
PREVIEW_SCRIPT = PREVIEW_DIR / 'preview.mjs'

DEFAULT_SIZE = 512


class GlbPreviewError(Exception):
    """Raised when a GLB still cannot be rendered."""


def _node_bin() -> str:
    return shutil.which('node') or 'node'


def ensure_preview_ready() -> None:
    if not PREVIEW_SCRIPT.is_file():
        raise GlbPreviewError(f'Preview script missing at {PREVIEW_SCRIPT}')
    if not (PREVIEW_DIR / 'node_modules').is_dir():
        raise GlbPreviewError(
            'Preview renderer dependencies are not installed. '
            'Run: cd tools/glb-preview && npm install'
        )


def render_glb_preview(src_path: str | Path, size: int = DEFAULT_SIZE) -> tuple[Path, dict]:
    """
    Render a PNG still from a GLB on disk.
    Returns (output_png_path, stats). Caller owns cleanup of the temp PNG.
    """
    ensure_preview_ready()
    src = Path(src_path).resolve()
    if not src.is_file():
        raise GlbPreviewError(f'Source GLB not found: {src}')

    size = int(size or DEFAULT_SIZE)
    if size < 128 or size > 1024:
        raise GlbPreviewError('size must be between 128 and 1024')

    fd, out_name = tempfile.mkstemp(suffix='.png', prefix='mb_prev_')
    os.close(fd)
    out_path = Path(out_name).resolve()

    try:
        result = subprocess.run(
            [_node_bin(), str(PREVIEW_SCRIPT), str(src), str(out_path), str(size)],
            cwd=str(PREVIEW_DIR),
            capture_output=True,
            text=True,
            timeout=90,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        out_path.unlink(missing_ok=True)
        raise GlbPreviewError('GLB preview render timed out') from exc
    except FileNotFoundError as exc:
        out_path.unlink(missing_ok=True)
        raise GlbPreviewError('Node.js is required to generate GLB previews') from exc

    if result.returncode != 0 or not out_path.is_file() or out_path.stat().st_size < 100:
        out_path.unlink(missing_ok=True)
        detail = (result.stderr or result.stdout or 'unknown error').strip()
        logger.error('glb preview failed: %s', detail)
        raise GlbPreviewError(f'Preview render failed: {detail[:400]}')

    stats = {}
    for line in reversed((result.stdout or '').strip().splitlines()):
        line = line.strip()
        if line.startswith('{'):
            try:
                stats = json.loads(line)
            except json.JSONDecodeError:
                stats = {}
            break

    stats.setdefault('bytesIn', src.stat().st_size)
    stats.setdefault('bytesOut', out_path.stat().st_size)
    stats.setdefault('size', size)
    return out_path, stats


def apply_preview_to_character(character, *, size: int = DEFAULT_SIZE, force: bool = False) -> dict:
    """
    Render a still from the character's GLB and save it to preview_image.
    Skips (returns skipped=True) when a preview already exists unless force=True.
    """
    if not character.model_file:
        raise GlbPreviewError('Character has no model file')

    if character.preview_image and not force:
        return {
            'skipped': True,
            'reason': 'preview_already_set',
            'bytesOut': character.preview_image.size if hasattr(character.preview_image, 'size') else None,
        }

    src = character.model_file.path
    out_path, stats = render_glb_preview(src, size=size)
    try:
        stem = Path(character.model_file.name).stem or f'character_{character.pk}'
        # Avoid stacking suffixes on regenerate.
        if stem.endswith('_opt'):
            stem = stem[:-4]
        name = f'{stem}_preview.png'
        with out_path.open('rb') as fh:
            # Clear old file first so regenerates don't orphan storage.
            if character.preview_image:
                character.preview_image.delete(save=False)
            character.preview_image.save(name, ContentFile(fh.read()), save=True)
    finally:
        out_path.unlink(missing_ok=True)

    stats['skipped'] = False
    return stats
