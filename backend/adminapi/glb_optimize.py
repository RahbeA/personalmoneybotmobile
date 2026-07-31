"""Run the Node gltf-transform pipeline to produce lightweight character GLBs."""

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
OPTIMIZE_DIR = REPO_ROOT / 'tools' / 'glb-optimize'
OPTIMIZE_SCRIPT = OPTIMIZE_DIR / 'optimize.mjs'

# Default keeps visual quality for shop cards while cutting tris hard.
DEFAULT_RATIO = 0.35


class GlbOptimizeError(Exception):
    """Raised when the GLB optimizer cannot produce an output file."""


def _node_bin() -> str:
    return shutil.which('node') or 'node'


def ensure_optimize_ready() -> None:
    if not OPTIMIZE_SCRIPT.is_file():
        raise GlbOptimizeError(f'Optimizer script missing at {OPTIMIZE_SCRIPT}')
    if not (OPTIMIZE_DIR / 'node_modules').is_dir():
        raise GlbOptimizeError(
            'GLB optimizer dependencies are not installed. '
            'Run: cd tools/glb-optimize && npm install'
        )


def optimize_glb_file(src_path: str | Path, ratio: float = DEFAULT_RATIO) -> tuple[Path, dict]:
    """
    Optimize a GLB on disk. Returns (output_path, stats_dict).
    Caller owns cleanup of the returned temp file.
    """
    ensure_optimize_ready()
    src = Path(src_path).resolve()
    if not src.is_file():
        raise GlbOptimizeError(f'Source GLB not found: {src}')

    ratio = float(ratio)
    if not (0 < ratio <= 1):
        raise GlbOptimizeError('ratio must be between 0 and 1')

    fd, out_name = tempfile.mkstemp(suffix='.glb', prefix='mb_opt_')
    os.close(fd)
    out_path = Path(out_name).resolve()

    try:
        result = subprocess.run(
            [_node_bin(), str(OPTIMIZE_SCRIPT), str(src), str(out_path), str(ratio)],
            cwd=str(OPTIMIZE_DIR),
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        out_path.unlink(missing_ok=True)
        raise GlbOptimizeError('GLB optimization timed out') from exc
    except FileNotFoundError as exc:
        out_path.unlink(missing_ok=True)
        raise GlbOptimizeError('Node.js is required to optimize GLB files') from exc

    if result.returncode != 0 or not out_path.is_file() or out_path.stat().st_size == 0:
        out_path.unlink(missing_ok=True)
        detail = (result.stderr or result.stdout or 'unknown error').strip()
        logger.error('glb optimize failed: %s', detail)
        raise GlbOptimizeError(f'Optimization failed: {detail[:400]}')

    stats = {}
    for line in reversed((result.stdout or '').strip().splitlines()):
        line = line.strip()
        if line.startswith('{'):
            try:
                stats = json.loads(line)
            except json.JSONDecodeError:
                stats = {}
            break

    stats.setdefault('bytesBefore', src.stat().st_size)
    stats.setdefault('bytesAfter', out_path.stat().st_size)
    stats['savedBytes'] = max(0, stats['bytesBefore'] - stats['bytesAfter'])
    stats['savedPct'] = (
        round(100.0 * stats['savedBytes'] / stats['bytesBefore'], 1)
        if stats['bytesBefore'] else 0
    )
    return out_path, stats


def optimize_uploaded_bytes(data: bytes, ratio: float = DEFAULT_RATIO) -> tuple[bytes, dict]:
    """Optimize an in-memory GLB upload. Returns (optimized_bytes, stats)."""
    if not data:
        raise GlbOptimizeError('Empty GLB upload')

    with tempfile.NamedTemporaryFile(suffix='.glb', prefix='mb_in_', delete=False) as tmp:
        tmp.write(data)
        in_path = Path(tmp.name)

    try:
        out_path, stats = optimize_glb_file(in_path, ratio=ratio)
        try:
            return out_path.read_bytes(), stats
        finally:
            out_path.unlink(missing_ok=True)
    finally:
        in_path.unlink(missing_ok=True)


def apply_optimized_to_character(character, ratio: float = DEFAULT_RATIO) -> dict:
    """
    Optimize the character's current model_file and replace it in-place.
    Returns stats dict.
    """
    if not character.model_file:
        raise GlbOptimizeError('Character has no model file')

    src = character.model_file.path
    out_path, stats = optimize_glb_file(src, ratio=ratio)
    try:
        original_name = Path(character.model_file.name).name or 'character.glb'
        stem = Path(original_name).stem
        # Avoid stacking "_opt_opt" on repeated runs.
        if stem.endswith('_opt'):
            new_name = f'{stem}.glb'
        else:
            new_name = f'{stem}_opt.glb'

        with out_path.open('rb') as fh:
            character.model_file.save(new_name, ContentFile(fh.read()), save=True)
    finally:
        out_path.unlink(missing_ok=True)

    return stats
