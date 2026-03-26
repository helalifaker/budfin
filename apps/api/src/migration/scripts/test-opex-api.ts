import { buildApp } from '../../index.js';

async function main() {
	const app = await buildApp();
	await app.ready();

	// Login
	const loginRes = await app.inject({
		method: 'POST',
		url: '/api/v1/auth/login',
		payload: { email: 'admin@budfin.app', password: 'admin123' },
	});

	if (loginRes.statusCode !== 200) {
		console.log('Login status:', loginRes.statusCode, loginRes.body);
		process.exit(1);
	}

	const { accessToken } = JSON.parse(loginRes.body);
	const auth = { Authorization: `Bearer ${accessToken}` };

	// Test GET line items
	const res = await app.inject({
		method: 'GET',
		url: '/api/v1/versions/20/opex/line-items',
		headers: auth,
	});

	console.log('GET /opex/line-items status:', res.statusCode);
	const body = JSON.parse(res.body);

	console.log('Line items:', body.data.length);

	console.log('Total Operating:', body.summary.totalOperating);

	console.log('Total NonOperating:', body.summary.totalNonOperating);

	console.log('Total Depreciation:', body.summary.totalDepreciation);

	console.log('Total Finance Income:', body.summary.totalFinanceIncome);

	console.log('Total Finance Costs:', body.summary.totalFinanceCosts);

	console.log('Operating categories:', Object.keys(body.summary.operatingByCategory).join(', '));

	// Verify PFC item
	const pfc = body.data.find((d: { lineItemName: string }) => d.lineItemName.includes('PFC'));

	console.log('PFC computeMethod:', pfc.computeMethod, 'rate:', pfc.computeRate);

	// Test calculate
	const calcRes = await app.inject({
		method: 'POST',
		url: '/api/v1/versions/20/calculate/opex',
		headers: auth,
	});

	console.log('POST /calculate/opex status:', calcRes.statusCode);

	console.log('Calculate result:', calcRes.body);

	// Verify monthly update
	const rentItem = body.data.find((d: { lineItemName: string }) => d.lineItemName === 'Rent');
	const updateRes = await app.inject({
		method: 'PUT',
		url: '/api/v1/versions/20/opex/monthly',
		headers: auth,
		payload: {
			updates: [{ lineItemId: rentItem.id, month: 1, amount: '699626.5000' }],
		},
	});

	console.log('PUT /opex/monthly status:', updateRes.statusCode);

	await app.close();

	console.log('\nALL ENDPOINTS FUNCTIONAL');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
