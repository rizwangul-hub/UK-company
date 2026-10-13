import mongoose from 'mongoose';
import '../config/env.js';
import Property from '../models/Property.js';
import Tenant from '../models/Tenant.js';
import TenancyAgreement from '../models/TenancyAgreement.js';
import RentSchedule from '../models/RentSchedule.js';
import RentPayment from '../models/RentPayment.js';
import Account from '../models/Account.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import { VALID_COMPANY_IDS } from '../config/companies.js';
import { seedAllCompaniesDefaults } from './seedDefaults.js';

// LandlordVision MongoDB URI (Read-Only source, loaded from environment)
const LANDLORD_VISION_URI = process.env.LANDLORD_VISION_MONGO_URI;

async function importRemainingLvData() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.log('======================================================');
  console.log('  PIXX UK EXPENSE TRACKER - DATA MIGRATION & SEEDING  ');
  console.log(`  Target DB: ${process.env.MONGO_URI ? 'Connected' : 'Missing'}`);
  console.log(`  Mode: ${isDryRun ? '🔍 DRY RUN (PREVIEW ONLY)' : '⚡ LIVE IMPORT & RECONCILIATION'}`);
  console.log('======================================================\n');

  // 1. Connect to Target Database
  await mongoose.connect(process.env.MONGO_URI);
  if (mongoose.connection.name !== 'uk_property_finance') {
    throw new Error(`CRITICAL: Connected to database "${mongoose.connection.name}" instead of "uk_property_finance". Aborting!`);
  }
  console.log(`[Target DB Connected]: ${mongoose.connection.host} / ${mongoose.connection.name}`);

  // 2. Step 1: Ensure Default Bank & Cash Accounts Exist For ALL 6 Companies
  console.log('\n--- STEP 1: SEEDING DEFAULT BANK & CASH ACCOUNTS FOR ALL 6 COMPANIES ---');
  if (!isDryRun) {
    await seedAllCompaniesDefaults();
  }
  const accountsCount = await Account.countDocuments({ companyId: { $in: VALID_COMPANY_IDS } });
  console.log(`✓ Active company bank/cash accounts: ${accountsCount}`);

  // 3. Connect to Source LandlordVision Database (Read-Only)
  if (!LANDLORD_VISION_URI) {
    throw new Error('LANDLORD_VISION_MONGO_URI environment variable is required to run this import script.');
  }
  console.log('\n--- STEP 2: CONNECTING TO SOURCE LANDLORDVISION DB ---');
  const sourceConn = await mongoose.createConnection(LANDLORD_VISION_URI).asPromise();
  console.log(`[Source DB Connected]: ${sourceConn.host} / ${sourceConn.name}`);

  const sourceCustomers = await sourceConn.collection('customers').find().toArray();
  const sourceTenancies = await sourceConn.collection('tenancies').find().toArray();
  const sourcePayments = await sourceConn.collection('payments').find().toArray();
  const sourceInvoices = await sourceConn.collection('invoices').find().toArray();
  const sourceProperties = await sourceConn.collection('properties').find().toArray();

  console.log(`Source records retrieved:`);
  console.log(`- Customers: ${sourceCustomers.length}`);
  console.log(`- Tenancies: ${sourceTenancies.length}`);
  console.log(`- Invoices: ${sourceInvoices.length}`);
  console.log(`- Payments: ${sourcePayments.length}`);

  // Map of source property ID -> target property document
  const targetProperties = await Property.find({ companyId: { $in: VALID_COMPANY_IDS } }).lean();
  const propMapByLvId = new Map();
  for (const tp of targetProperties) {
    if (tp.sourceReference) {
      propMapByLvId.set(tp.sourceReference, tp);
    }
  }
  console.log(`✓ Target properties matched by sourceReference: ${propMapByLvId.size} / ${targetProperties.length}`);

  // 4. Step 3: Import Tenants
  console.log('\n--- STEP 3: IMPORTING TENANTS ---');
  const tenantMapByLvCustId = new Map();
  let tenantsCreated = 0;
  let tenantsUpdated = 0;

  for (const c of sourceCustomers) {
    const isCompany = /ltd|limited|inc|llp|holdings/i.test(c.name || '') || c.type?.toLowerCase().includes('company');
    const tenantPayload = {
      companyId: 'old-street',
      fullName: (c.name || 'Unknown Tenant').trim(),
      email: (c.email || '').trim().toLowerCase(),
      phone: (c.phone || '').trim(),
      currentAddress: (c.address || '').trim(),
      postcode: (c.address && c.address.match(/[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}/i)?.[0]) || '',
      tenantType: isCompany ? 'COMPANY' : 'INDIVIDUAL',
      companyName: isCompany ? (c.name || '').trim() : '',
      notes: (c.notes || '').trim(),
      isActive: c.status !== 'Inactive' && !c.isArchived,
    };

    if (!isDryRun) {
      let tenantDoc = await Tenant.findOne({
        companyId: 'old-street',
        fullName: tenantPayload.fullName,
      });

      if (tenantDoc) {
        tenantDoc.email = tenantPayload.email || tenantDoc.email;
        tenantDoc.phone = tenantPayload.phone || tenantDoc.phone;
        tenantDoc.currentAddress = tenantPayload.currentAddress || tenantDoc.currentAddress;
        tenantDoc.tenantType = tenantPayload.tenantType;
        tenantDoc.companyName = tenantPayload.companyName;
        tenantDoc.isActive = tenantPayload.isActive;
        await tenantDoc.save();
        tenantsUpdated++;
      } else {
        tenantDoc = await Tenant.create(tenantPayload);
        tenantsCreated++;
      }
      tenantMapByLvCustId.set(c._id.toString(), tenantDoc);
    } else {
      tenantMapByLvCustId.set(c._id.toString(), {
        _id: new mongoose.Types.ObjectId(),
        ...tenantPayload,
      });
      tenantsCreated++;
    }
  }

  // Create or retrieve fallback tenants for the 2 ended tenancies with missing customer records
  const orphanCustomerFallbacks = [
    {
      lvId: '6aa28bd6f4b1b13ce0a42b8f',
      name: 'Previous Tenant (12 Alexandra Street)',
      email: '',
      phone: '',
      address: '12 Alexandra Street',
    },
    {
      lvId: '6aa28dd0f4b1b13ce0a42e93',
      name: 'Previous Tenant (62A Orsett Road)',
      email: '',
      phone: '',
      address: '62A Orsett Road',
    },
  ];

  for (const orphan of orphanCustomerFallbacks) {
    if (!isDryRun) {
      let doc = await Tenant.findOne({
        companyId: 'old-street',
        fullName: orphan.name,
      });
      if (!doc) {
        doc = await Tenant.create({
          companyId: 'old-street',
          fullName: orphan.name,
          email: orphan.email,
          phone: orphan.phone,
          currentAddress: orphan.address,
          tenantType: 'INDIVIDUAL',
          isActive: false,
          notes: `Legacy tenant from ended tenancy (LandlordVision ref: ${orphan.lvId})`,
        });
        tenantsCreated++;
      }
      tenantMapByLvCustId.set(orphan.lvId, doc);
    } else {
      tenantMapByLvCustId.set(orphan.lvId, {
        _id: new mongoose.Types.ObjectId(),
        fullName: orphan.name,
        companyId: 'old-street',
      });
      tenantsCreated++;
    }
  }

  console.log(`✓ Tenants: ${tenantsCreated} created, ${tenantsUpdated} updated (Total mapped: ${tenantMapByLvCustId.size})`);

  // 5. Step 4: Import Tenancy Agreements
  console.log('\n--- STEP 4: IMPORTING TENANCY AGREEMENTS ---');
  const tenancyMapByLvId = new Map();
  let tenanciesCreated = 0;
  let tenanciesUpdated = 0;

  for (const t of sourceTenancies) {
    const lvPropId = t.propertyId?.toString();
    const targetProp = propMapByLvId.get(lvPropId);
    if (!targetProp) {
      console.warn(`[WARN] No target property found for tenancy ${t._id} (prop ${lvPropId})`);
      continue;
    }

    const lvCustId = t.customerId?.toString();
    const targetTenant = tenantMapByLvCustId.get(lvCustId);
    if (!targetTenant) {
      console.warn(`[WARN] No target tenant found for tenancy ${t._id} (cust ${lvCustId})`);
      continue;
    }

    const startDate = new Date(t.startDate);
    const endDate = t.endDate ? new Date(t.endDate) : new Date(startDate.getTime() + 365 * 24 * 3600 * 1000);
    const isCompanyLet = targetTenant.tenantType === 'COMPANY';

    // Generate deterministic agreement reference
    const propCode = targetProp.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    const agreementRef = `AST-${propCode}-${startDate.getFullYear()}`;

    const agreementPayload = {
      companyId: 'old-street',
      agreementRef,
      tenantId: targetTenant._id,
      propertyId: targetProp._id,
      unitId: null,
      leaseType: isCompanyLet ? 'COMMERCIAL_LEASE' : 'AST',
      startDate,
      endDate,
      rentAmount: t.monthlyRent || targetProp.contractualRent || 0,
      paymentFrequency: 'MONTHLY',
      rentDueDay: t.paymentDueDay || 1,
      depositAmount: t.securityDeposit || 0,
      status: t.status === 'Active' ? 'ACTIVE' : 'TERMINATED',
      notes: `Imported from LandlordVision (Tenancy Ref: ${t._id})`,
    };

    if (!isDryRun) {
      let agreementDoc = await TenancyAgreement.findOne({
        companyId: 'old-street',
        agreementRef: agreementPayload.agreementRef,
      });

      if (agreementDoc) {
        agreementDoc.tenantId = agreementPayload.tenantId;
        agreementDoc.propertyId = agreementPayload.propertyId;
        agreementDoc.rentAmount = agreementPayload.rentAmount;
        agreementDoc.startDate = agreementPayload.startDate;
        agreementDoc.endDate = agreementPayload.endDate;
        agreementDoc.status = agreementPayload.status;
        agreementDoc.notes = agreementPayload.notes;
        await agreementDoc.save();
        tenanciesUpdated++;
      } else {
        agreementDoc = await TenancyAgreement.create(agreementPayload);
        tenanciesCreated++;
      }
      tenancyMapByLvId.set(t._id.toString(), agreementDoc);
    } else {
      tenancyMapByLvId.set(t._id.toString(), {
        _id: new mongoose.Types.ObjectId(),
        ...agreementPayload,
      });
      tenanciesCreated++;
    }
  }

  console.log(`✓ Tenancy Agreements: ${tenanciesCreated} created, ${tenanciesUpdated} updated (Total mapped: ${tenancyMapByLvId.size})`);

  // 6. Step 5: Import Rent Billing Schedules
  console.log('\n--- STEP 5: IMPORTING RENT BILLING SCHEDULES (131 Invoices) ---');
  let schedulesCreated = 0;
  let schedulesUpdated = 0;
  const scheduleMapByInvoiceId = new Map();

  // Create payment lookup for quick resolution of billing month/year
  const paymentMap = new Map();
  for (const p of sourcePayments) {
    paymentMap.set(p._id.toString(), p);
  }

  for (const inv of sourceInvoices) {
    const lvPropId = inv.propertyId?.toString();
    const targetProp = propMapByLvId.get(lvPropId);
    if (!targetProp) continue;

    const lvTenId = inv.tenancyId?.toString();
    const targetAgreement = tenancyMapByLvId.get(lvTenId);
    if (!targetAgreement) continue;

    const targetTenant = targetAgreement.tenantId;

    // Resolve billingMonth in YYYY-MM format
    let billingMonth = '';
    const payment = inv.paymentId ? paymentMap.get(inv.paymentId.toString()) : null;
    if (payment && payment.billingYear && payment.billingMonth) {
      billingMonth = `${payment.billingYear}-${String(payment.billingMonth).padStart(2, '0')}`;
    } else if (inv.dueDate) {
      const d = new Date(inv.dueDate);
      if (!isNaN(d.getTime())) {
        billingMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      }
    }
    if (!billingMonth) {
      billingMonth = new Date().toISOString().slice(0, 7);
    }

    const dueDate = new Date(inv.dueDate || Date.now());
    const expectedAmount = Number(inv.amount) || 0;
    const paidAmount = Number(inv.paymentInfo?.paidAmount) || 0;
    const outstandingAmount = Math.max(0, expectedAmount - paidAmount);

    let status = 'PENDING';
    if (paidAmount >= expectedAmount) {
      status = 'PAID';
    } else if (paidAmount > 0) {
      status = 'PARTIAL';
    } else {
      status = dueDate < new Date() ? 'OVERDUE' : 'PENDING';
    }

    if (!isDryRun) {
      let scheduleDoc = await RentSchedule.findOne({
        companyId: 'old-street',
        agreementId: targetAgreement._id,
        billingMonth,
      });

      if (scheduleDoc) {
        scheduleDoc.expectedAmount = expectedAmount;
        scheduleDoc.paidAmount = paidAmount;
        scheduleDoc.outstandingAmount = outstandingAmount;
        scheduleDoc.status = status;
        scheduleDoc.dueDate = dueDate;
        scheduleDoc.notes = `Invoice ${inv.invoiceNumber} (${inv.billingPeriod || ''})`;
        await scheduleDoc.save();
        schedulesUpdated++;
      } else {
        scheduleDoc = await RentSchedule.create({
          companyId: 'old-street',
          agreementId: targetAgreement._id,
          tenantId: targetTenant,
          propertyId: targetProp._id,
          unitId: null,
          billingMonth,
          dueDate,
          expectedAmount,
          paidAmount,
          outstandingAmount,
          status,
          notes: `Invoice ${inv.invoiceNumber} (${inv.billingPeriod || ''})`,
        });
        schedulesCreated++;
      }
      scheduleMapByInvoiceId.set(inv._id.toString(), scheduleDoc);
    } else {
      scheduleMapByInvoiceId.set(inv._id.toString(), {
        _id: new mongoose.Types.ObjectId(),
        companyId: 'old-street',
        agreementId: targetAgreement._id,
        tenantId: targetTenant,
        propertyId: targetProp._id,
        billingMonth,
        dueDate,
        expectedAmount,
        paidAmount,
        outstandingAmount,
        status,
      });
      schedulesCreated++;
    }
  }

  console.log(`✓ Rent Schedules: ${schedulesCreated} created, ${schedulesUpdated} updated (Total mapped: ${scheduleMapByInvoiceId.size})`);

  // 7. Step 6: Import Paid Rent Receipts & Ledger Cash Movement
  console.log('\n--- STEP 6: IMPORTING PAID RENT RECEIPTS & CASH LEDGER TRANSACTIONS ---');
  let paymentsCreated = 0;
  let transactionsPosted = 0;
  let totalCashCollected = 0;
  let receiptsCount = 0;

    for (const inv of sourceInvoices) {
      const paidAmount = Number(inv.paymentInfo?.paidAmount) || 0;
      if (paidAmount <= 0 && inv.status !== 'Received') continue;
      receiptsCount++;
      totalCashCollected += paidAmount;
    }

    if (isDryRun) {
      console.log(`[DRY RUN PREVIEW] Receipts to create: ${receiptsCount}`);
      console.log(`[DRY RUN PREVIEW] Transactions to post: ${receiptsCount}`);
      console.log(`[DRY RUN PREVIEW] Total cash to collect into Main Operating Account: £${totalCashCollected.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
    } else {
      // Resolve Barclays Main Operating Account for old-street
      const mainOperatingAccount = await Account.findOne({
        companyId: 'old-street',
        accountType: 'BANK',
        name: 'Main Operating Account',
      });

      if (!mainOperatingAccount) {
        throw new Error('Main Operating Account for old-street was not found!');
      }

      // Resolve Rental Income nominal head
      let rentalCategory = await Category.findOne({
        companyId: 'old-street',
        type: 'INCOME',
        isRentalHead: true,
      });
      if (!rentalCategory) {
        rentalCategory = await Category.findOne({
          companyId: 'old-street',
          type: 'INCOME',
          name: 'Rental Income',
        });
      }

      // Process all invoices with payments
      for (const inv of sourceInvoices) {
        const paidAmount = Number(inv.paymentInfo?.paidAmount) || 0;
        if (paidAmount <= 0 && inv.status !== 'Received') continue;

        const scheduleDoc = scheduleMapByInvoiceId.get(inv._id.toString());
        if (!scheduleDoc) continue;

        const receiptRef = `REC-${inv.invoiceNumber}`;
        const paymentDate = inv.paymentInfo?.paidDate ? new Date(inv.paymentInfo.paidDate) : new Date(inv.dueDate);

        let rentPaymentDoc = await RentPayment.findOne({
          companyId: 'old-street',
          receiptRef,
        });

        if (!rentPaymentDoc) {
          rentPaymentDoc = await RentPayment.create({
            companyId: 'old-street',
            receiptRef,
            paymentDate,
            billingMonth: scheduleDoc.billingMonth,
            tenantId: scheduleDoc.tenantId,
            propertyId: scheduleDoc.propertyId,
            unitId: null,
            agreementId: scheduleDoc.agreementId,
            scheduleId: scheduleDoc._id,
            amount: paidAmount,
            receivingAccountId: mainOperatingAccount._id,
            paymentMethod: inv.paymentInfo?.paymentMethod === 'Bank Transfer' ? 'BANK_TRANSFER' : 'CARD',
            notes: `Rent received for ${scheduleDoc.billingMonth} - Inv Ref: ${inv.invoiceNumber}`,
          });
          paymentsCreated++;
        }

        // Check/Post Transaction
        let txDoc = await Transaction.findOne({
          companyId: 'old-street',
          voucherNo: receiptRef,
        });

        if (!txDoc) {
          txDoc = await Transaction.create({
            companyId: 'old-street',
            transactionDate: paymentDate,
            voucherNo: receiptRef,
            transactionType: 'INCOME',
            accountId: mainOperatingAccount._id,
            categoryId: rentalCategory?._id || null,
            amount: paidAmount,
            direction: 'IN',
            propertyId: scheduleDoc.propertyId,
            unitId: null,
            periodMonth: scheduleDoc.billingMonth,
            narration: `Rental income received for ${scheduleDoc.billingMonth} (${receiptRef})`,
            reference: inv.invoiceNumber,
            status: 'POSTED',
          });
          transactionsPosted++;
        }
      }

      // Recompute and update Main Operating Account balance from all transactions
      const totalTransactionsIn = await Transaction.aggregate([
        { $match: { accountId: mainOperatingAccount._id, status: 'POSTED', direction: 'IN' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const totalTransactionsOut = await Transaction.aggregate([
        { $match: { accountId: mainOperatingAccount._id, status: 'POSTED', direction: 'OUT' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      const netBalance =
        (mainOperatingAccount.openingBalance || 0) +
        (totalTransactionsIn[0]?.total || 0) -
        (totalTransactionsOut[0]?.total || 0);

      mainOperatingAccount.currentBalance = Math.round((netBalance + Number.EPSILON) * 100) / 100;
      await mainOperatingAccount.save();

      console.log(`✓ Rent Receipts created: ${paymentsCreated}`);
      console.log(`✓ Ledger Transactions posted: ${transactionsPosted}`);
      console.log(`✓ Total Cash Collected: £${totalCashCollected.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
      console.log(`✓ Reconciled Main Operating Account Balance: £${mainOperatingAccount.currentBalance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
    }

  // Close source connection
  await sourceConn.close();

  console.log('\n======================================================');
  console.log('  DATA MIGRATION & RECONCILIATION COMPLETE!           ');
  console.log('======================================================\n');

  await mongoose.disconnect();
}

importRemainingLvData().catch((err) => {
  console.error('\n❌ ERROR RUNNING IMPORT:', err);
  process.exit(1);
});
