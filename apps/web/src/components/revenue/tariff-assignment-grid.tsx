import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useNationalityBreakdown } from '../../hooks/use-nationality-breakdown';
import { useDetail, usePutDetail } from '../../hooks/use-enrollment';
import { EditableCell } from '../shared/editable-cell';
import { cn } from '../../lib/cn';
import type {
	GradeCode,
	NationalityType,
	TariffType,
	DetailEntry,
	AcademicPeriod,
} from '@budfin/types';

export type TariffAssignmentGridProps = {
	versionId: number;
	academicPeriod: string;
	isReadOnly: boolean;
};

const NATIONALITIES: NationalityType[] = ['Francais', 'Nationaux', 'Autres'];
const TARIFFS: TariffType[] = ['RP', 'R3+', 'Plein'];

type NatHeadcountMap = Record<string, Record<NationalityType, number>>;
type DraftMap = Record<string, number>;

function makeDraftKey(grade: GradeCode, nationality: NationalityType, tariff: TariffType): string {
	return `${grade}|${nationality}|${tariff}`;
}

function buildNatHeadcountMap(
	entries: Array<{ gradeLevel: GradeCode; nationality: NationalityType; headcount: number }>
): NatHeadcountMap {
	const map: NatHeadcountMap = {};
	for (const e of entries) {
		let gradeMap = map[e.gradeLevel];
		if (!gradeMap) {
			gradeMap = { Francais: 0, Nationaux: 0, Autres: 0 };
			map[e.gradeLevel] = gradeMap;
		}
		gradeMap[e.nationality] = e.headcount;
	}
	return map;
}

function buildDraftMap(entries: DetailEntry[]): DraftMap {
	const map: DraftMap = {};
	for (const e of entries) {
		map[makeDraftKey(e.gradeLevel, e.nationality, e.tariff)] = e.headcount;
	}
	return map;
}

function sumForNat(draft: DraftMap, grade: GradeCode, nationality: NationalityType): number {
	let sum = 0;
	for (const tariff of TARIFFS) {
		sum += draft[makeDraftKey(grade, nationality, tariff)] ?? 0;
	}
	return sum;
}

function sumForGrade(draft: DraftMap, grade: GradeCode): number {
	let sum = 0;
	for (const nat of NATIONALITIES) {
		for (const tariff of TARIFFS) {
			sum += draft[makeDraftKey(grade, nat, tariff)] ?? 0;
		}
	}
	return sum;
}

export function TariffAssignmentGrid({
	versionId,
	academicPeriod,
	isReadOnly,
}: TariffAssignmentGridProps) {
	const effectivePeriod: AcademicPeriod =
		academicPeriod === 'AY1' || academicPeriod === 'AY2' ? academicPeriod : 'AY1';

	const { data: natData, isLoading: natLoading } = useNationalityBreakdown(
		versionId,
		effectivePeriod
	);
	const { data: detailData, isLoading: detailLoading } = useDetail(versionId, effectivePeriod);
	const putDetail = usePutDetail(versionId);

	const natEntries = useMemo(() => natData?.entries ?? [], [natData?.entries]);
	const detailEntries = useMemo(() => detailData?.entries ?? [], [detailData?.entries]);

	const natMap = useMemo(() => buildNatHeadcountMap(natEntries), [natEntries]);
	const grades = useMemo(() => {
		const seen = new Set<GradeCode>();
		const result: GradeCode[] = [];
		for (const e of natEntries) {
			if (!seen.has(e.gradeLevel)) {
				seen.add(e.gradeLevel);
				result.push(e.gradeLevel);
			}
		}
		return result;
	}, [natEntries]);

	const [draft, setDraft] = useState<DraftMap>({});

	useEffect(() => {
		setDraft(buildDraftMap(detailEntries));
	}, [detailEntries]);

	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		};
	}, [saveTimerRef]);

	const debouncedSave = useCallback(
		(newDraft: DraftMap) => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
			saveTimerRef.current = setTimeout(() => {
				const entries: DetailEntry[] = [];
				for (const grade of grades) {
					for (const nat of NATIONALITIES) {
						for (const tariff of TARIFFS) {
							const key = makeDraftKey(grade, nat, tariff);
							entries.push({
								gradeLevel: grade,
								academicPeriod: effectivePeriod,
								nationality: nat,
								tariff,
								headcount: newDraft[key] ?? 0,
							});
						}
					}
				}
				putDetail.mutate(entries);
			}, 800);
		},
		[grades, effectivePeriod, putDetail, saveTimerRef]
	);

	const handleCellChange = useCallback(
		(grade: GradeCode, nationality: NationalityType, tariff: TariffType, value: number) => {
			const intVal = Math.max(0, Math.round(value));
			setDraft((prev) => {
				const next = { ...prev, [makeDraftKey(grade, nationality, tariff)]: intVal };
				debouncedSave(next);
				return next;
			});
		},
		[debouncedSave]
	);

	const isLoading = natLoading || detailLoading;

	if (isLoading) {
		return (
			<div className="flex h-32 items-center justify-center text-(--text-sm) text-(--text-muted)">
				Loading tariff assignments...
			</div>
		);
	}

	if (grades.length === 0) {
		return (
			<div className="flex h-32 items-center justify-center text-(--text-sm) text-(--text-muted)">
				No nationality breakdown data. Configure enrollment headcounts first.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table
				role="grid"
				className="w-full text-left text-(--text-sm)"
				aria-label="Tariff assignment matrix"
			>
				<thead className="border-b border-(--workspace-border) bg-(--workspace-bg-muted)">
					<tr>
						<th
							rowSpan={2}
							className="sticky left-0 z-10 bg-(--workspace-bg-muted) px-4 py-3 align-bottom font-medium text-(--text-secondary)"
						>
							Grade
						</th>
						{NATIONALITIES.map((nat) => (
							<th
								key={nat}
								colSpan={3}
								className="border-b border-l border-(--workspace-border) px-4 py-1.5 text-center text-(--text-xs) font-medium text-(--text-muted)"
							>
								{nat}
							</th>
						))}
						<th
							rowSpan={2}
							className="border-l border-(--workspace-border) px-4 py-3 text-center align-bottom font-medium text-(--text-secondary)"
						>
							Total
						</th>
					</tr>
					<tr>
						{NATIONALITIES.flatMap((nat) =>
							TARIFFS.map((tariff) => (
								<th
									key={`${nat}-${tariff}`}
									className={cn(
										'px-3 py-1.5 text-center text-(--text-xs) font-medium text-(--text-muted)',
										tariff === 'RP' && 'border-l border-(--workspace-border)'
									)}
								>
									{tariff}
								</th>
							))
						)}
					</tr>
				</thead>
				<tbody>
					{grades.map((grade) => {
						const totalHeadcount =
							(natMap[grade]?.Francais ?? 0) +
							(natMap[grade]?.Nationaux ?? 0) +
							(natMap[grade]?.Autres ?? 0);
						const gradeTotal = sumForGrade(draft, grade);

						return (
							<tr
								key={grade}
								className={cn(
									'border-b border-(--workspace-border) last:border-0',
									'transition-colors duration-(--duration-fast)',
									'hover:bg-(--accent-50)'
								)}
							>
								<td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium whitespace-nowrap">
									{grade}{' '}
									<span className="text-(--text-xs) text-(--text-muted)">({totalHeadcount})</span>
								</td>
								{NATIONALITIES.flatMap((nat) => {
									const natTarget = natMap[grade]?.[nat] ?? 0;
									const natActual = sumForNat(draft, grade, nat);
									const natMismatch = natActual !== natTarget;

									return TARIFFS.map((tariff) => {
										const key = makeDraftKey(grade, nat, tariff);
										const cellValue = draft[key] ?? 0;

										return (
											<td
												key={`${grade}-${nat}-${tariff}`}
												className={cn(
													'px-1 py-1',
													tariff === 'RP' && 'border-l border-(--workspace-border)'
												)}
											>
												<EditableCell
													value={cellValue}
													onChange={(val) => handleCellChange(grade, nat, tariff, val)}
													isReadOnly={isReadOnly}
													isError={natMismatch}
													{...(natMismatch
														? {
																errorMessage: `${nat}: expected ${natTarget}, got ${natActual}`,
															}
														: {})}
												/>
											</td>
										);
									});
								})}
								<td
									className={cn(
										'border-l border-(--workspace-border) px-4 py-2',
										'text-center font-medium tabular-nums',
										gradeTotal !== totalHeadcount && 'text-(--color-error)'
									)}
								>
									{gradeTotal}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
