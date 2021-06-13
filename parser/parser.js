const registry = {
    parser: require("./parser_registry"),
    log_range_aggregation: require("./log_range_aggregation_registry")
};
const wrapToAsync = (fn) => (..._args) => {
    return new Promise((f,r) => {
        setImmediate(async () => {
            try {
                const res = fn(..._args);
                if (res instanceof Promise) {
                    return f(await res);
                }
                return f(res);
            } catch (e) {
                r(e);
            }
        })
    });
}

/**
 *
 * @param checkers {(function(number, string): Promise<[boolean | Object, number]>)[]}
 * @return {function(number, string): Promise<[boolean | Object, number]>}
 */
const check_next_token = (checkers) => {
    return  wrapToAsync(async (i, str) => {
                    const separators = str.substr(i).match(/^ +/);
                    const _i = separators ? i + separators[0].length : i;
                    for (const c of checkers) {
                        const res = await c(_i, str);
                        if (res[0]) {
                            return res;
                        }
                    }
                    return [false, i];
    });
}

/**
 *
 * @param toks {(string | RegExp)[]}
 * @return {function(number, string): Promise<[boolean | Object, number]>}
 */
const check_next_token_vals = (toks) => check_next_token(
    toks.map((tok) => wrapToAsync((i, str) => {
        if (tok instanceof RegExp) {
            const m = str.substr(i).match(tok);
            if (m) {
                return [{ value: m[0] }, i + m[0].length];
            }
            return [false, i]
        }
        if (str.substr(i).startsWith(tok)) {
            return [{ value: tok }, i + tok.length];
        }
        return [false, i];
    }))
);

/**
 *
 * @param checkers {(function(number, string): [boolean | Object, number])[]}
 * @return {function(number, string): Promise<[boolean | Object, number]>}
 */
const check_next_token_chain = (checkers) =>
    wrapToAsync(async (i, str) => {
        let _i = i;
        const res = []
        for (const c of checkers) {
            const _res = await check_next_token([c])(_i, str);
            if (!_res[0]) {
                return [false, i];
            }
            res.push(_res[0]);
            _i = _res[1];
        }
        return [res, _i];
    })

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const request = wrapToAsync(async (i, str) => {
    const res = await check_next_token([log_stream_selector, log_range_aggregation, aggregation_operator])(i,str);
    return res[0] && res[1] !== str.length ? [false, i] : res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const log_stream_selector = wrapToAsync(async (i, str) => {
    const parsed = await check_next_token_chain([
        check_next_token_vals(["{"]),
        log_stream_selector_rule,
        opt_log_stream_selector_rule,
        check_next_token_vals(["}"]),
        opt_log_pipeline
    ])(i, str);
    return parsed[0] ? [{
        type: "log_stream_selector",
        rules: [
            parsed[0][1],
            ...(parsed[0][2] === false || parsed[0][2] === true ? [] : parsed[0][2].rules)
        ],
        pipeline: parsed[0][4] === true ? null : parsed[0][4]
    }, parsed[1]] : [false, i];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const log_stream_selector_rule = wrapToAsync(async (i, str) => {
    const parsed = await check_next_token_chain([
        label,
        operator,
        quoted_str
    ])(i, str);
    return parsed[0] ? [{
        type: "log_stream_selector_rule",
        label: parsed[0][0],
        op: parsed[0][1],
        val: parsed[0][2]
    }, parsed[1]] : [false, i];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const label = wrapToAsync(async (i, str) => {
    const res = await check_next_token_vals([/[a-zA-Z0-9_]+(?![a-zA-Z0-9_])/])(i, str);
    return res[0] ? [
        {type: "label", ...res[0]},
        res[1]
    ] : [false, i];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const operator = wrapToAsync(async (i, str) => {
    const res = await check_next_token_vals([/(!=|=~|!~|=)/])(i,str);
    return res[0] ? [
        { type: "operator", ...res[0]},
        res[1]
    ] : [false, i];
})

const _quoted_str = (c) => wrapToAsync((i, str) => {
                let _i = i;
                if (str[_i] !== c) {
                    return [false, i];
                }
                ++_i;
                let esc = false;
                let val = "";
                while (true) {
                    if (_i === str.length) {
                        return [false, i];
                    }
                    if (esc) {
                        val += str[_i];
                        esc = false;
                    } else if (str[_i] === c) {
                        return [{ value: val }, _i+1];
                    } else if (str[_i] === "\\") {
                        esc = true;
                    } else {
                        val += str[_i];
                    }
                    ++_i;
                }
        })

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const quoted_str = _quoted_str('"');

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const opt_log_stream_selector_rule = wrapToAsync(async (i, str) => {
    const comma = await check_next_token_vals([","])(i, str);
    if (!comma[0]) {
        return [true, i];
    }
    let _i = comma[1];
    let rule = await check_next_token_chain([
        log_stream_selector_rule,
        opt_log_stream_selector_rule
    ])(_i,str);
    if (!rule[0]) {
        return [false, i];
    }
    _i = rule[1];
    return [{
        type: 'opt_log_stream_selector_rule',
        rules: [
            rule[0][0],
            ...(rule[0][1] === true ? [] : rule[0][1].rules)
        ]
    }, _i];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const opt_log_pipeline = wrapToAsync(async (i, str) => {
    const pipeline = await check_next_token([log_pipeline])(i, str);
    if (!pipeline[0]) {
        return [true, i];
    }
    const pipelines = await check_next_token([opt_log_pipeline])(pipeline[1],str);
    if (!pipelines[0]) {
        return [false, i];
    }
    return [{
        type: 'opt_log_pipeline',
        pipelines: [
            pipeline[0],
            ...(pipelines[0] === true ? [] : pipelines[0].pipelines)
        ]
    }, pipelines[1]];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const log_pipeline = wrapToAsync(async (i, str) => {
    return await check_next_token([
        line_filter_expression,
        parser_expression,
        label_filter_expression,
        line_format_expression,
        labels_format_expression
        //TODO: unwrap_expression
    ])(i, str);
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const line_filter_expression = wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        line_filter_operator,
        quoted_str
    ])(i, str);
    if (!res[0]) {
        return [false, i];
    }
    return [{
        type: 'line_filter_expression',
        op: res[0][0],
        value: res[0][1]
    }, res[1]];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const line_filter_operator = wrapToAsync(async (i, str) => {
    const res = await check_next_token_vals([/(\|=|!=|\|~|!~)/])(i, str);
    return res[0] ? [{type: 'line_filter_operator', ...res[0]}, res[1]] : res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const parser_expression = wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        check_next_token_vals(["|"]),
        parser_fn_name,
        opt_parameters
    ])(i,str);
    if (!res[0]) {
        return [false, i];
    }
    return [{
        type: "parser_expression",
        fn: res[0][1],
        params: res[0][2] === true ? null : res[0][2].params
    }, res[1]];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const parser_fn_name = wrapToAsync(async (i, str) => {
    const keys = Object.keys(registry.parser);
    const res = await check_next_token_vals(keys)(i, str);
    return res[0] ? [{ type: 'parser_fn_name', ...res[0] }, res[1]]: res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const opt_parameters = wrapToAsync(async (i, str) => {
    const param = await check_next_token([
        parameter
    ])(i,str);
    if (!param[0]) {
        return [true, i];
    }
    const params = await check_next_token([
        opt_comma_separated_parameters
    ])(param[1], str);
    return [{
        type: 'opt_parameters',
        params: [
            param[0],
            ...(params[0] === true ? [] : params[0].params)
        ]
    }, params[1]]
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const parameter = wrapToAsync(async (i, str) => {
    let parameter = await check_next_token_chain([
        label,
        check_next_token_vals(["="]),
        quoted_str
    ])(i,str);
    if (parameter[0]) {
        return [{
            type: 'parameter',
            label: parameter[0][0].value,
            value: parameter[0][2].value
        }, parameter[1]]
    }
    parameter = await check_next_token([quoted_str])(i,str);
    return parameter[0] ? [{
        type: 'parameter',
        label: null,
        value: parameter[0].value
    }, parameter[1]] : parameter;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const opt_comma_separated_parameters = wrapToAsync(async (i, str) => {
    const comma = await check_next_token_vals([","])(i, str);
    if (!comma[0]) {
        return [true, i];
    }
    const params = await check_next_token_chain([
        parameter,
        opt_comma_separated_parameters
    ])(i, str);
    if (!params[0]) {
        return [false, i];
    }
    return [{
        type: 'opt_comma_separated_parameters',
        params: [
            params[0][0],
            ...(params[0][1] === true ? [] : params[0][1].params)
        ]
    }, params[1]];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const label_filter_expression = wrapToAsync(async (i, str) => {
    const ln = await check_next_token_chain([
        check_next_token_vals(["|"]),
        check_next_token([
            string_label_filter_expression,
            number_label_filter_expression
        ])
    ])(i, str);
    if (!ln[0]) {
        return ln;
    }
    return [ln[0][1], ln[1]];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const string_label_filter_expression = wrapToAsync(async (i, str) => {
    //<label> <operator> <string_label_filter_expression_right_hand>
    const res = await check_next_token_chain([
        label,
        operator,
        string_label_filter_expression_right_hand
    ])(i, str);
    return res[0] ? [{
        type: 'string_label_filter_expression',
        label: res[0][0],
        operator: res[0][1],
        right: res[0][2]
    }, res[1]]: res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const string_label_filter_expression_right_hand = wrapToAsync(async (i, str) => {
    return await check_next_token([
        quoted_str,
        backticked_str
    ])(i, str);
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const backticked_str = _quoted_str("`");

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const number_label_filter_expression = wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        label,
        number_operator,
        number_value
    ])(i,str);
    if (!res[0]) {
        return res;
    }
    return [{
        type: 'number_label_filter_expression',
        label: res[0][0],
        op: res[0][1],
        value: res[0][2]
    }, res[1]];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const number_operator = wrapToAsync(async (i, str) => {
    return await check_next_token_vals([/(==|!=|>=|<=|>|<)/])(i, str);
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const number_value = wrapToAsync(async (i, str) => {
    return await check_next_token([
        duration_value,
        bytes_value,
        floating_point_value
    ])(i, str);
})

const _number_value = (tp, measurements) => wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        floating_point_value,
        check_next_token_vals([measurements])
    ])(i, str);
    if (!res[0]) {
        return res;
    }
    return [{
        type: tp,
        value: res[0][0],
        measure: res[0][1]
    }, res[1]];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const duration_value = _number_value('duration_value', /(ns|us|ms|s|m|h)/);

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const bytes_value = _number_value('bytes_value', /(b|kib|kb|mb|mib|gib|gb|lib|tb|pib|pb|eib|eb)/);

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const floating_point_value = wrapToAsync((i, str) => {
    return check_next_token_vals([/^[0-9]+(\.[0-9]+)?/])(i, str);
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const line_format_expression = wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        check_next_token_vals(["|"]),
        check_next_token_vals(["line_format"]),
        string_label_filter_expression_right_hand
    ])(i, str);
    return res[0] ? [{
        type: 'line_format_expression',
        value: res[0][2]
    }, res[1]] : res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const labels_format_expression = wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        check_next_token_vals(["|"]),
        check_next_token_vals(["label_format"]),
        labels_format_expression_param,
        opt_labels_format_expression_param
    ])(i, str);
    return res[0] ? [{
        type: 'labels_format_expression',
        params: [
            res[0][2],
            ...(res[0][3] === true ? [] : res[0][3].params)
        ]
    }, res[1]] : res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const labels_format_expression_param = wrapToAsync((i, str) => {
    return check_next_token([
        label_rename_param,
        label_inject_param
    ])(i,str);
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const label_rename_param = wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        label,
        check_next_token_vals(["="]),
        label
    ])(i, str);
    return res[0] ? [{
        type: 'label_rename_param',
        label: res[0][0],
        value: res[0][2]
    }, res[1]] : res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const label_inject_param = wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        label,
        check_next_token_vals(["="]),
        string_label_filter_expression_right_hand
    ])(i, str);
    return res[0] ? [{
        type: 'label_inject_param',
        label: res[0][0],
        value: res[0][2]
    }, res[1]] : res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const opt_labels_format_expression_param = wrapToAsync(async (i, str) => {
    const coma = await check_next_token_vals([","])(i, str);
    if (!coma[0]) {
        return [true, i];
    }
    const res = await check_next_token_chain([
        labels_format_expression_param,
        opt_labels_format_expression_param
    ])(i, str);
    return res[0] ? [{
        type: 'opt_labels_format_expression_param',
        params: [
            res[0][0],
            ...(res[0][1] === true ? [] : res[0][1].params)
        ]
    }, res[1]] : res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const log_range_aggregation = wrapToAsync(async (i, str) => {
    //<log_range_aggregation_fn> "(" <log_stream_selector> "[" <duration_value> "]" ")"
    const res = await check_next_token_chain([
        log_range_aggregation_fn,
        check_next_token_vals(["("]),
        log_stream_selector,
        check_next_token_vals(['[']),
        duration_value,
        check_next_token_vals([']']),
        check_next_token_vals([')'])
    ])(i, str);
    return res[0] ? [{
        type: 'log_range_aggregation',
        fn: res[0][0],
        selector: res[0][2],
        duration: res[0][4]
    }, res[1]] : res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const log_range_aggregation_fn = wrapToAsync((i, str) => {
    return check_next_token_vals(Object.keys(registry.log_range_aggregation))(i, str);
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const aggregation_operator = wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        aggregation_operator_fn,
        check_next_token_vals(["("]),
        opt_aggregation_operator_param,
        log_range_aggregation,
        opt_by_without,
        check_next_token_vals([")"])
    ])(i, str);
    return res[0] ? [{
        type: 'aggregation_operator',
        fn: res[0][0],
        opt_param: res[0][1],
        agg: res[0][2],
        by_without: res[0][3]
    }, res[1]] : res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const aggregation_operator_fn = wrapToAsync( async (i, str) => {
    return await check_next_token_vals([
        Object.keys(require('./high_level_aggregation_registry'))
    ])(i, str);
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const opt_aggregation_operator_param = wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        check_next_token_vals([/0-9+/]),
        check_next_token_vals([","])
    ]);
    return res[0] ? [{
        type: 'opt_aggregation_operator_param',
        value: res[0][0]
    }, res[1]] : [true, i];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const opt_by_without = wrapToAsync( async (i, str) => {
    //<by_without> "(" <label_list> ")" | ""
    const res = await check_next_token_chain([
        by_without,
        check_next_token_vals(["("]),
        label_list,
        check_next_token_vals([")"])
    ])(i, str);
    return res[0] ? [{
        type: 'opt_by_without',
        by_without: res[0][0],
        label_list: res[0][2]
    }, res[1]]: [true, i];
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const by_without = wrapToAsync( (i, str) => {
    return check_next_token_vals(["by", "without"])(i, str);
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const label_list = wrapToAsync(async (i, str) => {
    const res = await check_next_token_chain([
        label,
        opt_comma_separated_labels
    ])(i, str);
    return res[0] ? [{
        type: 'label_list',
        labels: [
            res[0][0],
            ...(res[0][1] === true ? [] : res[0][1].labels)
        ]
    }, res[1]] : res;
})

/**
 *
 * @param i {number}
 * @param str {string}
 * @return Promise<[boolean | Object, number]>
 */
const opt_comma_separated_labels = wrapToAsync(async (i, str) => {
    const comma = await check_next_token_vals([","])(i, str);
    if (!comma[0]) {
        return [true, i];
    }
    const res = await check_next_token_chain([
        label,
        opt_comma_separated_labels
    ])(i, str);
    return res[0] ? [{
        type: 'opt_comma_separated_labels',
        labels: [
            res[0][0],
            ...(res[0][1] === true ? [] : res[0][1].labels)
        ]
    }, res[1]] : res;
})

module.exports = {
    request: request,

    log_stream_selector: log_stream_selector,

    log_stream_selector_rule: log_stream_selector_rule,
    label: label,
    operator: operator,
    quoted_str: quoted_str,
    opt_log_stream_selector_rule: opt_log_stream_selector_rule,

    opt_log_pipeline: opt_log_pipeline,
    log_pipeline: log_pipeline,

    line_filter_expression: line_filter_expression,
    line_filter_operator: line_filter_operator,

    parser_expression: parser_expression,
    parser_fn_name: parser_fn_name,
    opt_parameters: opt_parameters,
    parameter: parameter,
    opt_comma_separated_parameters: opt_comma_separated_parameters,

    label_filter_expression: label_filter_expression,

    string_label_filter_expression: string_label_filter_expression,
    string_label_filter_expression_right_hand: string_label_filter_expression_right_hand,
    backticked_str: backticked_str,

    number_label_filter_expression: number_label_filter_expression,
    number_operator: number_operator,
    number_value: number_value,
    duration_value: duration_value,
    bytes_value: bytes_value,
    floating_point_value: floating_point_value,

    line_format_expression: line_format_expression,

    labels_format_expression: labels_format_expression,
    labels_format_expression_param: labels_format_expression_param,
    label_rename_param: label_rename_param,
    label_inject_param: label_inject_param,
    opt_labels_format_expression_param: opt_labels_format_expression_param,

    log_range_aggregation: log_range_aggregation,
    log_range_aggregation_fn: log_range_aggregation_fn,

    aggregation_operator: aggregation_operator,
    aggregation_operator_fn: aggregation_operator_fn,
    opt_aggregation_operator_param: opt_aggregation_operator_param,
    opt_by_without: opt_by_without,
    by_without: by_without,
    label_list: label_list,
    opt_comma_separated_labels: opt_comma_separated_labels,
    check_next_token: check_next_token,
    check_next_token_vals: check_next_token_vals
}