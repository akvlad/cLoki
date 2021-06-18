const bnf = require('./bnf');

it('should compile', () => {
    const res = bnf.ParseScript("bytes_rate({run=\"kokoko\",u_ru_ru!=\"lolol\",zozo=~\"sssss\"}  |~\"atltlt\" !~   \"rmrmrm\" [5m])");
    expect(res.rootToken.Children('log_stream_selector_rule').map(c => c.value)).toEqual(
        [ 'run="kokoko"', 'u_ru_ru!="lolol"', 'zozo=~"sssss"' ]
    );
    expect(res.rootToken.Children('log_pipeline').map(c => c.value)).toEqual(
        [ '|~"atltlt"', '!~   "rmrmrm"' ]
    );
});