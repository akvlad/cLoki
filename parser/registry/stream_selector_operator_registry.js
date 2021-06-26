const _i = () => { throw new Error('Not implemented'); };
module.exports = {
    "!=": _i,
    "=~": _i,
    "!~": _i,
    /**
     *
     * @param token {Token}
     * @param query {registry_types.Request}
     * @returns {registry_types.Request}
     */
    "=": (token, query) => {
        query = {...query};
        if (!query.where) {
            query.where = ['AND'];
        } else if (query.where[0] !== 'AND') {
            query.where = ['AND', query.where];
        } else {
            query.where = [...query.where];
        }
        const label = token.Child('label').value;
        const value = token.Child('quoted_str').value;
        query.where.push(
            `JSONHas(labels, '${label}')`,
            `JSONExtractString(labels, '${label}') = '${value.substr(1, value.length-2)}'`
        );
        return query;
    }
};