import dotenv from 'dotenv';
dotenv.config();

import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import Property from '../models/Property.js';
import Unit from '../models/Unit.js';
import Category from '../models/Category.js';

// Normalization helper for property names & addresses (including common spelling errors)
function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/claracne|clarance/g, 'clarence')
    .replace(/orset\b/g, 'orsett')
    .replace(/alaxandra|alexander/g, 'alexandra')
    .replace(/sounthend/g, 'southend')
    .replace(/protori|pretoria/g, 'pretoria')
    .replace(/vansitart|vansitratt|vanaitratt|vanistrat/g, 'vansittart')
    .replace(/landsbury|landsbbury/g, 'lansbury')
    .replace(/admin expeses/g, 'admin expenses')
    .replace(/repair and maintainance/g, 'repair and maintenance')
    .replace(/rent depsit refund/g, 'rent deposit refund')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function simulate() {
  await mongoose.connect(process.env.MONGO_URI);
  const companyId = 'old-street';

  const properties = await Property.find({ companyId }).lean();
  const allUnits = await Unit.find({ companyId }).lean();
  const categories = await Category.find({ companyId: { $in: [companyId, 'GLOBAL'] } }).lean();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/HP/Desktop/Bank statment of company.xlsx');
  const ws = wb.getWorksheet('Sheet1');

  console.log(`Loaded ${properties.length} properties, ${allUnits.length} units, ${categories.length} categories.`);

  let matchedPropsCount = 0;
  let matchedUnitsCount = 0;
  let loanCount = 0;
  let interestCount = 0;
  let rentCount = 0;
  let adminCount = 0;
  let unassignedCount = 0;

  const sampleResults = [];

  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const date = row.getCell(1).value;
    const memo = String(row.getCell(2).value || '').trim();
    const head = String(row.getCell(3).value || '').trim();
    const subHead = String(row.getCell(4).value || '').trim();
    const payments = Number(row.getCell(5).value) || 0;
    const receipts = Number(row.getCell(6).value) || 0;
    const memoOriginal = String(row.getCell(9).value || '').trim();

    if (!memo && !head && payments === 0 && receipts === 0) continue;

    const fullText = normalizeText(`${memo} ${head} ${subHead} ${memoOriginal}`);
    const normHead = normalizeText(head);
    const normSubHead = normalizeText(subHead);
    const normMemo = normalizeText(memo);

    let prop = null;
    let unit = null;
    let type = 'EXPENSE';

    // 1. Property detection
    // Clean normalized street & number matching
    for (const p of properties) {
      const pNameNorm = normalizeText(p.name);
      
      // Direct alias/special cases:
      if (pNameNorm.includes('cromwell') && (fullText.includes('cromwell') || fullText.includes('ceomwell'))) {
        prop = p;
        break;
      }
      if (pNameNorm.includes('clarence') && (fullText.includes('clarence') || fullText.includes('claracne') || fullText.includes('clarnece') || fullText.includes('clarnce'))) {
        // Distinguish 26 Clarence from 13/15 Clarence
        if (pNameNorm.includes('26') && fullText.includes('26')) {
          prop = p;
          break;
        } else if (pNameNorm.includes('13') && (fullText.includes('13') || fullText.includes('15'))) {
          prop = p;
          break;
        }
      }
      if (pNameNorm.includes('alexandra') && fullText.includes('alexandra')) {
        prop = p;
        break;
      }
      if (pNameNorm.includes('orsett') && fullText.includes('orsett')) {
        prop = p;
        break;
      }
      if (pNameNorm.includes('southend') && fullText.includes('southend')) {
        prop = p;
        break;
      }
      if (pNameNorm.includes('pretoria') && fullText.includes('pretoria')) {
        prop = p;
        break;
      }
      if (pNameNorm.includes('millard') && fullText.includes('millard')) {
        prop = p;
        break;
      }
      if (pNameNorm.includes('como') && fullText.includes('como')) {
        prop = p;
        break;
      }
      if (pNameNorm.includes('vansittart') && fullText.includes('vansittart')) {
        prop = p;
        break;
      }
      if (pNameNorm.includes('lakewalk') && (fullText.includes('lakewalk') || fullText.includes('lake walk'))) {
        prop = p;
        break;
      }
      if (pNameNorm.includes('lansbury') && fullText.includes('lansbury')) {
        prop = p;
        break;
      }
      if (pNameNorm.includes('morley') && fullText.includes('morley')) {
        prop = p;
        break;
      }
    }

    // 2. Unit detection & Classification logic
    const isRent = normHead.includes('income') && normSubHead.includes('rent');
    const isInterest = normHead.includes('interest');
    const isLoan = normHead.includes('loan');
    const isAdmin = normHead.includes('admin');

    if (isRent) {
      type = 'RENT';
      rentCount++;
      // Rent should assign Unit if multi-unit
      if (prop) {
        const propUnits = allUnits.filter(u => u.propertyId.toString() === prop._id.toString());
        if (propUnits.length === 1) {
          unit = propUnits[0];
        } else if (propUnits.length > 1) {
          // Detect shop vs flat
          const isShop = fullText.includes('shop') || fullText.includes('barber') || fullText.includes('latin plaza') || fullText.includes('heathway') || fullText.includes('penns') || fullText.includes('habib') || fullText.includes('abualela') || fullText.includes('ivape') || fullText.includes('shelby') || fullText.includes('wickford') || fullText.includes('rashed');
          const isFlat = fullText.includes('flat') || fullText.includes('flats') || fullText.includes('ideal letting') || fullText.includes('12a') || fullText.includes('12b') || fullText.includes('12c') || fullText.includes('12d') || fullText.includes('62a') || fullText.includes('26a') || fullText.includes('127a');

          if (isShop) {
            // Find shop unit
            if (fullText.includes('13') && !fullText.includes('13 15') && !fullText.includes('13/15')) {
              unit = propUnits.find(u => u.unitName.includes('13') && !u.unitName.includes('15') && u.unitType === 'RETAIL_SHOP');
            } else if (fullText.includes('15') && !fullText.includes('13 15') && !fullText.includes('13/15')) {
              unit = propUnits.find(u => u.unitName.includes('15') && !u.unitName.includes('13') && u.unitType === 'RETAIL_SHOP');
            } else {
              unit = propUnits.find(u => u.unitType === 'RETAIL_SHOP' || u.unitName.toLowerCase().includes('shop'));
            }
          } else if (isFlat) {
            unit = propUnits.find(u => u.unitType === 'FLAT' || u.unitName.toLowerCase().includes('flat'));
          } else {
            // Check specific unit mentions like 10b, 12b, 10, 12
            const matchedSubUnit = propUnits.find(u => fullText.includes(u.unitName.toLowerCase()));
            if (matchedSubUnit) unit = matchedSubUnit;
            else unit = propUnits.find(u => u.unitType === 'FLAT') || null;
          }
        }
      }
    } else if (isInterest) {
      type = 'MORTGAGE_PAYMENT';
      interestCount++;
      // User rule: "some are interst expense which are not single unit expens its have the property expense which located both or multiple unit"
      unit = null; // Whole property!
    } else if (isLoan) {
      type = 'TRANSFER';
      loanCount++;
      // User rule: "some loan which show like 127 SOUTHEND ROAD and in head show loan it mean that this is loan of the property whch have both unit not the single unit loan"
      if (normSubHead.includes('remortgage') && prop) {
        unit = null; // Whole property loan!
      } else {
        prop = null;
        unit = null;
      }
    } else if (isAdmin) {
      type = 'EXPENSE';
      adminCount++;
      // General admin unless repair specifically mentions property
      if (!normSubHead.includes('repair')) {
        prop = null;
        unit = null;
      }
    }

    if (prop) matchedPropsCount++;
    if (unit) matchedUnitsCount++;
    if (!prop && !unit && !isLoan && !isAdmin) unassignedCount++;

    if (r <= 25 || r % 100 === 0) {
      sampleResults.push({
        r,
        memo,
        head,
        subHead,
        type,
        property: prop?.name || 'NONE',
        unit: unit?.unitName || 'NONE (Whole Property / General)',
      });
    }
  }

  console.log('\n=== SIMULATION RESULTS OVER 677 ROWS ===');
  console.log('Total Rent Rows:', rentCount);
  console.log('Total Interest Rows:', interestCount);
  console.log('Total Loan Rows:', loanCount);
  console.log('Total Admin Rows:', adminCount);
  console.log('Matched Property count:', matchedPropsCount);
  console.log('Matched Unit count:', matchedUnitsCount);
  console.log('Unassigned (non-loan/non-admin) count:', unassignedCount);
  console.log('\nSample classifications:');
  console.log(JSON.stringify(sampleResults, null, 2));

  await mongoose.disconnect();
}

simulate().catch(console.error);
