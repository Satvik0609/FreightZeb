/**
 * Pagination helpers
 * Supports both offset pagination (default) and cursor pagination.
 */

/**
 * Parse offset pagination params from query string.
 * @param {object} query  req.query
 * @param {number} maxLimit   hard cap on limit
 * @param {number} defaultLimit
 * @returns {{ page, limit, skip }}
 */
function parsePagination(query = {}, maxLimit = 100, defaultLimit = 20) {
  const rawPage  = parseInt(query.page,  10);
  const rawLimit = parseInt(query.limit, 10);

  const page  = Number.isFinite(rawPage)  && rawPage  > 0 ? rawPage  : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, maxLimit)
    : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Build a standardised paginated response envelope.
 * @param {any[]}  data
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 */
function paginatedResponse(data, total, page, limit) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

module.exports = { parsePagination, paginatedResponse };