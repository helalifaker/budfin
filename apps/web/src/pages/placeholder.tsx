interface PlaceholderPageProps {
	title: string;
	description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
	return (
		<div className="flex flex-col items-center justify-center h-64 text-center">
			<h1 className="text-xl font-semibold text-slate-900">{title}</h1>
			<p className="mt-2 text-sm text-slate-500">{description}</p>
		</div>
	);
}
