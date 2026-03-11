import { useEnrollmentSelectionStore } from '../../stores/enrollment-selection-store';
import { registerPanelContent } from '../../lib/right-panel-registry';
import { InspectorDefaultView } from './inspector-default-view';
import { InspectorActiveView } from './inspector-active-view';

function EnrollmentInspectorContent() {
	const selection = useEnrollmentSelectionStore((state) => state.selection);
	const selectedGrade = selection?.type === 'GRADE' ? selection.id : null;

	return (
		<div className="relative min-h-full">
			{selectedGrade ? (
				<div key={selectedGrade} className="animate-inspector-slide-in">
					<InspectorActiveView gradeLevel={selectedGrade} />
				</div>
			) : (
				<div className="animate-inspector-crossfade">
					<InspectorDefaultView />
				</div>
			)}
		</div>
	);
}

// Register this component with the right panel registry
registerPanelContent('enrollment', EnrollmentInspectorContent);

// Export for direct use if needed
export { EnrollmentInspectorContent };
