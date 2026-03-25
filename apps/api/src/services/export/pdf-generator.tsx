import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { ReportData } from './report-data-loader.js';

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	page: {
		padding: 30,
		fontSize: 8,
		fontFamily: 'Helvetica',
	},
	header: {
		marginBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#333333',
		paddingBottom: 8,
	},
	title: {
		fontSize: 16,
		fontWeight: 'bold',
		marginBottom: 4,
	},
	subtitle: {
		fontSize: 10,
		color: '#666666',
	},
	section: {
		marginBottom: 16,
	},
	sectionTitle: {
		fontSize: 11,
		fontWeight: 'bold',
		marginBottom: 6,
		color: '#333333',
	},
	table: {
		width: '100%',
	},
	tableHeader: {
		flexDirection: 'row',
		backgroundColor: '#e8e8e8',
		borderBottomWidth: 1,
		borderBottomColor: '#cccccc',
	},
	tableRow: {
		flexDirection: 'row',
		borderBottomWidth: 0.5,
		borderBottomColor: '#eeeeee',
	},
	headerCell: {
		padding: 3,
		fontSize: 7,
		fontWeight: 'bold',
		flex: 1,
		textAlign: 'right',
	},
	headerCellFirst: {
		padding: 3,
		fontSize: 7,
		fontWeight: 'bold',
		flex: 2,
		textAlign: 'left',
	},
	cell: {
		padding: 3,
		fontSize: 7,
		flex: 1,
		textAlign: 'right',
	},
	cellFirst: {
		padding: 3,
		fontSize: 7,
		flex: 2,
		textAlign: 'left',
	},
	footer: {
		position: 'absolute',
		bottom: 20,
		left: 30,
		right: 30,
		textAlign: 'center',
		fontSize: 7,
		color: '#999999',
	},
});

// ── PDF Document Component ─────────────────────────────────────────────────

function ReportDocument({ data }: { data: ReportData }) {
	return (
		<Document>
			<Page size="A4" orientation="landscape" style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					<Text style={styles.title}>{data.versionName}</Text>
					<Text style={styles.subtitle}>
						{data.fiscalYear} — Generated{' '}
						{new Date(data.generatedAt).toLocaleDateString('en-GB', {
							year: 'numeric',
							month: 'short',
							day: 'numeric',
							hour: '2-digit',
							minute: '2-digit',
						})}
					</Text>
				</View>

				{/* Sections */}
				{data.sections.map((section, i) => (
					<View key={i} style={styles.section} wrap={false}>
						<Text style={styles.sectionTitle}>{section.title}</Text>
						<View style={styles.table}>
							{/* Table Header */}
							<View style={styles.tableHeader}>
								{section.headers.map((h, j) => (
									<Text key={j} style={j === 0 ? styles.headerCellFirst : styles.headerCell}>
										{h}
									</Text>
								))}
							</View>
							{/* Table Body */}
							{section.rows.map((row, k) => (
								<View key={k} style={styles.tableRow}>
									{row.map((cellValue, l) => (
										<Text key={l} style={l === 0 ? styles.cellFirst : styles.cell}>
											{cellValue}
										</Text>
									))}
								</View>
							))}
						</View>
					</View>
				))}

				{/* Footer */}
				<Text style={styles.footer} fixed>
					BudFin — {data.versionName} — {data.fiscalYear}
				</Text>
			</Page>
		</Document>
	);
}

// ── Generator ──────────────────────────────────────────────────────────────

export async function generatePdf(data: ReportData): Promise<Buffer> {
	const buffer = await renderToBuffer(<ReportDocument data={data} />);
	return Buffer.from(buffer);
}
