const bnf = require('./bnf');
const transpiler = require('./transpiler');

it('should transpile log_stream_selector', () => {
    const script = bnf.ParseScript('{label1="val1", label2="val2"}');
    const query = transpiler.transpile_log_stream_selector(script.rootToken, transpiler.init_query());
    const strQuery = transpiler.request_to_str(query);
    console.log(query);
    console.log(strQuery);
});