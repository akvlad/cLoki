const stream_selector_operator_registry = require('./registry/stream_selector_operator_registry');

/**
 *
 * @returns {registry_types.Request}
 */
module.exports.init_query = () => {
    return {
        select: ['labels', 'string', 'fingerprint', 'timestamp_ms'],
        from: 'samples',
        left_join: [{
            name: 'time_series',
            on: ['AND', 'samples.fingerprint = time_series.fingerprint']
        }],
        limit: 1000
    };
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {registry_types.Request}
 */
module.exports.transpile_log_stream_selector = (token, query) => {
    const rules = token.Children('log_stream_selector_rule');

    for(const rule of rules) {
        const op = rule.Child('operator').value;
        query = stream_selector_operator_registry[op](rule, query);
    }
    return query;
}

/**
 *
 * @param query {registry_types.Request}
 * @returns {string}
 */
module.exports.request_to_str = (query) => {
    let req = `SELECT ${query.select.join(', ')} FROM ${query.from} `;
    for (const clause of query.left_join || []) {
        req += ` LEFT JOIN ${clause.name} ON ${whereBuilder(clause.on)}`;
    }
    req += query.where && query.where.length ? ` WHERE ${whereBuilder(query.where)}` : '';
    req += typeof (query.limit) !== 'undefined' ? ` LIMIT ${query.limit}` : '';
    req += typeof (query.offset) !== 'undefined' ? ` OFFSET ${query.offset}` : '';
    return req;
}

/**
 *
 * @param clause {(string | string[])[]}
 */
const whereBuilder = (clause) => {
    const op = clause[0];
    let _clause = clause.slice(1).map(c => Array.isArray(c) ? `(${whereBuilder(c)})` : c);
    return _clause.join(` ${op} `);
}