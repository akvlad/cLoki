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

it("should check_next_token", () => {
    console.log(parser.check_next_token(0, "    alala", [(i, str) => {
        return [str.substr(i), i];
    }]));
    console.log(parser.check_next_token_vals([/(al)+/])(1, "     alala"));
});

it("should parse log", async () => {
    expect(await parser.request(0, '{run="kokoko",u_ru_ru!="lolol",zozo=~"sssss"}  |~"atltlt" !~   "rmrmrm"'))
        .toEqual([stream_selector_ast ,71]
    );
    expect(await parser.log_pipeline(0," |   json lbl1=\"tatata.lololo[\"ururu\"][1]\""))
        .toEqual([
            {
                "type":"parser_expression",
                "fn":{"type":"parser_fn_name","value":"json"},
                "params":[{"type":"parameter","label":"lbl1","value":"tatata.lololo["}]}
            ,31
        ]);
    expect(
        await parser.request(0, 'bytes_rate({run="kokoko",u_ru_ru!="lolol",zozo=~"sssss"}  |~"atltlt" !~   "rmrmrm" [5m])')
    ).toEqual([{
        "type":"log_range_aggregation",
        "fn":{"value":"bytes_rate"},
        "selector": stream_selector_ast,
        "duration":{"type":"duration_value","value":{"value":"5"},"measure":{"value":"m"}}
    }, 88]);
});