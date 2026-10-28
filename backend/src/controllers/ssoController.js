import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret, JWT_EXPIRES_IN } from '../config/jwt.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';

const SSO_ISSUER = 'https://portal.pixxtech.internal';
const ALLOWED_AUDIENCES = ['uk-company', 'uk-expense-tracker'];
const ALLOWED_ALGORITHMS = ['HS256'];

// Atomic in-memory replay prevention cache
const redeemedTickets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [jti, expMs] of redeemedTickets.entries()) {
    if (now > expMs) {
      redeemedTickets.delete(jti);
    }
  }
}, 60000).unref();

const getSSOSecret = () => {
  return process.env.SSO_SECRET || process.env.CENTRAL_PORTAL_SECRET || process.env.JWT_SECRET || 'pixxtech_central_portal_sso_secret_2026';
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Exchange Central Portal SSO authorization ticket for UK Expense Tracker native session
 * POST /api/auth/sso/exchange
 */
export const ssoExchange = async (req, res) => {
  try {
    const { ticket } = req.body;

    if (!ticket || typeof ticket !== 'string') {
      return apiError(res, 'SSO authorization ticket is required.', 400);
    }

    const ssoSecret = getSSOSecret();
    let decoded;

    try {
      decoded = jwt.verify(ticket, ssoSecret, {
        issuer: SSO_ISSUER,
        algorithms: ALLOWED_ALGORITHMS,
      });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return apiError(res, 'SSO authorization ticket has expired. Please launch again from Central Portal.', 401, null, 'TICKET_EXPIRED');
      }
      return apiError(res, `Invalid SSO authorization ticket: ${err.message}`, 401, null, 'TICKET_INVALID');
    }

    // Audience verification
    if (!ALLOWED_AUDIENCES.includes(decoded.aud)) {
      return apiError(res, `Ticket audience mismatch. Expected one of [${ALLOWED_AUDIENCES.join(', ')}], got '${decoded.aud}'.`, 403, null, 'AUDIENCE_MISMATCH');
    }

    // Mandatory claims check
    if (!decoded.jti || !decoded.sub || !decoded.email) {
      return apiError(res, 'SSO ticket is missing mandatory identity claims.', 400);
    }

    // Atomic replay protection
    if (redeemedTickets.has(decoded.jti)) {
      return apiError(res, 'SSO ticket has already been redeemed (replay detected).', 401, null, 'TICKET_REPLAYED');
    }

    const expMs = (decoded.exp || Math.floor(Date.now() / 1000) + 300) * 1000;
    redeemedTickets.set(decoded.jti, expMs);

    const normalizedEmail = decoded.email.toLowerCase().trim();

    // Resolve local operator by email
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return apiError(
        res,
        `No authorized operator record matching '${normalizedEmail}' found in UK Expense Tracker. Please contact administration for local user provisioning.`,
        404,
        null,
        'USER_NOT_MAPPED'
      );
    }

    if (!user.isActive) {
      return apiError(res, 'Operator account is deactivated in UK Expense Tracker.', 403, null, 'USER_DEACTIVATED');
    }

    // Update login timestamp without touching credentials or password
    user.lastLoginAt = new Date();
    await user.save();

    // Mint native JWT token
    const token = generateToken(user._id);

    return apiSuccess(
      res,
      {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          allowedCompanies: user.allowedCompanies,
          activeCompanyId: user.activeCompanyId,
          lastLoginAt: user.lastLoginAt,
        },
      },
      'SSO sign in successful.'
    );
  } catch (error) {
    console.error('[UK SSO Exchange Error]:', error);
    return apiError(res, 'Internal server error during SSO ticket exchange.', 500, error);
  }
};
