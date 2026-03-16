#!/usr/bin/env python3
"""
Populate revenue settings for version 20 (v2) from Excel data and run calculation.
Compares results against the Excel REVENUE_ENGINE sheet.
"""

import json
import sys
import requests

BASE = 'http://localhost:3001/api/v1'
VERSION_ID = 20

# ── Authentication ──────────────────────────────────────────────────────────────

def login():
	r = requests.post(f'{BASE}/auth/login', json={
		'email': 'admin@efir.edu.sa',
		'password': 'changeme123'
	})
	r.raise_for_status()
	data = r.json()
	token = data.get('access_token') or data.get('accessToken')
	if not token:
		print(f'Login response: {data}')
		sys.exit(1)
	return token

# ── Enrollment Detail (from Excel ENROLLMENT_DETAIL) ──────────────────────────

GRADES = ['PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
          '6EME', '5EME', '4EME', '3EME', '2NDE', '1ERE', 'TERM']

# AY1 data: [grade][nationality] = {RP, R3+, Plein}
AY1_DETAIL = {
	'PS':   {'Francais': (1, 6, 17),  'Nationaux': (0, 1, 1),  'Autres': (0, 5, 34)},
	'MS':   {'Francais': (1, 8, 18),  'Nationaux': (0, 1, 1),  'Autres': (1, 10, 37)},
	'GS':   {'Francais': (2, 12, 29), 'Nationaux': (0, 2, 2),  'Autres': (2, 15, 60)},
	'CP':   {'Francais': (2, 10, 32), 'Nationaux': (0, 1, 2),  'Autres': (2, 11, 66)},
	'CE1':  {'Francais': (2, 9, 30),  'Nationaux': (0, 1, 2),  'Autres': (2, 10, 62)},
	'CE2':  {'Francais': (2, 10, 34), 'Nationaux': (0, 1, 2),  'Autres': (2, 11, 70)},
	'CM1':  {'Francais': (2, 9, 31),  'Nationaux': (0, 1, 2),  'Autres': (2, 10, 64)},
	'CM2':  {'Francais': (2, 9, 31),  'Nationaux': (0, 1, 2),  'Autres': (2, 10, 64)},
	'6EME': {'Francais': (2, 5, 43),  'Nationaux': (0, 0, 3),  'Autres': (4, 5, 89)},
	'5EME': {'Francais': (1, 5, 40),  'Nationaux': (0, 0, 3),  'Autres': (4, 4, 82)},
	'4EME': {'Francais': (1, 4, 34),  'Nationaux': (0, 0, 2),  'Autres': (4, 4, 71)},
	'3EME': {'Francais': (1, 4, 29),  'Nationaux': (0, 0, 2),  'Autres': (3, 3, 61)},
	'2NDE': {'Francais': (2, 0, 37),  'Nationaux': (0, 0, 3),  'Autres': (6, 0, 77)},
	'1ERE': {'Francais': (2, 0, 36),  'Nationaux': (0, 0, 3),  'Autres': (5, 0, 74)},
	'TERM': {'Francais': (2, 0, 33),  'Nationaux': (0, 0, 2),  'Autres': (5, 0, 69)},
}

AY2_DETAIL = {
	'PS':   {'Francais': (1, 6, 17),  'Nationaux': (0, 1, 1),  'Autres': (0, 5, 34)},
	'MS':   {'Francais': (1, 7, 20),  'Nationaux': (0, 1, 1),  'Autres': (0, 6, 41)},
	'GS':   {'Francais': (2, 13, 29), 'Nationaux': (0, 2, 2),  'Autres': (2, 16, 58)},
	'CP':   {'Francais': (2, 12, 29), 'Nationaux': (0, 2, 2),  'Autres': (2, 15, 62)},
	'CE1':  {'Francais': (2, 9, 30),  'Nationaux': (0, 1, 2),  'Autres': (2, 10, 62)},
	'CE2':  {'Francais': (2, 10, 34), 'Nationaux': (0, 1, 2),  'Autres': (2, 11, 70)},
	'CM1':  {'Francais': (2, 9, 31),  'Nationaux': (0, 1, 2),  'Autres': (2, 10, 64)},
	'CM2':  {'Francais': (2, 9, 31),  'Nationaux': (0, 1, 2),  'Autres': (2, 10, 64)},
	'6EME': {'Francais': (2, 11, 39), 'Nationaux': (0, 1, 2),  'Autres': (2, 12, 82)},
	'5EME': {'Francais': (2, 5, 40),  'Nationaux': (0, 0, 3),  'Autres': (4, 5, 80)},
	'4EME': {'Francais': (1, 4, 35),  'Nationaux': (0, 0, 3),  'Autres': (3, 3, 71)},
	'3EME': {'Francais': (1, 3, 29),  'Nationaux': (0, 0, 2),  'Autres': (3, 3, 62)},
	'2NDE': {'Francais': (1, 5, 35),  'Nationaux': (0, 0, 2),  'Autres': (4, 4, 74)},
	'1ERE': {'Francais': (2, 0, 36),  'Nationaux': (0, 0, 3),  'Autres': (6, 0, 73)},
	'TERM': {'Francais': (2, 0, 33),  'Nationaux': (0, 0, 3),  'Autres': (5, 0, 68)},
}

def build_enrollment_entries():
	entries = []
	tariffs = ['RP', 'R3+', 'Plein']
	for period_name, period_data in [('AY1', AY1_DETAIL), ('AY2', AY2_DETAIL)]:
		for grade in GRADES:
			for nat in ['Francais', 'Nationaux', 'Autres']:
				rp, r3, plein = period_data[grade][nat]
				for tariff, hc in zip(tariffs, [rp, r3, plein]):
					if hc > 0:
						entries.append({
							'gradeLevel': grade,
							'academicPeriod': period_name,
							'nationality': nat,
							'tariff': tariff,
							'headcount': hc,
						})
	return entries

# ── Fee Grid (from Excel FEE_GRID) ──────────────────────────────────────────

# Fee data: {grade_band: {nationality: (tuitionTtc, tuitionHt, dai_ttc)}}
# Note: tuitionHt = tuitionTtc / 1.15 for Francais/Autres; = tuitionTtc for Nationaux

# AY1 (2025-2026) fee structure by grade band
AY1_FEES = {
	# Mat PS
	'PS': {
		'Francais':  (30000, 26086.9565, 5000),
		'Nationaux': (34783, 34783.0000, 4350),
		'Autres':    (40000, 34782.6087, 5000),
	},
	# Maternelle (MS, GS)
	'MS': {
		'Francais':  (34500, 30000.0000, 5000),
		'Nationaux': (35650, 35650.0000, 4350),
		'Autres':    (41000, 35652.1739, 5000),
	},
	# Elementaire (CP-CM2)
	'CP': {
		'Francais':  (34500, 30000.0000, 5000),
		'Nationaux': (35650, 35650.0000, 4350),
		'Autres':    (41000, 35652.1739, 5000),
	},
	# College (6EME-3EME)
	'6EME': {
		'Francais':  (34500, 30000.0000, 5000),
		'Nationaux': (35650, 35650.0000, 4350),
		'Autres':    (41000, 35652.1739, 5000),
	},
	# Lycee (2NDE-TERM)
	'2NDE': {
		'Francais':  (38500, 33478.2609, 5000),
		'Nationaux': (40000, 40000.0000, 4350),
		'Autres':    (46000, 40000.0000, 5000),
	},
}

# AY2 (2026-2027) fee structure
AY2_FEES = {
	'PS': {
		'Francais':  (30000, 26086.9565, 5000),
		'Nationaux': (34783, 34783.0000, 4350),
		'Autres':    (40000, 34782.6087, 5000),
	},
	'MS': {
		'Francais':  (35500, 30869.5652, 5000),
		'Nationaux': (36650, 36650.0000, 4350),
		'Autres':    (42000, 36521.7391, 5000),
	},
	'CP': {
		'Francais':  (36000, 31304.3478, 5000),
		'Nationaux': (36650, 36650.0000, 4350),
		'Autres':    (42000, 36521.7391, 5000),
	},
	'6EME': {
		'Francais':  (36500, 31739.1304, 5000),
		'Nationaux': (36650, 36650.0000, 4350),
		'Autres':    (42500, 36956.5217, 5000),
	},
	'2NDE': {
		'Francais':  (40800, 35478.2609, 5000),
		'Nationaux': (41000, 41000.0000, 4350),
		'Autres':    (47500, 41304.3478, 5000),
	},
}

# Map grade to fee band key
GRADE_TO_BAND = {
	'PS': 'PS',
	'MS': 'MS', 'GS': 'MS',
	'CP': 'CP', 'CE1': 'CP', 'CE2': 'CP', 'CM1': 'CP', 'CM2': 'CP',
	'6EME': '6EME', '5EME': '6EME', '4EME': '6EME', '3EME': '6EME',
	'2NDE': '2NDE', '1ERE': '2NDE', 'TERM': '2NDE',
}

def build_fee_grid_entries():
	entries = []
	for period_name, fee_data in [('AY1', AY1_FEES), ('AY2', AY2_FEES)]:
		for grade in GRADES:
			band = GRADE_TO_BAND[grade]
			for nat in ['Francais', 'Nationaux', 'Autres']:
				ttc, ht, dai = fee_data[band][nat]
				# Term amounts: 40% T1, 30% T2, 30% T3
				t1 = round(ttc * 0.4, 4)
				t2 = round(ttc * 0.3, 4)
				t3 = round(ttc * 0.3, 4)
				entries.append({
					'academicPeriod': period_name,
					'gradeLevel': grade,
					'nationality': nat,
					'tariff': 'Plein',
					'tuitionTtc': f'{ttc:.4f}',
					'tuitionHt': f'{ht:.4f}',
					'dai': f'{dai:.4f}',
					'term1Amount': f'{t1:.4f}',
					'term2Amount': f'{t2:.4f}',
					'term3Amount': f'{t3:.4f}',
				})
	return entries

# ── Discount Policies ──────────────────────────────────────────────────────────

DISCOUNT_ENTRIES = [
	{'tariff': 'RP',  'discountRate': '0.250000'},
	{'tariff': 'R3+', 'discountRate': '0.250000'},
]

# ── Other Revenue Items (from Excel OTHER_REVENUES) ──────────────────────────

OTHER_REVENUE_ITEMS = [
	# Registration Fees
	{'lineItemName': 'Frais de Dossier - Francais', 'annualAmount': '106000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [5, 6], 'ifrsCategory': 'Registration Fees'},
	{'lineItemName': 'Frais de Dossier - Nationaux', 'annualAmount': '8000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [5, 6], 'ifrsCategory': 'Registration Fees'},
	{'lineItemName': 'Frais de Dossier - Autres', 'annualAmount': '198000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [5, 6], 'ifrsCategory': 'Registration Fees'},
	{'lineItemName': 'DPI - Francais', 'annualAmount': '212000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [5, 6], 'ifrsCategory': 'Registration Fees'},
	{'lineItemName': 'DPI - Nationaux', 'annualAmount': '16000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [5, 6], 'ifrsCategory': 'Registration Fees'},
	{'lineItemName': 'DPI - Autres', 'annualAmount': '396000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [5, 6], 'ifrsCategory': 'Registration Fees'},
	{'lineItemName': 'Evaluation - Primaire', 'annualAmount': '22000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [10, 11], 'ifrsCategory': 'Registration Fees'},
	{'lineItemName': 'Evaluation - College+Lycee', 'annualAmount': '46500.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [10, 11], 'ifrsCategory': 'Registration Fees'},
	{'lineItemName': 'DAI - Francais', 'annualAmount': '2980000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [5, 6], 'ifrsCategory': 'Registration Fees'},
	{'lineItemName': 'DAI - Nationaux', 'annualAmount': '187050.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [5, 6], 'ifrsCategory': 'Registration Fees'},
	{'lineItemName': 'DAI - Autres', 'annualAmount': '5570000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [5, 6], 'ifrsCategory': 'Registration Fees'},
	# Activities & Services
	{'lineItemName': 'APS', 'annualAmount': '1230000.0000', 'distributionMethod': 'ACADEMIC_10', 'ifrsCategory': 'Activities & Services'},
	{'lineItemName': 'Garderie', 'annualAmount': '30000.0000', 'distributionMethod': 'ACADEMIC_10', 'ifrsCategory': 'Activities & Services'},
	{'lineItemName': 'Class Photos', 'annualAmount': '52800.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [11, 12], 'ifrsCategory': 'Activities & Services'},
	{'lineItemName': 'PSG Academy Rental', 'annualAmount': '51230.0000', 'distributionMethod': 'YEAR_ROUND_12', 'ifrsCategory': 'Activities & Services'},
	# Examination Fees
	{'lineItemName': 'BAC', 'annualAmount': '222000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [4, 5], 'ifrsCategory': 'Examination Fees'},
	{'lineItemName': 'DNB', 'annualAmount': '61800.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [4, 5], 'ifrsCategory': 'Examination Fees'},
	{'lineItemName': 'EAF', 'annualAmount': '96000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [4, 5], 'ifrsCategory': 'Examination Fees'},
	{'lineItemName': 'SIELE', 'annualAmount': '15000.0000', 'distributionMethod': 'SPECIFIC_PERIOD', 'specificMonths': [10, 11], 'ifrsCategory': 'Examination Fees'},
	# Social Aid (negative amounts, excluded from executive totals)
	{'lineItemName': 'Bourses AEFE', 'annualAmount': '-151906.0000', 'distributionMethod': 'ACADEMIC_10', 'ifrsCategory': 'Other Revenue'},
	{'lineItemName': 'Bourses AESH', 'annualAmount': '-177600.0000', 'distributionMethod': 'ACADEMIC_10', 'ifrsCategory': 'Other Revenue'},
]

# ── Expected Results (from Excel REVENUE_ENGINE) ──────────────────────────────

EXPECTED_MONTHLY = {
	1:  {'tuition': 5825395.94, 'discount': -223032.18, 'registration': 0,       'activities': 126000, 'exams': 0,      'total': 5728363.75},
	2:  {'tuition': 5825395.94, 'discount': -223032.18, 'registration': 0,       'activities': 126000, 'exams': 0,      'total': 5728363.75},
	3:  {'tuition': 5825395.94, 'discount': -223032.18, 'registration': 0,       'activities': 126000, 'exams': 0,      'total': 5728363.75},
	4:  {'tuition': 5825395.94, 'discount': -223032.18, 'registration': 0,       'activities': 126000, 'exams': 189900, 'total': 5918263.75},
	5:  {'tuition': 5825395.94, 'discount': -223032.18, 'registration': 4836525, 'activities': 126000, 'exams': 189900, 'total': 10754788.75},
	6:  {'tuition': 5825395.94, 'discount': -223032.18, 'registration': 4836525, 'activities': 126000, 'exams': 0,      'total': 10564888.75},
	7:  {'tuition': 0,          'discount': 0,          'registration': 0,       'activities': 0,      'exams': 0,      'total': 0},
	8:  {'tuition': 0,          'discount': 0,          'registration': 0,       'activities': 0,      'exams': 0,      'total': 0},
	9:  {'tuition': 6004969.53, 'discount': -248879.90, 'registration': 0,       'activities': 126000, 'exams': 0,      'total': 5882089.62},
	10: {'tuition': 6004969.53, 'discount': -248879.90, 'registration': 68500,   'activities': 126000, 'exams': 7500,   'total': 5958089.62},
	11: {'tuition': 6004969.53, 'discount': -248879.90, 'registration': 68500,   'activities': 152400, 'exams': 7500,   'total': 5984489.62},
	12: {'tuition': 6004969.53, 'discount': -248879.90, 'registration': 0,       'activities': 152400, 'exams': 0,      'total': 5908489.62},
}

EXPECTED_TOTALS = {
	'tuition': 58972253.73,
	'discount': -2333712.71,
	'registration': 9810050,
	'activities': 1312800,
	'exams': 394800,
	'total_operating': 68156191.02,
}

# ── API Helpers ─────────────────────────────────────────────────────────────────

def api_put(token, path, body):
	r = requests.put(f'{BASE}/versions/{VERSION_ID}/{path}', json=body,
	                 headers={'Authorization': f'Bearer {token}'})
	if not r.ok:
		print(f'PUT {path} failed ({r.status_code}): {r.text}')
		return None
	return r.json()

def api_post(token, path, body=None):
	r = requests.post(f'{BASE}/versions/{VERSION_ID}/{path}', json=body or {},
	                  headers={'Authorization': f'Bearer {token}'})
	if not r.ok:
		print(f'POST {path} failed ({r.status_code}): {r.text}')
		return None
	return r.json()

def api_get(token, path):
	r = requests.get(f'{BASE}/versions/{VERSION_ID}/{path}',
	                 headers={'Authorization': f'Bearer {token}'})
	if not r.ok:
		print(f'GET {path} failed ({r.status_code}): {r.text}')
		return None
	return r.json()

# ── Main ────────────────────────────────────────────────────────────────────────

def main():
	print('=== BudFin Revenue Data Population & Validation ===\n')

	# Step 1: Login
	print('[1/7] Logging in...')
	token = login()
	print(f'  Token obtained (first 20 chars): {token[:20]}...\n')

	# Step 2: Populate enrollment detail
	print('[2/7] Populating enrollment detail...')
	enrollment_entries = build_enrollment_entries()
	print(f'  Entries to upload: {len(enrollment_entries)}')
	# Verify headcount sums
	sums = {}
	for e in enrollment_entries:
		key = f"{e['gradeLevel']}:{e['academicPeriod']}"
		sums[key] = sums.get(key, 0) + e['headcount']
	total_ay1 = sum(v for k, v in sums.items() if ':AY1' in k)
	total_ay2 = sum(v for k, v in sums.items() if ':AY2' in k)
	print(f'  AY1 total: {total_ay1}, AY2 total: {total_ay2}')
	result = api_put(token, 'enrollment/detail', {'entries': enrollment_entries})
	if result:
		print(f'  Result: {result}\n')
	else:
		print('  FAILED - check error above\n')
		# Try to continue anyway

	# Step 3: Populate fee grid (Plein tariff only)
	print('[3/7] Populating fee grid...')
	fee_entries = build_fee_grid_entries()
	print(f'  Entries to upload: {len(fee_entries)}')
	result = api_put(token, 'fee-grid', {'entries': fee_entries})
	if result:
		print(f'  Result: {result}\n')
	else:
		print('  FAILED - check error above\n')

	# Step 4: Populate discount policies
	print('[4/7] Populating discount policies...')
	result = api_put(token, 'discounts', {'entries': DISCOUNT_ENTRIES})
	if result:
		print(f'  Result: {result}\n')
	else:
		print('  FAILED - check error above\n')

	# Step 5: Populate other revenue items
	print('[5/7] Populating other revenue items...')
	print(f'  Items to upload: {len(OTHER_REVENUE_ITEMS)}')
	result = api_put(token, 'other-revenue', {'items': OTHER_REVENUE_ITEMS})
	if result:
		print(f'  Result: {result}\n')
	else:
		print('  FAILED - check error above\n')

	# Step 6: Check readiness
	print('[6/7] Checking revenue readiness...')
	readiness = api_get(token, 'revenue/readiness')
	if readiness:
		print(f'  Overall ready: {readiness.get("overallReady")}')
		for area in ['feeGrid', 'tariffAssignment', 'discounts', 'otherRevenue']:
			status = readiness.get(area, {})
			print(f'  {area}: {status}')
		print()

	# Step 7: Run revenue calculation
	print('[7/7] Running revenue calculation...')
	calc_result = api_post(token, 'calculate/revenue')
	if calc_result:
		print(f'  Run ID: {calc_result.get("runId")}')
		print(f'  Duration: {calc_result.get("durationMs")}ms')
		print(f'  Tuition rows: {calc_result.get("tuitionRowCount")}')
		print(f'  Other revenue rows: {calc_result.get("otherRevenueRowCount")}')
		summary = calc_result.get('summary', {})
		print(f'\n  === Engine Totals ===')
		print(f'  Gross Revenue HT:       {float(summary.get("grossRevenueHt", 0)):>15,.2f}')
		print(f'  Total Discounts:         {float(summary.get("totalDiscounts", 0)):>15,.2f}')
		print(f'  Net Revenue HT:          {float(summary.get("netRevenueHt", 0)):>15,.2f}')
		print(f'  Total VAT:               {float(summary.get("totalVat", 0)):>15,.2f}')
		print(f'  Total Other Revenue:     {float(summary.get("totalOtherRevenue", 0)):>15,.2f}')
		print(f'  Exec Other Revenue:      {float(summary.get("totalExecutiveOtherRevenue", 0)):>15,.2f}')
		print(f'  Total Operating Revenue: {float(summary.get("totalOperatingRevenue", 0)):>15,.2f}')

		# Compare with expected
		print(f'\n  === Comparison with Excel ===')
		gross = float(summary.get('grossRevenueHt', 0))
		discount = float(summary.get('totalDiscounts', 0))
		net = float(summary.get('netRevenueHt', 0))
		total_op = float(summary.get('totalOperatingRevenue', 0))
		exec_other = float(summary.get('totalExecutiveOtherRevenue', 0))

		# Excel expects:
		# Tuition = grossRevenueHt (effective/charged tuition)
		# Discount = totalDiscounts
		# Registration + Activities + Exams = totalExecutiveOtherRevenue
		# Total Operating = netRevenueHt + totalExecutiveOtherRevenue
		expected_tuition = EXPECTED_TOTALS['tuition']
		expected_discount = abs(EXPECTED_TOTALS['discount'])
		expected_total = EXPECTED_TOTALS['total_operating']

		print(f'  Gross Tuition (engine):   {gross:>15,.2f}  Expected: {expected_tuition:>15,.2f}  Delta: {gross - expected_tuition:>10,.2f}')
		print(f'  Total Discounts (engine): {discount:>15,.2f}  Expected: {expected_discount:>15,.2f}  Delta: {discount - expected_discount:>10,.2f}')
		print(f'  Exec Other Rev (engine):  {exec_other:>15,.2f}  Expected: {EXPECTED_TOTALS["registration"] + EXPECTED_TOTALS["activities"] + EXPECTED_TOTALS["exams"]:>15,.2f}  Delta: {exec_other - (EXPECTED_TOTALS["registration"] + EXPECTED_TOTALS["activities"] + EXPECTED_TOTALS["exams"]):>10,.2f}')
		print(f'  Total Operating (engine): {total_op:>15,.2f}  Expected: {expected_total:>15,.2f}  Delta: {total_op - expected_total:>10,.2f}')
	else:
		print('  Calculation FAILED\n')

	print('\n=== Done ===')

if __name__ == '__main__':
	main()
