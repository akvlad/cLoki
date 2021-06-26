const casual = require('casual');
const fastify = require('fastify');
const axios = require('axios');
const logfmt = require('logfmt');
const isInsertBenchmarkEnabled = () => process.env.BENCHMARK && process.env.INSERT_BENCHMARK

const randWords = (min, max) => casual.words(Math.round(Math.random() * (max-min)) + min);

/**
 *
 * @param options? {{labels: {number}, fingerprints: {number}}}
 * @returns {[string, string][][]}
 */
const genFingerprints = (options) => {
    options = options || {};
    const labels = new Array(options.labels || 10).fill('').map(() =>
        randWords(1,2).replace(/[^a-zA-Z0-9_]/, '_')
    );
    const fingerprints = new Array(options.fingerprints || 1000).fill([]).map(() =>
        labels.map(l => [l, randWords(1, 5)])
    );
    return fingerprints;
}

/**
 *
 * @param labels {string[][]}
 * @returns {Object<string, string>}
 */
const labelsToJson = (labels) => labels.reduce((sum, lbl) => {
    sum[lbl[0]] = lbl[1];
    return sum;
}, {});

/**
 *
 * @type {[string, string][][]}
 */
let fingerprints = genFingerprints();

const genLog = [
    /**
     * Random str
     * @returns {string}
     */
    () => randWords(5, 10),
    /**
     * Random JSON str
     * @returns {string}
     */
    () => {
        const fp = casual.random_element(fingerprints);
        const jsn = [
            casual.random_element(fp),
            casual.random_element(fp),
            ...((new Array(8)).fill([]).map(() => [randWords(1,2), randWords(1,5)]))
        ];
        return JSON.stringify(labelsToJson(jsn));
    },
    /**
     * Random logfmt str
     * @returns {string}
     */
    () => {
        const fp = casual.random_element(fingerprints);
        const jsn = [
            casual.random_element(fp),
            casual.random_element(fp),
            ...((new Array(8)).fill([]).map(() => [randWords(1,2), randWords(1,5)]))
        ];
        return logfmt.stringify(labelsToJson(jsn));
    }

];

/**
 *
 * @param amount {number}
 * @returns {Promise<void>}
 */
const sendPoints = async (amount, fromMs, toMs) => {
    let points = {};
    for (let i=0; i < amount; i++) {
        const fp = casual.random_element(fingerprints);
        const strFp = JSON.stringify(fp);
        points[strFp] = points[strFp] || {stream: labelsToJson(fp), values: []};
        points[strFp].values.push([
            casual.integer(fromMs, toMs) * 1000000,
            casual.random_element(genLog)()
        ]);
    }
    await axios.post('http://localhost:3100/loki/api/v1/push', {
        streams: Object.values(points)
    });
};

/**
 *
 * @param startMs {number}
 * @param endMs {number}
 * @param points {number}
 */
const logResults = (startMs, endMs, points) => {
    const time = endMs - startMs;
    console.log(`Sent ${points} logs, ${time}ms (${Math.round(points * 1000 / time)} logs/s)`);
}

/**
 * @param pointsPerReq {number}
 * @param reqsPersSec {number}
 * @param testLengthMs {number}
 * @param fromMs? {number}
 * @param toMs? {number}
 * @returns {Promise<void>}
 */
const insertData = async (pointsPerReq, reqsPersSec, testLengthMs, fromMs, toMs) => {
    console.log(`Sending ${pointsPerReq} logs/req, ${reqsPersSec} reqs/sec - ${testLengthMs} msecs...`)
    let sendPromises = [];
    let sentPoints = 0;
    fromMs = fromMs || (new Date()).getTime() - 3600 * 2 * 1000;
    toMs = toMs || (new Date()).getTime();
    let start = new Date();
    const i = setInterval(() => {
        sendPromises.push(sendPoints(pointsPerReq, fromMs, toMs));
        sentPoints += pointsPerReq;
    }, 1000 / reqsPersSec);
    await new Promise(f => setTimeout(f, testLengthMs));
    clearInterval(i);
    await Promise.all(sendPromises);
    let end = new Date();
    logResults(start.getTime(), end.getTime(), sentPoints);
}
let l = null;
beforeAll(() => {
    l = require("../cloki");
})
afterAll(() => {
    l.stop();
})
jest.setTimeout(300000);
it('should insert data', async () => {
    if (!isInsertBenchmarkEnabled()) {
        return;
    }
    await new Promise(f => setTimeout(f, 500));
    for (const i of [1, 10,100]) {
        for(const j of [1,10,100]) {
            await insertData(i, j, 10000);
        }
    }
    console.log("Sending 1 000 000 logs as fast as I can");
    const start = new Date()
    for(let i = 0; i < 1000; i++) {
        await sendPoints(1000);
    }
    logResults(start.getTime(), (new Date()).getTime(), 1000000);
});
