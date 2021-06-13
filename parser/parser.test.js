const parser = require("./parser");

const stream_selector_ast = {
    "type":"log_stream_selector",
    "rules":[
        {
            "type":"log_stream_selector_rule",
            "label":{"type":"label","value":"run"},
            "op":{"type":"operator","value":"="},
            "val":{"value":"kokoko"}
        },
        {
            "type":"log_stream_selector_rule",
            "label":{"type":"label","value":"u_ru_ru"},
            "op":{"type":"operator","value":"!="},
            "val":{"value":"lolol"}
        },
        {
            "type":
                "log_stream_selector_rule",
            "label":{"type":"label","value":"zozo"},
            "op":{"type":"operator","value":"=~"},
            "val":{"value":"sssss"}
        }
    ],
    "pipeline":{
        "type":"opt_log_pipeline",
        "pipelines":[
            {
                "type":"line_filter_expression",
                "op":{"type":"line_filter_operator","value":"|~"},
                "value":{"value":"atltlt"}
            },
            {
                "type":"line_filter_expression",
                "op":{"type":"line_filter_operator","value":"!~"},
                "value":{"value":"rmrmrm"}
            }
        ]
    }
};

it('request', async () => {
    expect(await parser.request(0, '{run="kokoko",u_ru_ru!="lolol",zozo=~"sssss"}  |~"atltlt" !~   "rmrmrm"'))
        .toEqual([stream_selector_ast ,71]
    );
    expect(
        await parser.request(0, 'bytes_rate({run="kokoko",u_ru_ru!="lolol",zozo=~"sssss"}  |~"atltlt" !~   "rmrmrm" [5m])')
    ).toEqual([{
        "type":"log_range_aggregation",
        "fn":{"value":"bytes_rate"},
        "selector": stream_selector_ast,
        "duration":{"type":"duration_value","value":{"value":"5"},"measure":{"value":"m"}}
    }, 88]);
});

it('log_stream_selector', async () => {
    expect(await parser.log_stream_selector(
        0,
        '{run="kokoko",u_ru_ru!="lolol",zozo=~"sssss"}  |~"atltlt" !~   "rmrmrm"'))
        .toEqual([stream_selector_ast, 71]);
    expect(await parser.log_stream_selector(
        0,
        '{run="kokoko",u_ru_ru   !=   "lolol",zozo=~"sssss"}  |~"atltlt" !~   "rmrmrm"'))
        .toEqual([stream_selector_ast, 77]);
    expect(await parser.log_stream_selector(
        0,
        '{run="kokoko",u_ru_ru   !=   "lolol",zo-zo=~"sssss"}  |~"atltlt" !~   "rmrmrm"'))
        .toEqual([false, 0]);
});

it('log_stream_selector_rule', async () => {});
it('label', async () => {});
it('operator', async () => {});
it('quoted_str', async () => {});
it('opt_log_stream_selector_rule', async () => {});

it('opt_log_pipeline', async () => {});

it('log_pipeline', async () => {
    expect(await parser.log_pipeline(0," |   json lbl1=\"tatata.lololo[\\\"ururu\\\"][1]\""))
        .toEqual([
            {
                "type":"parser_expression",
                "fn":{"type":"parser_fn_name","value":"json"},
                "params":[{"type":"parameter","label":"lbl1","value":"tatata.lololo[\"ururu\"][1]"}]
            },
            44
        ]);
    expect(await parser.log_pipeline(0," |   json lb-l1=\"tatata.lololo[\\\"ururu\\\"][1]\""))
        .toEqual([
            {
                "type":"parser_expression",
                "fn":{"type":"parser_fn_name","value":"json"},
                "params": null
            },
            10
        ]);
    expect(await parser.log_pipeline(0," |~   json lb-l1=\"tatata.lololo[\\\"ururu\\\"][1]\""))
        .toEqual([false, 0]);
    expect(await parser.log_pipeline(0," |   jsin lb-l1=\"tatata.lololo[\\\"ururu\\\"][1]\""))
        .toEqual([false, 0]);
});

it('line_filter_expression', async () => {});
it('line_filter_operator', async () => {});

it('parser_expression', async () => {});
it('parser_fn_name', async () => {});
it('opt_parameters', async () => {});
it('parameter', async () => {});
it('opt_comma_separated_parameters', async () => {});

it('label_filter_expression', async () => {});

it('string_label_filter_expression', async () => {});
it('string_label_filter_expression_right_hand', async () => {});
it('backticked_str', async () => {});

it('number_label_filter_expression', async () => {});
it('number_operator', async () => {});
it('number_value', async () => {});
it('duration_value', async () => {});
it('bytes_value', async () => {});
it('floating_point_value', async () => {});

it('line_format_expression', async () => {});

it('labels_format_expression', async () => {});
it('labels_format_expression_param', async () => {});
it('label_rename_param', async () => {});
it('label_inject_param', async () => {});
it('opt_labels_format_expression_param', async () => {});

it('log_range_aggregation', async () => {});
it('log_range_aggregation_fn', async () => {});

it('aggregation_operator', async () => {});
it('aggregation_operator_fn', async () => {});
it('opt_aggregation_operator_param', async () => {});
it('opt_by_without', async () => {});
it('by_without', async () => {});
it('label_list', async () => {});
it('opt_comma_separated_labels', async () => {});
it('check_next_token', async () => {});
it('check_next_token_vals', async () => {});
