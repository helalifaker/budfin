#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

DOC_EXTENSIONS = {'.md', '.mdx', '.txt', '.pdf', '.docx'}
ROOT_DOCS = {
    'README.md': 'root-readme',
    'CHANGELOG.md': 'changelog',
    'AGENTS.md': 'agent-guidance',
    'CLAUDE.md': 'claude-guidance',
}
ARCHIVE_CATEGORY_MAP = {
    'plan': 'plans',
    'review': 'reviews',
    'analysis': 'analysis',
    'reconciliation': 'reconciliation',
    'page-review': 'reviews',
    'process': 'process',
    'edge-case': 'edge-cases',
}
DATE_PREFIX = re.compile(r'^(?P<date>\d{4}-\d{2}-\d{2})[-_]')


@dataclass
class DocRecord:
    path: str
    category: str
    archived: bool
    extension: str
    dated: bool
    normalized_topic: str
    size_bytes: int
    warnings: list[str]


def normalize_topic(path: Path) -> str:
    stem = path.stem.lower()
    stem = re.sub(r'^\d{4}-\d{2}-\d{2}[-_]', '', stem)
    stem = re.sub(r'^adr-\d+[-_]', '', stem)
    stem = stem.replace('_', '-').replace(' ', '-')
    stem = re.sub(r'-(v|rev)\d+$', '', stem)
    stem = re.sub(r'-(final|draft|copy)$', '', stem)
    stem = re.sub(r'-+', '-', stem).strip('-')
    return stem or path.stem.lower()


def classify_path(relative_path: Path) -> tuple[str, bool]:
    normalized = relative_path.as_posix()

    if normalized in ROOT_DOCS:
        return ROOT_DOCS[normalized], False

    if normalized.startswith('docs/archive/'):
        parts = normalized.split('/')
        category = parts[2] if len(parts) > 2 else 'archive'
        return f'archive:{category}', True

    prefixes = {
        'docs/prd/': 'prd',
        'docs/tdd/': 'tdd',
        'docs/adr/': 'adr',
        'docs/specs/': 'spec',
        'docs/ui-ux-spec/': 'ui-ux-spec',
        'docs/plans/': 'plan',
        'docs/reviews/': 'review',
        'docs/analysis/': 'analysis',
        'docs/reconciliation/': 'reconciliation',
        'docs/edge-cases/': 'edge-case',
        'docs/Process/': 'process',
        'docs/Page review/': 'page-review',
        'docs/planning/': 'planning',
    }

    for prefix, category in prefixes.items():
        if normalized.startswith(prefix):
            return category, False

    if normalized.startswith('docs/'):
        return 'docs-other', False

    return 'other', False


def build_warnings(relative_path: Path) -> list[str]:
    warnings: list[str] = []
    normalized = relative_path.as_posix()

    if ' ' in normalized:
        warnings.append('path contains spaces')

    if any(part != part.lower() for part in relative_path.parts if part not in {'README.md', 'CHANGELOG.md', 'AGENTS.md', 'CLAUDE.md'}):
        warnings.append('path contains uppercase characters')

    if normalized.startswith('docs/Process/'):
        warnings.append('legacy process folder naming')

    if normalized.startswith('docs/Page review/'):
        warnings.append('legacy page-review folder naming')

    return warnings


def iter_documents(root: Path, scopes: list[str], include_archive: bool) -> list[DocRecord]:
    requested_paths = [root / scope for scope in scopes] if scopes else [root]
    records: list[DocRecord] = []

    for requested_path in requested_paths:
        if requested_path.is_file() and requested_path.suffix.lower() in DOC_EXTENSIONS:
            files = [requested_path]
        else:
            files = [path for path in requested_path.rglob('*') if path.is_file()]

        for path in files:
            relative_path = path.relative_to(root)
            if path.suffix.lower() not in DOC_EXTENSIONS and relative_path.as_posix() not in ROOT_DOCS:
                continue

            category, archived = classify_path(relative_path)
            if archived and not include_archive:
                continue

            dated = bool(DATE_PREFIX.match(path.name))
            records.append(
                DocRecord(
                    path=relative_path.as_posix(),
                    category=category,
                    archived=archived,
                    extension=path.suffix.lower() or '<none>',
                    dated=dated,
                    normalized_topic=normalize_topic(path),
                    size_bytes=path.stat().st_size,
                    warnings=build_warnings(relative_path),
                )
            )

    deduped = {record.path: record for record in records}
    return [deduped[key] for key in sorted(deduped)]


def file_hash(root: Path, record: DocRecord) -> str:
    path = root / record.path
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(65536), b''):
            digest.update(chunk)
    return digest.hexdigest()


def group_exact_duplicates(root: Path, records: list[DocRecord]) -> list[list[str]]:
    by_hash: dict[str, list[str]] = defaultdict(list)
    for record in records:
        by_hash[file_hash(root, record)].append(record.path)
    return [sorted(paths) for paths in by_hash.values() if len(paths) > 1]


def group_similar_titles(records: list[DocRecord]) -> list[list[str]]:
    live_records = [record for record in records if not record.archived]
    by_topic: dict[str, list[DocRecord]] = defaultdict(list)
    for record in live_records:
        by_topic[record.normalized_topic].append(record)

    groups: list[list[str]] = []
    for topic_records in by_topic.values():
        if len(topic_records) > 1:
            groups.append(sorted(record.path for record in topic_records))

    seen: set[tuple[str, str]] = set()
    for index, first in enumerate(live_records):
        for second in live_records[index + 1 :]:
            if first.normalized_topic == second.normalized_topic:
                continue
            pair = tuple(sorted((first.path, second.path)))
            if pair in seen:
                continue
            similarity = SequenceMatcher(None, first.normalized_topic, second.normalized_topic).ratio()
            if similarity >= 0.92:
                groups.append(list(pair))
                seen.add(pair)

    unique_groups: list[list[str]] = []
    seen_groups: set[tuple[str, ...]] = set()
    for group in groups:
        key = tuple(sorted(group))
        if key not in seen_groups:
            unique_groups.append(list(key))
            seen_groups.add(key)
    return sorted(unique_groups)


def extract_date_from_name(path: str) -> datetime | None:
    match = DATE_PREFIX.match(Path(path).name)
    if not match:
        return None
    return datetime.strptime(match.group('date'), '%Y-%m-%d').replace(tzinfo=timezone.utc)


def archive_candidates(records: list[DocRecord]) -> list[dict[str, str]]:
    eligible_categories = {'plan', 'review', 'analysis', 'reconciliation', 'page-review'}
    by_topic: dict[str, list[DocRecord]] = defaultdict(list)
    for record in records:
        if record.category in eligible_categories and record.dated and not record.archived:
            by_topic[record.normalized_topic].append(record)

    candidates: list[dict[str, str]] = []
    for topic, topic_records in by_topic.items():
        if len(topic_records) < 2:
            continue
        dated_records = [(extract_date_from_name(record.path), record) for record in topic_records]
        dated_records = [(date, record) for date, record in dated_records if date is not None]
        if len(dated_records) < 2:
            continue
        dated_records.sort(key=lambda item: item[0])
        keep = dated_records[-1][1]
        for _, record in dated_records[:-1]:
            candidates.append(
                {
                    'path': record.path,
                    'suggested_archive_category': ARCHIVE_CATEGORY_MAP.get(record.category, record.category),
                    'reason': f'superseded by newer "{topic}" document',
                    'keep': keep.path,
                }
            )
    return sorted(candidates, key=lambda item: item['path'])


def as_payload(root: Path, scopes: list[str], include_archive: bool) -> dict[str, object]:
    records = iter_documents(root, scopes, include_archive)
    category_counts = Counter(record.category for record in records)
    warnings = {record.path: record.warnings for record in records if record.warnings}

    return {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'root': str(root),
        'scopes': scopes or ['.'],
        'include_archive': include_archive,
        'summary': {
            'document_count': len(records),
            'live_count': sum(not record.archived for record in records),
            'archived_count': sum(record.archived for record in records),
            'categories': dict(sorted(category_counts.items())),
        },
        'records': [asdict(record) for record in records],
        'exact_duplicates': group_exact_duplicates(root, records),
        'similar_title_groups': group_similar_titles(records),
        'archive_candidates': archive_candidates(records),
        'warnings': warnings,
    }


def render_markdown(payload: dict[str, object]) -> str:
    lines: list[str] = []
    summary = payload['summary']
    lines.append('# Documentation Inventory')
    lines.append('')
    lines.append(f"- Generated: `{payload['generated_at']}`")
    lines.append(f"- Scope: `{', '.join(payload['scopes'])}`")
    lines.append(f"- Documents: `{summary['document_count']}` total")
    lines.append(f"- Live: `{summary['live_count']}`")
    lines.append(f"- Archived: `{summary['archived_count']}`")
    lines.append('')
    lines.append('## Categories')
    lines.append('')
    for category, count in summary['categories'].items():
        lines.append(f"- `{category}`: {count}")

    exact_duplicates: list[list[str]] = payload['exact_duplicates']
    lines.append('')
    lines.append('## Exact Duplicates')
    lines.append('')
    if exact_duplicates:
        for group in exact_duplicates:
            lines.append(f"- Group ({len(group)} files)")
            for path in group:
                lines.append(f"  - `{path}`")
    else:
        lines.append('- None')

    similar_groups: list[list[str]] = payload['similar_title_groups']
    lines.append('')
    lines.append('## Similar Title Groups')
    lines.append('')
    if similar_groups:
        for group in similar_groups:
            lines.append(f"- Group ({len(group)} files)")
            for path in group:
                lines.append(f"  - `{path}`")
    else:
        lines.append('- None')

    warnings: dict[str, list[str]] = payload['warnings']
    lines.append('')
    lines.append('## Naming And Path Warnings')
    lines.append('')
    if warnings:
        for path, items in sorted(warnings.items()):
            lines.append(f"- `{path}`: {', '.join(items)}")
    else:
        lines.append('- None')

    archive_suggestions: list[dict[str, str]] = payload['archive_candidates']
    lines.append('')
    lines.append('## Archive Candidates')
    lines.append('')
    if archive_suggestions:
        for item in archive_suggestions:
            lines.append(
                f"- `{item['path']}` -> `docs/archive/{item['suggested_archive_category']}/<year>/...`"
                f" ({item['reason']}; keep `{item['keep']}` live)"
            )
    else:
        lines.append('- None')

    return '\n'.join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Inventory BudFin documentation files.')
    parser.add_argument('--root', default='.', help='Repository root to scan from.')
    parser.add_argument(
        '--scope',
        action='append',
        default=[],
        help='Optional path relative to root. Repeat for multiple scopes.',
    )
    parser.add_argument(
        '--include-archive',
        action='store_true',
        help='Include files already under docs/archive.',
    )
    parser.add_argument(
        '--format',
        choices=('markdown', 'json'),
        default='markdown',
        help='Output format.',
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    payload = as_payload(root, args.scope, args.include_archive)
    if args.format == 'json':
        print(json.dumps(payload, indent=2))
    else:
        print(render_markdown(payload))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
