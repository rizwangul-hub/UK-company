import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import { AUTHORITATIVE_HEADS_HIERARCHY } from '../scripts/seedHeadsAndSubHeads.js';

/**
 * Escapes regex special characters
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves and strictly validates Head & Sub Head hierarchy for a transaction.
 * Supports passing headId/subHeadId, textual names (head/subHead), or legacy categoryId.
 */
export async function resolveAndValidateCategoryHierarchy({
  companyId,
  headId = null,
  subHeadId = null,
  head = '',
  subHead = '',
  categoryId = null,
}) {
  let resolvedHeadId = headId ? headId.toString() : null;
  let resolvedSubHeadId = subHeadId ? subHeadId.toString() : null;
  let resolvedHeadName = (head || '').trim();
  let resolvedSubHeadName = (subHead || '').trim();
  let resolvedCategoryId = categoryId ? categoryId.toString() : null;

  // 1. If explicit subHeadId is provided
  if (resolvedSubHeadId && mongoose.Types.ObjectId.isValid(resolvedSubHeadId)) {
    const subDoc = await Category.findOne({ _id: resolvedSubHeadId, companyId });
    if (!subDoc) {
      throw new Error(`Sub Head category "${resolvedSubHeadId}" not found in active company.`);
    }

    resolvedSubHeadName = subDoc.name;
    resolvedCategoryId = subDoc._id.toString();

    if (subDoc.parentCategoryId) {
      const parentIdStr = subDoc.parentCategoryId.toString();
      if (resolvedHeadId && resolvedHeadId !== parentIdStr) {
        const expectedParent = await Category.findById(subDoc.parentCategoryId);
        throw new Error(
          `Sub Head "${subDoc.name}" does not belong to the selected Head. It belongs to "${expectedParent ? expectedParent.name : 'another Head'}".`
        );
      }
      resolvedHeadId = parentIdStr;
      if (!resolvedHeadName) {
        const parent = await Category.findById(subDoc.parentCategoryId);
        if (parent) resolvedHeadName = parent.name;
      }
    }
  }

  // 2. If explicit headId is provided
  if (resolvedHeadId && mongoose.Types.ObjectId.isValid(resolvedHeadId)) {
    const headDoc = await Category.findOne({ _id: resolvedHeadId, companyId });
    if (!headDoc) {
      throw new Error(`Head category "${resolvedHeadId}" not found in active company.`);
    }
    resolvedHeadName = headDoc.name;
    if (!resolvedCategoryId && !resolvedSubHeadId) {
      resolvedCategoryId = headDoc._id.toString();
    }
  }

  // 3. If textual names are provided (e.g. from Excel bank statement import)
  if ((!resolvedHeadId || !resolvedSubHeadId) && (resolvedHeadName || resolvedSubHeadName)) {
    // If head name provided, find matching Head category (handling aliases e.g. "Admin Expeses")
    let headDoc = null;
    if (resolvedHeadName) {
      const hRegex = new RegExp(`^${escapeRegex(resolvedHeadName)}$`, 'i');
      headDoc = await Category.findOne({
        companyId,
        $or: [{ name: hRegex }, { aliases: hRegex }],
        parentCategoryId: null,
      });

      if (headDoc) {
        resolvedHeadId = headDoc._id.toString();
        resolvedHeadName = headDoc.name; // Use canonical name (e.g. 'Admin Expenses')
      }
    }

    // If subHead name provided
    if (resolvedSubHeadName) {
      const sRegex = new RegExp(`^${escapeRegex(resolvedSubHeadName)}$`, 'i');
      const subQuery = { companyId, name: sRegex };
      if (resolvedHeadId) {
        subQuery.parentCategoryId = resolvedHeadId;
      }

      let subDoc = await Category.findOne(subQuery);
      if (!subDoc && !resolvedHeadId) {
        // Search across any subhead if head was omitted
        subDoc = await Category.findOne({ companyId, name: sRegex, parentCategoryId: { $ne: null } });
      }

      if (subDoc) {
        resolvedSubHeadId = subDoc._id.toString();
        resolvedSubHeadName = subDoc.name;
        resolvedCategoryId = subDoc._id.toString();
        if (!resolvedHeadId && subDoc.parentCategoryId) {
          resolvedHeadId = subDoc.parentCategoryId.toString();
          const parent = await Category.findById(subDoc.parentCategoryId);
          if (parent) resolvedHeadName = parent.name;
        }
      }
    }
  }

  // 4. Legacy backward compatibility: If only legacy categoryId is passed
  if (!resolvedHeadId && !resolvedSubHeadId && resolvedCategoryId && mongoose.Types.ObjectId.isValid(resolvedCategoryId)) {
    const cat = await Category.findOne({ _id: resolvedCategoryId, companyId });
    if (cat) {
      if (cat.parentCategoryId) {
        resolvedSubHeadId = cat._id.toString();
        resolvedSubHeadName = cat.name;
        resolvedHeadId = cat.parentCategoryId.toString();
        const parent = await Category.findById(cat.parentCategoryId);
        if (parent) resolvedHeadName = parent.name;
      } else if (cat.isMainHead) {
        resolvedHeadId = cat._id.toString();
        resolvedHeadName = cat.name;
      } else {
        // Check if a child category with the same name exists
        const matchingSub = await Category.findOne({
          companyId,
          name: new RegExp(`^${escapeRegex(cat.name)}$`, 'i'),
          parentCategoryId: { $ne: null },
        });
        if (matchingSub) {
          resolvedSubHeadId = matchingSub._id.toString();
          resolvedSubHeadName = matchingSub.name;
          resolvedHeadId = matchingSub.parentCategoryId.toString();
          const parent = await Category.findById(matchingSub.parentCategoryId);
          if (parent) resolvedHeadName = parent.name;
        }
      }
    }
  }

  return {
    headId: resolvedHeadId ? new mongoose.Types.ObjectId(resolvedHeadId) : null,
    subHeadId: resolvedSubHeadId ? new mongoose.Types.ObjectId(resolvedSubHeadId) : null,
    head: resolvedHeadName,
    subHead: resolvedSubHeadName,
    categoryId: resolvedCategoryId ? new mongoose.Types.ObjectId(resolvedCategoryId) : null,
  };
}

/**
 * Returns full hierarchy for a company:
 * - All Main Heads
 * - Child Sub Heads nested under each Head
 * - Accurate transaction count for each Head and Sub Head
 * - Standalone unparented categories (if any)
 */
export async function getCategoryHierarchy(companyId) {
  // Aggregate transaction counts grouped by headId and subHeadId
  const [headCounts, subHeadCounts, legacyCatCounts] = await Promise.all([
    Transaction.aggregate([
      { $match: { companyId, isDeleted: { $ne: true }, headId: { $ne: null } } },
      { $group: { _id: '$headId', count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { companyId, isDeleted: { $ne: true }, subHeadId: { $ne: null } } },
      { $group: { _id: '$subHeadId', count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { companyId, isDeleted: { $ne: true }, categoryId: { $ne: null } } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]),
  ]);

  const headCountMap = new Map();
  headCounts.forEach((h) => headCountMap.set(h._id.toString(), h.count));

  const subHeadCountMap = new Map();
  subHeadCounts.forEach((s) => subHeadCountMap.set(s._id.toString(), s.count));

  const legacyCatCountMap = new Map();
  legacyCatCounts.forEach((c) => legacyCatCountMap.set(c._id.toString(), c.count));

  const allCategories = await Category.find({ companyId })
    .sort({ isMainHead: -1, type: 1, name: 1 })
    .lean();

  const mainHeads = [];
  const subHeadsByParent = new Map();
  const unparentedCategories = [];

  for (const cat of allCategories) {
    if (cat.isMainHead) {
      mainHeads.push(cat);
    } else if (cat.parentCategoryId) {
      const pId = cat.parentCategoryId.toString();
      if (!subHeadsByParent.has(pId)) {
        subHeadsByParent.set(pId, []);
      }
      subHeadsByParent.get(pId).push(cat);
    } else {
      unparentedCategories.push(cat);
    }
  }

  const structuredHeads = mainHeads.map((head) => {
    const headIdStr = head._id.toString();
    const children = (subHeadsByParent.get(headIdStr) || []).map((sub) => {
      const subIdStr = sub._id.toString();
      const directCount = subHeadCountMap.get(subIdStr) || 0;
      const legacyCount = legacyCatCountMap.get(subIdStr) || 0;
      return {
        ...sub,
        transactionCount: Math.max(directCount, legacyCount),
      };
    });

    const directHeadCount = headCountMap.get(headIdStr) || 0;
    const legacyHeadCount = legacyCatCountMap.get(headIdStr) || 0;
    const childrenTotalTx = children.reduce((acc, c) => acc + c.transactionCount, 0);

    return {
      ...head,
      transactionCount: Math.max(directHeadCount, legacyHeadCount, childrenTotalTx),
      subHeads: children,
    };
  });

  const structuredUnparented = unparentedCategories.map((cat) => {
    const catIdStr = cat._id.toString();
    return {
      ...cat,
      transactionCount: legacyCatCountMap.get(catIdStr) || 0,
    };
  });

  return {
    heads: structuredHeads,
    unparented: structuredUnparented,
    totalHeads: structuredHeads.length,
    totalSubHeads: structuredHeads.reduce((acc, h) => acc + h.subHeads.length, 0),
  };
}

/**
 * Creates a new Main Head
 */
export async function createHeadCategory({ companyId, name, code, type, aliases = [] }) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) throw new Error('Head category name is required.');

  const existing = await Category.findOne({
    companyId,
    name: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i'),
    parentCategoryId: null,
  });
  if (existing) {
    throw new Error(`Head category "${trimmedName}" already exists for this company.`);
  }

  const head = await Category.create({
    companyId,
    name: trimmedName,
    code: code ? code.trim().toUpperCase() : undefined,
    type: type || 'OPERATING_EXPENSE',
    isMainHead: true,
    parentCategoryId: null,
    aliases: Array.isArray(aliases) ? aliases.map((a) => a.trim()).filter(Boolean) : [],
    isActive: true,
  });

  return head;
}

/**
 * Creates a new Sub Head under an existing Head
 */
export async function createSubHeadCategory({
  companyId,
  headId,
  parentCategoryId,
  name,
  code,
  type,
  isRentalHead = false,
}) {
  const targetHeadId = headId || parentCategoryId;
  const trimmedName = (name || '').trim();
  if (!trimmedName) throw new Error('Sub Head category name is required.');
  if (!targetHeadId) throw new Error('Parent Head is required for Sub Head.');

  const headDoc = await Category.findOne({ _id: targetHeadId, companyId });
  if (!headDoc) {
    throw new Error('Parent Head category not found in active company.');
  }

  const existing = await Category.findOne({
    companyId,
    name: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i'),
    parentCategoryId: headDoc._id,
  });
  if (existing) {
    throw new Error(`Sub Head "${trimmedName}" already exists under "${headDoc.name}".`);
  }

  const subHead = await Category.create({
    companyId,
    name: trimmedName,
    code: code ? code.trim().toUpperCase() : undefined,
    type: type || headDoc.type,
    isMainHead: false,
    parentCategoryId: headDoc._id,
    isRentalHead: Boolean(isRentalHead),
    isActive: true,
  });

  return subHead;
}

/**
 * Updates a Category (Rename, Move Sub Head to another Head, Toggle Active)
 */
export async function updateCategoryHierarchy({ companyId, categoryId, updateData }) {
  const category = await Category.findOne({ _id: categoryId, companyId });
  if (!category) {
    throw new Error('Category not found in active company.');
  }

  let oldParentId = category.parentCategoryId ? category.parentCategoryId.toString() : null;
  let newParentId = updateData.parentCategoryId !== undefined ? (updateData.parentCategoryId || null) : oldParentId;

  // Moving a Sub Head to another Head
  if (newParentId && newParentId !== oldParentId) {
    const targetParent = await Category.findOne({ _id: newParentId, companyId });
    if (!targetParent) {
      throw new Error('Target parent Head category not found.');
    }
    category.parentCategoryId = targetParent._id;
    category.isMainHead = false;
    if (updateData.type === undefined) {
      category.type = targetParent.type;
    }

    // Synchronize transactions linked to this subHeadId
    await Transaction.updateMany(
      { companyId, subHeadId: category._id },
      { $set: { headId: targetParent._id, head: targetParent.name } }
    );
  } else if (updateData.parentCategoryId === null && oldParentId) {
    // Promoted to top-level
    category.parentCategoryId = null;
    category.isMainHead = true;
  }

  if (updateData.name !== undefined) {
    const trimmed = updateData.name.trim();
    if (!trimmed) throw new Error('Category name cannot be empty.');
    category.name = trimmed;

    // Update text denormalization on transactions
    if (category.isMainHead) {
      await Transaction.updateMany({ companyId, headId: category._id }, { $set: { head: category.name } });
    } else {
      await Transaction.updateMany({ companyId, subHeadId: category._id }, { $set: { subHead: category.name } });
    }
  }

  if (updateData.code !== undefined) {
    category.code = updateData.code ? updateData.code.trim().toUpperCase() : '';
  }
  if (updateData.type !== undefined) {
    category.type = updateData.type;
  }
  if (updateData.isActive !== undefined) {
    category.isActive = Boolean(updateData.isActive);
  }
  if (updateData.isRentalHead !== undefined) {
    category.isRentalHead = Boolean(updateData.isRentalHead);
  }
  if (Array.isArray(updateData.aliases)) {
    category.aliases = updateData.aliases.map((a) => a.trim()).filter(Boolean);
  }

  await category.save();
  return category;
}

/**
 * Deletes a category only if no transactions reference it.
 */
export async function deleteCategoryHierarchy({ companyId, categoryId }) {
  const category = await Category.findOne({ _id: categoryId, companyId });
  if (!category) {
    throw new Error('Category not found in active company.');
  }

  // Check direct usage on transactions
  const directTxCount = await Transaction.countDocuments({
    companyId,
    $or: [{ headId: category._id }, { subHeadId: category._id }, { categoryId: category._id }],
  });

  if (directTxCount > 0) {
    throw new Error(
      `Cannot delete "${category.name}" because it is linked to ${directTxCount} active transaction(s). You can deactivate it instead.`
    );
  }

  // If Main Head, prevent deletion if it still contains child Sub Heads
  if (category.isMainHead || !category.parentCategoryId) {
    const childCount = await Category.countDocuments({ companyId, parentCategoryId: category._id });
    if (childCount > 0) {
      throw new Error(
        `Cannot delete Head "${category.name}" because it still contains ${childCount} Sub Head(s). Please delete or move the Sub Heads first.`
      );
    }
  }

  await Category.deleteOne({ _id: category._id, companyId });
  return { success: true, message: `Category "${category.name}" deleted successfully.` };
}
